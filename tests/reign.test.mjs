import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ReignRunner,reignFormula} from '../scripts/reign.mjs';
import {initialState,transition} from '../scripts/state.mjs';
import {catalogue} from '../scripts/catalogue.mjs';
function setup({degree=2}={}){
 const actor={uuid:'Actor.hero'},c={time:1000,level:18,learned:['bloodfest','reign-of-beasts','noble-blood','lion-heart'],encounterId:'combat',round:1,turn:1,inTurn:true,wielding:true,targetIds:['primary']};
 let state=transition(transition(initialState(),{type:'start'},c,catalogue),{type:'use',slug:'bloodfest'},c,catalogue),journal=null,attacks=0,damages=0;
 const candidates=[{uuid:'one',actorUuid:'Actor.one'},{uuid:'two',actorUuid:'Actor.two'}],applications=[];
 const prepared={primary:{uuid:'primary',actorUuid:'Actor.primary'},candidates,targets:[]};
 const p={authorize:()=>{},read:()=>state,write:(_a,s)=>{state=structuredClone(s);},journal:()=>journal,saveJournal:(_a,j)=>{journal=structuredClone(j);},
 prepare:()=>prepared,validate:()=>c,verify:()=>{},attack:()=>{attacks++;return {degree};},primaryDamage:()=>({messageId:'primaryDamage'}),choose:()=>['one','two'],
 damage:()=>{damages++;return {formula:reignFormula('reign-of-beasts')};},save:(_a,_r,_c,t)=>({degree:t.uuid==='one'?1:0}),
 review:(_a,_r,_c,_p,j)=>j.saves.map(s=>({target:s.target,multiplier:s.degree===0?2:1})),apply:(_a,_r,_c,_p,_j,row)=>applications.push(row),summary:()=>{}};
 return {actor,c,p,prepared,applications,runner:new ReignRunner(p),req:{id:'click',slug:'reign-of-beasts'},get state(){return state;},get journal(){return journal;},get attacks(){return attacks;},get damages(){return damages;}};
}
test('Bloodfest primes a full Reign sequence whose misses still advance once per turn',async()=>{
 const h=setup({degree:1});assert.equal(h.state.cartridges,4);assert.equal(h.state.bloodfestUntil,1060);assert.equal(h.state.reignUntil,1060);
 await h.runner.execute(h.actor,h.req);assert.equal(h.state.reignUntil,0);assert.equal(h.state.combo.next,'noble-blood');assert.equal(h.damages,0);
 await assert.rejects(()=>h.runner.execute(h.actor,{id:'early',slug:'noble-blood'}),/one Reign/);
 h.c.turn++;await h.runner.execute(h.actor,{id:'second',slug:'noble-blood'});assert.equal(h.state.combo.next,'lion-heart');
 h.c.turn++;await h.runner.execute(h.actor,{id:'third',slug:'lion-heart'});assert.equal(h.state.combo,null);assert.equal(h.state.continuation,null);
});
test('Reign critical primary does not double secondary formula; secondary save degree controls its multiplier',async()=>{
 const h=setup({degree:3});await h.runner.execute(h.actor,h.req);
 assert.deepEqual([...['reign-of-beasts','noble-blood','lion-heart'].map(reignFormula)],['2d6[fire]','3d6[fire]','4d6[fire]']);
 assert.deepEqual(h.applications.map(a=>a.multiplier),[1,2]);assert.equal(h.damages,1);assert.equal(h.state.continuation,null);
});
test('canceled Reign attack leaves opening and state unchanged; canceled primary damage needs recovery',async()=>{
 const h=setup(),before=structuredClone(h.state);h.p.attack=()=>null;
 assert.equal((await h.runner.execute(h.actor,h.req)).status,'canceled');assert.deepEqual(h.state,before);
 const hit=setup();hit.p.primaryDamage=()=>null;await assert.rejects(()=>hit.runner.execute(hit.actor,hit.req),/Primary damage was canceled/);
 assert.equal(hit.state.reignUntil,0);assert.equal(hit.state.combo.next,'noble-blood');assert.equal(hit.journal.status,'recovery');assert.equal(hit.damages,0);
});
test('Reign duplicates and a new runner cannot replay partial secondary damage',async()=>{
 const h=setup();h.p.apply=(...args)=>{h.applications.push(args.at(-1));if(h.applications.length===2)throw Error('uncertain HP');};
 await assert.rejects(()=>h.runner.execute(h.actor,h.req),/uncertain/);assert.deepEqual(h.journal.applications.map(a=>a.status),['complete','applying']);
 await assert.rejects(()=>new ReignRunner(h.p).execute(h.actor,h.req),/pending/);assert.equal(h.attacks,1);assert.equal(h.damages,1);
 const clean=setup();await Promise.all([clean.runner.execute(clean.actor,clean.req),clean.runner.execute(clean.actor,clean.req)]);await clean.runner.execute(clean.actor,clean.req);assert.equal(clean.attacks,1);
});
test('Reign permits zero secondaries but rejects more than two, duplicate or unrelated targets',async()=>{
 const h=setup();h.p.choose=()=>[];await h.runner.execute(h.actor,h.req);assert.equal(h.damages,0);assert.equal(h.journal.status,'complete');
 for(const selected of [['one','two','three'],['one','one'],['primary']]){
  const invalid=setup();invalid.p.choose=()=>selected;await assert.rejects(()=>invalid.runner.execute(invalid.actor,invalid.req),/two eligible/);assert.equal(invalid.damages,0);
 }
});
test('expired readiness, expired combo and a missing Reign feat block before rolling',async()=>{
 const h=setup();h.c.time=1060;await assert.rejects(()=>h.runner.execute(h.actor,h.req),/Ready to Reign/);assert.equal(h.attacks,0);
 const missing=setup();missing.c.learned=missing.c.learned.filter(s=>s!=='reign-of-beasts');
 const state={...missing.state,combo:{next:'noble-blood',untilTurn:2}};
 assert.throws(()=>transition(state,{type:'use',slug:'noble-blood',outcome:'hit'},missing.c,catalogue),/not learned reign/);
 assert.throws(()=>transition({...state,combo:{next:'noble-blood',untilTurn:0}},{type:'use',slug:'noble-blood',outcome:'hit'},h.c,catalogue),/opening/);
});
