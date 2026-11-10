import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combinedSaveDamage} from '../scripts/area-native.mjs';
import {setup} from './helpers/native-save-harness.mjs';
const MOD='gunbreaker-pf2e';
test('native area adapter preserves class DC, private evidence and one application per enemy even when the first dies',async()=>{
 const h=setup();await h.runner.execute(h.actor,h.req);
 assert.deepEqual(h.applied.map(a=>a.total),[21,42]);assert.equal(h.saveArgs.length,2);assert(h.saveArgs.every(a=>a.dc.value===22&&a.dc.slug==='gunbreaker'&&a.damaging));
 assert.deepEqual(h.flags.tracker.continuation.targets,h.targets.map(t=>t.document.uuid));assert.equal(h.flags.execution.status,'complete');
 assert(!h.flags.execution.saves);assert(!h.flags.execution.prepared);
 const log=h.messages.get(h.flags.execution.journalId);assert.deepEqual(log.whisper,['gm']);assert.equal(log.getFlag(MOD,'areaJournal').applications.length,2);
});
test('Double Down includes 10-foot enemies, excludes farther targets and spends cost/frequency before saving',async()=>{
 const h=setup({slug:'double-down',level:18,distances:[5,10,15],degrees:[1,1,1],calibration:'cold'});
 h.onSave=()=>{assert.equal(h.flags.tracker.cartridges,1);assert.deepEqual(h.flags.tracker.cooldowns['double-down'],[1000]);};
 await h.runner.execute(h.actor,h.req);
 assert.deepEqual(h.rolls,['12d6[cold]']);assert.equal(h.saveArgs.length,2);assert.equal(h.applied.length,2);assert.equal(h.flags.tracker.continuation,null);
});
test('Danger Zone preserves the requested single enemy and enforces the exact range boundary',async()=>{
 const h=setup({slug:'danger-zone',level:6,distances:[10,15],degrees:[1,1]});h.c.targetIds=[h.targets[0].document.uuid];
 await h.runner.execute(h.actor,{...h.req,targetIds:[h.targets[1].document.uuid]});
 assert.equal(h.saveArgs.length,1);assert(!h.saveArgs[0].extraRollOptions.includes('area-damage'));assert.equal(h.applied[0].target,h.targets[1].document.uuid);assert.deepEqual(h.rolls,['3d6[fire]']);
 const far=setup({slug:'danger-zone',level:6,distances:[15.1],degrees:[1]});
 await assert.rejects(()=>far.runner.execute(far.actor,{...far.req,targetIds:[far.targets[0].document.uuid]}),/No eligible/);assert.equal(far.flags.execution,undefined);
});
test('Blasting Zone upgrades Danger Zone range and dice without changing fire or granting another cooldown',async()=>{
 const h=setup({slug:'danger-zone',level:14,distances:[30],degrees:[1],learned:['blasting-zone'],calibration:'electricity',killOnApply:false});h.req.targetIds=[h.targets[0].document.uuid];
 await h.runner.execute(h.actor,h.req);assert.deepEqual(h.rolls,['7d8[fire]']);assert(h.dialogs[0].window.title.startsWith('Blasting Zone'));
 assert.deepEqual(h.flags.tracker.cooldowns['danger-zone'],[1000]);assert.equal(h.flags.tracker.cooldowns['blasting-zone'],undefined);
 await assert.rejects(()=>h.runner.execute(h.actor,{...h.req,id:'second'}),/frequency/);assert.equal(h.saveArgs.length,1);
 await assert.rejects(()=>h.runner.execute(h.actor,{...h.req,id:'upgrade',slug:'blasting-zone'}),/Invalid area request/);
});
test('Bow Shock applies unscaled deferred fire only to failed saves within one native application each',async()=>{
 const h=setup({slug:'bow-shock',level:11,degrees:[0,1,2,3],calibration:'cold'});await h.runner.execute(h.actor,h.req);
 assert(h.saveArgs.every(a=>a.extraRollOptions.includes('area-damage')));assert.deepEqual(h.rolls,['6d4[fire]','1d4[persistent,fire]']);assert.deepEqual(h.applied.map(a=>a.total),[42,21,10.5]);
 for(const application of h.applied.slice(0,2)){
  const persistent=application.instances.filter(i=>i.persistent);assert.equal(persistent.length,1);assert.equal(persistent[0].formula,'1d4[persistent,fire]');assert.equal(persistent[0].total,0);assert.equal(persistent[0].options.evaluatePersistent,false);
 }
 assert.equal(h.applied[2].instances.some(i=>i.persistent),false);assert.equal(h.flags.tracker.continuation,null);
});
test('Bow Shock can apply only the persistent condition or suppress it for an exceptional rule',async()=>{
 const h=setup({slug:'bow-shock',level:12,degrees:[1,1]});
 h.review=fields=>{fields.scale0.value='0';fields.persistent1.checked=false;};
 await h.runner.execute(h.actor,h.req);
 assert.equal(h.applied[0].total,0);assert.deepEqual(h.applied[0].instances.map(i=>i.formula),['2d4[persistent,fire]']);
 assert.equal(h.applied[1].instances.some(i=>i.persistent),false);
});
test('persistent combination refuses a tick that was already evaluated and never mutates the shared rolls',async()=>{
 const h=setup(),base=await new h.DamageRoll('6d4[fire]').evaluate(),persistent=await new h.DamageRoll('2d4[persistent,fire]',{},{evaluatePersistent:false}).evaluate();
 const snapshot=JSON.stringify(base.toJSON());const roll=combinedSaveDamage(h.DamageRoll,base.toJSON(),2,persistent.toJSON());
 assert.equal(roll.total,42);assert.equal(JSON.stringify(base.toJSON()),snapshot);assert.equal(persistent.instances[0].formula,'2d4[persistent,fire]');
 persistent.instances[0].options.evaluatePersistent=true;
 assert.throws(()=>combinedSaveDamage(h.DamageRoll,base.toJSON(),2,persistent.toJSON()),/deferred/);
});
test('combat advancing between native applications leaves the remaining target pending without replay',async()=>{
 const h=setup({slug:'bow-shock',level:12,degrees:[1,1]});h.onApply=()=>h.c.turn++;
 await assert.rejects(()=>h.runner.execute(h.actor,h.req),/Combat advanced/);
 assert.equal(h.applied.length,1);assert.equal(h.flags.execution.status,'recovery');
 const log=h.messages.get(h.flags.execution.journalId).getFlag(MOD,'areaJournal');assert.deepEqual(log.applications.map(a=>a.status),['complete','applying']);
 await assert.rejects(()=>h.runner.execute(h.actor,{...h.req,id:'repeat'}),/pending/);assert.equal(h.applied.length,1);
});
test('a target becoming hidden after its save stops area damage for GM adjudication',async()=>{
 const h=setup({slug:'bow-shock',level:12,degrees:[1]});h.onSave=()=>{h.targets[0].document.hidden=true;};
 await assert.rejects(()=>h.runner.execute(h.actor,h.req),/visibility/);assert.equal(h.applied.length,0);assert.equal(h.flags.execution.status,'recovery');
});

