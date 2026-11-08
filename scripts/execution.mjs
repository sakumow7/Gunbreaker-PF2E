import {resolvedOptions,validateResourceOptions} from './options.mjs';
import {transition,normalizeState} from './state.mjs';
import {catalogue} from './catalogue.mjs';
import {strikeOutcome,nativeWeaponDice} from './mechanics.mjs';
import {ActorQueue} from './queue.mjs';
import {REIGN_STEPS} from './reign.mjs';
import {SUPPORT_ACTIONS} from './support.mjs';
import {SAVE_ACTIONS} from './area.mjs';
export const CORE_STRIKES=new Set(['keen-edge','brutal-shell','solid-barrel','burst-strike','gnashing-fang','savage-claw','wicked-talon','sonic-break','lightning-shot']);
export const CORE_FOLLOWUPS=new Set(['hypervelocity','jugular-rip','abdomen-tear','eye-gouge']);
export const CORE_EFFECTS=new Set(['royal-guard','release-royal-guard','camouflage','nebula','no-mercy','superbolide','perfect-chamber','bloodfest']);
export const SUPPORTED=new Set([...CORE_STRIKES,...CORE_FOLLOWUPS,...CORE_EFFECTS,...SAVE_ACTIONS,...REIGN_STEPS,...SUPPORT_ACTIONS]);
/**
 * Side-effect orchestration with injected native ports. One authority owns this runner.
 * A journal reservation survives client crashes. Never refund after a native check resolves.
 * Pending/recovery events block new execution until the GM reconciles them.
 */
export class ActionRunner {
  constructor(ports,queue=new ActorQueue()){this.ports=ports;this.queue=queue;}
  async execute(actor,request){
    const captured=structuredClone(request);
    const actors=this.ports.lockActors?await this.ports.lockActors(actor,captured):[actor];
    return this.queue.runMany(actors,()=>this.#execute(actor,captured));
  }
  async #execute(actor,request){
    const p=this.ports;
    await p.authorize(actor,request);
    if(!request.id || typeof request.id!=='string' || request.id.length>100)throw Error('A valid execution ID is required.');
    if(!SUPPORTED.has(request.slug)||SAVE_ACTIONS.has(request.slug)||REIGN_STEPS.has(request.slug)||SUPPORT_ACTIONS.has(request.slug))throw Error('This action is not yet supported by this native executor.');
    let context=await p.context(actor,request);
    const raw=await p.read(actor);
    const checkpoint={revision:raw?.revision??0,encounterId:context.encounterId,round:context.round,turn:context.turn};
    let state=normalizeState(raw,context);
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
    const options=validateResourceOptions(request.options,request.slug,context,state);
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
        committed=true;await p.saveJournal(actor,{...entry,status:'committed'});
        result=await p.attack(actor,request,context);
        if(!result){await p.saveJournal(actor,{...entry,status:'canceled'});return {id:request.id,status:'canceled'};}
        committed=true;
        await p.saveJournal(actor,{...entry,status:'committed',result});
        const current=await p.context(actor,request),currentState=await p.read(actor);
        if((currentState?.revision??0)!==checkpoint.revision||['encounterId','round','turn'].some(k=>current[k]!==checkpoint[k]))throw Error('Combat or tracker changed during the native roll; reconcile the resolved attack.');
        // The native callback/result is authoritative for hit/miss; never ask the player to enter it.
        const outcome=strikeOutcome(result.degree);
        const op={...preOp,...resolvedOptions(options,request.slug,outcome),id:request.id,outcome};
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
      const done={id:request.id,slug:request.slug,status:'complete',revision:state.revision,riders:(await p.journal(actor))?.riders??[]};
      await p.saveJournal(actor,done);return done;
    }catch(error){
      await p.saveJournal(actor,{...entry,...await p.journal(actor),status:committed?'recovery':'canceled',error:String(error.message??error)});
      throw error;
    }
  }
}
export {nativeWeaponDice};
