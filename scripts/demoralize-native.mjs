import {normalizeState,transition} from './state.mjs';
import {catalogue} from './catalogue.mjs';
import {assertFreshIntent} from './requests.mjs';
import {suppressingAction,immunityActive,immunityEntry,frightenedValue,setFrightenedAtLeast,DEMORALIZE_TRAITS} from './demoralize.mjs';
const MOD='gunbreaker-pf2e',assert=(x,m)=>{if(!x)throw Error(m);};
const position=t=>JSON.stringify([t.document.uuid,t.document.x,t.document.y,t.document.elevation,t.document.width,t.document.height]);
export function createDemoralizeRunner({authority,contextFor,actorToken,weaponFor},queue){
 return {execute:async(actor,request)=>{
  const req=structuredClone(request);authority(actor,req);
  assert(req.slug==='suppressing-fire'&&typeof req.id==='string'&&req.id.length>0&&req.id.length<=100,'Invalid Suppressing Fire request.');
  assert(!Object.values(req.options??{}).some(Boolean),'Suppressing Fire has no cartridge riders.');
  const ids=req.targetIds??contextFor(actor).targetIds;assert(ids.length===1,'Select one enemy for Suppressing Fire.');
  const target=(await fromUuid(ids[0]))?.object;assert(target?.actor,'Target is unavailable.');
  return queue.runMany([actor,target.actor],async()=>{
   authority(actor,req);const prior=actor.getFlag(MOD,'execution');
   if(prior?.id===req.id&&['complete','canceled'].includes(prior.status))return prior;
   assert(!['reserved','committed','recovery'].includes(prior?.status),'Resolve the pending action first.');
   const inspect=()=>{
    authority(actor,req);weaponFor(actor,req.weaponId);const self=actorToken(actor);
    assert(!actor.isDead&&!['unconscious','paralyzed','stunned'].some(c=>actor.hasCondition(c)),'This character cannot act.');
    assert(actor.items.some(i=>(i.slug??i.system.slug)===req.slug&&i.system.publication?.title?.includes('1.4.0')),'Update Suppressing Fire from the v1.4 compendium.');
    assert(target.document.parent.id===self.document.parent.id&&self.document.parent.id===canvas.scene.id&&!self.document.hidden&&!target.document.hidden&&self.isVisible!==false&&target.isVisible!==false&&actor.isEnemyOf(target.actor)&&!target.actor.isDead&&self.distanceTo(target)<=30,'Choose a visible enemy within 30 feet.');
    assert(!target.actor.hasCondition('blinded'),'The enemy must be able to see you.');
    assert(!immunityActive(target.actor.getFlag(MOD,'demoralizeImmunity'),actor.uuid,game.time.worldTime),'This enemy is immune to your Demoralize.');
    return self;
   };
   const self=inspect(),c={...contextFor(actor),targetIds:ids},raw=actor.getFlag(MOD,'tracker'),checkpoint={revision:raw?.revision??0,encounterId:c.encounterId,round:c.round,turn:c.turn};
   if(req.intent||req.expected)assertFreshIntent(req.intent??req.expected,c,raw);
   let before=normalizeState(raw,c);if(before.encounter!==c.encounterId)before=transition(before,{type:'start'},c,catalogue);
   if(before.events.includes(req.id))return {id:req.id,status:'complete',duplicate:true};
   const after=transition(before,{type:'use',slug:req.slug,id:req.id},c,catalogue),origin=position(self),destination=position(target);
   const yes=await foundry.applications.api.DialogV2.confirm({window:{title:'Suppressing Fire'},content:'<p>Confirm that the enemy can see you, line of effect is clear, and it has no Demoralize immunity from an earlier/untracked attempt. The native Intimidation check uses visual instead of auditory and has no language penalty.</p>',rejectClose:false});
   if(!yes)return {id:req.id,status:'canceled'};
   inspect();assertFreshIntent(checkpoint,contextFor(actor),actor.getFlag(MOD,'tracker'));assert(position(self)===origin&&position(target)===destination,'Positions changed during confirmation.');
   let journal={id:req.id,slug:req.slug,status:'committed',before,target:target.document.uuid,started:c.time};
   await actor.setFlag(MOD,'execution',journal);
   try{
    const action=suppressingAction(game.pf2e.actions.get('demoralize'));
    const results=await action.use({actors:actor,target});
    if(!results?.length){journal={...journal,status:'canceled'};await actor.setFlag(MOD,'execution',journal);return journal;}
    assert(results.length===1&&results[0].actor.uuid===actor.uuid,'Unexpected Demoralize result.');
    const result=results[0],value=frightenedValue(result.roll.degreeOfSuccess);
    journal={...journal,degree:result.roll.degreeOfSuccess,messageId:result.message?.id??null};await actor.setFlag(MOD,'execution',journal);
    authority(actor,req);assertFreshIntent(checkpoint,contextFor(actor),actor.getFlag(MOD,'tracker'));
    assert(position(self)===origin&&position(target)===destination,'Positions changed during the check; reconcile the attempt.');
    await actor.setFlag(MOD,'tracker',after);
    const old=(target.actor.getFlag(MOD,'demoralizeImmunity')??[]).filter(e=>e.until>c.time);
    assert(!immunityActive(old,actor.uuid,c.time),'Another Demoralize attempt resolved during this check.');
    // Claim immunity and condition application before writing a condition; a failure cannot be retried.
    journal={...journal,application:'applying'};await actor.setFlag(MOD,'execution',journal);
    await target.actor.setFlag(MOD,'demoralizeImmunity',[...old,immunityEntry(actor.uuid,c.time,req.id)]);
    const effect={name:'Suppressing Fire',type:'effect',system:{traits:{value:DEMORALIZE_TRAITS},duration:{value:-1,unit:'unlimited',expiry:null},rules:[]}};
    if(value&&!target.actor.isDead&&!target.actor.isImmuneTo(effect)&&!target.actor.isImmuneTo('frightened'))await setFrightenedAtLeast(target.actor,value);
    journal={...journal,status:'complete',application:'complete',revision:after.revision};await actor.setFlag(MOD,'execution',journal);return journal;
   }catch(e){await actor.setFlag(MOD,'execution',{...journal,status:'recovery',error:e.message});throw e;}
  });
 }};
}
