/** Shared by manual and native module operations on the elected GM client. */
export class ActorQueue {
  #tasks=new Map();
  run(actor,fn){
    return this.runMany([actor],fn);
  }
  runMany(actors,fn){
    const keys=[...new Set(actors.map(a=>a.uuid))];
    if(!keys.length||keys.some(k=>typeof k!=='string'||!k))throw Error('Actor queue requires valid identifiers.');
    // Reserve every actor synchronously before waiting; never acquire one lock while holding another.
    const previous=[...new Set(keys.map(k=>this.#tasks.get(k)).filter(Boolean))];
    const task=Promise.allSettled(previous).then(fn);
    for(const key of keys)this.#tasks.set(key,task);
    return task.finally(()=>{for(const key of keys)if(this.#tasks.get(key)===task)this.#tasks.delete(key);});
  }
}
