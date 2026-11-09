import {ReignRunner,REIGN_STEPS} from './reign.mjs';
import {createSavePorts,nativePosition} from './area-native.mjs';
import {assertFreshIntent} from './requests.mjs';
import {catalogue} from './catalogue.mjs';
const MOD='gunbreaker-pf2e';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const esc=s=>foundry.utils.escapeHTML(String(s));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function reignAttackEvidence(message,actorUuid,weaponId,targetUuid){
  const roll=message?.rolls?.[0],context=message?.flags?.pf2e?.context;
  assert(message?.isCheckRoll&&context?.type==='attack-roll'&&context.action==='strike'&&!message.isReroll&&!context.isReroll
    &&message.actor?.uuid===actorUuid&&message.item?.id===weaponId&&context.target?.token===targetUuid&&[0,1,2,3].includes(roll?.degreeOfSuccess),'The Reign attack evidence is missing, changed or rerolled.');
  return {degree:roll.degreeOfSuccess,messageId:message.id,fingerprint:JSON.stringify(roll.toJSON())};
}
export function createReignRunner(deps,queue){
  const {contextFor,actorToken,weaponFor,strikeFor}=deps,save=createSavePorts(deps);
  const tokenData=t=>({uuid:t.document.uuid,actorUuid:t.actor.uuid,name:t.name,position:nativePosition(t)});
  const inspect=(actor,request)=>{
    save.authorize(actor,request);
    assert(REIGN_STEPS.has(request.slug),'Unknown Reign action.');
    assert(!['unconscious','paralyzed','stunned'].some(c=>actor.hasCondition(c)),'This character cannot act.');
    const item=actor.items.find(i=>(i.slug??i.system?.slug)===request.slug&&i.system.publication?.title?.includes('1.4.0'));
    assert(item,'Update the Reign action from the v1.4 compendium.');
    assert((game.combat?.turns.filter(t=>t.actor?.uuid===actor.uuid).length??0)===1,'Reign requires exactly one combatant.');
    const self=actorToken(actor),weapon=weaponFor(actor,request.weaponId),reach=actor.getReach({action:'attack',weapon});
    assert(self.document.parent.id===canvas.scene?.id,'The actor must be on the active scene.');
    const dc=actor.getStatistic('gunbreaker')?.dc?.value;
    assert(Number.isFinite(dc)&&dc>0&&game.pf2e.settings.iwr,'Reign requires native Gunbreaker DC and IWR.');
    return {self,weapon,reach,dc,item};
  };
  const verify=async(actor,request,c,prepared,progress)=>{
    const {self,reach}=inspect(actor,request),now=contextFor(actor);
    assert(now.encounterId===c.encounterId&&now.round===c.round&&now.turn===c.turn&&now.inTurn,'Combat advanced during the Reign action.');
    assert(same(nativePosition(self),prepared.origin)&&reach===prepared.profile.range,'The Reign origin or melee reach changed.');
    const primary=(await fromUuid(prepared.primary.uuid))?.object;
    assert(primary?.actor?.uuid===prepared.primary.actorUuid&&same(nativePosition(primary),prepared.primary.position)&&!primary.document.hidden&&primary.isVisible!==false
      &&actor.isEnemyOf(primary.actor)&&self.distanceTo(primary)<=reach,'The primary Reign target moved or changed.');
    if(!progress?.attack)assert(!primary.actor.isDead,'The primary enemy is already dead.');
    const completed=progress?.applications.filter(a=>a.status==='complete').map(a=>a.target)??[];
    for(const data of prepared.selected?prepared.targets:prepared.candidates){
      const t=(await fromUuid(data.uuid))?.object;
      assert(t?.actor?.uuid===data.actorUuid&&!t.document.hidden&&t.isVisible!==false&&same(nativePosition(t),data.position)&&actor.isEnemyOf(t.actor)
        &&(!t.actor.isDead||completed.includes(data.uuid))&&self.distanceTo(t)<=reach&&primary.distanceTo(t)<=5,'A secondary Reign target changed, moved or left adjacency/reach.');
    }
    if(progress?.attack){
      const evidence=reignAttackEvidence(game.messages.get(progress.attack.messageId),actor.uuid,prepared.weaponId,prepared.primary.uuid);
      assert(evidence.fingerprint===progress.attack.fingerprint,'The Reign attack changed after resolution.');
    }
    if(progress?.primaryDamage){
      const m=game.messages.get(progress.primaryDamage.messageId);
      assert(m?.isDamageRoll&&same(m.rolls?.[0]?.toJSON(),progress.primaryDamage.roll),'The primary damage evidence changed.');
    }
  };
  return new ReignRunner({...save,
    prepare:async(actor,request)=>{
      const {self,weapon,reach,dc}=inspect(actor,request),c=contextFor(actor),raw=actor.getFlag(MOD,'tracker');
      if(request.intent||request.expected)assertFreshIntent(request.intent??request.expected,c,raw);
      assert(Number.isInteger(request.map??0)&&(request.map??0)>=0&&(request.map??0)<=2,'Choose a valid MAP stage.');
      const ids=request.targetIds??c.targetIds;assert(ids?.length===1,'Select one primary enemy.');
      const primary=(await fromUuid(ids[0]))?.object;
      assert(primary?.actor&&primary.document.parent.id===self.document.parent.id&&primary.actor.uuid!==actor.uuid&&actor.isEnemyOf(primary.actor)&&!primary.actor.isDead&&primary.isVisible!==false&&!primary.document.hidden&&self.distanceTo(primary)<=reach,'Select a visible enemy within melee reach.');
      const candidates=canvas.tokens.placeables.filter(t=>t.actor&&t.actor.uuid!==actor.uuid&&t.document.uuid!==primary.document.uuid&&actor.isEnemyOf(t.actor)&&!t.actor.isDead&&self.distanceTo(t)<=reach&&primary.distanceTo(t)<=5);
      assert(candidates.every(t=>!t.document.hidden&&t.isVisible!==false),'Secondary visibility needs manual GM adjudication.');
      return {origin:nativePosition(self),primary:tokenData(primary),candidates:candidates.map(tokenData),targets:[],selected:false,
        profile:{name:catalogue[request.slug].name,shape:'target',range:reach},weaponId:weapon.id,dc,privateResults:!!self.document.hidden,
        expected:{revision:raw?.revision??0,encounterId:c.encounterId,round:c.round,turn:c.turn}};
    },
    validate:async(actor,request,prepared)=>{
      const {dc}=inspect(actor,request),c={...contextFor(actor),targetIds:[prepared.primary.uuid],weaponId:prepared.weaponId};
      assertFreshIntent(prepared.expected,c,actor.getFlag(MOD,'tracker'));assert(dc===prepared.dc,'The Gunbreaker DC changed.');
      await verify(actor,request,c,prepared);return {...c,dc};
    },
    attack:async(actor,request,c,prepared)=>{
      await verify(actor,request,c,prepared);
      const target=(await fromUuid(prepared.primary.uuid)).object;let messageId;
      const roll=await strikeFor(actor,prepared.weaponId).variants[request.map??0].roll({target,options:[`gunbreaker:action:${request.slug}`],callback:(_r,_o,m)=>{messageId=m?.id;}});
      if(!roll)return null;
      return reignAttackEvidence(game.messages.get(messageId),actor.uuid,prepared.weaponId,prepared.primary.uuid);
    },
    preCommit:async(actor,request,c,prepared,progress)=>{
      assertFreshIntent(prepared.expected,contextFor(actor),actor.getFlag(MOD,'tracker'));
      await verify(actor,request,c,prepared,progress);
    },
    consumeOpening:async(actor,request)=>{
      if(request.slug!=='reign-of-beasts')return;
      const ids=actor.items.filter(i=>i.type==='effect'&&(i.slug??i.system?.slug)==='ready-to-reign'&&i.flags?.[MOD]?.execution).map(i=>i.id);
      if(ids.length)await actor.deleteEmbeddedDocuments('Item',ids);
    },
    verify,
    primaryDamage:async(actor,request,c,prepared,progress)=>{
      const target=(await fromUuid(prepared.primary.uuid)).object,message=game.messages.get(progress.attack.messageId);
      // PF2e returns a DamageRoll (its callback also receives only that roll), not the card.
      // Match one newly created native card to the returned roll; ambiguous evidence needs recovery.
      const existing=new Set([...game.messages.values()].map(m=>m.id));
      const roll=await strikeFor(actor,prepared.weaponId)[progress.attack.degree===3?'critical':'damage']({target,mapIncreases:request.map??0,
        checkContext:message.flags.pf2e.context,options:new Set([`gunbreaker:action:${request.slug}`])});
      if(!roll)return null;
      const cards=[...game.messages.values()].filter(m=>!existing.has(m.id)&&m.isDamageRoll&&m.actor?.uuid===actor.uuid
        &&m.item?.id===prepared.weaponId&&m.flags?.pf2e?.context?.sourceType==='attack'
        &&m.flags.pf2e.context.target?.token===prepared.primary.uuid&&same(m.rolls?.[0]?.toJSON(),roll.toJSON()));
      assert(cards.length===1&&roll.options?.degreeOfSuccess===progress.attack.degree,'Native primary Strike damage evidence is unavailable or ambiguous.');
      return {messageId:cards[0].id,roll:structuredClone(roll.toJSON()),application:'native-card-controls'};
    },
    choose:async(actor,request,c,prepared,progress)=>{
      if(!prepared.candidates.length)return [];
      await verify(actor,request,c,prepared,progress);
      for(;;){
        const selected=await foundry.applications.api.DialogV2.wait({window:{title:'Reign secondary enemies'},rejectClose:false,
          content:`<p>The primary Strike hit. Apply its damage and resolve its reactions through the normal native card controls after this workflow completes. Choose up to two other enemies within your reach and adjacent to the primary target. Confirm geometry before proceeding. Secondary saves do not inherit the primary critical result.</p>${prepared.candidates.map(t=>`<label><input type="checkbox" name="secondary" value="${esc(t.uuid)}"> ${esc(t.name)}</label>`).join('')}`,
          buttons:[{action:'continue',label:'Resolve selected enemies (0–2)',callback:(_e,b)=>[...b.form.querySelectorAll('input[name="secondary"]:checked')].map(e=>e.value)}]});
        if(!selected||selected.length<=2)return selected;
        ui.notifications.warn('Select at most two secondary enemies.');
      }
    },
    summary:async(actor,request,progress)=>{
      const count=progress.saves.length;
      await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),whisper:progress.prepared.privateResults?game.users.filter(u=>u.isGM).map(u=>u.id):[],
        content:`<p><strong>${esc(catalogue[request.slug].name)}</strong>: ${progress.attack.degree>=2?'hit':'miss'}; combo updated. ${progress.attack.degree>=2?'Primary damage remains on its native card controls.':''} ${count} secondary saves resolved${count?' with one shared fire damage roll':''}.</p>`,flags:{[MOD]:{execution:request.id}}});
    }
  },queue);
}
