import {AreaRunner,areaFormula,basicMultiplier} from './area.mjs';
import {normalizeState,transition} from './state.mjs';
import {catalogue} from './catalogue.mjs';
import {assertFreshIntent} from './requests.mjs';
import {nativeDamageContext} from './native-damage.mjs';
const MOD='gunbreaker-pf2e';
const esc=s=>foundry.utils.escapeHTML(String(s));
const degreeNames=['criticalFailure','failure','success','criticalSuccess'];
const position=t=>({uuid:t.document.uuid,x:t.document.x,y:t.document.y,elevation:t.document.elevation,width:t.document.width,height:t.document.height});
const samePosition=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const itemFor=(actor,slug)=>actor.items.find(i=>(i.slug??i.system?.slug)===slug&&i.system.publication?.title?.includes('1.4.0'));
const damageClass=()=>{const cls=CONFIG.Dice.rolls.find(r=>r.name==='DamageRoll');if(!cls)throw Error('Native PF2e damage rolls are unavailable.');return cls;};
export function areaSaveEvidence(message,actorUuid){
  const roll=message?.rolls?.[0];
  if(!message?.isCheckRoll||message.flags?.pf2e?.context?.type!=='saving-throw'||(actorUuid&&message.actor?.uuid!==actorUuid)||message.isReroll||message.flags?.pf2e?.context?.isReroll||![0,1,2,3].includes(roll?.degreeOfSuccess))throw Error('A save changed, was rerolled, or has no native outcome. Reconcile this activity.');
  return {degree:roll.degreeOfSuccess,messageId:message.id,fingerprint:JSON.stringify(roll.toJSON())};
}
export function scaledAreaDamage(DamageRoll,data,multiplier){
  if(![0,0.5,1,2].includes(multiplier))throw Error('Invalid basic-save damage multiplier.');
  const roll=DamageRoll.fromJSON(JSON.stringify(data)).alter(multiplier,0);
  roll.options.degreeOfSuccess=null;
  return roll;
}
export function createAreaRunner({authority,contextFor,actorToken,weaponFor},queue){
  const privateJournals=new Set();
  const check=(actor,request)=>{
    authority(actor,request);
    if(game.users.filter(u=>u.active&&u.isGM).length!==1)throw Error('Area automation requires exactly one active GM.');
  };
  const inspect=(actor,request)=>{
    check(actor,request);
    if(['unconscious','paralyzed','stunned'].some(c=>actor.hasCondition(c)))throw Error('This character cannot act.');
    if((game.combat?.turns.filter(t=>t.actor?.uuid===actor.uuid).length??0)!==1)throw Error('Area automation requires exactly one combatant for the actor.');
    const item=itemFor(actor,request.slug);if(!item)throw Error('Update this ability from the v1.4 compendium first.');
    const weapon=weaponFor(actor,request.weaponId),self=actorToken(actor);
    if(self.document.parent.id!==canvas.scene?.id)throw Error('The acting token must be on the active scene.');
    const dc=actor.getStatistic('gunbreaker')?.dc?.value;
    if(!Number.isFinite(dc)||dc<1)throw Error('A native Gunbreaker class DC is required; another class DC cannot substitute.');
    if(!game.pf2e.settings.iwr)throw Error('Enable native PF2e immunity, weakness and resistance automation first.');
    return {item,weapon,self,dc};
  };
  const verifyTargets=async(actor,prepared,completed=[])=>{
    const self=actorToken(actor);
    if(!samePosition(position(self),prepared.origin))throw Error('The origin moved after area confirmation.');
    for(const t of prepared.targets){
      const doc=await fromUuid(t.uuid),token=doc?.object;
      if(!token?.actor||token.actor.uuid!==t.actorUuid||!samePosition(position(token),t.position)||!actor.isEnemyOf(token.actor)||(token.actor.isDead&&!completed.includes(t.uuid))||self.distanceTo(token)>5)throw Error('An affected target moved, changed allegiance, died, or left the area. Reconcile before continuing.');
    }
  };
  const verifySaves=progress=>{
    for(const saved of progress.saves){
      if(areaSaveEvidence(game.messages.get(saved.messageId)).fingerprint!==saved.fingerprint)throw Error('A saved result changed; automatic damage is stopped for GM reconciliation.');
    }
  };
  return new AreaRunner({
    authorize:check,
    journal:a=>{
      const marker=a.getFlag(MOD,'execution');
      if(!marker?.journalId||marker.status==='complete'||marker.status==='canceled')return marker;
      // Pending journals are not replayed on reconnect. Keep detailed enemy/save data GM-private.
      return privateJournals.has(marker.journalId)?game.messages.get(marker.journalId)?.getFlag(MOD,'areaJournal')??{...marker,status:'recovery'}:{...marker,status:'recovery'};
    },
    saveJournal:async(a,j)=>{
      authority(a);
      const marker=a.getFlag(MOD,'execution');let log;
      if(marker?.id===j.id&&marker.journalId){
        if(!privateJournals.has(marker.journalId))throw Error('This area journal requires GM reconciliation after reconnect.');
        log=game.messages.get(marker.journalId);if(!log)throw Error('The private area journal was deleted.');
        await log.setFlag(MOD,'areaJournal',j);
      }else{
        log=await ChatMessage.create({author:game.user.id,whisper:game.users.filter(u=>u.isGM).map(u=>u.id),
          content:`<p>Gunbreaker area journal: ${esc(j.slug)}. Keep this record for interruption recovery.</p>`,flags:{[MOD]:{areaJournal:j}}});
        if(!log?.id)throw Error('The private area journal could not be created.');privateJournals.add(log.id);
      }
      await a.setFlag(MOD,'execution',{id:j.id,slug:j.slug,status:j.status,journalId:log.id,revision:j.revision??null});
    },
    read:a=>a.getFlag(MOD,'tracker'),write:(a,s)=>{authority(a);return a.setFlag(MOD,'tracker',s);},
    prepare:async(actor,request)=>{
      const {self,dc}=inspect(actor,request),c=contextFor(actor),raw=actor.getFlag(MOD,'tracker');
      const expected={revision:raw?.revision??0,encounterId:c.encounterId,round:c.round,turn:c.turn};
      if(request.intent||request.expected)assertFreshIntent(request.intent??request.expected,c,raw);
      let state=normalizeState(raw,c);
      const original=request.slug==='fated-brand'?state.continuation?.targets:null;
      if(request.slug==='fated-brand'&&!original?.length)throw Error('Fated Brand has no eligible original targets.');
      const tokens=canvas.tokens.placeables.filter(t=>t.actor&&t.actor.uuid!==actor.uuid&&actor.isEnemyOf(t.actor)&&!t.actor.isDead&&self.distanceTo(t)<=5&&(!original||original.includes(t.document.uuid)));
      // Do not put hidden target identities into an owner-readable Continuation state.
      if(tokens.some(t=>t.document.hidden))throw Error('This area requires GM adjudication outside the automated target workflow.');
      if(!tokens.length)throw Error('No eligible enemy remains within the 5-foot emanation.');
      if(tokens.length>50)throw Error('This prototype supports at most 50 targets; adjudicate this area manually.');
      if(new Set(tokens.map(t=>t.actor.uuid)).size!==tokens.length)throw Error('Multiple target tokens share a creature; adjudicate this area manually.');
      const candidates=tokens.map(t=>({uuid:t.document.uuid,actorUuid:t.actor.uuid,name:t.name,hidden:!!t.document.hidden,position:position(t)}));
      c.targetIds=candidates.map(t=>t.uuid);
      if(state.encounter!==c.encounterId)state=transition(state,{type:'start'},c,catalogue);
      transition(state,{type:'use',slug:request.slug,outcome:request.slug==='fated-circle'?'none':undefined},c,catalogue);
      const origin=position(self);
      const selected=await foundry.applications.api.DialogV2.wait({window:{title:`${catalogue[request.slug].name} — Confirm area`},rejectClose:false,
        content:`<p>5-foot emanation · Gunbreaker DC ${dc}. Check every affected enemy. Exclude only creatures blocked by geometry or another rule.</p>${candidates.map(t=>`<label><input type="checkbox" name="target" value="${esc(t.uuid)}" checked> ${esc(t.name)}</label>`).join('')}<label><input type="checkbox" name="verified"> I verified the area, line of effect, and genuine enemy targets.</label><p>Confirming begins the activity. Canceling a later save requires recovery and cannot refund the activity.</p>`,
        buttons:[{action:'confirm',label:'Begin activity',callback:(_e,b)=>b.form.elements.verified.checked?[...b.form.querySelectorAll('input[name="target"]:checked')].map(e=>e.value):null}]});
      if(!selected)return null;
      if(!selected.length)throw Error('At least one affected enemy is required.');
      return {origin,expected,dc,weaponId:request.weaponId,targets:candidates.filter(t=>selected.includes(t.uuid)),privateResults:!!self.document.hidden||candidates.some(t=>t.hidden)};
    },
    validate:async(actor,request,prepared)=>{
      const {dc}=inspect(actor,request),c=contextFor(actor);
      assertFreshIntent(prepared.expected,c,actor.getFlag(MOD,'tracker'));
      if(dc!==prepared.dc)throw Error('The class DC changed after area confirmation.');
      await verifyTargets(actor,prepared);
      for(const t of prepared.targets){const doc=await fromUuid(t.uuid);if(!doc.actor.saves?.reflex?.check)throw Error('A target has no native Reflex save.');}
      return {...c,targetIds:prepared.targets.map(t=>t.uuid),dc,origin:prepared.origin,prepared,weaponId:prepared.weaponId};
    },
    damage:async(actor,request,c,prepared,state)=>{
      const formula=areaFormula(request.slug,c.level,state.calibration),DamageRoll=damageClass();
      const roll=await new DamageRoll(formula).evaluate();
      const item=itemFor(actor,request.slug);
      const options=[...actor.getSelfRollOptions('self'),...item.getRollOptions('item'),'area-damage','damaging-effect',`origin:action:slug:${request.slug}`];
      const message=await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:catalogue[request.slug].name,
        flags:{[MOD]:{execution:request.id},pf2e:{suppressDamageButtons:true,context:{type:'damage-roll',sourceType:'save',options}}}},
        {messageMode:prepared.privateResults?'gm':game.settings.get('core','messageMode')});
      if(!message?.id)throw Error('Damage evidence could not be saved.');
      return {formula,roll:roll.toJSON(),fingerprint:JSON.stringify(roll.toJSON()),messageId:message.id,options};
    },
    save:async(actor,request,c,t)=>{
      inspect(actor,request);await verifyTargets(actor,c.prepared);
      const now=contextFor(actor);if(now.encounterId!==c.encounterId||now.round!==c.round||now.turn!==c.turn||!now.inTurn)throw Error('Combat advanced during the activity.');
      const token=await fromUuid(t.uuid),item=itemFor(actor,request.slug);let messageId=null;
      const roll=await token.actor.saves.reflex.check.roll({dc:{value:c.dc,slug:'gunbreaker'},origin:actor,item,token,damaging:true,
        extraRollOptions:['area-damage','damaging-effect'],traits:[...item.system.traits.value],
        messageMode:c.prepared.privateResults?'gm':undefined,
        callback:(_roll,_outcome,message)=>{messageId=message?.id??null;}});
      if(!roll)return null;
      return areaSaveEvidence(game.messages.get(messageId),t.actorUuid);
    },
    review:async(actor,request,c,prepared,progress)=>{
      verifySaves(progress);
      const rows=progress.saves.map((s,i)=>({...s,name:prepared.targets[i].name,multiplier:basicMultiplier(s.degree)}));
      const selected=await foundry.applications.api.DialogV2.wait({window:{title:'Review area damage'},rejectClose:false,
        content:`<p>One damage roll: ${esc(progress.damage.formula)}. Native save outcomes are recorded below. Adjust damage only for a rule such as Improved Evasion; this does not change who failed the save.</p>${rows.map((r,i)=>`<label>${esc(r.name)} · ${degreeNames[r.degree]} <select name="scale${i}">${[0,0.5,1,2].map(n=>`<option value="${n}" ${n===r.multiplier?'selected':''}>${n}× damage</option>`).join('')}</select></label>`).join('')}<label><input type="checkbox" name="verified"> These results are ready. No other control or module has applied this damage; no unresolved reaction, reroll or damage redirection remains.</label>`,
        buttons:[{action:'apply',label:'Apply reviewed damage once',callback:(_e,b)=>b.form.elements.verified.checked?rows.map((r,i)=>({target:r.target,multiplier:Number(b.form.elements[`scale${i}`].value)})):null}]});
      if(!selected)return null;
      inspect(actor,request);await verifyTargets(actor,prepared);verifySaves(progress);
      const now=contextFor(actor);if(now.encounterId!==c.encounterId||now.round!==c.round||now.turn!==c.turn||!now.inTurn)throw Error('Combat advanced before damage resolution.');
      return selected;
    },
    apply:async(actor,request,c,prepared,progress,row)=>{
      inspect(actor,request);verifySaves(progress);await verifyTargets(actor,prepared,progress.applications.filter(a=>a.status==='complete').map(a=>a.target));
      const damageMessage=game.messages.get(progress.damage.messageId);
      if(JSON.stringify(damageMessage?.rolls?.[0]?.toJSON())!==progress.damage.fingerprint)throw Error('The area damage roll changed.');
      const roll=scaledAreaDamage(damageClass(),progress.damage.roll,row.multiplier);
      const saved=progress.saves.find(s=>s.target===row.target);
      // Doubling a failed basic save is not a critical attack; never give it critical-hit IWR semantics.
      const token=await fromUuid(row.target),item=itemFor(actor,request.slug);
      const options=[...progress.damage.options,`gunbreaker:save:degree:${saved.degree}`];
      const {clone,rollOptions}=await nativeDamageContext(token.actor,{actor,item,flags:{pf2e:{context:{options}}}});
      check(actor,request);verifySaves(progress);
      await clone.applyDamage({damage:roll,token,item,rollOptions,skipIWR:false,shieldBlockRequest:false,outcome:degreeNames[saved.degree]});
    },
    summary:async(actor,request,progress)=>{
      const content=`<p><strong>${esc(catalogue[request.slug].name)}</strong> resolved. ${progress.saves.length} native saves; one damage roll; costs and combo updated.</p><ul>${progress.prepared.targets.map(t=>{const save=progress.saves.find(s=>s.target===t.uuid),row=progress.review.find(r=>r.target===t.uuid);return `<li>${esc(t.name)}: ${degreeNames[save.degree]}, ${row.multiplier}× damage.</li>`;}).join('')}</ul>`;
      const whisper=progress.prepared.privateResults?game.users.filter(u=>u.isGM).map(u=>u.id):[];
      await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content,whisper,flags:{[MOD]:{execution:request.id}}});
    }
  },queue);
}
