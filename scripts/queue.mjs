/** Shared by manual and native module operations on the elected GM client. */
export class ActorQueue {
  #tasks=new Map();
  run(actor,fn){
    const key=actor.uuid;
    const task=(this.#tasks.get(key)??Promise.resolve()).catch(()=>{}).then(fn);
    this.#tasks.set(key,task);
    return task.finally(()=>{if(this.#tasks.get(key)===task)this.#tasks.delete(key);});
  }
}
