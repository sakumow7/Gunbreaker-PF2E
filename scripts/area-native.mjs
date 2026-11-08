import {tempHPEffect} from './riders.mjs';
import {resolvedOptions} from './options.mjs';
import {AreaRunner,areaFormula,areaProfile,areaPersistentFormula,basicMultiplier} from './area.mjs';
import {normalizeState,transition} from './state.mjs';
import {catalogue} from './catalogue.mjs';
import {assertFreshIntent} from './requests.mjs';
import {REIGN_STEPS,reignFormula} from './reign.mjs';
import {LineRegionService} from './line-native.mjs';
import {nativeDamageContext} from './native-damage.mjs';
const MOD='gunbreaker-pf2e';
const esc=s=>foundry.utils.escapeHTML(String(s));
const degreeNames=['criticalFailure','failure','success','criticalSuccess'];
export const nativePosition=t=>({uuid:t.document.uuid,x:t.document.x,y:t.document.y,elevation:t.document.elevation,width:t.document.width,height:t.document.height,level:t.document.level,depth:t.document.depth,shape:t.document.shape});
const samePosition=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const itemFor=(actor,slug)=>actor.items.find(i=>(i.slug??i.system?.slug)===slug&&i.system.publication?.title?.includes('1.4.0'));
const saveOptions=profile=>['damaging-effect',...(profile.shape!=='target'?['area-damage']:[])];
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
/** Combine evaluated native instances; never reroll or multiply deferred persistent damage. */
export function combinedSaveDamage(DamageRoll,data,multiplier,persistentData=null){
  if(![0,0.5,1,2].includes(multiplier))throw Error('Invalid basic-save damage multiplier.');
  if(!persistentData)return scaledAreaDamage(DamageRoll,data,multiplier);
  const persistent=DamageRoll.fromJSON(JSON.stringify(persistentData));
  if(!persistent.instances.length||persistent.instances.some(i=>!i.persistent||i.options.evaluatePersistent))throw Error('Persistent damage must remain deferred.');
  const immediate=multiplier>0?scaledAreaDamage(DamageRoll,data,multiplier):null;
  const Pool=persistent.terms[0].constructor;
  const roll=DamageRoll.fromTerms([Pool.fromRolls([...(immediate?.instances??[]),...persistent.instances])]);
  roll.options.degreeOfSuccess=null;
  return roll;
}
export function createSavePorts({authority,contextFor,actorToken,weaponFor},{automatic=false,allowEmpty=false,formulaFor=null}={}){
  const privateJournals=new Set(),lines=new LineRegionService();
  const check=(actor,request)=>{
    authority(actor,request);
    if(game.users.filter(u=>u.active&&u.isGM).length!==1)throw Error('Area automation requires exactly one active GM.');
  };
  const inspect=(actor,request)=>{
    check(actor,request);
    if((automatic?['unconscious']:['unconscious','paralyzed','stunned']).some(c=>actor.hasCondition(c)))throw Error('This character cannot act.');
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
    if(!samePosition(nativePosition(self),prepared.origin))throw Error('The origin moved after area confirmation.');
    const region=prepared.line?await lines.read(prepared.line):null;
    if(region){
      const eligible=canvas.tokens.placeables.filter(t=>t.actor&&t.actor.uuid!==actor.uuid&&actor.isEnemyOf(t.actor)&&(!t.actor.isDead||completed.includes(t.document.uuid))&&lines.contains(region,t,prepared.line)).map(t=>t.document.uuid).sort();
      if(JSON.stringify(eligible)!==JSON.stringify(prepared.lineCandidates))throw Error('The enemies within the confirmed line changed.');
    }
    for(const t of prepared.targets){
      const doc=await fromUuid(t.uuid),token=doc?.object;
      if(!token?.actor||token.actor.uuid!==t.actorUuid||token.document.hidden||!samePosition(nativePosition(token),t.position)||!actor.isEnemyOf(token.actor)||(token.actor.isDead&&!completed.includes(t.uuid))||(region?!lines.contains(region,token,prepared.line):self.distanceTo(token)>prepared.profile.range))throw Error('An affected target moved, changed visibility or allegiance, died, or left range. Reconcile before continuing.');
    }
  };
  const verifySaves=progress=>{
    for(const saved of progress.saves){
      if(areaSaveEvidence(game.messages.get(saved.messageId)).fingerprint!==saved.fingerprint)throw Error('A saved result changed; automatic damage is stopped for GM reconciliation.');
    }
  };
  return {
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
          content:`<p>Gunbreaker action journal: ${esc(j.slug)}. Keep this record for interruption recovery.</p>`,flags:{[MOD]:{areaJournal:j}}});
        if(!log?.id)throw Error('The private area journal could not be created.');privateJournals.add(log.id);
      }
      await a.setFlag(MOD,'execution',{id:j.id,slug:j.slug,status:j.status,journalId:log.id,revision:j.revision??null});
    },
    cleanup:async(actor,request,prepared)=>{
      const marker=actor.getFlag(MOD,'execution');
      if(marker?.id===request.id&&['reserved','committed','recovery'].includes(marker.status))return;
      await lines.cleanup(prepared.line);
    },
    read:a=>a.getFlag(MOD,'tracker'),write:(a,s)=>{authority(a);return a.setFlag(MOD,'tracker',s);},
    prepare:async(actor,request)=>{
      const {self,dc}=inspect(actor,request),c=contextFor(actor),raw=actor.getFlag(MOD,'tracker');
      const profile=areaProfile(request.slug,c.level,c.learned);
      if(profile.upgraded&&!itemFor(actor,'blasting-zone'))throw Error('Update Blasting Zone from the v1.4 compendium first.');
      const expected={revision:raw?.revision??0,encounterId:c.encounterId,round:c.round,turn:c.turn};
      if(request.intent||request.expected)assertFreshIntent(request.intent??request.expected,c,raw);
      let state=normalizeState(raw,c);
      const original=request.slug==='fated-brand'?state.continuation?.targets:null;
      if(request.slug==='fated-brand'&&!original?.length)throw Error('Fated Brand has no eligible original targets.');
      const selectedIds=request.targetIds??c.targetIds;
      if(profile.shape==='target'&&selectedIds?.length!==1)throw Error('Select exactly one enemy for Danger Zone.');
      // Validate resources and learned prerequisites before asking the GM to place a region.
      if(profile.shape==='line'){
        if(state.encounter!==c.encounterId)state=transition(state,{type:'start'},c,catalogue);
        transition(state,{type:'use',slug:request.slug,...resolvedOptions(request.options,request.slug,null)},{...c,targetIds:['preview']},catalogue);
      }
      const origin=nativePosition(self);let line=null;
      try{
        if(profile.shape==='line'){line=await lines.place(actor,self,request);if(!line)return null;}
        if(!samePosition(nativePosition(self),origin))throw Error('The acting token moved during line placement.');
        const region=line?await lines.read(line):null;
        const tokens=canvas.tokens.placeables.filter(t=>t.actor&&t.actor.uuid!==actor.uuid&&actor.isEnemyOf(t.actor)&&!t.actor.isDead&&(region?lines.contains(region,t,line):self.distanceTo(t)<=profile.range)&&(!original||original.includes(t.document.uuid))&&(profile.shape!=='target'||selectedIds.includes(t.document.uuid)));
        // Do not put hidden target identities into an owner-readable Continuation state.
        if(tokens.some(t=>t.document.hidden))throw Error('This area requires GM adjudication outside the automated target workflow.');
        if(!tokens.length&&!allowEmpty)throw Error(`No eligible enemy remains within ${profile.range} feet.`);
        if(tokens.length>50)throw Error('This prototype supports at most 50 targets; adjudicate this area manually.');
        if(new Set(tokens.map(t=>t.actor.uuid)).size!==tokens.length)throw Error('Multiple target tokens share a creature; adjudicate this area manually.');
        const candidates=tokens.map(t=>({uuid:t.document.uuid,actorUuid:t.actor.uuid,name:t.name,hidden:!!t.document.hidden,position:nativePosition(t)}));
        c.targetIds=candidates.map(t=>t.uuid);
        if(state.encounter!==c.encounterId)state=transition(state,{type:'start'},c,catalogue);
        if(!automatic)transition(state,{type:'use',slug:request.slug,...resolvedOptions(request.options,request.slug,null),outcome:request.slug==='fated-circle'?'none':undefined},c,catalogue);
        const selected=automatic&&!candidates.length?[]:await foundry.applications.api.DialogV2.wait({window:{title:`${profile.name} — Confirm area`},rejectClose:false,
          content:`<p>${profile.shape==='target'?`One enemy within ${profile.range} feet`:profile.shape==='line'?`${profile.range}-foot line; native covered spaces`:`${profile.range}-foot emanation`} · Gunbreaker DC ${dc}. Check every affected enemy. Exclude only creatures blocked by geometry or another rule.</p>${candidates.map(t=>`<label><input type="checkbox" name="target" value="${esc(t.uuid)}" checked> ${esc(t.name)}</label>`).join('')}<label><input type="checkbox" name="verified"> I verified the area, line of effect, and genuine enemy targets.</label><p>${automatic?'Resolve the already-triggered blast; this spends no action or frequency.':'Confirming begins the activity and spends its frequency.'} Canceling a later save requires recovery and cannot refund the activity.</p>`,
          buttons:[{action:'confirm',label:'Begin activity',callback:(_e,b)=>b.form.elements.verified.checked?[...b.form.querySelectorAll('input[name="target"]:checked')].map(e=>e.value):null}]});
        if(!selected){await lines.cleanup(line);return null;}
        if(!selected.length&&!allowEmpty)throw Error('At least one affected enemy is required.');
        return {origin,expected,dc,profile,line,lineCandidates:line?candidates.map(t=>t.uuid).sort():null,weaponId:request.weaponId,targets:candidates.filter(t=>selected.includes(t.uuid)),privateResults:!!self.document.hidden||candidates.some(t=>t.hidden)};
      }catch(error){await lines.cleanup(line);throw error;}
    },
    validate:async(actor,request,prepared)=>{
      const {dc}=inspect(actor,request),c=contextFor(actor);
      assertFreshIntent(prepared.expected,c,actor.getFlag(MOD,'tracker'));
      if(dc!==prepared.dc)throw Error('The class DC changed after area confirmation.');
      if(JSON.stringify(areaProfile(request.slug,c.level,c.learned))!==JSON.stringify(prepared.profile))throw Error('The ability changed after confirmation.');
      await verifyTargets(actor,prepared);
      for(const t of prepared.targets){const doc=await fromUuid(t.uuid);if(!doc.actor.saves?.reflex?.check)throw Error('A target has no native Reflex save.');}
      return {...c,targetIds:prepared.targets.map(t=>t.uuid),dc,origin:prepared.origin,prepared,weaponId:prepared.weaponId};
    },
    onCommitted:async(actor,request,c,before)=>{
      if(['fated-circle','double-down'].includes(request.slug)&&c.learned.includes('fated-resolve')&&before.once.fatedRound!==c.round)await actor.createEmbeddedDocuments('Item',[tempHPEffect('Fated Resolve',actor,c,Math.floor(c.level/2),request.id)]);
    },
    damage:async(actor,request,c,prepared,state)=>{
      const formula=formulaFor?formulaFor(request,c,state):REIGN_STEPS.has(request.slug)?reignFormula(request.slug):areaFormula(request.slug,c.level,state.calibration,c.learned),DamageRoll=damageClass();
      const roll=await new DamageRoll(formula).evaluate();
      const item=itemFor(actor,request.slug);
      const options=[...actor.getSelfRollOptions('self'),...item.getRollOptions('item'),...saveOptions(prepared.profile),...item.system.traits.value.map(t=>`origin:action:trait:${t}`),`origin:action:slug:${request.slug}`];
      const message=await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:prepared.profile.name,
        flags:{[MOD]:{execution:request.id},pf2e:{suppressDamageButtons:true,context:{type:'damage-roll',sourceType:'save',options}}}},
        {messageMode:prepared.privateResults?'gm':game.settings.get('core','messageMode')});
      if(!message?.id)throw Error('Damage evidence could not be saved.');
      const persistentFormula=areaPersistentFormula(request.slug,c.level);
      const persistent=persistentFormula?await new DamageRoll(persistentFormula,{}, {evaluatePersistent:false}).evaluate():null;
      return {formula,roll:roll.toJSON(),fingerprint:JSON.stringify(roll.toJSON()),messageId:message.id,options,
        persistent:persistent?{formula:persistentFormula,roll:persistent.toJSON()}:null};
    },
    save:async(actor,request,c,t)=>{
      inspect(actor,request);await verifyTargets(actor,c.prepared);
      const now=contextFor(actor);if(now.encounterId!==c.encounterId||now.round!==c.round||now.turn!==c.turn||!now.inTurn)throw Error('Combat advanced during the activity.');
      const token=await fromUuid(t.uuid),item=itemFor(actor,request.slug);let messageId=null;
      const roll=await token.actor.saves.reflex.check.roll({dc:{value:c.dc,slug:'gunbreaker'},origin:actor,item,token,damaging:true,
        extraRollOptions:saveOptions(c.prepared.profile),traits:[...item.system.traits.value],
        messageMode:c.prepared.privateResults?'gm':undefined,
        callback:(_roll,_outcome,message)=>{messageId=message?.id??null;}});
      if(!roll)return null;
      return areaSaveEvidence(game.messages.get(messageId),t.actorUuid);
    },
    review:async(actor,request,c,prepared,progress)=>{
      verifySaves(progress);
      const rows=progress.saves.map((s,i)=>({...s,name:prepared.targets[i].name,multiplier:basicMultiplier(s.degree),persistent:request.slug==='bow-shock'&&s.degree<=1}));
      const selected=await foundry.applications.api.DialogV2.wait({window:{title:'Review area damage'},rejectClose:false,
        content:`<p>One initial damage roll: ${esc(progress.damage.formula)}. Native save outcomes are recorded below. Adjust damage only for a rule such as Improved Evasion; this does not change who failed the save.${progress.damage.persistent?` Failed saves also receive ${esc(progress.damage.persistent.formula)} as a native condition, without doubling or an immediate tick. Uncheck only if a rule prevents it.`:''}</p>${rows.map((r,i)=>`<label>${esc(r.name)} · ${degreeNames[r.degree]} <select name="scale${i}">${[0,0.5,1,2].map(n=>`<option value="${n}" ${n===r.multiplier?'selected':''}>${n}× initial damage</option>`).join('')}</select></label>${r.persistent?`<label><input type="checkbox" name="persistent${i}" checked> Apply persistent damage</label>`:''}`).join('')}<label><input type="checkbox" name="verified"> These results are ready. No other control or module has applied this damage; no unresolved reaction, reroll or damage redirection for these save results remains.</label>`,
        buttons:[{action:'apply',label:'Apply reviewed damage once',callback:(_e,b)=>b.form.elements.verified.checked?rows.map((r,i)=>({target:r.target,multiplier:Number(b.form.elements[`scale${i}`].value),persistent:!!r.persistent&&!!b.form.elements[`persistent${i}`]?.checked})):null}]});
      if(!selected)return null;
      inspect(actor,request);await verifyTargets(actor,prepared);verifySaves(progress);
      const now=contextFor(actor);if(now.encounterId!==c.encounterId||now.round!==c.round||now.turn!==c.turn||!now.inTurn)throw Error('Combat advanced before damage resolution.');
      return selected;
    },
    apply:async(actor,request,c,prepared,progress,row)=>{
      inspect(actor,request);verifySaves(progress);await verifyTargets(actor,prepared,progress.applications.filter(a=>a.status==='complete').map(a=>a.target));
      const damageMessage=game.messages.get(progress.damage.messageId);
      if(JSON.stringify(damageMessage?.rolls?.[0]?.toJSON())!==progress.damage.fingerprint)throw Error('The area damage roll changed.');
      if(row.persistent&&!progress.damage.persistent)throw Error('Persistent damage evidence is missing.');
      const roll=combinedSaveDamage(damageClass(),progress.damage.roll,row.multiplier,row.persistent?progress.damage.persistent.roll:null);
      const saved=progress.saves.find(s=>s.target===row.target);
      // Doubling a failed basic save is not a critical attack; never give it critical-hit IWR semantics.
      const token=await fromUuid(row.target),item=itemFor(actor,request.slug);
      const options=[...progress.damage.options,`gunbreaker:save:degree:${saved.degree}`];
      const {clone,rollOptions}=await nativeDamageContext(token.actor,{actor,item,flags:{pf2e:{context:{options}}}});
      check(actor,request);verifySaves(progress);
      const now=contextFor(actor);if(now.encounterId!==c.encounterId||now.round!==c.round||now.turn!==c.turn||!now.inTurn)throw Error('Combat advanced during damage resolution.');
      await clone.applyDamage({damage:roll,token,item,rollOptions,skipIWR:false,shieldBlockRequest:false,outcome:degreeNames[saved.degree]});
    },
    summary:async(actor,request,progress)=>{
      const content=`<p><strong>${esc(progress.prepared.profile.name)}</strong> resolved. ${progress.saves.length} native saves; ${progress.damage?'one shared damage roll':'no affected enemies'}. ${automatic?'Triggered blast; no action, frequency or combo spent.':'Costs, frequency and combo updated.'}</p><ul>${progress.prepared.targets.map(t=>{const save=progress.saves.find(s=>s.target===t.uuid),row=progress.review.find(r=>r.target===t.uuid);return `<li>${esc(t.name)}: ${degreeNames[save.degree]}, ${row.multiplier}× initial damage${row.persistent?`; persistent ${esc(progress.damage.persistent.formula)}`:''}.</li>`;}).join('')}</ul>`;
      const whisper=progress.prepared.privateResults?game.users.filter(u=>u.isGM).map(u=>u.id):[];
      await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content,whisper,flags:{[MOD]:{execution:request.id}}});
    }
  };
}
export function createAreaRunner(args,queue){return new AreaRunner(createSavePorts(args),queue);}
