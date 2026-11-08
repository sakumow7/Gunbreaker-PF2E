import {normalizeState,transition} from './state.mjs';
import {catalogue} from './catalogue.mjs';
import {assertFreshIntent} from './requests.mjs';
import {createSavePorts,nativePosition} from './area-native.mjs';
import {SUPPORT_ACTIONS,SUPPORT_TARGETED,supportEffect,damageReceipt,supportActive} from './support.mjs';
const MOD='gunbreaker-pf2e',assert=(ok,m)=>{if(!ok)throw Error(m);},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const get=(effect)=>effect.flags?.[MOD]?.support;
const activeEffects=(actor)=>actor.items.filter(i=>i.type==='effect'&&supportActive(i,game.time.worldTime));
const actors=()=>[...new Map([...game.actors,...(canvas.tokens?.placeables??[]).map(t=>t.actor),...(game.combat?.turns??[]).map(t=>t.actor)].filter(Boolean).map(a=>[a.uuid,a])).values()];
const coordinator=()=>game.user.isGM&&game.users.filter(u=>u.active&&u.isGM).length===1;
const busy=a=>['reserved','committed','recovery'].includes(a.getFlag(MOD,'execution')?.status);
const hp=a=>a.hitPoints??a.system.attributes.hp;
const esc=s=>foundry.utils.escapeHTML(String(s));
export function createSupportRunner(deps,queue){
  const {authority,contextFor,actorToken,weaponFor}=deps,ports=createSavePorts(deps),inflight=new Map();
  const inspect=(actor,req)=>{
    ports.authorize(actor,req);assert(SUPPORT_ACTIONS.has(req.slug),'Unknown support ability.');
    assert(!actor.isDead&&!['unconscious','paralyzed','stunned'].some(c=>actor.hasCondition(c)),'This character cannot act.');
    assert(actor.items.some(i=>(i.slug??i.system.slug)===req.slug&&i.system.publication?.title?.includes('1.4.0')),'Update the support action from the v1.4 compendium.');
    weaponFor(actor,req.weaponId);const self=actorToken(actor);assert(self.document.parent.id===canvas.scene?.id,'View the source scene.');return self;
  };
  async function execute(actor,req){
    const self=inspect(actor,req),c=contextFor(actor),raw=actor.getFlag(MOD,'tracker'),prior=await ports.journal(actor);
    if(prior?.id===req.id&&['complete','canceled'].includes(prior.status))return prior;
    assert(!busy(actor),'Resolve the pending action first.');assert(typeof req.id==='string'&&req.id.length>0&&req.id.length<=100,'Invalid execution ID.');
    assert(!req.options||!Object.keys(req.options).length,'This support ability has no optional resource riders.');
    if(req.intent||req.expected)assertFreshIntent(req.intent??req.expected,c,raw);
    const range=req.slug==='heart-of-light'?15:30,ids=req.targetIds??c.targetIds;
    assert(!SUPPORT_TARGETED.has(req.slug)||ids.length<=1,'Choose one recipient, or no target for yourself.');
    const selected=SUPPORT_TARGETED.has(req.slug)?[ids.length?(await fromUuid(ids[0]))?.object:self]:canvas.tokens.placeables.filter(t=>t.actor&&(t.actor.uuid===actor.uuid||actor.isAllyOf(t.actor))&&self.distanceTo(t)<=range);
    assert(selected.length>0&&selected.length<=50,'No valid recipients.');
    assert(selected.every(t=>t?.actor&&!t.actor.isDead&&(t.actor.uuid===actor.uuid||actor.isAllyOf(t.actor))&&t.document.parent.id===canvas.scene.id&&!t.document.hidden&&t.isVisible!==false&&self.distanceTo(t)<=range),'Choose visible allies in range.');
    assert(new Set(selected.map(t=>t.actor.uuid)).size===selected.length,'Multiple tokens share a recipient actor.');
    if(req.slug==='aurora'){
      assert(selected[0].actor.modeOfBeing==='living','Aurora requires a living recipient.');
      if(c.encounterId)assert(game.combat.turns.filter(t=>t.actor?.uuid===selected[0].actor.uuid).length===1,'Aurora needs one recipient combatant for turn timing.');
    }
    const validRecipients=()=>selected.every(t=>t?.actor&&!t.actor.isDead&&(t.actor.uuid===actor.uuid||actor.isAllyOf(t.actor))&&t.document.parent.id===canvas.scene.id&&!t.document.hidden&&t.isVisible!==false&&self.distanceTo(t)<=range)&&(req.slug!=='aurora'||selected[0].actor.modeOfBeing==='living');
    const positions=selected.map(nativePosition),origin=nativePosition(self),expected={revision:raw?.revision??0,encounterId:c.encounterId,round:c.round,turn:c.turn};
    const confirmed=await foundry.applications.api.DialogV2.confirm({window:{title:catalogue[req.slug].name},content:`<p>Apply to ${selected.map(t=>esc(t.name)).join(', ')}? Confirm range, line of effect and ally eligibility.</p>`,rejectClose:false});
    if(!confirmed)return {id:req.id,status:'canceled'};
    return queue.runMany([actor,...selected.map(t=>t.actor)],async()=>{
      inspect(actor,req);assert(!busy(actor),'Resolve the pending action first.');const now=contextFor(actor);assertFreshIntent(expected,now,actor.getFlag(MOD,'tracker'));
      assert(validRecipients(),'Recipient eligibility changed during confirmation.');
      assert(same(origin,nativePosition(actorToken(actor)))&&selected.every((t,i)=>same(positions[i],nativePosition(t))),'A recipient moved during confirmation.');
      let before=normalizeState(actor.getFlag(MOD,'tracker'),now);if(now.encounterId&&before.encounter!==now.encounterId)before=transition(before,{type:'start'},now,catalogue);
      if(before.events.includes(req.id))return {id:req.id,status:'complete'};
      const after=transition(before,{type:'use',slug:req.slug,id:req.id},{...now,targetIds:selected.map(t=>t.document.uuid)},catalogue);
      if(req.slug==='aurora')assert(!(selected[0].actor.getFlag(MOD,'auroraImmunity')??[]).some(x=>x.source===actor.uuid&&x.until>now.time),'This recipient is immune to your Aurora.');
      let journal={id:req.id,slug:req.slug,status:'committed',before,recipients:[],revision:after.revision};await ports.saveJournal(actor,journal);
      try{
        await ports.write(actor,after);
        for(const t of selected){
          inspect(actor,req);assertFreshIntent({...expected,revision:after.revision},contextFor(actor),actor.getFlag(MOD,'tracker'));assert(validRecipients(),'Recipient eligibility changed before effects were applied.');journal.recipients.push({actor:t.actor.uuid,status:'applying'});await ports.saveJournal(actor,journal);
          if(req.slug==='aurora'){
            const immunity=(t.actor.getFlag(MOD,'auroraImmunity')??[]).filter(x=>x.until>now.time&&x.source!==actor.uuid);
            await t.actor.setFlag(MOD,'auroraImmunity',[...immunity,{source:actor.uuid,until:now.time+600}]);
          }
          const data=supportEffect(req.slug,actor,{...now,sourceToken:self.document.uuid,combatTurn:game.combat?.turn??-1,recipientIndex:game.combat?.turns.findIndex(x=>x.actor?.uuid===t.actor.uuid)??-1},t.actor,req.id);
          const created=await t.actor.createEmbeddedDocuments('Item',[data]);assert(created?.some(e=>get(e)?.id===req.id&&get(e)?.kind===req.slug),'The support effect was not created; reconcile its committed cost.');journal.recipients.at(-1).status='complete';await ports.saveJournal(actor,journal);
        }
        journal.status='complete';await ports.saveJournal(actor,journal);return journal;
      }catch(e){await ports.saveJournal(actor,{...journal,status:'recovery',error:e.message});throw e;}
    });
  }
  return {execute:(actor,req)=>{const key=`${actor.uuid}:${req.id}`;if(inflight.has(key))return inflight.get(key);const task=execute(actor,structuredClone(req));inflight.set(key,task);return task.finally(()=>inflight.delete(key));}};
}
export function createSupportLifecycle(queue){
  async function heal(actor,amount,options=[]){
    assert(coordinator(),'One active GM is required.');assert(!actor.isDead,'Cannot heal a dead creature.');
    const tokens=actor.getActiveTokens();assert(tokens.length===1,'Healing needs one active recipient token.');
    await actor.applyDamage({damage:-amount,token:tokens[0].document,rollOptions:new Set(options)});
  }
  async function tick(actor,event){
    return queue.run(actor,async()=>{
      assert(coordinator(),'One active GM is required.');
      const effects=activeEffects(actor).filter(e=>get(e).kind==='aurora');
      const eligible=effects.filter(e=>{const s=get(e);return s.ticks<3&&!s.events.includes(event.id)&&(event.encounterId?s.encounterId===event.encounterId&&s.recipientCombatant===event.combatantId&&event.round>=s.nextRound:!s.encounterId&&event.time>=s.nextTime);});
      if(!eligible.length)return;
      assert(!busy(actor),'Resolve pending recipient damage before Aurora.');
      // A separate FastHealing rule may create another healing card/module application. Stop rather than stack it.
      assert(!actor.rules?.some(r=>r.key==='FastHealing'&&!r.ignored),'Another fast-healing/regeneration workflow needs GM reconciliation.');
      const missed=eligible.filter(e=>{const s=get(e);return event.encounterId?event.round!==s.nextRound:event.time!==s.nextTime;});
      if(missed.length){for(const e of missed)await e.setFlag(MOD,'support',{...get(e),status:'recovery',error:'Aurora missed a recipient turn or six-second interval.'});throw Error('Aurora missed a recipient turn; reconcile healing in Recovery.');}
      const updates=eligible.map(e=>{const s=get(e);return {_id:e.id,[`flags.${MOD}.support`]:{...s,status:'applying',events:[...s.events,event.id],ticks:s.ticks+1,nextRound:s.nextRound===null?null:s.nextRound+1,nextTime:s.nextTime+6}};});
      await actor.updateEmbeddedDocuments('Item',updates);
      try{
        if(!actor.isDead)await heal(actor,Math.max(...eligible.map(e=>get(e).value)),['healing','gunbreaker:aurora']);
        await actor.updateEmbeddedDocuments('Item',updates.map(u=>({...u,[`flags.${MOD}.support`]:{...u[`flags.${MOD}.support`],status:u[`flags.${MOD}.support`].ticks>=3?'complete':'active'}})));
        const done=updates.filter(u=>u[`flags.${MOD}.support`].ticks>=3).map(u=>u._id);if(done.length)await actor.deleteEmbeddedDocuments('Item',done);
      }catch(e){for(const u of updates)await actor.items.get(u._id)?.setFlag(MOD,'support',{...u[`flags.${MOD}.support`],status:'recovery',error:e.message});throw e;}
    });
  }
  async function damage(message,creator){
    const receipt=damageReceipt(message);if(!receipt)return;
    const actor=await fromUuid(receipt.actorUuid),user=game.users.get(creator);
    assert(actor&&user&&message.author?.id===creator&&actor.testUserPermission(user,'OWNER'),'Unverified native damage receipt.');
    const snapshot={hp:hp(actor).value,max:hp(actor).max};if(actor.isDead||snapshot.hp>snapshot.max/2)return;
    return queue.run(actor,async()=>{
      assert(coordinator(),'One active GM is required.');
      if(actor.isDead)return;assert(hp(actor).value===snapshot.hp&&hp(actor).max===snapshot.max,'HP changed before Corundum resolved; reconcile the damage receipt.');
      const corundums=activeEffects(actor).filter(e=>get(e).kind==='heart-of-corundum'&&get(e).healing==='armed');
      if(corundums.length>1){for(const effect of corundums)await effect.setFlag(MOD,'support',{...get(effect),healing:'recovery',error:'Overlapping Corundum effects need GM adjudication.'});throw Error('Overlapping Corundum healing needs Recovery; no healing was applied.');}
      for(const effect of corundums){
        const s=get(effect);await effect.setFlag(MOD,'support',{...s,healing:'applying',events:[...s.events,receipt.id]});
        try{
          const roll=await new Roll(`2d8+${s.level}`).evaluate();
          await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:'Heart of Corundum healing',flags:{pf2e:{suppressDamageButtons:true},[MOD]:{corundum:receipt.id}}});
          await heal(actor,roll.total,['healing','gunbreaker:corundum']);await effect.setFlag(MOD,'support',{...s,healing:'complete',events:[...s.events,receipt.id]});
        }catch(e){await effect.setFlag(MOD,'support',{...s,healing:'recovery',events:[...s.events,receipt.id],error:e.message});throw e;}
      }
    });
  }
  async function reconcile(actor,{reconnect=false}={}){
    return queue.run(actor,async()=>{
      assert(coordinator(),'One active GM is required.');
      for(const effect of actor.items.filter(i=>i.type==='effect'&&i.flags?.[MOD])){
        const s=get(effect);
        if(s?.kind==='aurora'){
          if(s.status==='complete'){await actor.deleteEmbeddedDocuments('Item',[effect.id]);continue;}
          if(s.status!=='active')continue;
          const combat=game.combat?.started?game.combat:null;
          const missed=reconnect&&(s.encounterId||game.time.worldTime>s.nextTime);
          if(missed){await effect.setFlag(MOD,'support',{...s,status:'recovery',error:'Aurora timing crossed a disconnected session; reconcile completed healing.'});continue;}
          if(s.encounterId&&combat?.id!==s.encounterId){
            await effect.setFlag(MOD,'support',{...s,encounterId:null,recipientCombatant:null,nextRound:null,nextTime:game.time.worldTime+6});
          }else if(!s.encounterId&&combat){
            const matches=combat.turns.filter(t=>t.actor?.uuid===actor.uuid);
            if(matches.length!==1){await effect.setFlag(MOD,'support',{...s,status:'recovery',error:'Aurora needs exactly one recipient combatant.'});continue;}
            const index=combat.turns.indexOf(matches[0]);
            await effect.setFlag(MOD,'support',{...s,encounterId:combat.id,recipientCombatant:matches[0].id,nextRound:combat.round+(combat.turn>=index?1:0)});
          }
          continue;
        }
        // PF2e clears TempHP on deleting its owning effect, not merely on expiry.
        // Respect native source-initiative expiry and leave unrelated module effects alone.
        if(effect.flags[MOD].execution&&effect.remainingDuration?.expired&&(!s||s.status==='active')&&!['applying','recovery'].includes(s?.healing))await actor.deleteEmbeddedDocuments('Item',[effect.id]);
      }
    });
  }
  return {tick,damage,reconcile};
}
export function installSupportHooks(queue){
  const lifecycle=createSupportLifecycle(queue),warn=e=>ui.notifications.warn(`Gunbreaker support: ${e.message}`);
  Hooks.on('pf2e.startTurn',(combatant,combat)=>{if(coordinator()&&combatant.actor)void lifecycle.tick(combatant.actor,{id:`${combat.id}:${combat.round}:${combatant.id}`,encounterId:combat.id,combatantId:combatant.id,round:combat.round}).catch(warn);});
  Hooks.on('createChatMessage',(message,_options,userId)=>{if(coordinator()&&damageReceipt(message))void lifecycle.damage(message,userId).catch(warn);});
  Hooks.on('updateWorldTime',time=>{if(coordinator()&&!game.combat?.started)for(const actor of actors())void lifecycle.tick(actor,{id:`time:${time}`,time}).catch(warn);});
  const reconcileAll=(options)=>{if(coordinator())for(const actor of actors())void lifecycle.reconcile(actor,options).catch(warn);};
  Hooks.on('updateCombat',()=>reconcileAll());
  Hooks.on('deleteCombat',()=>reconcileAll());
  Hooks.on('updateWorldTime',()=>reconcileAll());
  reconcileAll({reconnect:true});
  return lifecycle;
}
