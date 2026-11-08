import {transition,normalizeState,initialState} from './state.mjs';
import {catalogue} from './catalogue.mjs';
import {strikeOutcome,nativeWeaponDice} from './mechanics.mjs';
import {ActorQueue} from './queue.mjs';
import {REIGN_STEPS} from './reign.mjs';
import {SAVE_ACTIONS} from './area.mjs';
export const CORE_STRIKES=new Set(['keen-edge','brutal-shell','solid-barrel','burst-strike','gnashing-fang','savage-claw','wicked-talon','sonic-break']);
export const CORE_FOLLOWUPS=new Set(['hypervelocity','jugular-rip','abdomen-tear','eye-gouge']);
export const CORE_EFFECTS=new Set(['royal-guard','release-royal-guard','camouflage','nebula','no-mercy','superbolide','perfect-chamber','bloodfest']);
export const SUPPORTED=new Set([...CORE_STRIKES,...CORE_FOLLOWUPS,...CORE_EFFECTS,...SAVE_ACTIONS,...REIGN_STEPS]);
/**
 * Side-effect orchestration with injected native ports. One authority owns this runner.
 * A journal reservation survives client crashes. Never refund after a native check resolves.
 * Pending/recovery events block new execution until the GM reconciles them.
 */
export class ActionRunner {
  constructor(ports,queue=new ActorQueue()){this.ports=ports;this.queue=queue;}
  execute(actor,request){
    return this.queue.run(actor,()=>this.#execute(actor,request));
  }
  async #execute(actor,request){
    const p=this.ports;
    await p.authorize(actor,request);
    if(!request.id || typeof request.id!=='string' || request.id.length>100)throw Error('A valid execution ID is required.');
    if(!SUPPORTED.has(request.slug)||SAVE_ACTIONS.has(request.slug)||REIGN_STEPS.has(request.slug))throw Error('This action is not yet supported by this native executor.');
    let context=await p.context(actor,request);
    let state=normalizeState(await p.read(actor),context);
    const existing=await p.journal(actor);
    if(existing?.id===request.id){
      if(existing.status==='complete'||existing.status==='canceled')return existing;
      throw Error('This action needs GM recovery; it will not be executed twice.');
    }
    if(existing && ['reserved','committed','recovery'].includes(existing.status))throw Error('Resolve the pending action before starting another.');
    if(state.events.includes(request.id))return {id:request.id,status:'complete',duplicate:true};
    await p.preflight?.(actor,request,context,state);
    if(context.encounterId && state.encounter!==context.encounterId){
      state=transition(state,{type:'start'},context,catalogue);
    }
    const strike=CORE_STRIKES.has(request.slug);
    const options=request.options??{};
    if(Object.keys(options).some(key=>!['expertise','perfect'].includes(key)))throw Error('This optional rider is not yet integrated with native execution.');
    // Validate all mechanical prerequisites before asking for a roll or mutating an effect.
    const preOp={type:'use',slug:request.slug,...options,outcome:strike?'miss':undefined};
    // Hit-gated optional resource choices are selected from the actual result, not a speculative miss.
    delete preOp.discipline;delete preOp.cadence;
    transition(state,preOp,context,catalogue);
    await p.validate(actor,request,context,state);
    await p.authorize(actor,request);
    const entry={id:request.id,slug:request.slug,status:'reserved',before:state,context,request,started:context.time};
    await p.saveJournal(actor,entry);
    let committed=false;
    try {
      let result;
      if(strike){
        await p.authorize(actor,request);
        result=await p.attack(actor,request,context);
        if(!result){await p.saveJournal(actor,{...entry,status:'canceled'});return {id:request.id,status:'canceled'};}
        committed=true;
        await p.saveJournal(actor,{...entry,status:'committed',result});
        // The native callback/result is authoritative for hit/miss; never ask the player to enter it.
        const op={...preOp,id:request.id,outcome:strikeOutcome(result.degree)};
        context={...context,weaponDice:result.weaponDice,weaponId:result.weaponId};
        state=transition(state,op,context,catalogue);
      }else{
        committed=true;
        await p.saveJournal(actor,{...entry,status:'committed'});
        state=transition(state,{...preOp,id:request.id},context,catalogue);
      }
      // Costs and openings commit before damage dialogs or effect writes, so cancellation cannot refund a Strike.
      await p.write(actor,state);
      await p.resolve(actor,request,context,entry.before,state,result);
      const done={id:request.id,slug:request.slug,status:'complete',revision:state.revision};
      await p.saveJournal(actor,done);return done;
    }catch(error){
      await p.saveJournal(actor,{...entry,status:committed?'recovery':'canceled',error:String(error.message??error)});
      throw error;
    }
  }
}
export {nativeWeaponDice};
