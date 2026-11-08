import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AreaRunner,areaFormula,basicMultiplier,areaCommit,areaFinish,areaProfile,areaPersistentFormula} from '../scripts/area.mjs';
import {ActorQueue} from '../scripts/queue.mjs';
import {initialState,transition} from '../scripts/state.mjs';
import {catalogue} from '../scripts/catalogue.mjs';
function setup({degrees=[0,1,2,3],slug='fated-circle'}={}){
 const actor={uuid:'Actor.hero'};
 const c={time:1000,level:12,learned:['demon-slice','demon-slaughter','fated-circle','fated-brand','continuation'],encounterId:'combat',round:1,turn:1,inTurn:true,wielding:true,targetIds:degrees.map((_,i)=>`Scene.scene.Token.t${i}`)};
 let state=transition(initialState(),{type:'start'},c,catalogue),journal=null,damageRolls=0,saves=0,prepares=0;const applications=[];
 const targets=c.targetIds.map((uuid,i)=>({uuid,actorUuid:`Actor.enemy${i}`}));
 const p={authorize:()=>{},journal:()=>structuredClone(journal),saveJournal:(_a,j)=>{journal=structuredClone(j);},read:()=>state,write:(_a,s)=>{state=structuredClone(s);},
 prepare:()=>{prepares++;return {targets};},validate:()=>c,
 damage:()=>{damageRolls++;return {roll:{total:21},messageId:'damage'};},
 save:(_a,_r,_c,t)=>{const degree=degrees[targets.findIndex(x=>x.uuid===t.uuid)];saves++;return {degree,messageId:`save${saves}`,fingerprint:`${degree}`};},
 review:(_a,_r,_c,_prep,progress)=>progress.saves.map(s=>({target:s.target,multiplier:basicMultiplier(s.degree)})),
 apply:(_a,_r,_c,_prep,_progress,row)=>{applications.push(row);}};
 const queue=new ActorQueue(),runner=new AreaRunner(p,queue),req={id:'event',slug};
 return {actor,c,p,queue,runner,req,targets,applications,get state(){return state;},set state(v){state=v;},get journal(){return journal;},get damageRolls(){return damageRolls;},get saves(){return saves;},get prepares(){return prepares;}};
}
test('area formulas use level, calibration and fixed Brand dice without weapon or No Mercy bonuses',()=>{
 assert.equal(areaFormula('demon-slice',1),'1d4[slashing]');assert.equal(areaFormula('demon-slaughter',20),'10d4[slashing]');
 assert.equal(areaFormula('fated-circle',13,'cold'),'7d6[cold]');assert.equal(areaFormula('fated-brand',16,'electricity'),'2d6[electricity]');assert.equal(areaFormula('fated-brand',17),'3d6[fire]');
 assert.throws(()=>areaFormula('fated-circle',12,'force'));assert.throws(()=>areaFormula('relentless-rush',18));
 assert.deepEqual([0,1,2,3].map(basicMultiplier),[2,1,.5,0]);assert.throws(()=>basicMultiplier(null));
});
test('Circle spends before any save, rolls damage once, applies native degrees and stores only original failures',async()=>{
 const h=setup(),save=h.p.save;h.p.save=(...args)=>{assert.equal(h.state.cartridges,0);return save(...args);};
 await h.runner.execute(h.actor,h.req);
 assert.equal(h.damageRolls,1);assert.equal(h.saves,4);assert.equal(h.applications.length,3);
 assert.deepEqual(h.applications.map(a=>a.multiplier),[2,1,.5]);assert.deepEqual(h.state.continuation.targets,h.c.targetIds.slice(0,2));
 assert.equal(h.journal.status,'complete');assert.equal(h.journal.applications[3].status,'no-damage');
});
test('Demon Slice opens its combo even when every save critically succeeds',async()=>{
 const h=setup({degrees:[3,3],slug:'demon-slice'});await h.runner.execute(h.actor,h.req);assert.equal(h.state.combo.next,'demon-slaughter');assert.equal(h.applications.length,0);
});
test('Demon Slaughter reward follows saves and never subtracts cartridges while already at capacity',async()=>{
 const h=setup({degrees:[2,3],slug:'demon-slaughter'});h.state={...h.state,cartridges:3,combo:{next:'demon-slaughter',untilTurn:2}};
 const save=h.p.save;h.p.save=(...args)=>{assert.equal(h.state.cartridges,3);return save(...args);};
 await h.runner.execute(h.actor,h.req);assert.equal(h.state.cartridges,3);assert.equal(h.state.combo,null);
 const low=setup({degrees:[3],slug:'demon-slaughter'});low.state={...low.state,cartridges:0,combo:{next:'demon-slaughter',untilTurn:2}};
 await low.runner.execute(low.actor,low.req);assert.equal(low.state.cartridges,1);
});
test('Fated Brand makes fresh saves, consumes one opening and shares the round limit',async()=>{
 const h=setup({degrees:[3,1],slug:'fated-brand'});h.state={...h.state,continuation:{slug:'fated-brand',turn:1,targets:h.c.targetIds}};
 await h.runner.execute(h.actor,h.req);assert.equal(h.saves,2);assert.equal(h.state.lastFollowRound,1);assert.equal(h.state.continuation,null);assert.equal(h.applications.length,1);
});
test('Brand rejects new targets, expired openings and shared-round reuse before rolling',async()=>{
 for(const mutate of [h=>h.state={...h.state,continuation:{slug:'fated-brand',turn:1,targets:['other']}},h=>h.c.turn=2,h=>h.state={...h.state,lastFollowRound:1}]){
  const h=setup({slug:'fated-brand'});h.state={...h.state,continuation:{slug:'fated-brand',turn:1,targets:h.c.targetIds}};mutate(h);
  await assert.rejects(()=>h.runner.execute(h.actor,h.req));assert.equal(h.damageRolls,0);assert.equal(h.saves,0);
 }
});
test('preparation cancellation and stale validation spend nothing',async()=>{
 for(const cancel of [true,false]){
  const h=setup(),before=structuredClone(h.state);
  if(cancel)h.p.prepare=()=>null;else h.p.validate=()=>{throw Error('stale');};
  if(cancel)assert.equal((await h.runner.execute(h.actor,h.req)).status,'canceled');else await assert.rejects(()=>h.runner.execute(h.actor,h.req),/stale/);
  assert.deepEqual(h.state,before);assert.equal(h.journal,null);assert.equal(h.damageRolls,0);
 }
});
test('canceled native save retains cost and evidence, with no automatic replay',async()=>{
 const h=setup();h.p.save=()=>null;await assert.rejects(()=>h.runner.execute(h.actor,h.req),/degree/);
 assert.equal(h.state.cartridges,0);assert.equal(h.journal.status,'recovery');assert.equal(h.journal.damage.messageId,'damage');
 await assert.rejects(()=>new AreaRunner(h.p,h.queue).execute(h.actor,h.req),/pending/);assert.equal(h.damageRolls,1);
});
test('closing damage review preserves save-derived rewards and blocks automatic damage',async()=>{
 const h=setup({degrees:[1],slug:'demon-slaughter'});h.state={...h.state,cartridges:0,combo:{next:'demon-slaughter',untilTurn:2}};h.p.review=()=>null;
 await assert.rejects(()=>h.runner.execute(h.actor,h.req),/recovery/);assert.equal(h.state.cartridges,1);assert.equal(h.state.combo,null);assert.equal(h.applications.length,0);
});
test('partial HP failure persists completed targets and does not repeat any damage',async()=>{
 const h=setup({degrees:[1,1,1]});h.p.apply=(_a,_r,_c,_p,_progress,row)=>{h.applications.push(row);if(h.applications.length===2)throw Error('HP uncertain');};
 await assert.rejects(()=>h.runner.execute(h.actor,h.req),/uncertain/);
 assert.deepEqual(h.journal.applications.map(a=>a.status),['complete','applying']);assert.equal(h.journal.status,'recovery');
 await assert.rejects(()=>new AreaRunner(h.p,h.queue).execute(h.actor,{...h.req,id:'other'}),/pending/);assert.equal(h.applications.length,2);
});
test('duplicate clicks share one preparation and completed activity cannot be rerolled',async()=>{
 const h=setup();await Promise.all([h.runner.execute(h.actor,h.req),h.runner.execute(h.actor,h.req)]);await h.runner.execute(h.actor,h.req);
 assert.equal(h.prepares,1);assert.equal(h.damageRolls,1);assert.equal(h.saves,4);
});
test('damage-only adjustment does not rewrite failed-save eligibility',async()=>{
 const h=setup({degrees:[1]});h.p.review=()=>[{target:h.c.targetIds[0],multiplier:.5}];await h.runner.execute(h.actor,h.req);
 assert.deepEqual(h.state.continuation.targets,h.c.targetIds);assert.equal(h.applications[0].multiplier,.5);
});
test('overlapping actor groups reserve atomically without lock inversion',async()=>{
 const q=new ActorQueue(),a={uuid:'a'},b={uuid:'b'},events=[];let release;
 const one=q.runMany([a,b],async()=>{events.push('one');await new Promise(r=>release=r);});
 const two=q.runMany([b,a],()=>events.push('two'));
 await new Promise(r=>setImmediate(r));assert.deepEqual(events,['one']);release();await Promise.all([one,two]);assert.deepEqual(events,['one','two']);
});
test('area holds affected actor queues until resolution so module corrections cannot race HP application',async()=>{
 const h=setup({degrees:[1]});let release;h.p.save=async()=>{await new Promise(r=>release=r);return {degree:1};};
 const action=h.runner.execute(h.actor,h.req);await new Promise(r=>setImmediate(r));let corrected=false;
 const correction=h.queue.run({uuid:h.targets[0].actorUuid},()=>{corrected=true;});await new Promise(r=>setImmediate(r));assert.equal(corrected,false);
 release();await action;await correction;assert.equal(corrected,true);
});
test('finishing rejects missing or duplicated target results',()=>{
 const h=setup(),committed=areaCommit(h.state,'fated-circle',h.c,'id');
 assert.throws(()=>areaFinish(h.state,committed,'fated-circle',h.c,'id',[]),/exactly once/);
 assert.throws(()=>areaFinish(h.state,committed,'fated-circle',h.c,'id',h.c.targetIds.map(()=>({target:h.c.targetIds[0],degree:1}))),/exactly once/);
});

