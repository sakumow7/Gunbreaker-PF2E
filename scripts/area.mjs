import {normalizeState,transition,COSTS} from './state.mjs';
import {catalogue} from './catalogue.mjs';
import {ActorQueue} from './queue.mjs';
export const CORE_AREAS=new Set(['demon-slice','demon-slaughter','fated-circle','fated-brand']);
const assert=(ok,message)=>{if(!ok)throw Error(message);};
export function areaFormula(slug,level,calibration='fire'){
  assert(CORE_AREAS.has(slug)&&Number.isInteger(level)&&level>=1&&level<=20,'Invalid area ability or level.');
  if(slug.startsWith('demon-'))return `${Math.ceil(level/2)}d4[slashing]`;
  assert(['fire','cold','electricity'].includes(calibration),'Invalid calibration.');
  return `${slug==='fated-brand'?(level>=17?3:2):Math.ceil(level/2)}d6[${calibration}]`;
}
export function basicMultiplier(degree){
  assert([0,1,2,3].includes(degree),'Native save has no resolved degree of success.');
  return [2,1,0.5,0][degree];
}
export function areaCommit(before,slug,context,id){
  // Validate the complete activity before separating its start costs from completion rewards.
  const preview=transition(before,{type:'use',slug,id,outcome:slug==='fated-circle'?'none':undefined},context,catalogue);
  return {...structuredClone(before),revision:preview.revision,events:preview.events,
    cartridges:before.cartridges-(COSTS[slug]??0),continuation:null,lastFollowRound:preview.lastFollowRound};
}
export function areaFinish(before,committed,slug,context,id,saves){
  assert(saves.length===context.targetIds.length&&new Set(saves.map(s=>s.target)).size===saves.length&&saves.every(s=>context.targetIds.includes(s.target)),'Save results must cover each affected target exactly once.');
  for(const save of saves)basicMultiplier(save.degree);
  const failed=saves.filter(s=>s.degree<=1).map(s=>s.target);
  const next=transition(before,{type:'use',slug,id,outcome:slug==='fated-circle'?(failed.length?'failed':'none'):undefined,failedTargetIds:failed},context,catalogue);
  return {...next,revision:committed.revision+1};
}
export class AreaRunner{
  #inflight=new Map();
  constructor(ports,queue=new ActorQueue()){this.p=ports;this.queue=queue;}
  execute(actor,request){
    const key=`${actor.uuid}:${request.id}`;
    if(this.#inflight.has(key))return this.#inflight.get(key);
    const task=this.#prepare(actor,structuredClone(request));this.#inflight.set(key,task);
    return task.finally(()=>{if(this.#inflight.get(key)===task)this.#inflight.delete(key);});
  }
  async #prepare(actor,request){
    const p=this.p;await p.authorize(actor,request);
    assert(typeof request.id==='string'&&request.id.length>0&&request.id.length<=100&&CORE_AREAS.has(request.slug),'Invalid area request.');
    assert(!request.options||!Object.keys(request.options).length,'Optional area riders are not yet supported.');
    const prior=await p.journal(actor);
    if(prior?.id===request.id&&['complete','canceled'].includes(prior.status))return prior;
    assert(!['reserved','committed','recovery'].includes(prior?.status),'Resolve the pending action before starting another.');
    const prepared=await p.prepare(actor,request);
    if(!prepared)return {id:request.id,status:'canceled'};
    assert(prepared.targets.length>0&&prepared.targets.length<=50,'The area needs 1–50 valid targets.');
    assert(new Set(prepared.targets.map(t=>t.uuid)).size===prepared.targets.length&&new Set(prepared.targets.map(t=>t.actorUuid)).size===prepared.targets.length,'Multiple target tokens share a creature; adjudicate the area manually.');
    return this.queue.runMany([actor,...prepared.targets.map(t=>({uuid:t.actorUuid}))],()=>this.#execute(actor,request,prepared));
  }
  async #execute(actor,request,prepared){
    const p=this.p;await p.authorize(actor,request);
    const existing=await p.journal(actor);
    if(existing?.id===request.id&&['complete','canceled'].includes(existing.status))return existing;
    assert(!['reserved','committed','recovery'].includes(existing?.status),'Resolve the pending action before starting another.');
    const c=await p.validate(actor,request,prepared);
    let before=normalizeState(await p.read(actor),c);
    if(before.events.includes(request.id))return {id:request.id,status:'complete',duplicate:true};
    if(before.encounter!==c.encounterId)before=transition(before,{type:'start'},c,catalogue);
    const committed=areaCommit(before,request.slug,c,request.id);
    let progress={id:request.id,slug:request.slug,status:'reserved',before,context:c,prepared,saves:[],applications:[]};
    await p.saveJournal(actor,progress);
    try{
      await p.authorize(actor,request);
      // Committing the activity precedes native saves. Later cancellation cannot refund a begun activity.
      progress={...progress,status:'committed'};await p.saveJournal(actor,progress);await p.write(actor,committed);
      progress.damage=await p.damage(actor,request,c,prepared,committed);await p.saveJournal(actor,progress);
      for(const target of prepared.targets){
        await p.authorize(actor,request);
        const result=await p.save(actor,request,c,target);
        progress.saves.push({target:target.uuid,...result});await p.saveJournal(actor,progress);
        basicMultiplier(result?.degree);
      }
      // These rewards follow resolution of all saves, even if later HP application is interrupted.
      const after=areaFinish(before,committed,request.slug,c,request.id,progress.saves);
      await p.write(actor,after);
      const review=await p.review(actor,request,c,prepared,progress);
      assert(review&&review.length===progress.saves.length,'Area resolution needs GM recovery; no damage was applied by this workflow.');
      assert(review.every((r,i)=>r.target===progress.saves[i].target&&[0,0.5,1,2].includes(r.multiplier)),'Invalid damage review.');
      progress.review=review;await p.saveJournal(actor,progress);
      for(const row of review){
        await p.authorize(actor,request);
        progress.applications.push({target:row.target,status:'applying',multiplier:row.multiplier});await p.saveJournal(actor,progress);
        if(row.multiplier>0)await p.apply(actor,request,c,prepared,progress,row);
        progress.applications.at(-1).status=row.multiplier>0?'complete':'no-damage';await p.saveJournal(actor,progress);
      }
      progress={...progress,status:'complete',revision:after.revision};await p.saveJournal(actor,progress);
      await p.summary?.(actor,request,progress);return progress;
    }catch(error){
      await p.saveJournal(actor,{...progress,status:'recovery',error:String(error.message??error)});throw error;
    }
  }
}
