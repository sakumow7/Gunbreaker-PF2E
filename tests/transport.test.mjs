import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installRequests} from '../scripts/transport.mjs';
const MOD='gunbreaker-pf2e';
const intent=()=>({version:1,id:'click',actorUuid:'Actor.hero',sceneId:'scene',gmId:'gm',slug:'burst-strike',weaponId:'blade',map:0,targetIds:['Scene.scene.Token.enemy'],revision:0,encounterId:'combat',round:1,turn:1});
function setup(gm=true){
 const hooks=new Map(),calls=[],updates=[];
 const users=[{id:'gm',active:true,isGM:true},{id:'player',active:true,isGM:false}];users.get=id=>users.find(u=>u.id===id);
 globalThis.Hooks={on:(name,fn)=>hooks.set(name,fn)};
 globalThis.game={users,user:users[gm?0:1],settings:{get:()=>true}};
 globalThis.canvas={scene:{id:'scene'}};
 globalThis.foundry={utils:{escapeHTML:s=>s,randomID:()=> 'generated'}};
 globalThis.ui={notifications:{warn:()=>{},info:()=>{}}};
 const actor={uuid:'Actor.hero',type:'character',isOwner:true,testUserPermission:()=>true,getFlag:()=>null};
 globalThis.fromUuid=async()=>actor;
 const runner={execute:async(a,r)=>{calls.push([a,r]);return {status:'complete'};}};
 const context=()=>({encounterId:'combat',round:1,turn:1,targetIds:['Scene.scene.Token.enemy']});
 const api=installRequests(runner,context);
 const message=raw=>({author:{id:'player'},getFlag:(_m,k)=>k==='request'?raw:message.response,update:async change=>updates.push(change)});
 return {api,actor,runner,hooks,calls,updates,message,users};
}
const flush=()=>new Promise(r=>setImmediate(r));
test('ordinary rules cards and updated requests never execute',async()=>{
 const h=setup();h.hooks.get('createChatMessage')(h.message(undefined),{},'player');
 h.hooks.get('updateChatMessage')(h.message(intent()),{flags:{[MOD]:{request:intent()}}},{},'player');
 await flush();assert.equal(h.calls.length,0);
});
test('creation hook uses actual creator identity and copies intent before asynchronous work',async()=>{
 const h=setup(),raw=intent();h.hooks.get('createChatMessage')(h.message(raw),{},'player');raw.slug='solid-barrel';
 await flush();assert.equal(h.calls.length,1);assert.equal(h.calls[0][1].slug,'burst-strike');assert.equal(h.calls[0][1].requesterId,'player');
 assert.equal(h.updates[0][`flags.${MOD}.response`].status,'complete');
});
test('mismatched author and creator gets no GM execution',async()=>{
 const h=setup();h.hooks.get('createChatMessage')(h.message(intent()),{},'gm');await flush();
 assert.equal(h.calls.length,0);assert.equal(h.updates[0][`flags.${MOD}.response`].status,'error');
});
test('player submission is whispered, blocks duplicate actor requests and accepts only GM acknowledgement',async()=>{
 const h=setup(false);let created;
 globalThis.ChatMessage={create:async data=>{created=data;return {};}};
 const p=h.api.execute(h.actor,{id:'click',slug:'burst-strike',weaponId:'blade',map:0});await flush();
 assert.deepEqual(created.whisper,['gm','player']);assert.equal(created.author,'player');assert.equal(h.calls.length,0);
 await assert.rejects(()=>h.api.execute(h.actor,{id:'second',slug:'keen-edge',weaponId:'blade'}),/unresolved/);
 const m={getFlag:(_m,k)=>k==='request'?intent():{id:'click',status:'complete'}};
 h.hooks.get('updateChatMessage')(m,{flags:{[MOD]:{response:{}}}},{},'player');
 await assert.rejects(()=>h.api.execute(h.actor,{id:'third',slug:'keen-edge',weaponId:'blade'}),/unresolved/);
 h.hooks.get('updateChatMessage')(m,{flags:{[MOD]:{response:{}}}},{},'gm');assert.equal((await p).status,'complete');
});
test('uncertain submission failure retains the local guard until GM acknowledgement',async()=>{
 const h=setup(false);let submits=0;globalThis.ChatMessage={create:async()=>{submits++;throw Error('network failed');}};
 await assert.rejects(()=>h.api.execute(h.actor,{id:'click',slug:'burst-strike',weaponId:'blade'}),/delivery is uncertain/);
 await assert.rejects(()=>h.api.execute(h.actor,{id:'two',slug:'burst-strike',weaponId:'blade'}),/unresolved/);
 assert.equal(submits,1);
 const m={getFlag:(_m,k)=>k==='request'?intent():{id:'click',status:'complete'}};
 h.hooks.get('updateChatMessage')(m,{flags:{[MOD]:{response:{}}}},{},'gm');
});
test('timeout never automatically retries and late GM acknowledgement releases the guard',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const h=setup(false);let submits=0;globalThis.ChatMessage={create:async()=>{submits++;return {};}};
 const p=h.api.execute(h.actor,{id:'click',slug:'burst-strike',weaponId:'blade'});
 const failed=assert.rejects(p,/may have executed/);t.mock.timers.tick(90000);await failed;
 await assert.rejects(()=>h.api.execute(h.actor,{id:'next',slug:'burst-strike',weaponId:'blade'}),/unresolved/);assert.equal(submits,1);
 const m={getFlag:(_m,k)=>k==='request'?intent():{id:'click',status:'complete'}};
 h.hooks.get('updateChatMessage')(m,{flags:{[MOD]:{response:{}}}},{},'gm');
 globalThis.ChatMessage.create=async()=>{throw Error('new request reached transport');};
 await assert.rejects(()=>h.api.execute(h.actor,{id:'next',slug:'burst-strike',weaponId:'blade'}),/delivery is uncertain/);
});