test('save power profiles preserve distinct range, upgrade and calibration rules',()=>{
 assert.equal(areaProfile('double-down',14).range,10);
 assert.equal(areaFormula('double-down',17,'cold'),'10d6[cold]');assert.equal(areaFormula('double-down',18,'electricity'),'12d6[electricity]');
 assert.deepEqual([areaProfile('danger-zone',6).shape,areaProfile('danger-zone',6).range],['target',15]);
 assert.equal(areaProfile('danger-zone',14,['blasting-zone']).range,30);
 assert.equal(areaFormula('danger-zone',14,'cold',['blasting-zone']),'7d8[fire]');
 assert.equal(areaFormula('danger-zone',7,'electricity'),'4d6[fire]');
 assert.throws(()=>areaProfile('danger-zone',13,['blasting-zone']),/level 14/);
 assert.equal(areaFormula('bow-shock',11,'cold'),'6d4[fire]');
 assert.equal(areaPersistentFormula('bow-shock',11),'1d4[persistent,fire]');assert.equal(areaPersistentFormula('bow-shock',12),'2d4[persistent,fire]');
 assert.equal(areaPersistentFormula('double-down',18),null);
});
test('frequency and cartridge costs commit before saves and survive canceled save resolution',async()=>{
 for(const slug of ['double-down','danger-zone','bow-shock']){
  const h=setup({slug,degrees:[1]});h.c.level=14;h.c.learned.push(slug);h.state={...h.state,cartridges:3};
  h.p.save=()=>{assert.deepEqual(h.state.cooldowns[slug],[1000]);assert.equal(h.state.cartridges,slug==='double-down'?1:3);return null;};
  await assert.rejects(()=>h.runner.execute(h.actor,h.req),/degree/);assert.equal(h.journal.status,'recovery');
  assert.throws(()=>transition({...h.state,cartridges:3},{type:'use',slug},h.c,catalogue),/frequency/);
 }
});
test('successful save powers spend one shared frequency and become available at the exact boundary',async()=>{
 for(const slug of ['double-down','danger-zone','bow-shock']){
  const h=setup({slug,degrees:[2]});h.c.level=14;h.c.learned.push(slug);h.state={...h.state,cartridges:3};
  await h.runner.execute(h.actor,h.req);assert.deepEqual(h.state.cooldowns[slug],[1000]);
  h.state={...h.state,cartridges:3};h.c.time+=slug==='double-down'?59:599;
  await assert.rejects(()=>h.runner.execute(h.actor,{...h.req,id:'early'}),/frequency/);
  h.c.time++;await h.runner.execute(h.actor,{...h.req,id:'ready'});assert.equal(h.damageRolls,2);
 }
});
test('persistent application is independent of initial damage and cannot be added to a successful save',async()=>{
 const h=setup({slug:'bow-shock',degrees:[1]});h.c.learned.push('bow-shock');
 h.p.review=()=>[{target:h.c.targetIds[0],multiplier:0,persistent:true}];
 await h.runner.execute(h.actor,h.req);assert.equal(h.applications.length,1);assert.equal(h.journal.applications[0].persistent,true);assert.equal(h.journal.applications[0].status,'complete');
 const invalid=setup({slug:'bow-shock',degrees:[2]});invalid.c.learned.push('bow-shock');invalid.p.review=()=>[{target:invalid.c.targetIds[0],multiplier:1,persistent:true}];
 await assert.rejects(()=>invalid.runner.execute(invalid.actor,invalid.req),/Invalid damage review/);assert.equal(invalid.applications.length,0);
});

test('Saturation Fire uses a calibrated line, spends one cartridge and cannot open Fated Brand',async()=>{
 assert.deepEqual([areaProfile('saturation-fire',12).shape,areaProfile('saturation-fire',12).range],['line',30]);
 assert.equal(areaFormula('saturation-fire',13,'cold'),'7d6[cold]');
 const h=setup({slug:'saturation-fire',degrees:[0,1,2,3]});h.c.learned.push('saturation-fire');
 h.state={...h.state,continuation:{slug:'fated-brand',turn:1,targets:h.c.targetIds}};
 await h.runner.execute(h.actor,h.req);assert.equal(h.state.cartridges,0);assert.equal(h.state.continuation,null);assert.equal(h.state.cooldowns['saturation-fire'],undefined);
});
