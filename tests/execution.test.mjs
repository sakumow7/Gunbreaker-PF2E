import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ActionRunner} from '../scripts/execution.mjs';
import {initialState,transition} from '../scripts/state.mjs';
import {catalogue} from '../scripts/catalogue.mjs';
function setup({degree=2,cancel=false,resolveError=false,allowed=true}={}){
 const actor={uuid:'Actor.test'},context={time:1000,level:7,learned:['burst-strike','continuation','hypervelocity','keen-edge','brutal-shell','solid-barrel'],encounterId:'encounter',round:1,turn:1,inTurn:true,targetIds:['target'],wielding:true,weaponDice:2,weaponId:'blade'};
 let state=transition(initialState(),{type:'start'},context,catalogue),journal=null,attacks=0,resolves=0;
 const ports={authorize:()=>{if(!allowed)throw Error('permission');},context:()=>context,read:()=>state,write:(_a,s)=>{state=structuredClone(s);},journal:()=>journal,saveJournal:(_a,j)=>{journal=structuredClone(j);},validate:()=>{},attack:async()=>{attacks++;await Promise.resolve();return cancel?null:{degree,weaponDice:2,weaponId:'blade'};},resolve:()=>{resolves++;if(resolveError)throw Error('effect write failed');}};
 return {actor,context,runner:new ActionRunner(ports),ports,get state(){return state;},get journal(){return journal;},get attacks(){return attacks;},get resolves(){return resolves;}};
}
test('native hit spends once, captures weapon dice, and duplicate click never rerolls',async()=>{
 const h=setup(),req={id:'click1',slug:'burst-strike'};
 await Promise.all([h.runner.execute(h.actor,req),h.runner.execute(h.actor,req)]);
 assert.equal(h.attacks,1);assert.equal(h.resolves,1);assert.equal(h.state.cartridges,0);assert.equal(h.state.continuation.weaponDice,2);
});
test('a canceled native attack releases reservation and spends nothing',async()=>{
 const h=setup({cancel:true});const before=structuredClone(h.state);
 assert.equal((await h.runner.execute(h.actor,{id:'cancel',slug:'burst-strike'})).status,'canceled');assert.deepEqual(h.state,before);assert.equal(h.resolves,0);
});
test('native miss spends cartridge and opens no Continuation',async()=>{
 const h=setup({degree:1});await h.runner.execute(h.actor,{id:'miss',slug:'burst-strike'});assert.equal(h.state.cartridges,0);assert.equal(h.state.continuation,null);
});
test('post-attack failure keeps cost and requires recovery rather than rerolling',async()=>{
 const h=setup({resolveError:true});await assert.rejects(()=>h.runner.execute(h.actor,{id:'error',slug:'burst-strike'}),/effect write/);
 assert.equal(h.state.cartridges,0);assert.equal(h.journal.status,'recovery');
 await assert.rejects(()=>h.runner.execute(h.actor,{id:'error',slug:'burst-strike'}),/recovery/);
 await assert.rejects(()=>h.runner.execute(h.actor,{id:'new',slug:'keen-edge'}),/pending/);assert.equal(h.attacks,1);
});
test('invalid preflight, unsupported ability and permission failure cause no rolls',async()=>{
 const h=setup();await assert.rejects(()=>h.runner.execute(h.actor,{id:'bad',slug:'solid-barrel'}),/opening/);
 await assert.rejects(()=>h.runner.execute(h.actor,{id:'area',slug:'fated-circle'}),/not yet supported/);assert.equal(h.attacks,0);
 const p=setup({allowed:false});await assert.rejects(()=>p.runner.execute(p.actor,{id:'p',slug:'burst-strike'}),/permission/);assert.equal(p.journal,null);
});
test('missing native degree leaves recovery state and never asks for a fabricated hit',async()=>{
 const h=setup({degree:null});await assert.rejects(()=>h.runner.execute(h.actor,{id:'no-degree',slug:'burst-strike'}),/degree/);assert.equal(h.journal.status,'recovery');
});
test('new runner after reconnect refuses to replay an unresolved committed action',async()=>{
 const h=setup({resolveError:true});await assert.rejects(()=>h.runner.execute(h.actor,{id:'persist',slug:'burst-strike'}));
 const fresh=new ActionRunner(h.ports);await assert.rejects(()=>fresh.execute(h.actor,{id:'persist',slug:'burst-strike'}),/recovery/);assert.equal(h.attacks,1);
});
