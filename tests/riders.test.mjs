import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tempHPEffect,vortexGuard,overpoweredRound} from '../scripts/riders.mjs';
import {setup} from './helpers/native-save-harness.mjs';
const MOD='gunbreaker-pf2e';
function fixture(slug){
 const h=setup({slug,level:18,degrees:[1,1,1],learned:[slug],killOnApply:false});h.c.weaponDice=3;h.actor.isAllyOf=a=>a===h.targets[2].actor;h.actor.isEnemyOf=a=>a.uuid.startsWith('Actor.enemy')&&a!==h.targets[2].actor;h.effects=[];
 h.targets[2].actor.createEmbeddedDocuments=async(_t,items)=>{h.effects.push(...items);};
 h.req.lockedActors=canvas.tokens.placeables.map(t=>t.actor.uuid);h.flags.execution={id:h.req.id,status:'committed'};
 foundry.applications.api.DialogV2.confirm=async()=>{h.onConfirm?.();return !h.cancel;};
 foundry.applications.api.DialogV2.wait=async()=>{h.onConfirm?.();return h.cancel?null:h.targets[2].document.uuid;};return h;
}
test('Vortex Guard creates source-timed native TempHP once per round and declining preserves its gate',async()=>{
 const h=fixture('vortex-guard');h.cancel=true;await vortexGuard(h.actor,h.req,h.c,h.flags.tracker,h.self);assert.equal(h.effects.length,0);
 h.cancel=false;await vortexGuard(h.actor,h.req,h.c,h.flags.tracker,h.self);await vortexGuard(h.actor,h.req,h.c,h.flags.tracker,h.self);
 assert.equal(h.effects.length,1);assert.equal(h.effects[0].system.rules[0].value,9);assert.equal(h.effects[0].system.duration.expiry,'turn-end');assert.equal(h.effects[0].system.context.origin.actor,h.actor.uuid);
});
test('Vortex Guard rejects an ally changing eligibility before the effect without spending its gate',async()=>{
 const h=fixture('vortex-guard');h.onConfirm=()=>h.targets[2].actor.isDead=true;
 await assert.rejects(()=>vortexGuard(h.actor,h.req,h.c,h.flags.tracker,h.self),/recipient changed/);assert.equal(h.effects.length,0);assert.equal(h.flags.tracker.once.vortexRound,undefined);
});
test('Overpowered Round excludes primary, source and allies, uses calibration, and preserves per-target evidence',async()=>{
 const h=fixture('overpowered-round');h.flags.tracker.calibration='cold';
 await overpoweredRound(h.actor,h.req,h.c,h.flags.tracker,h.targets[0]);assert.deepEqual(h.rolls,['3[cold]']);assert.equal(h.applied.length,1);assert.equal(h.applied[0].target,h.targets[1].document.uuid);assert.equal(h.flags.execution.riders[0].status,'complete');
});
test('Overpowered Round decline and stale targets do not apply HP; uncertain applications remain claimed',async()=>{
 const h=fixture('overpowered-round');h.cancel=true;await overpoweredRound(h.actor,h.req,h.c,h.flags.tracker,h.targets[0]);assert.equal(h.rolls.length,0);
 h.cancel=false;h.onConfirm=()=>h.targets[1].document.hidden=true;await assert.rejects(()=>overpoweredRound(h.actor,h.req,h.c,h.flags.tracker,h.targets[0]),/secondary enemy changed/);assert.equal(h.applied.length,0);
 const f=fixture('overpowered-round');f.onApply=()=>{throw Error('HP result uncertain');};await assert.rejects(()=>overpoweredRound(f.actor,f.req,f.c,f.flags.tracker,f.targets[0]),/uncertain/);assert.equal(f.flags.execution.riders[0].status,'applying');
});
test('Fated Resolve reserves its round gate before applying TempHP and cannot award it twice',async()=>{
 const h=setup({slug:'fated-circle',level:18,learned:['fated-resolve'],degrees:[1],killOnApply:false});const effects=[];h.actor.createEmbeddedDocuments=async(_t,data)=>{effects.push(...data);};
 await h.runner.execute(h.actor,h.req);assert.equal(effects.length,1);assert.equal(effects[0].system.rules[0].value,9);assert.equal(effects[0].system.duration.expiry,'turn-start');
 await h.runner.execute(h.actor,{...h.req,id:'second'});assert.equal(effects.length,1);
});
test('temporary-HP effects use native non-stacking rules and carry a managed-expiry marker',()=>{
 const e=tempHPEffect('Fated Resolve',{uuid:'Actor.hero',combatant:{initiative:17}},{level:18,time:1000},9,'execution');assert.deepEqual(e.system.rules,[{key:'TempHP',value:9}]);assert.equal(e.flags[MOD].execution,'execution');assert.equal(e.system.start.initiative,17);
});
