import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RequestRouter,validateIntent,assertFreshIntent} from '../scripts/requests.mjs';
import {ActorQueue} from '../scripts/queue.mjs';
const intent=()=>({version:1,id:'click',actorUuid:'Actor.hero',sceneId:'scene',gmId:'gm',slug:'burst-strike',weaponId:'blade',map:0,targetIds:['Scene.scene.Token.enemy'],revision:3,encounterId:'combat',round:1,turn:1});
function harness(){
 const player={id:'player',active:true},actor={uuid:'Actor.hero',type:'character'};
 const calls=[];
 const ports={enabled:()=>true,localId:()=> 'gm',coordinatorId:()=> 'gm',user:id=>id==='player'?player:null,actor:async()=>actor,owns:()=>true,execute:async(a,r)=>{calls.push([a,r]);return {status:'complete'};}};
 return {player,actor,ports,calls,router:new RequestRouter(ports)};
}
test('request identity comes from creation event, while outcomes and costs cannot be supplied',async()=>{
 const h=harness();await h.router.receive(intent(),'player');
 assert.equal(h.calls[0][1].requesterId,'player');assert.equal(h.calls[0][1].id,'player:click');
 assert.throws(()=>validateIntent({...intent(),options:'forged'}),/Invalid resource/);
 for(const field of ['requesterId','outcome','cartridges','context'])assert.throws(()=>validateIntent({...intent(),[field]:'forged'}),/Unexpected/);
});
test('intent validation rejects malformed, oversized, unsupported and cross-scene requests',()=>{
 for(const patch of [{version:2},{id:'x'.repeat(65)},{actorUuid:'Item.blade'},{slug:'fated-circle'},{map:3},{map:NaN},{revision:-1},{revision:2.5},{targetIds:['Scene.other.Token.enemy']},{targetIds:['Scene.scene.Token.one','Scene.scene.Token.two']},{round:-1},{encounterId:{}},{weaponId:'../data'}])assert.throws(()=>validateIntent({...intent(),...patch}));
});
test('validated intent is detached from subsequent edits',()=>{
 const original=intent(),copy=validateIntent(original);original.targetIds[0]='changed';assert.equal(copy.targetIds[0],'Scene.scene.Token.enemy');
});
test('only the nominated active coordinator handles a new request',async()=>{
 for(const patch of [{enabled:()=>false},{localId:()=> 'otherGM'},{coordinatorId:()=> 'otherGM'}]){
  const h=harness();Object.assign(h.ports,patch);assert.equal(await h.router.receive(intent(),'player'),null);assert.equal(h.calls.length,0);
 }
});
test('unowned, disconnected and non-character requests never execute',async()=>{
 for(const patch of [{owns:()=>false},{user:()=>({active:false})},{actor:async()=>({type:'npc'})},{actor:async()=>null}]){
  const h=harness();Object.assign(h.ports,patch);await assert.rejects(()=>h.router.receive(intent(),'player'));assert.equal(h.calls.length,0);
 }
 const h=harness();await assert.rejects(()=>h.router.receive(intent(),'forgedGM'));assert.equal(h.calls.length,0);
});
test('freshness checks reject changed resource state and advanced combat',()=>{
 const c={encounterId:'combat',round:1,turn:1};assert.doesNotThrow(()=>assertFreshIntent(intent(),c,{revision:3}));
 assert.throws(()=>assertFreshIntent(intent(),c,{revision:4}),/Tracker changed/);
 for(const patch of [{encounterId:'next'},{round:2},{turn:0}])assert.throws(()=>assertFreshIntent(intent(),{...c,...patch},{revision:3}),/Combat advanced/);
});
test('shared actor queue serializes manual and native writes, and recovers from failure',async()=>{
 const q=new ActorQueue(),a={uuid:'a'},events=[];let release;
 const first=q.run(a,async()=>{events.push('native');await new Promise(r=>release=r);events.push('native done');throw Error('fail');});
 const failed=assert.rejects(first,/fail/);
 const second=q.run(a,()=>events.push('manual'));
 await q.run({uuid:'b'},()=>events.push('other actor'));
 assert.deepEqual(events,['native','other actor']);release();await Promise.all([failed,second]);
 assert.deepEqual(events,['native','other actor','native done','manual']);
});
