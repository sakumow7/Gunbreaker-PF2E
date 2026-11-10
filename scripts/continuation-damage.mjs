import {calibratedItem,damageType,followupFormula} from './mechanics.mjs';
import {nativeDamageContext} from './native-damage.mjs';
import {assertFreshIntent} from './requests.mjs';
const MOD='gunbreaker-pf2e';
const allowed=new Set(['hypervelocity','jugular-rip','abdomen-tear','eye-gouge']);
const assert=(ok,message)=>{if(!ok)throw Error(message);};
export const continuationPosition=t=>JSON.stringify([t.document.uuid,t.document.parent.id,t.document.x,t.document.y,t.document.elevation,t.document.width,t.document.height,t.document.level]);
const position=continuationPosition;

/** Called after the action/opening is committed, inside the executor's source/recipient queue. */
export async function applyContinuationDamage(actor,req,c,before,after,deps){
 const {authority,contextFor,actorToken,weaponFor}=deps;
 assert(allowed.has(req.slug)&&before.continuation?.slug===req.slug,'No matching Continuation damage opening.');
 assert(before.continuation.targets.length===1,'Continuation needs exactly one original target.');
 const token=await fromUuid(before.continuation.targets[0]),target=token?.object,self=actorToken(actor);
 assert(target?.actor&&req.lockedActors?.includes(target.actor.uuid),'The Continuation recipient is unavailable or not locked.');
 const recipient=target.actor,origin=position(self),destination=position(target);
 assert(req.continuationSnapshot?.actorUuid===recipient.uuid&&req.continuationSnapshot.origin===origin&&req.continuationSnapshot.destination===destination,'Continuation changed after its preflight.');
 const rawItem=actor.items.find(i=>(i.slug??i.system?.slug)===req.slug);
 assert(rawItem?.system.publication?.title?.includes('1.4.0'),'Update the Continuation action from the v1.4 compendium.');
 const item=calibratedItem(rawItem,req.slug,after.calibration);
 const itemTraits=JSON.stringify(rawItem.system.traits.value);
 const expected={revision:after.revision,encounterId:c.encounterId,round:c.round,turn:c.turn};
 const verify=()=>{
  authority(actor,req);const now=contextFor(actor),state=actor.getFlag(MOD,'tracker');assertFreshIntent(expected,now,state);
  assert(now.inTurn&&now.level===c.level&&now.learned.includes(req.slug)&&now.learned.includes('continuation')&&state.calibration===after.calibration,'Continuation source state changed.');
  assert(actor.items.includes(rawItem)&&JSON.stringify(rawItem.system.traits.value)===itemTraits,'Continuation ability changed during damage.');
  const journal=actor.getFlag(MOD,'execution');
  assert(journal?.id===req.id&&journal.status==='committed'&&!journal.reconciliation,'Continuation execution was superseded or reconciled.');
  assert(game.pf2e.settings.iwr,'Enable native IWR automation before managed Continuation damage.');
  assert(actorToken(actor)===self&&target.actor===recipient&&token.parent.id===canvas.scene?.id&&self.document.parent.id===token.parent.id,'Continuation source or recipient changed.');
  assert(position(self)===origin&&position(target)===destination,'Continuation source or target moved during damage.');
  assert(!recipient.isDead&&!token.hidden&&target.isVisible!==false&&actor.isEnemyOf(recipient),'Continuation target eligibility changed.');
  assert(!actor.isDead&&!['unconscious','paralyzed','stunned'].some(s=>actor.hasCondition(s)),'The source can no longer resolve Continuation.');
  const weapon=weaponFor(actor,before.continuation.weaponId);
  assert(self.distanceTo(target)<=actor.getReach({action:'attack',weapon}),'The original target is outside Continuation reach.');
 };
 verify();
 assert(!actor.getFlag(MOD,'execution').riders?.some(r=>r.kind==='continuation-damage'),'Continuation damage was already claimed; reconcile without replay.');
 const DamageRoll=CONFIG.Dice.rolls.find(r=>r.name==='DamageRoll');assert(DamageRoll,'PF2e DamageRoll is unavailable.');
 const formula=followupFormula(c.level,before.continuation.weaponDice,damageType(req.slug,after.calibration));
 const entry={kind:'continuation-damage',target:token.uuid,actor:recipient.uuid,status:'rolling',formula};
 const mark=async patch=>{
  const journal=actor.getFlag(MOD,'execution');
  assert(journal?.id===req.id&&journal.status==='committed'&&!journal.reconciliation,'Continuation journal changed.');
  Object.assign(entry,patch);
  await actor.setFlag(MOD,'execution',{...journal,riders:[...(journal.riders??[]).filter(r=>r.kind!=='continuation-damage'),structuredClone(entry)]});
 };
 await mark({});verify();
 const roll=await new DamageRoll(formula).evaluate();roll.options.degreeOfSuccess=null;
 const options=[...actor.getSelfRollOptions('self'),...item.getRollOptions('item'),...item.system.traits.value.map(t=>`origin:action:trait:${t}`),`origin:action:slug:${req.slug}`];
 verify();
 const message=await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:item.name,
  flags:{[MOD]:{execution:req.id,target:token.uuid},pf2e:{suppressDamageButtons:true,origin:item.getOriginData(),
   context:{type:'damage-roll',sourceType:'check',outcome:null,options,target:{actor:recipient.uuid,token:token.uuid}}}}});
 assert(message?.id,'Continuation damage evidence could not be saved.');
 const fingerprint=JSON.stringify(roll.toJSON());
 await mark({status:'rolled',messageId:message.id,roll:roll.toJSON()});
 const {clone,rollOptions}=await nativeDamageContext(recipient,{actor,item,flags:{pf2e:{context:{options}}}});
 verify();
 assert(JSON.stringify(game.messages.get(message.id)?.rolls?.[0]?.toJSON())===fingerprint,'Continuation damage evidence changed.');
 await mark({status:'applying'});verify();
 assert(JSON.stringify(game.messages.get(message.id)?.rolls?.[0]?.toJSON())===fingerprint,'Continuation damage evidence changed.');
 // One separate energy effect: no attack multiplier, no property runes, no No Mercy, no second button application.
 await clone.applyDamage({damage:roll,token,item,rollOptions,skipIWR:false,shieldBlockRequest:false});
 await mark({status:'complete'});
}
