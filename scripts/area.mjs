import {resourceOptions,resolvedOptions,validateResourceOptions} from './options.mjs';
import {normalizeState,transition,COSTS} from './state.mjs';
import {catalogue} from './catalogue.mjs';
import {ActorQueue} from './queue.mjs';
export const SAVE_ACTIONS=new Set(['demon-slice','demon-slaughter','fated-circle','fated-brand','double-down','danger-zone','bow-shock','saturation-fire','relentless-rush']);
export const TARGETED_SAVES=new Set(['danger-zone']);
const assert=(ok,message)=>{if(!ok)throw Error(message);};
export function areaProfile(slug,level,learned=[]){
  assert(SAVE_ACTIONS.has(slug),'Unsupported save ability.');
  const upgraded=slug==='danger-zone'&&learned.includes('blasting-zone');
  assert(!upgraded||level>=14,'Blasting Zone requires level 14.');
  return {shape:slug==='saturation-fire'?'line':TARGETED_SAVES.has(slug)?'target':'emanation',range:slug==='saturation-fire'?30:slug==='double-down'?10:slug==='danger-zone'?(upgraded?30:15):5,
    name:upgraded?'Blasting Zone':catalogue[slug].name,upgraded};
}
export function areaPersistentFormula(slug,level){
  return slug==='bow-shock'?`${level>=12?2:1}d4[persistent,fire]`:null;
}
export function areaFormula(slug,level,calibration='fire',learned=[]){
  assert(SAVE_ACTIONS.has(slug)&&Number.isInteger(level)&&level>=1&&level<=20,'Invalid area ability or level.');
  if(slug==='relentless-rush')return '8d6[fire]';
  if(slug.startsWith('demon-'))return `${Math.ceil(level/2)}d4[slashing]`;
  if(slug==='bow-shock')return `${Math.ceil(level/2)}d4[fire]`;
  if(slug==='danger-zone')return `${Math.ceil(level/2)}d${areaProfile(slug,level,learned).upgraded?8:6}[fire]`;
  assert(['fire','cold','electricity'].includes(calibration),'Invalid calibration.');
  if(slug==='double-down')return `${level>=18?12:10}d6[${calibration}]`;
  return `${slug==='fated-brand'?(level>=17?3:2):Math.ceil(level/2)}d6[${calibration}]`;
}
export function basicMultiplier(degree){
  assert([0,1,2,3].includes(degree),'Native save has no resolved degree of success.');
  return [2,1,0.5,0][degree];
}
export function areaCommit(before,slug,context,id,options={}){
  // Validate the complete activity before separating its start costs from completion rewards.
  validateResourceOptions(options,slug,context,before);
  const preOptions=resolvedOptions(options,slug,null);
  const preview=transition(before,{type:'use',slug,id,...preOptions,outcome:slug==='fated-circle'?'none':undefined},context,catalogue);
  return {...structuredClone(before),revision:preview.revision,events:preview.events,
    cartridges:before.cartridges-(COSTS[slug]??0)+(preOptions.perfect?1:0),perfectRound:preview.perfectRound,once:{...before.once,...(preview.once.fatedRound!==undefined?{fatedRound:preview.once.fatedRound}:{})},cooldowns:preview.cooldowns,dailyUses:preview.dailyUses,
    continuation:null,lastFollowRound:preview.lastFollowRound};
}
export function areaFinish(before,committed,slug,context,id,saves,options={}){
  assert(saves.length===context.targetIds.length&&new Set(saves.map(s=>s.target)).size===saves.length&&saves.every(s=>context.targetIds.includes(s.target)),'Save results must cover each affected target exactly once.');
  for(const save of saves)basicMultiplier(save.degree);
  const failed=saves.filter(s=>s.degree<=1).map(s=>s.target);
  const outcome=slug==='fated-circle'?(failed.length?'failed':'none'):slug==='double-down'&&saves.some(s=>s.degree===0)?'critical-failure':undefined;
  const next=transition(before,{type:'use',slug,id,...resolvedOptions(options,slug,outcome),outcome,failedTargetIds:failed},context,catalogue);
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
    assert(typeof request.id==='string'&&request.id.length>0&&request.id.length<=100&&SAVE_ACTIONS.has(request.slug),'Invalid area request.');
    resourceOptions(request.options);
    assert(!request.options?.discipline,'Powder Discipline requires a critical Strike.');
    const prior=await p.journal(actor);
    if(prior?.id===request.id&&['complete','canceled'].includes(prior.status))return prior;
    assert(!['reserved','committed','recovery'].includes(prior?.status),'Resolve the pending action before starting another.');
    const prepared=await p.prepare(actor,request);
    if(!prepared)return {id:request.id,status:'canceled'};
    try{
      assert((prepared.targets.length>0||p.allowEmpty)&&prepared.targets.length<=50,'The area needs 1–50 valid targets.');
      assert(new Set(prepared.targets.map(t=>t.uuid)).size===prepared.targets.length&&new Set(prepared.targets.map(t=>t.actorUuid)).size===prepared.targets.length,'Multiple target tokens share a creature; adjudicate the area manually.');
      return await this.queue.runMany([actor,...prepared.targets.map(t=>({uuid:t.actorUuid}))],()=>this.#execute(actor,request,prepared));
    }finally{await p.cleanup?.(actor,request,prepared);}
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
    const committed=p.commit?await p.commit(actor,request,before,c):areaCommit(before,request.slug,c,request.id,request.options);
    let progress={id:request.id,slug:request.slug,status:'reserved',before,context:c,prepared,saves:[],applications:[]};
    await p.saveJournal(actor,progress);
    try{
      await p.authorize(actor,request);
      // Committing the activity precedes native saves. Later cancellation cannot refund a begun activity.
      progress={...progress,status:'committed'};await p.saveJournal(actor,progress);await p.write(actor,committed);
      await p.onCommitted?.(actor,request,c,before,committed);
      progress.damage=prepared.targets.length?await p.damage(actor,request,c,prepared,committed):null;await p.saveJournal(actor,progress);
      for(const target of prepared.targets){
        await p.authorize(actor,request);
        const result=await p.save(actor,request,c,target);
        progress.saves.push({target:target.uuid,...result});await p.saveJournal(actor,progress);
        basicMultiplier(result?.degree);
      }
      // These rewards follow resolution of all saves, even if later HP application is interrupted.
      const after=p.finish?await p.finish(actor,request,before,committed,c):areaFinish(before,committed,request.slug,c,request.id,progress.saves,request.options);
      await p.write(actor,after);
      const review=prepared.targets.length?await p.review(actor,request,c,prepared,progress):[];
      assert(review&&review.length===progress.saves.length,'Area resolution needs GM recovery; no damage was applied by this workflow.');
      assert(review.every((r,i)=>r.target===progress.saves[i].target&&[0,0.5,1,2].includes(r.multiplier)
        &&(r.persistent===undefined||typeof r.persistent==='boolean')
        &&(!r.persistent||(request.slug==='bow-shock'&&progress.saves[i].degree<=1))),'Invalid damage review.');
      progress.review=review;await p.saveJournal(actor,progress);
      for(const row of review){
        await p.authorize(actor,request);
        progress.applications.push({target:row.target,status:'applying',multiplier:row.multiplier,persistent:!!row.persistent});await p.saveJournal(actor,progress);
        if(row.multiplier>0||row.persistent)await p.apply(actor,request,c,prepared,progress,row);
        progress.applications.at(-1).status=row.multiplier>0||row.persistent?'complete':'no-damage';await p.saveJournal(actor,progress);
      }
      await p.finalize?.(actor,request,c,prepared,progress);
      progress={...progress,status:'complete',revision:after.revision};await p.saveJournal(actor,progress);
      await p.summary?.(actor,request,progress);return progress;
    }catch(error){
      await p.saveJournal(actor,{...progress,status:'recovery',error:String(error.message??error)});throw error;
    }
  }
}
