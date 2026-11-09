const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(v);
const text=(v,max)=>typeof v==='string'&&v.length>0&&v.length<=max;
const exact=(v,keys)=>plain(v)&&Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
export function validChoicePrompt(p,now){
 return exact(p,['version','id','parentId','actorUuid','gmId','ownerId','sceneId','title','text','choices','expiresAt'])&&p.version===1&&id(p.id)&&text(p.parentId,100)
  &&typeof p.actorUuid==='string'&&/^(Actor\.[a-zA-Z0-9_-]+|Scene\.[a-zA-Z0-9_-]+\.Token\.[a-zA-Z0-9_-]+\.Actor\.[a-zA-Z0-9_-]+)$/.test(p.actorUuid)
  &&id(p.gmId)&&id(p.ownerId)&&id(p.sceneId)&&text(p.title,80)&&text(p.text,600)
  &&Array.isArray(p.choices)&&p.choices.length>0&&p.choices.length<=50&&p.choices.every(c=>exact(c,['id','label'])&&id(c.id)&&text(c.label,120))
  &&new Set(p.choices.map(c=>c.id)).size===p.choices.length&&Number.isFinite(p.expiresAt)&&p.expiresAt>now&&p.expiresAt<=now+65000;
}
export function validChoiceResponse(r){return exact(r,['version','id','choiceId'])&&r.version===1&&id(r.id)&&(r.choiceId===null||id(r.choiceId));}

/** Only current in-memory GM requests may resolve. Document edits/reloads never replay a choice. */
export class OwnerChoiceBroker {
 constructor(ports){this.ports=ports;this.pending=new Map();}
 async ask(actor,request,options){
  const p=this.ports;request=structuredClone(request);options=structuredClone(options);
  await p.authorize(actor,request.requesterId);
  if([...this.pending.values()].some(e=>e.actor.uuid===actor.uuid))throw Error('This character already has an unresolved rider choice.');
  const prompt={version:1,id:p.id(),parentId:request.id,actorUuid:actor.uuid,gmId:p.gmId(),ownerId:request.requesterId,sceneId:p.sceneId(),
   title:options.title,text:options.text,choices:structuredClone(options.choices),expiresAt:p.now()+60000};
  if(!validChoicePrompt(prompt,p.now())||this.pending.has(prompt.id))throw Error('Invalid or duplicate rider choice prompt.');
  return new Promise((resolve,reject)=>{
   const entry={actor,prompt,resolve,reject};this.pending.set(prompt.id,entry);
   entry.timer=p.timer(()=>this.finish(entry,Error('The player did not answer the rider choice in time. Reconcile the parent action; do not repeat it.')),60000);
   // Register before delivery: a fast response can arrive before create resolves.
   Promise.resolve().then(()=>p.send(prompt)).catch(()=>this.finish(entry,Error('Rider choice delivery is uncertain. Reconcile the parent action before continuing.')));
  });
 }
 finish(entry,error,value){
  if(this.pending.get(entry.prompt.id)!==entry)return;
  this.pending.delete(entry.prompt.id);this.ports.clearTimer(entry.timer);
  if(error)entry.reject(error);else entry.resolve(value);
 }
 async receive(raw,creatorId,authorId){
  if(!validChoiceResponse(raw))return;
  const response=structuredClone(raw),entry=this.pending.get(response.id);
  if(!entry||creatorId!==authorId||creatorId!==entry.prompt.ownerId)return;
  if(response.choiceId!==null&&!entry.prompt.choices.some(c=>c.id===response.choiceId))return;
  try{
   await this.ports.authorize(entry.actor,creatorId);
   if(this.ports.gmId()!==entry.prompt.gmId)throw Error('The rider coordinator changed. Reconcile the parent action.');
   if(this.ports.now()>=entry.prompt.expiresAt)throw Error('The rider choice expired. Reconcile the parent action.');
   if(this.ports.sceneId()!==entry.prompt.sceneId)throw Error('The GM scene changed while awaiting the rider choice.');
   this.finish(entry,null,response.choiceId);
  }catch(e){this.finish(entry,e);}
 }
}
