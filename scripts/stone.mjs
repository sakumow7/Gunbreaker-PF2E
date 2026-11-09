import {initialState,normalizeState,transition} from './state.mjs';
import {catalogue} from './catalogue.mjs';
import {stoneResistance} from './mechanics.mjs';
import {ActorQueue} from './queue.mjs';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
/** Exact native attack evidence, not a name/most-recent-roll heuristic. */
export function stoneAttack(message){
  const c=message?.flags?.pf2e?.context,roll=message?.rolls?.[0],item=message?.item;
  const strike=c?.action==='strike'&&['weapon','melee'].includes(item?.type);
  if(!message?.isCheckRoll||message.isReroll||c?.isReroll||c?.type!=='attack-roll'||![2,3].includes(roll?.degreeOfSuccess)||(!strike&&item?.type!=='spell'))return null;
  if(!(strike?item.dealsDamage:item.damageKinds?.has('damage')))return null;
  const e={id:message.id,attacker:message.actor?.uuid,origin:c.origin?.token??message.token?.uuid,
    target:c.target?.token,item:item?.uuid,kind:strike?'strike':'spell',degree:roll.degreeOfSuccess};
  if(!e.id||!e.attacker||!e.origin||!e.target||!e.item)return null;
  return {...e,fingerprint:JSON.stringify([e,roll.toJSON()])};
}
export function stoneDamage(attack,message){
  const c=message?.flags?.pf2e?.context,roll=message?.rolls?.[0];
  assert(message?.isDamageRoll&&c?.type==='damage-roll'&&c.sourceType==='attack','Choose a native attack damage card.');
  assert(message.actor?.uuid===attack.attacker&&message.item?.uuid===attack.item,'Damage must come from the triggering attacker and item.');
  assert(!c.target?.token||c.target.token===attack.target,'The damage card names a different target.');
  assert(roll?.constructor?.name==='DamageRoll'&&Number.isFinite(roll.total)&&roll.total>0,'A positive native DamageRoll is required.');
  assert(roll.instances?.some(i=>!i.persistent)&&!roll.instances.some(i=>i.options?.evaluatePersistent),'Persistent ticks cannot trigger Heart of Stone.');
  assert(roll.options?.degreeOfSuccess===attack.degree,'The damage roll must already use the triggering hit or critical-hit outcome. Do not manually double it here.');
  return {id:message.id,fingerprint:JSON.stringify(roll.toJSON())};
}
export function stoneOptions(raw,context,facts){
  if(!facts.conscious||!facts.seesBoth||!facts.enemy||(!facts.self&&!facts.ally))return [];
  if(!context.encounterId||!context.wielding||!context.learned.includes('heart-of-stone'))return [];
  const range=context.learned.includes('guardians-instinct')?30:15;
  if(!Number.isFinite(facts.distance)||facts.distance>range)return [];
  if(facts.self&&facts.attackKind!=='strike')return [];
  let state=normalizeState(raw,context);
  if(state.encounter!==context.encounterId)state=transition(state,{type:'start'},context,catalogue);
  const choices=[];
  for(const instinct of [false,true])for(const mode of ['base','enhanced','reserved','perfect']){
    const op={type:'use',slug:'heart-of-stone',self:!!facts.self,enhance:mode!=='base',reserve:mode==='reserved',perfect:mode==='perfect',instinct};
    try{transition(state,op,context,catalogue);}catch{continue;}
    choices.push({id:`${mode}-${instinct?'instinct':'regular'}`,op,
      resistance:stoneResistance(context.level,{enhanced:op.enhance,legend:context.learned.includes('lions-legend')}),
      label:`${mode==='base'?'Base':mode==='enhanced'?'Enhanced (1 cartridge)':mode==='reserved'?'Reserved Cartridge':'Perfect Chamber'} · ${instinct?'extra ally reaction':'regular reaction'}`});
  }
  return choices;
}
export function stoneEffect(value,eventId){
  assert(Number.isInteger(value)&&value>0,'Invalid Heart of Stone resistance.');
  return {name:'Heart of Stone',type:'effect',img:'icons/magic/defensive/shield-barrier-blue.webp',
    system:{slug:'gunbreaker-heart-of-stone-scoped',level:{value:1},traits:{value:['gunbreaker','magical']},duration:{value:-1,unit:'unlimited',expiry:null,sustained:false},
      rules:[{key:'Resistance',type:'all-damage',value}]},flags:{'gunbreaker-pf2e':{attack:eventId}}};
}
/** Durable window state plus actor queue. The GM pairs damage explicitly; no guessed links. */
export class StoneRunner {
  constructor(ports,actorQueue=new ActorQueue()){this.p=ports;this.actors=actorQueue;this.windows=new ActorQueue();}
  choose(windowId,actor,choiceId,userId,revision,{bulwark=false}={}){
    return this.windows.run({uuid:windowId},async()=>{
      const p=this.p;let reserved,id,nextState,step=null;
      const decline=await this.actors.run(actor,async()=>{
        await p.authorize(actor,userId);assert(typeof bulwark==='boolean','Invalid Bulwark choice.');
        const w=await p.readWindow(windowId);
        assert(w?.status==='awaiting'&&w.revision===revision,'This reaction window has changed or closed.');
        assert(w.candidates.some(c=>c.actor===actor.uuid)&&!w.declined.includes(actor.uuid),'This character has no pending choice.');
        assert((await p.attack(w.attack.id))?.fingerprint===w.attack.fingerprint,'Attack changed or was rerolled; GM reconciliation is required.');
        assert(p.sameTurn(w),'Combat advanced while this reaction was pending.');
        if(choiceId==='decline'){
          const declined=[...w.declined,actor.uuid],status=declined.length===w.candidates.length?'declined':'awaiting';
          const next={...w,declined,status,revision:w.revision+(status==='declined'?1:0)};await p.writeWindow(windowId,next);return next;
        }
        const context=await p.context(actor,w),facts=await p.facts(actor,w),raw=await p.readActor(actor);
        const choice=stoneOptions(raw,context,facts).find(c=>c.id===choiceId);
        assert(choice,'That protection option is no longer available.');
        const journal=await p.journal(actor);assert(!['reserved','committed','recovery'].includes(journal?.status),'Resolve the character’s pending action first.');
        id=`stone:${w.attack.id}:${actor.id??actor.uuid}`;
        let state=normalizeState(raw,context);assert(!state.events.includes(id),'This character already reacted to that attack.');
        if(state.encounter!==context.encounterId)state=transition(state,{type:'start'},context,catalogue);
        nextState=transition(state,{...choice.op,id},context,catalogue);
        if(bulwark){
          assert(!facts.self&&context.learned.includes('bulwark-protocol')&&context.level>=8&&p.prepareStep,'Bulwark Protocol requires its learned feat and another protected ally.');
          step=await p.prepareStep(actor,w); // All original range/eligibility checks precede any Step.
        }
        await p.authorize(actor,userId);
        assert((await p.attack(w.attack.id))?.fingerprint===w.attack.fingerprint&&p.sameTurn(w),'Attack or turn changed before commitment.');
        assert(((await p.readActor(actor))?.revision??0)===(raw?.revision??0),'The tracker changed during the reaction choice.');
        assert(stoneOptions(raw,await p.context(actor,w),await p.facts(actor,w)).some(c=>c.id===choiceId),'Reaction eligibility changed before commitment.');
        if(step)await p.validateStep(actor,w,step);
        reserved={...w,status:'reserving',revision:w.revision+1,protector:actor.uuid,choice,...(step?{bulwark:p.stepEvidence(step)}:{})};
        await p.writeWindow(windowId,reserved);
        try{
          await p.saveJournal(actor,{id,slug:'heart-of-stone',status:'reserved',windowId,before:raw??initialState(),...(step?{bulwark:reserved.bulwark}:{})});
          await p.writeActor(actor,nextState);
        }catch(error){await p.writeWindow(windowId,{...reserved,status:'recovery',error:String(error.message??error)});throw error;}
        return null;
      });
      if(decline)return decline;
      try{
        // Leave the actor queue available while native movement is paused. The window stays reserved,
        // so damage cannot apply until movement has completed and protection is accepted.
        if(step)await p.moveStep(actor,reserved,step);
        return await this.actors.run(actor,async()=>{
          await p.authorize(actor,userId);
          assert((await p.attack(reserved.attack.id))?.fingerprint===reserved.attack.fingerprint&&p.sameTurn(reserved),'Attack or turn changed during the reaction.');
          assert((await p.readActor(actor))?.revision===nextState.revision,'The tracker changed before protection was accepted.');
          if(step){const f=await p.facts(actor,reserved),c=await p.context(actor,reserved);assert(f.conscious&&f.seesBoth&&f.enemy&&f.ally&&!f.self&&c.wielding&&c.learned.includes('heart-of-stone')&&Number.isFinite(f.distance)&&f.distance<=(c.learned.includes('guardians-instinct')?30:15),'Reaction eligibility changed during Bulwark movement.');}
          await p.saveJournal(actor,{id,slug:'heart-of-stone',status:'complete',revision:nextState.revision,...(step?{bulwark:reserved.bulwark}:{})});
          const accepted={...reserved,status:'accepted'};await p.writeWindow(windowId,accepted);return accepted;
        });
      }catch(error){await p.writeWindow(windowId,{...reserved,status:'recovery',error:String(error.message??error)});throw error;}
    });
  }

