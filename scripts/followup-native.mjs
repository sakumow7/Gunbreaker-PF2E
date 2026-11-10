import {writeTracker} from './tracker-storage.mjs';
import {followupFeat,followupAvailable,commitFollowup} from './followup-riders.mjs';
import {createStepService,stepPosition} from './step-native.mjs';
import {tempHPEffect} from './riders.mjs';
import {assertFreshIntent} from './requests.mjs';
const MOD='gunbreaker-pf2e',assert=(v,m)=>{if(!v)throw Error(m);};
export const FOLLOWUP_BUSY=new Set(['prompting','planning','applying','recovery']);
const slug=i=>i.slug??i.system?.slug;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function createFollowupRunner(deps,queue,steps=createStepService(deps)){
 const {authority,contextFor,actorToken}=deps;
 const allies=(actor,self)=>canvas.tokens.placeables.filter(t=>t.actor&&t.actor.uuid!==actor.uuid&&actor.isAllyOf(t.actor)&&!t.actor.isDead&&!t.document.hidden&&t.isVisible!==false&&t.document.parent.id===self.document.parent.id&&self.distanceTo(t)<=5);
 const guard=a=>a.itemTypes.effect.some(i=>slug(i)==='royal-guard-stance');
 return {async execute(actor,req,parent,trigger){
  const feat=followupFeat(req.slug);if(!feat||parent?.status!=='complete'||parent.duplicate)return parent;
  let c,checkpoint,marker,entry,self,origin;
  const started=await queue.run(actor,async()=>{
   authority(actor,req);c=contextFor(actor);const state=actor.getFlag(MOD,'tracker'),old=actor.getFlag(MOD,'followup');
   if(old?.parentId===req.id)return false;
   assert(!FOLLOWUP_BUSY.has(old?.status),'Resolve the pending optional rider first.');
   marker=actor.getFlag(MOD,'execution');
   if(!followupAvailable(state,c,feat)||state.events.at(-1)!==req.id||marker?.id!==req.id||marker.status!=='complete'||marker.reconciliation)return false;
   assert(c.encounterId===trigger.encounterId&&c.round===trigger.round&&c.turn===trigger.turn,'Combat advanced before the optional rider.');
   assert(actor.items.some(i=>slug(i)===feat&&i.system.publication?.title?.includes('1.4.0')),'Update the optional rider from the v1.4 compendium.');
   self=actorToken(actor);origin=stepPosition(self);checkpoint={revision:state.revision,encounterId:c.encounterId,round:c.round,turn:c.turn};
   entry={parentId:req.id,feat,status:'prompting',checkpoint};
   await actor.setFlag(MOD,'followup',entry);await actor.setFlag(MOD,'execution',{...marker,status:'committed',followup:feat});return true;
  });
  if(!started)return parent;
  const fresh=()=>{
   authority(actor,req);const now=contextFor(actor);assertFreshIntent(checkpoint,now,actor.getFlag(MOD,'tracker'));
   assert(now.learned.includes(feat)&&now.level===c.level,'The optional rider feature or level changed.');
   assert(actor.getFlag(MOD,'execution')?.id===req.id&&actor.getFlag(MOD,'execution')?.status==='committed'&&FOLLOWUP_BUSY.has(actor.getFlag(MOD,'followup')?.status),'Optional rider was reconciled or superseded.');
   assert(!actor.isDead&&!['unconscious','paralyzed','stunned'].some(s=>actor.hasCondition(s)),'The source can no longer use the rider.');
   assert(same(origin,stepPosition(self)),'The source moved after its triggering action.');
  };
  const finish=async(status)=>queue.run(actor,async()=>{
   fresh();await actor.setFlag(MOD,'followup',{...entry,status});await actor.setFlag(MOD,'execution',{...marker,status:'complete',followup:{feat,status},revision:actor.getFlag(MOD,'tracker').revision});return {...parent,revision:actor.getFlag(MOD,'tracker').revision};
  });
  try{
   const candidates=feat==='continued-assault'&&guard(actor)?allies(actor,self):[];
   const title=feat==='relentless-combo'?'Relentless Combo':'Continued Assault';
   let choice;
   if(req.requesterId){
    assert(deps.ownerChoices,'Owner rider choices are unavailable; reconcile the parent action.');
    const options=[{id:'step',label:'Step (GM plans the path)',value:{kind:'step'}},...candidates.map((t,i)=>({id:`ally${i}`,label:`Protect ${t.name}`,value:{kind:'barrier',target:t.document.uuid}}))];
    const id=await deps.ownerChoices.ask(actor,req,{title,text:'Use the optional once-per-round rider now? Step uses ordinary five-foot ground movement; the GM plans and verifies the path. Skip preserves this round’s rider use.',choices:options.map(({id,label})=>({id,label}))});
    assert(id===null||options.some(o=>o.id===id),'Invalid owner rider choice.');
    choice=options.find(o=>o.id===id)?.value??null;
   }else choice=await foundry.applications.api.DialogV2.wait({window:{title},rejectClose:false,content:'<p>Use the optional once-per-round rider now? Step uses ordinary five-foot ground movement; verify terrain and hazards. Declining leaves the round use available.</p>',buttons:[{action:'step',label:'Step',callback:()=>({kind:'step'})},...candidates.map((t,i)=>({action:`ally${i}`,label:`Protect ${t.name}`,callback:()=>({kind:'barrier',target:t.document.uuid})})),{action:'skip',label:'Skip',callback:()=>false}]});
   if(!choice)return await finish('declined');
   fresh();let plan=null,target=null;
   if(choice.kind==='step'){
    entry={...entry,status:'planning',kind:'step'};await actor.setFlag(MOD,'followup',entry);
    plan=await steps.prepare(actor,req);if(!plan)return await finish('declined');
   }else{
    assert(choice.kind==='barrier'&&feat==='continued-assault'&&guard(actor),'Invalid optional rider choice.');
    target=candidates.find(t=>t.document.uuid===choice.target);assert(target&&allies(actor,self).includes(target),'The adjacent ally changed.');
   }
   await queue.runMany(target?[actor,target.actor]:[actor],async()=>{
    fresh();if(plan)steps.validate(actor,req,plan);
    if(target)assert(guard(actor)&&allies(actor,self).includes(target),'The stance or recipient changed.');
    entry={...entry,status:'applying',kind:choice.kind,target:target?.document.uuid??null,...(plan?{plan:steps.evidence(plan)}:{})};
    await actor.setFlag(MOD,'followup',entry);
    const after=commitFollowup(actor.getFlag(MOD,'tracker'),c,feat,req.id);await writeTracker(actor,after);checkpoint={...checkpoint,revision:after.revision};
    if(target)await target.actor.createEmbeddedDocuments('Item',[tempHPEffect('Continued Assault',actor,c,Math.max(1,Math.floor(c.level/2)),req.id)]);
   });
   // Do not hold reaction/recipient actor queues while native movement may pause.
   if(plan){await steps.move(actor,req,plan);origin=stepPosition(self);}
   return await finish('complete');
  }catch(e){
   await queue.run(actor,async()=>{const current=actor.getFlag(MOD,'followup');if(current?.parentId===req.id&&FOLLOWUP_BUSY.has(current.status)){await actor.setFlag(MOD,'followup',{...current,status:'recovery',error:e.message});const execution=actor.getFlag(MOD,'execution');if(execution?.id===req.id&&!execution.reconciliation)await actor.setFlag(MOD,'execution',{...execution,status:'recovery',error:e.message});}});
   throw e;
  }
 }};
}
