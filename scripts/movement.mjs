import {normalizeState,transition} from './state.mjs';
import {catalogue} from './catalogue.mjs';
import {assertFreshIntent} from './requests.mjs';
export const MOVEMENT_ACTIONS=new Set(['guarded-advance','trajectory']);
const assert=(ok,m)=>{if(!ok)throw Error(m);};
export function capturePath(movement,origin){
 assert(!movement.constrainOptions?.ignoreWalls&&!movement.constrainOptions?.ignoreCost,'Movement cannot bypass walls or terrain constraints.');
 const raw=movement.pending?.waypoints;assert(Array.isArray(raw)&&raw.length&&raw.length<=250,'A measured movement path is required.');
 const points=[origin,...raw].map(p=>{
  assert(Number.isFinite(p.x)&&Number.isFinite(p.y)&&!p.teleport&&(!p.action||p.action==='walk'),'Use an ordinary ground movement path.');
  assert((p.elevation??origin.elevation)===origin.elevation&&(p.level??origin.level)===origin.level,'Elevation/level-changing paths require manual adjudication.');
  assert((p.width??origin.width)===origin.width&&(p.height??origin.height)===origin.height,'Resizing during movement is unsupported.');
  return {x:p.x,y:p.y,elevation:origin.elevation,level:origin.level,width:origin.width,height:origin.height,terrain:{difficulty:p.terrain?.difficulty??1}};
 }).filter((p,i,a)=>!i||p.x!==a[i-1].x||p.y!==a[i-1].y);
 return points;
}
/** Intersection with open interiors: merely touching an adjacent creature's edge is allowed. */
export function crossesRectangle(a,b,r){
 let lo=0,hi=1;
 for(const axis of ['x','y']){
  const min=r[axis]+1e-7,max=r[axis]+r[axis==='x'?'width':'height']-1e-7,d=b[axis]-a[axis];
  if(Math.abs(d)<1e-9){if(a[axis]<=min||a[axis]>=max)return false;continue;}
  const t1=(min-a[axis])/d,t2=(max-a[axis])/d;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;
 }
 return hi>=0&&lo<=1;
}
export function pathCrossesCreature(path,blocker,mover,size){
 // Inflate the blocker by the mover footprint; path coordinates represent the mover's top-left corner.
 const r={x:blocker.x-mover.width*size,y:blocker.y-mover.height*size,width:(blocker.width+mover.width)*size,height:(blocker.height+mover.height)*size};
 return path.slice(1).some((p,i)=>crossesRectangle(path[i],p,r));
}
export function adjacentAt(point,mover,target,size){
 const ax1=point.x,ay1=point.y,ax2=ax1+mover.width*size,ay2=ay1+mover.height*size;
 const bx1=target.x,by1=target.y,bx2=bx1+target.width*size,by2=by1+target.height*size;
 const gapX=Math.max(0,bx1-ax2,ax1-bx2),gapY=Math.max(0,by1-ay2,ay1-by2);
 const overlap=ax1<bx2&&ax2>bx1&&ay1<by2&&ay2>by1;
 // Top-left positions are snapped: adjacent occupied cells touch an edge or corner.
 return !overlap&&gapX<1e-6&&gapY<1e-6;
}
export class MovementRunner{
 #pending=new Map();
 constructor(ports,queue){this.p=ports;this.queue=queue;}
 execute(actor,request){
  if(this.#pending.has(actor.uuid))return Promise.reject(Error('This actor already has a movement request.'));
  const task=this.#run(actor,structuredClone(request));this.#pending.set(actor.uuid,task);return task.finally(()=>this.#pending.delete(actor.uuid));
 }
 async #run(actor,req){
  const p=this.p;await p.authorize(actor,req);
  assert(MOVEMENT_ACTIONS.has(req.slug)&&typeof req.id==='string'&&req.id.length>0&&req.id.length<=100,'Invalid movement request.');
  assert(!Object.values(req.options??{}).some(Boolean),'Movement has no cartridge resource choices.');
  const prior=await p.journal(actor);if(prior?.id===req.id&&['complete','canceled'].includes(prior.status))return prior;
  assert(!['reserved','committed','recovery'].includes(prior?.status),'Resolve pending automation before moving.');
  const c=await p.context(actor,req),raw=await p.read(actor),expected={revision:raw?.revision??0,encounterId:c.encounterId,round:c.round,turn:c.turn};
  if(req.intent||req.expected)assertFreshIntent(req.intent??req.expected,c,raw);
  let before=normalizeState(raw,c);if(before.encounter!==c.encounterId)before=transition(before,{type:'start'},c,catalogue);
  if(before.events.includes(req.id))return {id:req.id,status:'complete',duplicate:true};
  const committed=transition(before,{type:'use',slug:req.slug,id:req.id},c,catalogue);
  const plan=await p.prepare(actor,req,c);if(!plan)return {id:req.id,status:'canceled'};
  let journal;
  try{
   await this.queue.runMany(plan.actors??[actor],async()=>{
    await p.authorize(actor,req);assertFreshIntent(expected,await p.context(actor,req),await p.read(actor));
    assert(!['reserved','committed','recovery'].includes((await p.journal(actor))?.status),'Resolve pending automation before moving.');
    await p.validate(actor,req,c,plan);
    journal={id:req.id,slug:req.slug,status:'committed',before,plan:p.evidence(plan)};await p.saveJournal(actor,journal);
    await p.write(actor,committed);journal.stage='moving';await p.saveJournal(actor,journal);
   });
   // The persistent execution journal blocks another source activity. Release actor queues while native
   // movement is paused so reactions can finish; never wait on movement while holding their actor locks.
   assert(await p.move(actor,req,c,plan),'Movement was stopped or prevented; reconcile the spent activity.');
   return await this.queue.runMany(plan.actors??[actor],async()=>{
    assert((await p.journal(actor))?.id===req.id&&(await p.journal(actor))?.status==='committed','Movement was reconciled or superseded while pending.');
    journal.stage='moved';await p.saveJournal(actor,journal);
    await p.authorize(actor,req);assertFreshIntent({...expected,revision:committed.revision},await p.context(actor,req),await p.read(actor));
    await p.arrived(actor,req,c,plan);
    if(req.slug==='guarded-advance'){
     journal.stage='stance';await p.saveJournal(actor,journal);await p.stance(actor,req,c,plan);
     journal.stage='strike';await p.saveJournal(actor,journal);const result=await p.strike(actor,req,c,plan);
     if(result){
      journal.result=result;await p.saveJournal(actor,journal);
      assert([0,1,2,3].includes(result.degree),'The subordinate Strike has no resolved native outcome.');
      assertFreshIntent({...expected,revision:committed.revision},await p.context(actor,req),await p.read(actor));
      const after=transition(before,{type:'use',slug:req.slug,id:req.id,struck:true,outcome:result.degree===3?'critical':result.degree===2?'hit':'miss'},c,catalogue);after.revision=committed.revision+1;
      await p.write(actor,after);await p.damage(actor,req,c,plan,result);
     }
    }
    journal={...journal,status:'complete',stage:'complete'};await p.saveJournal(actor,journal);return journal;
   });
  }catch(e){
   if(journal)await this.queue.run(actor,async()=>{const current=await p.journal(actor);if(current?.id===req.id&&current.status==='committed')await p.saveJournal(actor,{...journal,status:'recovery',error:e.message});});
   throw e;
  }finally{await p.cleanup?.(plan);}
 }
}
