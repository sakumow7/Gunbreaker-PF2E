import {initialState,transition} from './state.mjs';
import {catalogue} from './catalogue.mjs';
const MOD='gunbreaker-pf2e';
const coordinator=()=>game.user.isGM&&game.users.filter(u=>u.active&&u.isGM).length===1;
const busy=actor=>['reserved','committed','recovery'].includes(actor.getFlag(MOD,'execution')?.status);
export function createEncounterLifecycle(contextFor,queue){
 return {sync:async actor=>{
  if(!coordinator()||actor?.type!=='character'||!actor.isOwner||!actor.items.some(i=>i.type==='class'&&(i.slug??i.system.slug)==='gunbreaker'))return;
  const tokens=actor.getActiveTokens();if(tokens.length!==1||tokens[0].document.parent.id!==canvas.scene?.id)return;
  return queue.run(actor,async()=>{
   if(!coordinator()||!actor.isOwner||busy(actor))return;
   if((game.combat?.turns.filter(t=>t.actor?.uuid===actor.uuid).length??0)>1)return;
   const c=contextFor(actor),raw=actor.getFlag(MOD,'tracker')??initialState();
   if(c.learned.some(s=>['twin-cartridge','overcharged-gauge'].includes(s)))return;
   if(c.encounterId&&raw.encounter!==c.encounterId)await actor.setFlag(MOD,'tracker',transition(raw,{type:'start'},c,catalogue));
   else if(!c.encounterId&&raw.encounter)await actor.setFlag(MOD,'tracker',transition(raw,{type:'end'},c,catalogue));
   if(!c.encounterId||!c.wielding||actor.isDead||actor.hasCondition('unconscious')){
    const ids=actor.items.filter(i=>i.type==='effect'&&(i.slug??i.system.slug)==='royal-guard-stance'&&i.flags?.[MOD]?.execution).map(i=>i.id);
    if(ids.length)await actor.deleteEmbeddedDocuments('Item',ids);
   }
  });
 }};
}
export function installEncounterHooks(contextFor,queue){
 const lifecycle=createEncounterLifecycle(contextFor,queue);
 const sync=actor=>{if(actor)void lifecycle.sync(actor).catch(e=>ui.notifications.warn(`Gunbreaker encounter: ${e.message}`));};
 const sceneActors=()=>[...new Map((canvas.tokens?.placeables??[]).filter(t=>t.actor).map(t=>[t.actor.uuid,t.actor])).values()];
 const all=()=>{for(const actor of sceneActors())sync(actor);};
 Hooks.on('updateCombat',all);Hooks.on('deleteCombat',all);Hooks.on('createCombatant',all);Hooks.on('deleteCombatant',all);Hooks.on('canvasReady',all);
 Hooks.on('updateActor',sync);
 for(const hook of ['createItem','updateItem','deleteItem'])Hooks.on(hook,item=>{if(['weapon','condition'].includes(item.type))sync(item.actor);});
 all();return lifecycle;
}
