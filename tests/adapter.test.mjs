import {test} from 'node:test';
import assert from 'node:assert/strict';
const hooks=new Map();
globalThis.Hooks={once:(name,fn)=>hooks.set(name,fn),on:(name,fn)=>hooks.set(name,fn)};
globalThis.game={time:{worldTime:1000},combat:{started:true,id:'c1',round:1,turn:0,turns:[]},user:{targets:new Set([{document:{uuid:'target1'}}])}};
const {record,contextFor}=await import('../scripts/gunbreaker.js');
function actor(){
 let state;
 const a={uuid:'Actor.gnb',type:'character',isOwner:true,level:1,
  items:[{type:'class',slug:'gunbreaker'},...['powder-gauge','keen-edge','brutal-shell','solid-barrel','burst-strike'].map(slug=>({type:'feat',slug}))],
  itemTypes:{weapon:[{system:{traits:{value:['gunbreaker']},equipped:{carryType:'held',handsHeld:2}}}]},
  getFlag:()=>state,setFlag:async(_mod,_key,next)=>{await new Promise(r=>setTimeout(r,5));state=structuredClone(next);}};
 game.combat.turns=[{actor:a},{actor:{uuid:'Actor.enemy'}}];return a;
}
test('posting cards has no registered mutation hook',()=>assert(!hooks.has('createChatMessage')));
test('one atomic write stores resource and combo changes; stale duplicate is rejected',async()=>{
 const a=actor();const s=await record(a,{type:'start'},0);
 const results=await Promise.allSettled([record(a,{type:'use',slug:'keen-edge',outcome:'miss'},s.revision),record(a,{type:'use',slug:'keen-edge',outcome:'miss'},s.revision)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.match(results.find(r=>r.status==='rejected').reason.message,/changed/);
 assert.equal(a.getFlag().combo.next,'brutal-shell');assert.equal(a.getFlag().cartridges,1);
});
test('permission failure does not write an actor',async()=>{
 const a=actor();a.isOwner=false;await assert.rejects(()=>record(a,{type:'start'}),/own/);assert.equal(a.getFlag(),undefined);
});
test('combat context counts the actor turn correctly before and after initiative',()=>{
 const a=actor();game.combat.round=2;game.combat.turn=1;
 assert.equal(contextFor(a).turn,2);assert.equal(contextFor(a).inTurn,false);
 game.combat.turns.reverse();game.combat.turn=0;
 assert.equal(contextFor(a).turn,1);assert.equal(contextFor(a).inTurn,false);
 game.combat.round=1;game.combat.turn=0;
});
