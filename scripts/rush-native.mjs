import {AreaRunner} from './area.mjs';
import {createSavePorts} from './area-native.mjs';
import {ActorQueue} from './queue.mjs';
const MOD='gunbreaker-pf2e',SLUG='relentless-rush';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const busy=s=>['reserved','committed','recovery'].includes(s);
const pending=s=>['arming','armed','resolving','recovery'].includes(s);
const held=actor=>actor.itemTypes.weapon.filter(w=>w.system.traits.value.includes('gunbreaker')&&w.system.equipped.carryType==='held'&&w.system.equipped.handsHeld>0);
const order=combat=>combat.turns.map(t=>({id:t.id,initiative:t.initiative}));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function rushDue(state,combat,combatant){
  return state?.status==='armed'&&state.encounterId===combat.id&&state.combatantId===combatant.id&&combat.round>=state.dueRound;
}
export function rushResistance(level,time,initiative,execution){
  return {name:'Relentless Rush Resistance',type:'effect',img:'icons/magic/defensive/shield-barrier-glowing-blue.webp',
    system:{slug:'gunbreaker-relentless-rush-resistance',level:{value:level},duration:{value:1,unit:'rounds',expiry:'turn-start',sustained:false},
      start:{value:time,initiative},rules:[{key:'Resistance',type:'all-damage',value:Math.floor(level/2)}]},flags:{[MOD]:{rush:execution}}};
}
/** The follow-up entry is private to the GM turn hook, never a player request phase. */
export function createRushRunner(deps,queue=new ActorQueue()){
  const {authority,contextFor,actorToken}=deps,inflight=new Map();
  const initial=createSavePorts(deps,{allowEmpty:true});
  const delayed=createSavePorts(deps,{automatic:true,allowEmpty:true,formulaFor:()=> '4d6[fire]'});
  const removeResistance=async(actor,state)=>{
    const ids=actor.items.filter(i=>i.type==='effect'&&i.flags?.[MOD]?.rush===state.id).map(i=>i.id);
    if(ids.length)await actor.deleteEmbeddedDocuments('Item',ids);
  };
  const current=(actor,state,c=contextFor(actor))=>{
    const combat=game.combat,combatant=combat?.combatant;
    assert(state?.status==='resolving'&&c.encounterId===state.encounterId&&combatant?.id===state.combatantId
      &&c.inTurn&&c.round===state.dueRound&&same(order(combat),state.order),'The scheduled Rush turn changed; reconcile the delayed blast.');
    assert(actorToken(actor).document.uuid===state.tokenUuid,'The Rush origin token changed.');
    assert(!actor.isDead&&!actor.hasCondition('unconscious')&&held(actor).length,'The delayed blast requires consciousness and a held gunblade.');
  };
  const initialRunner=new AreaRunner({...initial,allowEmpty:true,
    prepare:async(actor,request)=>{
      assert(!pending(actor.getFlag(MOD,'rush')?.status),'Resolve the previous Relentless Rush first.');
      assert(game.combat?.combatant?.actor?.uuid===actor.uuid,'Use Relentless Rush on your own turn.');
      return initial.prepare(actor,request);
    },
    validate:async(actor,request,prepared)=>{
      assert(!pending(actor.getFlag(MOD,'rush')?.status),'Resolve the previous Relentless Rush first.');
      return initial.validate(actor,request,prepared);
    },
    finalize:async(actor,request,c,prepared)=>{
      const now=contextFor(actor),combat=game.combat;
      assert(now.encounterId===c.encounterId&&now.round===c.round&&now.turn===c.turn&&now.inTurn,'Combat advanced before Rush protection could be armed.');
      const state={id:request.id,blastId:foundry.utils.randomID(),status:'arming',encounterId:c.encounterId,combatantId:combat.combatant.id,
        tokenUuid:prepared.origin.uuid,dueRound:c.round+1,order:order(combat)};
      // Record uncertain effect creation before the document write. Recovery never recreates it.
      await actor.setFlag(MOD,'rush',state);
      await actor.createEmbeddedDocuments('Item',[rushResistance(c.level,game.time.worldTime,combat.combatant.initiative,request.id)]);
      await actor.setFlag(MOD,'rush',{...state,status:'armed'});
    }
  },queue);
  const followup=new AreaRunner({...delayed,allowEmpty:true,
    authorize:(actor,request)=>{delayed.authorize(actor,request);current(actor,actor.getFlag(MOD,'rush'));},
    prepare:async(actor,request)=>{current(actor,actor.getFlag(MOD,'rush'));return delayed.prepare(actor,request);},
    validate:async(actor,request,prepared)=>{current(actor,actor.getFlag(MOD,'rush'));return delayed.validate(actor,request,prepared);},
    // This is an automatic effect, not another use of the two-action feat.
    commit:(_actor,_request,before)=>before,
    finish:(_actor,_request,_before,committed)=>committed,
    finalize:async(actor)=>{const state=actor.getFlag(MOD,'rush');current(actor,state);await actor.setFlag(MOD,'rush',{...state,status:'complete'});}
  },queue);
  async function advance(actor,combat,combatant){
    const state=actor.getFlag(MOD,'rush');
    if(!rushDue(state,combat,combatant))return;
    const snapshot=contextFor(actor),revision=actor.getFlag(MOD,'tracker')?.revision;
    try{
      const claimed=await queue.run(actor,async()=>{
        delayed.authorize(actor);
        const latest=actor.getFlag(MOD,'rush');if(!rushDue(latest,combat,combatant))return null;
        assert(!busy(actor.getFlag(MOD,'execution')?.status),'Resolve the pending action before the delayed blast.');
        assert(game.combat===combat&&combat.combatant?.id===combatant.id&&snapshot.round===combat.round&&snapshot.inTurn
          &&actor.getFlag(MOD,'tracker')?.revision===revision,'The turn or tracker changed before Rush could trigger.');
        const claimed={...latest,status:'resolving'};
        await actor.setFlag(MOD,'rush',claimed);
        await removeResistance(actor,claimed);
        assert(combat.round===claimed.dueRound&&same(order(combat),claimed.order),'The Rush turn was skipped or initiative changed; reconcile it manually.');
        assert(actorToken(actor).document.uuid===claimed.tokenUuid,'The Rush origin token changed.');
        if(actor.isDead||actor.hasCondition('unconscious')||!held(actor).length){
          await actor.setFlag(MOD,'rush',{...claimed,status:'skipped',reason:'Not conscious or not wielding a gunblade at turn start.'});return null;
        }
        return claimed;
      });
      if(!claimed)return;
      const weapons=held(actor);
      // Any held gunblade satisfies the requirement; this blast does not use weapon damage.
      const result=await followup.execute(actor,{id:claimed.blastId,slug:SLUG,weaponId:weapons[0].id,map:0,targetIds:[]});
      assert(result?.status==='complete','The triggered blast was closed; reconcile it rather than replaying.');
      return result;
    }catch(error){
      const latest=actor.getFlag(MOD,'rush');
      if(latest?.id===state.id)await actor.setFlag(MOD,'rush',{...latest,status:'recovery',error:String(error.message??error)});
      throw error;
    }
  }
  return {
    execute:(actor,request)=>initialRunner.execute(actor,request),
    advance:(actor,combat,combatant)=>{
      if(inflight.has(actor.uuid))return inflight.get(actor.uuid);
      const task=advance(actor,combat,combatant);inflight.set(actor.uuid,task);
      return task.finally(()=>{if(inflight.get(actor.uuid)===task)inflight.delete(actor.uuid);});
    },
    reconcile:async(actor,reason)=>queue.run(actor,async()=>{
      authority(actor);const state=actor.getFlag(MOD,'rush');
      if(!['armed','arming','resolving'].includes(state?.status))return;
      await actor.setFlag(MOD,'rush',{...state,status:'recovery',error:reason});
      await removeResistance(actor,state);
      ui.notifications.warn(`Relentless Rush requires GM reconciliation: ${reason}`);
    })
  };
}
export function installRushHooks(runner){
  const notify=error=>ui.notifications.warn(`Relentless Rush: ${error.message??error}`);
  const gm=()=>game.user.isGM&&game.users.filter(u=>u.active&&u.isGM).length===1;
  Hooks.on('pf2e.startTurn',(combatant,combat)=>{
    if(!gm()||!combatant.actor)return;
    return runner.advanceRush(combatant.actor,combat,combatant).catch(notify);
  });
  Hooks.on('deleteCombat',combat=>{
    if(!gm())return;
    for(const actor of new Set(combat.turns.map(t=>t.actor).filter(Boolean))){
      if(actor.getFlag(MOD,'rush')?.encounterId===combat.id)runner.reconcileRush(actor,'The encounter ended before the blast resolved.').catch(notify);
    }
  });
  // Reconnect cannot prove whether a due turn-start effect already happened. Never auto-replay it.
  if(gm())for(const actor of new Set([...(game.actors??[]),...(game.combat?.turns.map(t=>t.actor).filter(Boolean)??[])])){
    const state=actor.getFlag(MOD,'rush');if(!state)continue;
    const combat=game.combat;
    if(['arming','resolving'].includes(state.status)||(state.status==='armed'&&(!combat?.started||combat.id!==state.encounterId||combat.round>=state.dueRound))){
      runner.reconcileRush(actor,'Reconnect found an uncertain or already-due blast; inspect the journal.').catch(notify);
    }
  }
}
