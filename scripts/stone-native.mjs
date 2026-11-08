import {StoneRunner,stoneAttack,stoneDamage,stoneOptions,stoneEffect} from './stone.mjs';
import {activeGM} from './native.mjs';
const MOD='gunbreaker-pf2e';
const esc=s=>foundry.utils.escapeHTML(String(s));
const pendingPrompts=new Set();
function gm(){
  if(!game.settings.get(MOD,'stoneReactions')||!game.user.isGM||activeGM()?.id!==game.user.id||game.users.filter(u=>u.active&&u.isGM).length!==1)throw Error('Heart of Stone beta requires its setting enabled and exactly one active GM.');
}
function singleToken(actor){
  const tokens=actor.getActiveTokens();
  if(tokens.length!==1)throw Error('Heart of Stone needs one active token per character.');return tokens[0];
}
function turnSnapshot(){return {id:game.combat?.id,round:game.combat?.round,turn:game.combat?.turn};}
async function factsFor(actor,w){
  if((game.combat?.turns.filter(c=>c.actor?.uuid===actor.uuid).length??0)!==1)throw Error('Heart of Stone needs exactly one combatant for the reacting character.');
  const target=await fromUuid(w.attack.target),origin=await fromUuid(w.attack.origin),self=singleToken(actor);
  if(!target?.actor||!origin?.actor||self.document.parent.id!==target.parent.id||origin.parent.id!==target.parent.id)throw Error('Reaction tokens must be on the same active scene.');
  const selfTarget=actor.uuid===target.actor.uuid;
  return {self:selfTarget,ally:actor.isAllyOf(target.actor),enemy:target.actor.isEnemyOf(origin.actor),
    conscious:!['unconscious','paralyzed','stunned'].some(c=>actor.hasCondition(c)),
    // Actor-specific sight and unusual cover require the owner's declaration and GM review.
    seesBoth:!actor.hasCondition('blinded')&&!!target.object?.isVisible&&!!origin.object?.isVisible,
    distance:self.distanceTo(target.object),attackKind:w.attack.kind};
}
/** Build the same target context used by PF2e's native damage-card helper. */
export async function stoneDamageContext(actor,message,attack,resistance){
  const options=[...(message.flags.pf2e.context.options??[])],origin=message.actor,item=message.item;
  if(actor.alliance&&origin)options.push(`origin:${actor.alliance===origin.alliance?'ally':'enemy'}`);
  if(!options.some(o=>o.startsWith('target:')))options.push(...actor.getSelfRollOptions('target'));
  const originOptions=options.filter(o=>o.startsWith('self:')).map(o=>o.replace(/^self:/,'origin:'));
  const deferred=origin?.synthetics?.ephemeralEffects?.['damage-received']?.target??[];
  const resolvables=item?{[item.type==='spell'?'spell':'weapon']:item}:{};
  const test=[...options,...(origin?.getRollOptions(['damage-received'])??[]),...actor.getSelfRollOptions('target')];
  const effects=(await Promise.all(deferred.map(fn=>fn({test,resolvables})))).filter(Boolean).map(source=>{
    const effect=foundry.utils.deepClone(source);
    if(effect.type==='effect'){
      effect.system.context={origin:{actor:origin.uuid,token:null,item:null,spellcasting:null,rollOptions:[]},target:{actor:actor.uuid,token:null},roll:null};
      effect.system.duration={value:-1,unit:'unlimited',expiry:null,sustained:false};
    }
    return effect;
  });
  if(resistance)effects.push({...stoneEffect(resistance,attack.id),_id:foundry.utils.randomID()});
  const clone=actor.getContextualClone(originOptions,effects);
  const itemOptions=['affliction','condition','effect'].includes(item?.type)?item.getRollOptions('item'):[];
  return {clone,rollOptions:new Set([...options.filter(o=>!/^(self|target)(:|$)/.test(o)),...itemOptions,...originOptions,...clone.getSelfRollOptions()])};
}
export function installStone(contextFor,actorQueue){
  // Only server-delivered GM creation events establish trusted windows in this session.
  // After a GM reload, old windows require manual reconciliation rather than blind replay.
  const trustedWindows=new Set();
  const windows=()=>game.messages.filter(m=>m.getFlag(MOD,'stoneWindow'));
  const windowData=id=>{
    const w=game.messages.get(id)?.getFlag(MOD,'stoneWindow');
    if(!w||w.gmId!==game.user.id||!trustedWindows.has(id))throw Error('This reaction is not verified in this GM session; reconcile it manually before proceeding.');
    return structuredClone(w);
  };
  const context=(actor,w)=>({...contextFor(actor),targetIds:[w.attack.target],selfTargetIds:[]});
  const runner=new StoneRunner({
    gm,
    authorize:async(actor,userId)=>{gm();const user=game.users.get(userId);if(!user?.active||!actor.testUserPermission(user,'OWNER'))throw Error('You must own this reacting character.');},
    readWindow:async id=>windowData(id),
    writeWindow:async(id,w)=>{gm();await game.messages.get(id).update({[`flags.${MOD}.stoneWindow`]:w,content:`<p><strong>Heart of Stone</strong> · ${esc(w.targetName)} · ${esc(w.status)}${w.choice?` · Resistance ${w.choice.resistance}`:''}.</p><p>Resolve through this reaction card. Ordinary damage buttons and other modules are outside this workflow.</p>`});},
    attack:async id=>stoneAttack(game.messages.get(id)),sameTurn:w=>JSON.stringify(w.turn)===JSON.stringify(turnSnapshot()),
    context:async(actor,w)=>{const c=context(actor,w);const target=await fromUuid(w.attack.target);if(target?.actor?.uuid===actor.uuid)c.selfTargetIds=[w.attack.target];return c;},
    facts:factsFor,readActor:a=>a.getFlag(MOD,'tracker'),writeActor:(a,s)=>{gm();return a.setFlag(MOD,'tracker',s);},
    journal:a=>a.getFlag(MOD,'execution'),saveJournal:(a,j)=>{gm();return a.setFlag(MOD,'execution',j);},
    damage:async(attack,id)=>stoneDamage(attack,game.messages.get(id)),
    targetActor:async uuid=>{const token=await fromUuid(uuid);if(!token?.actor)throw Error('Protected target no longer exists.');return token.actor;},
    applied:async(id,actorUuid)=>game.messages.get(id)?.getFlag(MOD,'stoneApplications')?.some(e=>e.actor===actorUuid),
    markApplied:async(id,actorUuid,state)=>{gm();const message=game.messages.get(id),entries=message.getFlag(MOD,'stoneApplications')??[];await message.setFlag(MOD,'stoneApplications',[...entries.filter(e=>e.actor!==actorUuid),{actor:actorUuid,...state}]);},
    applyNative:async(actor,attack,damage,resistance)=>{
      gm();if(!game.pf2e.settings.iwr)throw Error('Enable PF2e immunity, weakness and resistance automation before managed damage.');
      const message=game.messages.get(damage.id);
      if(stoneDamage(attack,message).fingerprint!==damage.fingerprint)throw Error('The selected damage roll changed.');
      const token=await fromUuid(attack.target);
      if(!token?.object||token.parent.id!==canvas.scene?.id)throw Error('The protected token must be on the active scene.');
      const {clone,rollOptions}=await stoneDamageContext(actor,message,attack,resistance);
      gm();
      if(stoneAttack(game.messages.get(attack.id))?.fingerprint!==attack.fingerprint||stoneDamage(attack,message).fingerprint!==damage.fingerprint)throw Error('Attack or damage changed during preparation; reconcile the pending application.');
      // One contextual clone for one native application: no lasting all-damage effect and no extra subtraction.
      await clone.applyDamage({damage:message.rolls[0],token,item:message.item,rollOptions,
        outcome:attack.degree===3?'criticalSuccess':'success',skipIWR:false,shieldBlockRequest:false});
    }
  },actorQueue);

  async function offer(message){
    gm();const attack=stoneAttack(message);if(!attack||!game.combat?.started)return null;
    if(!game.pf2e.settings.iwr)throw Error('Heart of Stone beta requires PF2e native IWR automation.');
    if(windows().some(m=>m.getFlag(MOD,'stoneWindow').attack.id===attack.id))return null;
    const target=await fromUuid(attack.target);if(!target?.actor||target.parent.id!==canvas.scene?.id)return null;
    const skeleton={attack,turn:turnSnapshot()};const candidates=[];
    const seen=new Set();
    for(const token of canvas.tokens.placeables){
      const actor=token.actor;if(!actor||actor.type!=='character'||seen.has(actor.uuid))continue;seen.add(actor.uuid);
      if(!actor.items.some(i=>(i.slug??i.system?.slug)==='heart-of-stone'&&i.system.publication?.title?.includes('1.4.0')))continue;
      try{
        const c=context(actor,skeleton),facts=await factsFor(actor,skeleton);if(facts.self)c.selfTargetIds=[attack.target];
        const choices=stoneOptions(actor.getFlag(MOD,'tracker'),c,facts);if(!choices.length)continue;
        const owners=game.users.filter(u=>u.active&&!u.isGM&&actor.testUserPermission(u,'OWNER')).sort((a,b)=>Number(b.character?.uuid===actor.uuid)-Number(a.character?.uuid===actor.uuid)||a.id.localeCompare(b.id));
        candidates.push({actor:actor.uuid,name:actor.name,owner:owners[0]?.id??game.user.id,choices});
      }catch{/* Ambiguous tokens and unsupported cases remain manual. */}
    }
    if(!candidates.length)return null;
    const w={version:1,gmId:game.user.id,...skeleton,targetName:target.name,candidates,declined:[],status:'awaiting',revision:0};
    // Mark only after successful creation; duplicate creation is prevented by a per-attack in-flight guard below.
    return ChatMessage.create({author:game.user.id,whisper:[...new Set([game.user.id,...candidates.map(c=>c.owner)])],
      content:`<p><strong>Heart of Stone</strong> · ${esc(target.name)} · awaiting a reaction choice.</p><p>Hold this attack's damage. Use this card to resolve it; ordinary damage buttons are outside this workflow.</p>`,flags:{[MOD]:{stoneWindow:w}}});
  }
  async function respond(message,actorUuid){
    const w=message.getFlag(MOD,'stoneWindow'),candidate=w?.candidates.find(c=>c.actor===actorUuid);
    if(!candidate||w.status!=='awaiting'||w.declined.includes(actorUuid))return;
    const actor=await fromUuid(actorUuid);if(!actor?.isOwner)return;
    const key=`${message.id}:${actorUuid}`;if(pendingPrompts.has(key))return;pendingPrompts.add(key);
    const timer=setTimeout(()=>ui.notifications.warn('Heart of Stone is still unresolved. The GM can explicitly continue without protection.'),60000);
    try{
      const choice=await foundry.applications.api.DialogV2.wait({window:{title:`Heart of Stone — ${candidate.name}`},rejectClose:false,
        content:`<p>Protect <strong>${esc(w.targetName)}</strong> from the triggering ${w.attack.kind}?</p><p>Accept only if you can see both the ally and attacker and can legally react. These options do not include Bulwark Protocol movement. Costs are checked again when accepted.</p>`,
        buttons:[...candidate.choices.map(c=>({action:c.id,label:`${c.label} · resistance ${c.resistance}`,callback:()=>c.id})),{action:'decline',label:'Decline',callback:()=> 'decline'}]});
      await ChatMessage.create({author:game.user.id,whisper:[...new Set([w.gmId,game.user.id])],content:'<p>Heart of Stone response submitted.</p>',
        flags:{[MOD]:{stoneResponse:{windowId:message.id,actorUuid,choiceId:typeof choice==='string'?choice:'decline',revision:w.revision}}}});
    }finally{clearTimeout(timer);pendingPrompts.delete(key);}
  }
  async function applyDialog(message){
    gm();const w=windowData(message.id);
    const matches=game.messages.filter(m=>{try{stoneDamage(w.attack,m);return true;}catch{return false;}});
    if(!matches.length)throw Error('No matching native damage card. Roll this attack’s damage with the correct outcome first. Critical spell rolls that are not represented natively require manual adjudication.');
    const choice=await foundry.applications.api.DialogV2.wait({window:{title:'Pair attack damage'},rejectClose:false,
      content:`<p>Select the damage for this exact attack on ${esc(w.targetName)}. This workflow applies one combined damage roll.</p><select name="damage">${matches.map(m=>`<option value="${m.id}">${esc(m.id)} · ${esc(m.item?.name??'Damage')} · ${m.rolls[0].total}</option>`).join('')}</select><label><input name="confirm" type="checkbox"> I confirm the attack link, visibility, and that this damage has not already been applied. No Shield Block, damage redirection or separate damage packet needs resolution.</label>`,
      buttons:[{action:'apply',label:'Apply once',callback:(_e,b)=>b.form.elements.confirm.checked?b.form.elements.damage.value:null}]});
    if(typeof choice==='string')return runner.apply(message.id,choice);
  }
  const opening=new Set();
  Hooks.on('createChatMessage',(message,_options,userId)=>{
    if(!game.settings.get(MOD,'stoneReactions'))return;
    const w=message.getFlag(MOD,'stoneWindow');
    if(w&&game.users.get(userId)?.isGM&&w.gmId===userId){
      trustedWindows.add(message.id);
      for(const c of w.candidates.filter(c=>c.owner===game.user.id))void respond(message,c.actor).catch(e=>ui.notifications.warn(e.message));
      return;
    }
    if(!game.user.isGM||activeGM()?.id!==game.user.id)return;
    const response=message.getFlag(MOD,'stoneResponse');
    if(response){
      const captured=structuredClone(response);
      void (async()=>{
        if(Object.keys(captured).some(k=>!['windowId','actorUuid','choiceId','revision'].includes(k))||typeof captured.windowId!=='string'||typeof captured.actorUuid!=='string'||typeof captured.choiceId!=='string'||!Number.isSafeInteger(captured.revision))throw Error('Invalid reaction response.');
        if(message.author?.id!==userId)throw Error('Reaction response creator mismatch.');
        const w=windowData(captured.windowId),user=game.users.get(userId),candidate=w.candidates.find(c=>c.actor===captured.actorUuid);
        if(!candidate||(!user?.isGM&&candidate.owner!==userId))throw Error('This reaction was assigned to another owner.');
        const actor=await fromUuid(captured.actorUuid);if(!actor)throw Error('Reacting actor no longer exists.');
        await runner.choose(captured.windowId,actor,captured.choiceId,userId,captured.revision);
        await message.update({content:'<p>Heart of Stone response resolved.</p>'});
      })().catch(async e=>{ui.notifications.warn(e.message);await message.update({content:`<p>Heart of Stone response: ${esc(e.message)}. Reopen the reaction card if needed.</p>`}).catch(()=>{});});
      return;
    }
    const attack=stoneAttack(message),creator=game.users.get(userId);
    if(!attack||!creator||!message.actor?.testUserPermission(creator,'OWNER')||opening.has(message.id))return;
    opening.add(message.id);
    void offer(message).catch(e=>ui.notifications.warn(e.message)).finally(()=>opening.delete(message.id));
  });
  Hooks.on('renderChatMessageHTML',(message,html)=>{
    const w=message.getFlag(MOD,'stoneWindow');if(!w||!game.settings.get(MOD,'stoneReactions'))return;
    const add=(label,fn)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>void fn().catch(e=>ui.notifications.warn(e.message)));html.append(button);};
    if(w.status==='awaiting'){
      for(const c of w.candidates.filter(c=>!w.declined.includes(c.actor)&&(c.owner===game.user.id||game.user.isGM)))add(`Respond — ${c.name}`,()=>respond(message,c.actor));
      if(game.user.isGM)add('Continue without protection',async()=>{if(await foundry.applications.api.DialogV2.confirm({window:{title:'Continue pending damage'},content:'<p>Close this unresolved reaction without spending a reaction or cartridge?</p>',rejectClose:false}))await runner.continue(message.id);});
    }
    if(game.user.isGM&&['accepted','declined'].includes(w.status))add('Pair and apply damage',()=>applyDialog(message));
  });
  return {offer,respond,apply:applyDialog};
}
