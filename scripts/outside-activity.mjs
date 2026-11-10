import {transition} from './state.mjs';
import {assertFreshIntent} from './requests.mjs';
import {OUTSIDE_ACTIVITIES} from './outside-controls.mjs';
const MOD='gunbreaker-pf2e';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const busy=actor=>['reserved','committed','recovery'].includes(actor.getFlag(MOD,'execution')?.status)||['prompting','planning','applying','recovery'].includes(actor.getFlag(MOD,'followup')?.status);

/** Explicit bookkeeping for an already resolved outside activity, never inferred from a chat card. */
export function createOutsideActivityRunner({authority,contextFor},queue){
 return {execute(actor,request){
  const req=structuredClone(request);
  return queue.run(actor,async()=>{
   authority(actor,req);
   assert(OUTSIDE_ACTIVITIES.has(req.slug),'Unknown outside activity.');
   assert(typeof req.id==='string'&&req.id.length>0&&req.id.length<=100,'A valid activity ID is required.');
   assert(req.map===0&&req.weaponId==='none'&&Array.isArray(req.targetIds)&&req.targetIds.length===0&&Object.keys(req.options??{}).length===0,'Outside activity records cannot include weapons, targets, attack stages or resources.');
   assert(actor.items.some(i=>i.type==='class'&&(i.slug??i.system?.slug)==='gunbreaker'),'This character needs the Gunbreaker class.');
   const tokens=actor.getActiveTokens();
   assert(tokens.length===1&&tokens[0].document.parent.id===canvas.scene?.id,'Outside activity recording needs one character token on the GM scene.');
   if(req.requesterId)assert(game.users.get(req.requesterId)?.viewedScene===canvas.scene?.id,'The acting player and GM must view the same scene.');
   const state=actor.getFlag(MOD,'tracker');
   // One atomic tracker write carries both the mutation and its receipt. Never rerun a duplicate after a turn change.
   if(state?.events?.includes(req.id))return {id:req.id,status:'complete',duplicate:true,revision:state.revision};
   assert(!busy(actor),'Reconcile the pending action before recording an outside activity.');
   const c=contextFor(actor);
   assert(req.intent??req.expected,'Open the action panel before recording an outside activity.');
   assertFreshIntent(req.intent??req.expected,c,state);
   assert(c.encounterId&&state?.encounter===c.encounterId,'Initialize this encounter before recording an outside activity.');
   assert(game.combat?.turns.filter(t=>t.actor?.uuid===actor.uuid).length===1,'Outside activity recording requires one unambiguous combatant.');
   assert(!c.learned.some(s=>['twin-cartridge','overcharged-gauge'].includes(s)),'Review retired feat migration before recording v1.4 activities.');
   const reaction=req.slug==='record-other-reaction';
   assert(reaction||c.inTurn,'Record another action only on your own turn.');
   const next=transition(state,{type:'other',reaction,id:req.id},c);
   next.lastOutsideActivity={id:req.id,slug:req.slug,encounterId:c.encounterId,round:c.round,turn:c.turn};
   await actor.setFlag(MOD,'tracker',next);
   return {id:req.id,status:'complete',revision:next.revision};
  });
 }};
}
