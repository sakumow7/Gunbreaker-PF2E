import test from 'node:test';
import assert from 'node:assert/strict';
import {MovementRunner,capturePath,pathCrossesCreature,adjacentAt} from '../scripts/movement.mjs';
import {ActorQueue} from '../scripts/queue.mjs';
import {initialState,transition} from '../scripts/state.mjs';
import {catalogue} from '../scripts/catalogue.mjs';
const origin={x:0,y:0,width:1,height:1,elevation:0,level:null};
test('movement paths reject bypass, teleportation, resizing and elevation changes',()=>{
 const make=waypoints=>({pending:{waypoints}});assert.equal(capturePath(make([origin,{...origin,x:100}]),origin).length,2);
 for(const bad of [{teleport:true},{elevation:5},{width:2},{level:'other'},{action:'fly'},{x:Infinity}])assert.throws(()=>capturePath(make([{...origin,x:100,...bad}]),origin));
 assert.throws(()=>capturePath({constrainOptions:{ignoreWalls:true},pending:{waypoints:[origin]}},origin));
});
test('creature paths allow edge contact but reject crossing and occupied endpoints',()=>{
 const blocker={x:200,y:0,width:1,height:1};assert(pathCrossesCreature([{x:0,y:0},{x:400,y:0}],blocker,origin,100));
 assert(!pathCrossesCreature([{x:0,y:100},{x:400,y:100}],blocker,origin,100));
 assert(pathCrossesCreature([{x:200,y:0},{x:200,y:0}],blocker,origin,100));
 assert(!pathCrossesCreature([{x:100,y:0},{x:100,y:0}],blocker,origin,100));
});
test('adjacency uses occupied footprints without accepting overlapping or distant endpoints',()=>{
 assert(adjacentAt({x:100,y:0},origin,{x:200,y:0,width:2,height:2},100));assert(adjacentAt({x:100,y:100},origin,{x:200,y:200,width:1,height:1},100));assert(!adjacentAt({x:200,y:200},origin,{x:200,y:200,width:1,height:1},100));assert(!adjacentAt({x:0,y:0},origin,{x:200,y:0,width:1,height:1},100));
});
function setup(slug='trajectory'){
 const actor={uuid:'Actor.hero'},c={time:1000,level:10,learned:['trajectory','guarded-advance','royal-guard'],encounterId:'combat',round:1,turn:1,inTurn:true,wielding:true,targetIds:['enemy']};
 const h={actor,c,req:{id:'request',slug},state:transition(initialState(),{type:'start'},c,catalogue),moves:0,stances:0,attacks:0,damage:0,cleanup:0};
 const ports={authorize:()=>{if(h.denied)throw Error('permission');},context:()=>({...c}),read:()=>h.state,write:async s=>{},journal:()=>h.journal,saveJournal:(_a,j)=>h.journal=structuredClone(j),prepare:async()=>{h.onPrepare?.();return h.cancel?null:{actors:[actor]};},validate:()=>{if(h.invalid)throw Error('invalid path');},evidence:()=>({}),move:async()=>{h.moves++;h.onMove?.();return !h.stopped;},arrived:()=>{if(h.displaced)throw Error('displaced');},stance:()=>h.stances++,strike:()=>{h.attacks++;return h.noEnemy?null:{degree:h.degree??1};},damage:()=>{h.damage++;if(h.damageError)throw Error('damage interrupted');},cleanup:()=>h.cleanup++};
 ports.write=(_a,s)=>h.state=structuredClone(s);h.runner=new MovementRunner(ports,new ActorQueue());return h;
}
test('canceled or invalid movement never spends, and invalid plans are cleaned',async()=>{for(const key of ['cancel','invalid']){const h=setup(),before=structuredClone(h.state);h[key]=true;if(key==='cancel')assert.equal((await h.runner.execute(h.actor,h.req)).status,'canceled');else await assert.rejects(h.runner.execute(h.actor,h.req),/invalid/);assert.deepEqual(h.state,before);assert.equal(h.moves,0);assert.equal(h.cleanup,Number(key==='invalid'));}});
test('stale planning rejects before cost or movement',async()=>{const h=setup();h.onPrepare=()=>h.c.turn++;await assert.rejects(h.runner.execute(h.actor,h.req),/Combat advanced/);assert.equal(h.moves,0);assert.equal(h.journal,undefined);assert.equal(h.cleanup,1);});
test('Trajectory preserves combo, closes Continuation and consumes the flourish once',async()=>{
 const h=setup();h.state.combo={next:'solid-barrel',untilTurn:2};h.state.continuation={slug:'hypervelocity',turn:1,targets:['enemy']};
 await h.runner.execute(h.actor,h.req);assert.equal(h.state.combo.next,'solid-barrel');assert.equal(h.state.continuation,null);assert.equal(h.moves,1);
 await h.runner.execute(h.actor,h.req);assert.equal(h.moves,1);await assert.rejects(h.runner.execute(h.actor,{id:'other',slug:'guarded-advance'}),/flourish/);
});
for(const degree of [0,1,2,3])test(`Guarded Advance degree ${degree} creates Brutal Shell opening`,async()=>{const h=setup('guarded-advance');h.degree=degree;await h.runner.execute(h.actor,h.req);assert.equal(h.state.combo.next,'brutal-shell');assert.equal(h.stances,1);assert.equal(h.attacks,1);assert.equal(h.moves,1);assert.equal(h.journal.result.degree,degree);});
test('Guarded Advance without an enemy keeps movement and stance, but creates no opening',async()=>{const h=setup('guarded-advance');h.noEnemy=true;await h.runner.execute(h.actor,h.req);assert.equal(h.state.combo,null);assert.equal(h.stances,1);assert.equal(h.damage,0);});
for(const key of ['stopped','displaced','damageError'])test(`${key} preserves spent movement and blocks replay`,async()=>{const h=setup('guarded-advance');h[key]=true;await assert.rejects(h.runner.execute(h.actor,h.req));assert.equal(h.state.lastFlourishTurn,1);assert.equal(h.journal.status,'recovery');await assert.rejects(h.runner.execute(h.actor,h.req),/pending/);assert.equal(h.moves,1);});
test('permission changes during movement stop subordinate effects in recovery',async()=>{const h=setup('guarded-advance');h.onMove=()=>h.denied=true;await assert.rejects(h.runner.execute(h.actor,h.req),/permission/);assert.equal(h.journal.status,'recovery');assert.equal(h.attacks,0);assert.equal(h.stances,0);});
test('paused native movement releases actor queues for intervening reactions',async()=>{
 const h=setup('guarded-advance');let resume,entered;const ready=new Promise(r=>entered=r),paused=new Promise(r=>resume=r);
 h.runner.p.move=async()=>{h.moves++;entered();await paused;return true;};
 const execution=h.runner.execute(h.actor,h.req);await ready;
 let reacted=false;await h.runner.queue.run(h.actor,()=>{reacted=true;});assert(reacted);resume();await execution;assert.equal(h.journal.status,'complete');
});
