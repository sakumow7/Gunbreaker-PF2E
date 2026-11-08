import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRushRunner,rushResistance,installRushHooks} from '../scripts/rush-native.mjs';
import {ActorQueue} from '../scripts/queue.mjs';
import {validateIntent} from '../scripts/requests.mjs';
import {setup} from './helpers/native-save-harness.mjs';
const MOD='gunbreaker-pf2e';
function rush(options={}){
 const h=setup({slug:'relentless-rush',level:18,calibration:'cold',killOnApply:false,...options});
 h.actor.itemTypes={weapon:[{id:'blade',system:{traits:{value:['gunbreaker']},equipped:{carryType:'held',handsHeld:1}}}]};
 h.combatant={id:'hero-turn',actor:h.actor,initiative:20};
 game.combat={id:'combat',started:true,round:1,combatant:h.combatant,turns:[h.combatant]};
 game.time={worldTime:1000};game.actors=[h.actor];foundry.utils.randomID=()=> 'delayed-blast';
 h.created=[];h.deleted=[];
 h.actor.createEmbeddedDocuments=async(_type,items)=>{
  h.created.push(...items);if(h.failEffect)throw Error('Effect write uncertain');
  h.actor.items.push(...items.map((item,i)=>({...item,id:`effect${i}`})));
 };
 h.actor.deleteEmbeddedDocuments=async(_type,ids)=>{h.deleted.push(...ids);h.actor.items=h.actor.items.filter(i=>!ids.includes(i.id));};
 const queue=new ActorQueue();h.queue=queue;h.runner=createRushRunner(h.deps,queue);
 h.next=()=>{h.c.time+=6;game.time.worldTime+=6;h.c.round++;h.c.turn++;game.combat.round++;};
 h.advance=()=>h.runner.advance(h.actor,game.combat,h.combatant);
 return h;
}
test('Rush uses fixed fire and native resistance, then fresh targets and saves without a new frequency',async()=>{
 const h=rush({degrees:[1,3],distances:[5,10]});await h.runner.execute(h.actor,h.req);
 assert.deepEqual(h.rolls,['8d6[fire]']);assert.equal(h.applied.length,1);assert.deepEqual(h.flags.tracker.cooldowns['relentless-rush'],[1000]);
 assert.equal(h.created.length,1);assert.deepEqual(h.created[0].system.rules,[{key:'Resistance',type:'all-damage',value:9}]);
 assert.equal(h.created[0].system.duration.expiry,'turn-start');assert.equal(h.flags.rush.status,'armed');
 h.targets[0].distance=10;h.targets[1].distance=5;h.self.document.x=100;h.next();
 // A free turn-start effect does not consume an unrelated valid next-action opening.
 h.flags.tracker.continuation={slug:'fated-brand',turn:2,targets:[h.targets[1].document.uuid]};
 const revision=h.flags.tracker.revision;
 await h.advance();
 assert.deepEqual(h.rolls,['8d6[fire]','4d6[fire]']);assert.equal(h.saveArgs.length,2);assert.equal(h.saveArgs[1].token.uuid,h.targets[1].document.uuid);
 assert.equal(h.flags.tracker.revision,revision);assert.equal(h.flags.tracker.continuation.slug,'fated-brand');assert.deepEqual(h.flags.tracker.cooldowns['relentless-rush'],[1000]);
 assert.equal(h.flags.rush.status,'complete');assert.deepEqual(h.deleted,['effect0']);assert(h.saveArgs.every(a=>a.extraRollOptions.includes('area-damage')));
 await h.advance();assert.equal(h.rolls.length,2);
});
test('Rush resistance rounds down at odd levels and ends at the next turn start',()=>{
 const effect=rushResistance(19,1000,21,'request');assert.equal(effect.system.rules[0].value,9);
 assert.deepEqual(effect.system.duration,{value:1,unit:'rounds',expiry:'turn-start',sustained:false});
});
test('empty initial and delayed emanations still arm and expire protection without rolling damage',async()=>{
 const h=rush({degrees:[]});await h.runner.execute(h.actor,h.req);
 assert.equal(h.flags.rush.status,'armed');assert.equal(h.rolls.length,0);assert.equal(h.created.length,1);
 h.next();await h.advance();assert.equal(h.flags.rush.status,'complete');assert.equal(h.rolls.length,0);assert.deepEqual(h.deleted,['effect0']);
});
test('unconscious, dead or unarmed Gunbreakers lose the delayed blast and resistance once',async()=>{
 for(const condition of ['unconscious','dead','unarmed']){
  const h=rush();await h.runner.execute(h.actor,h.req);h.next();
  if(condition==='unconscious')h.actor.hasCondition=c=>c==='unconscious';
  if(condition==='dead')h.actor.isDead=true;
  if(condition==='unarmed')h.actor.itemTypes.weapon=[];
  await h.advance();assert.equal(h.flags.rush.status,'skipped');assert.equal(h.rolls.length,1);assert.deepEqual(h.deleted,['effect0']);
  h.actor.hasCondition=()=>false;h.actor.isDead=false;await h.advance();assert.equal(h.rolls.length,1);
 }
});
test('stunned and paralyzed do not suppress an already-triggered automatic blast',async()=>{
 const h=rush();await h.runner.execute(h.actor,h.req);h.next();h.actor.hasCondition=c=>c==='stunned'||c==='paralyzed';
 await h.advance();assert.equal(h.flags.rush.status,'complete');assert.equal(h.rolls.length,2);
});
test('duplicate start-turn delivery rolls one delayed blast',async()=>{
 const h=rush();await h.runner.execute(h.actor,h.req);h.next();
 await Promise.all([h.advance(),h.advance()]);assert.equal(h.rolls.length,2);assert.equal(h.flags.rush.status,'complete');
});
test('closing initial confirmation spends nothing, while closing triggered confirmation needs recovery',async()=>{
 const h=rush();h.cancelConfirm=true;const state=structuredClone(h.flags.tracker);
 await h.runner.execute(h.actor,h.req);assert.deepEqual(h.flags.tracker,state);assert.equal(h.flags.rush,undefined);
 h.cancelConfirm=false;await h.runner.execute(h.actor,h.req);h.next();h.cancelConfirm=true;
 await assert.rejects(h.advance,/closed/);assert.equal(h.flags.rush.status,'recovery');assert.equal(h.rolls.length,1);
 await h.advance();assert.equal(h.rolls.length,1);
});
test('partial delayed HP failure preserves exact application progress and blocks automatic replay',async()=>{
 const h=rush();await h.runner.execute(h.actor,h.req);h.next();
 h.onApply=i=>{if(i===1)throw Error('HP uncertain');};
 await assert.rejects(h.advance,/HP uncertain/);assert.equal(h.flags.rush.status,'recovery');assert.equal(h.flags.execution.status,'recovery');
 const journal=h.messages.get(h.flags.execution.journalId).getFlag(MOD,'areaJournal');
 assert.deepEqual(journal.applications.map(a=>a.status),['complete','applying']);
 const writes=h.applied.length;await h.advance();assert.equal(h.applied.length,writes);
});
test('missed rounds, changed initiative and changed source token require recovery',async()=>{
 for(const mode of ['late','initiative','token']){
  const h=rush();await h.runner.execute(h.actor,h.req);h.next();
  if(mode==='late')h.next();if(mode==='initiative')h.combatant.initiative=25;if(mode==='token')h.self.document.uuid='Scene.scene.Token.other';
  await assert.rejects(h.advance,/skipped|initiative|origin/);assert.equal(h.flags.rush.status,'recovery');assert.equal(h.rolls.length,1);
 }
});
test('turn advance or loss of consciousness during the delayed review stops all HP writes',async()=>{
 for(const mode of ['turn','unconscious']){
  const h=rush();await h.runner.execute(h.actor,h.req);h.next();const writes=h.applied.length;
  h.review=()=>{if(mode==='turn')h.next();else h.actor.hasCondition=c=>c==='unconscious';};
  await assert.rejects(h.advance,/Combat advanced|cannot act/);assert.equal(h.flags.rush.status,'recovery');assert.equal(h.applied.length,writes);
 }
});
test('uncertain resistance creation remains recoverable without rolling the initial blast again',async()=>{
 const h=rush();h.failEffect=true;
 await assert.rejects(()=>h.runner.execute(h.actor,h.req),/Effect write uncertain/);assert.equal(h.flags.execution.status,'recovery');assert.equal(h.flags.rush.status,'arming');
 await assert.rejects(()=>h.runner.execute(h.actor,h.req),/pending/);assert.equal(h.rolls.length,1);
});
test('player requests expose only the initial action and reject forged delayed phases',()=>{
 const request={version:1,id:'request',actorUuid:'Actor.hero',sceneId:'scene',gmId:'gm',slug:'relentless-rush',weaponId:'blade',map:0,targetIds:[],revision:0,encounterId:'combat',round:1,turn:1};
 assert.equal(validateIntent(request).slug,'relentless-rush');assert.throws(()=>validateIntent({...request,phase:'delayed'}));assert.throws(()=>validateIntent({...request,map:1}));
});
test('the native turn hook resolves a scheduled blast once, and reconnect never replays a due blast',async()=>{
 for(const reconnect of [false,true]){
  const h=rush();await h.runner.execute(h.actor,h.req);if(reconnect)h.next();const hooks=new Map(),tasks=[];
  globalThis.Hooks={on:(name,fn)=>hooks.set(name,fn)};
  installRushHooks({advanceRush:(...args)=>h.runner.advance(...args),reconcileRush:(...args)=>{const p=h.runner.reconcile(...args);tasks.push(p);return p;}});
  if(reconnect){await Promise.all(tasks);assert.equal(h.flags.rush.status,'recovery');assert.equal(h.rolls.length,1);}
  else {
   assert.equal(tasks.length,0);h.next();await hooks.get('pf2e.startTurn')(h.combatant,game.combat);
   assert.equal(h.flags.rush.status,'complete');assert.equal(h.rolls.length,2);
  }
 }
});
test('ending combat reconciles pending Rush and removes only its own resistance',async()=>{
 const h=rush();await h.runner.execute(h.actor,h.req);h.actor.items.push({id:'custom',type:'effect',system:{slug:'gunbreaker-relentless-rush-resistance'}});
 await h.runner.reconcile(h.actor,'Encounter ended');assert.equal(h.flags.rush.status,'recovery');assert.deepEqual(h.deleted,['effect0']);assert(h.actor.items.some(i=>i.id==='custom'));
 await h.advance();assert.equal(h.rolls.length,1);
});
test('Rush rejects hidden targets and an under-level actor before spending or rolling',async()=>{
 for(const mode of ['hidden','level']){
  const h=rush();if(mode==='hidden')h.targets[0].document.hidden=true;else h.c.level=17;
  const before=structuredClone(h.flags.tracker);
  await assert.rejects(()=>h.runner.execute(h.actor,h.req),/GM adjudication|above your character level/);
  assert.deepEqual(h.flags.tracker,before);assert.equal(h.rolls.length,0);assert.equal(h.created.length,0);
 }
});
test('pending initial damage recovery blocks the next-turn trigger without a second damage roll',async()=>{
 const h=rush();await h.runner.execute(h.actor,h.req);h.next();h.flags.execution.status='recovery';
 await assert.rejects(h.advance,/pending action/);assert.equal(h.flags.rush.status,'recovery');assert.equal(h.rolls.length,1);
});
test('turn hook is inactive for players and multiple GMs',async()=>{
 for(const mode of ['player','multiple']){
  const h=rush();await h.runner.execute(h.actor,h.req);const hooks=new Map();globalThis.Hooks={on:(name,fn)=>hooks.set(name,fn)};
  installRushHooks({advanceRush:(...args)=>h.runner.advance(...args),reconcileRush:(...args)=>h.runner.reconcile(...args)});h.next();
  if(mode==='player')game.user.isGM=false;else game.users.push({id:'second-gm',isGM:true,active:true});
  await hooks.get('pf2e.startTurn')(h.combatant,game.combat);assert.equal(h.flags.rush.status,'armed');assert.equal(h.rolls.length,1);
 }
});
test('a different held gunblade satisfies the delayed trigger and no other turn triggers it',async()=>{
 const h=rush();await h.runner.execute(h.actor,h.req);h.next();
 await h.runner.advance(h.actor,game.combat,{id:'other-turn'});assert.equal(h.rolls.length,1);
 h.actor.itemTypes.weapon[0].id='new-blade';const selected=[];h.deps.weaponFor=(_actor,id)=>{selected.push(id);return {id};};
 // Construct a fresh coordinator before the due callback; the persisted armed trigger remains valid.
 h.runner=createRushRunner(h.deps,h.queue);await h.advance();assert.equal(h.flags.rush.status,'complete');assert(selected.every(id=>id==='new-blade'));
});