test('Saturation Fire uses native line containment, excludes allies, rolls calibrated damage once and cleans its region',async()=>{
 const h=setup({slug:'saturation-fire',level:12,degrees:[0,1,1,1],distances:[5,40,10,10],calibration:'electricity'});
 h.targets[2].inLine=false;h.targets[3].actor.uuid='Actor.ally';
 h.onSave=()=>assert.equal(h.flags.tracker.cartridges,2);
 await h.runner.execute(h.actor,h.req);
 assert.equal(h.placements,1);assert.equal(h.deleted,1);assert.equal(h.region.shapes[0].type,'line');assert.equal(h.region.shapes[0].length,600);assert.equal(h.region.shapes[0].width,100);
 assert.equal(h.saveArgs.length,2);assert(h.saveArgs.every(a=>a.extraRollOptions.includes('area-damage')));
 assert.deepEqual(h.rolls,['6d6[electricity]']);assert.deepEqual(h.applied.map(a=>a.total),[42,21]);assert.equal(h.flags.tracker.continuation,null);
 const journal=h.messages.get(h.flags.execution.journalId).getFlag(MOD,'areaJournal');assert.equal(journal.prepared.line.uuid,h.region.uuid);
});
test('canceling line placement or target confirmation spends nothing and removes only a created preview',async()=>{
 for(const stage of ['placement','confirmation']){
  const h=setup({slug:'saturation-fire',level:12}),before=structuredClone(h.flags.tracker);
  h.cancelPlacement=stage==='placement';h.cancelConfirm=stage==='confirmation';
  assert.equal((await h.runner.execute(h.actor,h.req)).status,'canceled');
  assert.deepEqual(h.flags.tracker,before);assert.equal(h.flags.execution,undefined);assert.equal(h.deleted,stage==='placement'?0:1);assert.equal(h.rolls.length,0);
 }
});
test('line preflight rejects missing cartridges before asking the GM to place anything',async()=>{
 const h=setup({slug:'saturation-fire',level:12});h.flags.tracker.cartridges=0;
 await assert.rejects(()=>h.runner.execute(h.actor,h.req),/Not enough cartridges/);assert.equal(h.placements,0);assert.equal(h.flags.execution,undefined);
});
test('a line shape or wall change after saves preserves the cartridge spend and keeps evidence for recovery',async()=>{
 for(const change of ['shape','wall']){
  const h=setup({slug:'saturation-fire',level:12,degrees:[1]});h.onSave=()=>{if(change==='shape')h.region.shapes[0].rotation=90;else h.covered=[{i:0,j:2}];};
  await assert.rejects(()=>h.runner.execute(h.actor,h.req),/line shape changed|blocking walls changed/);
  assert.equal(h.flags.tracker.cartridges,2);assert.equal(h.flags.execution.status,'recovery');assert.equal(h.applied.length,0);assert.equal(h.deleted,0);
  await assert.rejects(()=>h.runner.execute(h.actor,{...h.req,id:'again'}),/pending/);assert.equal(h.placements,1);
 }
});
test('new enemies entering the confirmed line before commit reject without spending or leaving a preview',async()=>{
 const h=setup({slug:'saturation-fire',level:12,degrees:[1,1]});h.targets[1].inLine=false;
 h.onConfirm=()=>{h.targets[1].inLine=true;};
 await assert.rejects(()=>h.runner.execute(h.actor,h.req),/enemies.*changed/);assert.equal(h.flags.execution,undefined);assert.equal(h.flags.tracker.cartridges,3);assert.equal(h.deleted,1);
});
test('line origin, elevation and scene changes reject before committing',async()=>{
 for(const change of ['origin','elevation','scene','movement']){
  const h=setup({slug:'saturation-fire',level:12,degrees:[1]});
  h.onPlace=r=>{if(change==='origin')r.shapes[0].x=500;else if(change==='elevation')h.targets[0].document.elevation=10;else if(change==='scene')canvas.scene.id='other';else h.self.document.x=100;};
  await assert.rejects(()=>h.runner.execute(h.actor,h.req));assert.equal(h.deleted,1);assert.equal(h.flags.execution,undefined);assert.equal(h.flags.tracker.cartridges,3);
 }
});