  continue(windowId){return this.windows.run({uuid:windowId},async()=>{
    const p=this.p;await p.gm();const w=await p.readWindow(windowId);
    assert(w?.status==='awaiting','Only an unresolved reaction can be continued without protection.');
    const next={...w,status:'declined',revision:w.revision+1};await p.writeWindow(windowId,next);return next;
  });}
  apply(windowId,damageId){return this.windows.run({uuid:windowId},async()=>{
    const p=this.p;await p.gm();const w=await p.readWindow(windowId);
    assert(['accepted','declined'].includes(w?.status),'Resolve the reaction before applying damage.');
    assert((await p.attack(w.attack.id))?.fingerprint===w.attack.fingerprint,'Attack changed or was rerolled; GM reconciliation is required.');
    const damage=await p.damage(w.attack,damageId),actor=await p.targetActor(w.attack.target);
    return this.actors.run(actor,async()=>{
      await p.gm();
      assert(!await p.applied(damageId,actor.uuid),'This damage card already has a managed application for that target.');
      const applying={...w,status:'applying',damage,revision:w.revision+1};
      await p.writeWindow(windowId,applying);
      try{
        await p.markApplied(damageId,actor.uuid,{status:'applying',windowId});
        await p.applyNative(actor,w.attack,damage,w.status==='accepted'?w.choice.resistance:0);
        await p.markApplied(damageId,actor.uuid,{status:'complete',windowId});
        const complete={...applying,status:'complete'};await p.writeWindow(windowId,complete);return complete;
      }catch(error){await p.writeWindow(windowId,{...applying,status:'recovery',error:String(error.message??error)});throw error;}
    });
  });}
}
