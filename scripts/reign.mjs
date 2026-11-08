import {normalizeState,transition} from './state.mjs';
import {catalogue} from './catalogue.mjs';
import {strikeOutcome} from './mechanics.mjs';
import {ActorQueue} from './queue.mjs';
export const REIGN_STEPS=new Set(['reign-of-beasts','noble-blood','lion-heart']);
const assert=(ok,message)=>{if(!ok)throw Error(message);};
export function reignFormula(slug){
  assert(REIGN_STEPS.has(slug),'Unknown Reign step.');
  return `${{'reign-of-beasts':2,'noble-blood':3,'lion-heart':4}[slug]}d6[fire]`;
}
/** One action journal spans the native Strike and its independently saved secondary damage. */
export class ReignRunner{
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
    assert(REIGN_STEPS.has(request.slug)&&typeof request.id==='string'&&request.id.length>0&&request.id.length<=100,'Invalid Reign request.');
    assert(!request.options||!Object.keys(request.options).length,'Optional Reign riders are not integrated.');
    const existing=await p.journal(actor);
    if(existing?.id===request.id&&['complete','canceled'].includes(existing.status))return existing;
    assert(!['reserved','committed','recovery'].includes(existing?.status),'Resolve the pending action first.');
    const prepared=await p.prepare(actor,request);
    assert(prepared.candidates.length<=50,'Too many potential secondary targets; adjudicate manually.');
    const actors=[actor,...[prepared.primary,...prepared.candidates].map(t=>({uuid:t.actorUuid}))];
    assert(new Set(actors.map(a=>a.uuid)).size===actors.length,'Multiple tokens share an actor; adjudicate manually.');
    return this.queue.runMany(actors,()=>this.#execute(actor,request,prepared));
  }
  async #execute(actor,request,prepared){
    const p=this.p;await p.authorize(actor,request);
    const existing=await p.journal(actor);
    if(existing?.id===request.id&&['complete','canceled'].includes(existing.status))return existing;
    assert(!['reserved','committed','recovery'].includes(existing?.status),'Resolve the pending action first.');
    const c=await p.validate(actor,request,prepared);let before=normalizeState(await p.read(actor),c);
    if(before.events.includes(request.id))return {id:request.id,status:'complete',duplicate:true};
    if(before.encounter!==c.encounterId)before=transition(before,{type:'start'},c,catalogue);
    transition(before,{type:'use',slug:request.slug,outcome:'miss'},c,catalogue);
    let progress={id:request.id,slug:request.slug,status:'reserved',before,context:c,prepared,saves:[],applications:[]};
    await p.saveJournal(actor,progress);
    try{
      await p.authorize(actor,request);
      // Mark uncertain before invoking the native roller: an exception may follow a visible roll.
      progress.status='committed';await p.saveJournal(actor,progress);
      const attack=await p.attack(actor,request,c,prepared);
      if(!attack){progress.status='canceled';await p.saveJournal(actor,progress);return progress;}
      progress.attack=attack;await p.saveJournal(actor,progress);
      const after=transition(before,{type:'use',slug:request.slug,id:request.id,outcome:strikeOutcome(attack.degree)},c,catalogue);
      await p.write(actor,after);progress.revision=after.revision;await p.saveJournal(actor,progress);
      await p.consumeOpening?.(actor,request);
      if(attack.degree>=2){
        await p.verify(actor,request,c,prepared,progress);
        progress.primaryDamage=await p.primaryDamage(actor,request,c,prepared,progress);await p.saveJournal(actor,progress);
        assert(progress.primaryDamage,'Primary damage was canceled; reconcile the rolled Strike before continuing.');
        await p.verify(actor,request,c,prepared,progress);
        const selected=await p.choose(actor,request,c,prepared,progress);
        assert(Array.isArray(selected),'Secondary selection closed; reconcile this activity.');
        assert(selected.length<=2&&new Set(selected).size===selected.length&&selected.every(id=>prepared.candidates.some(t=>t.uuid===id)),'Choose at most two eligible secondary enemies.');
        progress.prepared={...prepared,selected:true,targets:prepared.candidates.filter(t=>selected.includes(t.uuid))};
        await p.saveJournal(actor,progress);
        await p.verify(actor,request,c,progress.prepared,progress);
        if(selected.length){
          const secondary={...c,targetIds:selected,prepared:progress.prepared};
          progress.damage=await p.damage(actor,request,secondary,progress.prepared,after);await p.saveJournal(actor,progress);
          for(const target of progress.prepared.targets){
            await p.verify(actor,request,c,progress.prepared,progress);
            const save=await p.save(actor,request,secondary,target);
            progress.saves.push({target:target.uuid,...save});await p.saveJournal(actor,progress);
            assert([0,1,2,3].includes(save?.degree),'A native secondary save is unresolved.');
          }
          const review=await p.review(actor,request,secondary,progress.prepared,progress);
          assert(Array.isArray(review)&&review.length===progress.saves.length&&review.every((r,i)=>r.target===progress.saves[i].target&&[0,.5,1,2].includes(r.multiplier)&&!r.persistent),'Secondary damage needs GM recovery.');
          progress.review=review;await p.saveJournal(actor,progress);
          for(const row of review){
            await p.verify(actor,request,c,progress.prepared,progress);
            progress.applications.push({target:row.target,status:'applying',multiplier:row.multiplier});await p.saveJournal(actor,progress);
            if(row.multiplier>0)await p.apply(actor,request,secondary,progress.prepared,progress,row);
            progress.applications.at(-1).status=row.multiplier>0?'complete':'no-damage';await p.saveJournal(actor,progress);
          }
        }
      }
      progress.status='complete';await p.saveJournal(actor,progress);await p.summary(actor,request,progress);return progress;
    }catch(error){await p.saveJournal(actor,{...progress,status:'recovery',error:String(error.message??error)});throw error;}
  }
}