test('unsupported line grids and hidden origins stop before placement or state writes',async()=>{
 for(const change of ['gridless','scale','hidden']){
  const h=setup({slug:'saturation-fire',level:12});
  if(change==='gridless')canvas.grid.isSquare=false;else if(change==='scale')canvas.dimensions.distance=10;else h.self.document.hidden=true;
  await assert.rejects(()=>h.runner.execute(h.actor,h.req));assert.equal(h.placements,0);assert.equal(h.flags.execution,undefined);
 }
});
test('a line with no eligible enemy cleans its preview without spending',async()=>{
 const h=setup({slug:'saturation-fire',level:12});h.targets.forEach(t=>t.inLine=false);
 await assert.rejects(()=>h.runner.execute(h.actor,h.req),/No eligible/);assert.equal(h.deleted,1);assert.equal(h.flags.tracker.cartridges,3);assert.equal(h.flags.execution,undefined);
});
test('native line placement does not accept a second simultaneous aiming session',async()=>{
 const h=setup({slug:'saturation-fire',level:12});let release;h.placementWait=new Promise(r=>release=r);h.cancelConfirm=true;
 const first=h.runner.execute(h.actor,h.req);await new Promise(r=>setImmediate(r));
 await assert.rejects(()=>h.runner.execute(h.actor,{...h.req,id:'second'}),/Another line/);assert.equal(h.placements,1);
 release();assert.equal((await first).status,'canceled');assert.equal(h.deleted,1);assert.equal(h.flags.tracker.cartridges,3);
});
test('cleanup never deletes a region whose action ownership marker was replaced',async()=>{
 const h=setup({slug:'saturation-fire',level:12});h.onConfirm=()=>{h.region.flags[MOD].line.id='different-action';};
 await assert.rejects(()=>h.runner.execute(h.actor,h.req),/removed or replaced/);assert.equal(h.deleted,0);assert.equal(h.flags.execution,undefined);assert.equal(h.flags.tracker.cartridges,3);
});

test('unchecked native area verification spends nothing despite DialogV2 action fallback',async()=>{
 const h=setup(),before=structuredClone(h.flags.tracker);h.unverifiedArea=true;
 assert.equal((await h.runner.execute(h.actor,h.req)).status,'canceled');assert.deepEqual(h.flags.tracker,before);assert.equal(h.saveArgs.length,0);assert.equal(h.applied.length,0);
});
test('unchecked native damage verification preserves recovery and never applies HP',async()=>{
 const h=setup();h.review=elements=>elements.verified.checked=false;
 await assert.rejects(h.runner.execute(h.actor,h.req));assert.equal(h.flags.execution.status,'recovery');assert.equal(h.applied.length,0);
});
