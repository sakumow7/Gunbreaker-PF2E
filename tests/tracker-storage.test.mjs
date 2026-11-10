import test from 'node:test';
import assert from 'node:assert/strict';
import {trackerPatch,writeTracker} from '../scripts/tracker-storage.mjs';
import {initialState,transition} from '../scripts/state.mjs';
import {catalogue} from '../scripts/catalogue.mjs';
function merge(old,patch){const out=structuredClone(old??{});for(const [key,value] of Object.entries(patch)){if(key.startsWith('-=')){delete out[key.slice(2)];continue;}out[key]=value&&typeof value==='object'&&!Array.isArray(value)?merge(out[key],value):structuredClone(value);}return out;}
test('one merged flag write removes old nested gates without clearing unrelated flags',async()=>{
 let stored={...initialState(),encounter:'old',once:{discipline:true,expertise:true,brutalRound:1},dailyUses:{superbolide:1},cooldowns:{hypervelocity:[1],aurora:[900]}};
 const c={time:1000,encounterId:'new',round:1,turn:1,inTurn:true,learned:[],level:20,wielding:true},next=transition(stored,{type:'start'},c,catalogue);let writes=0;
 const actor={getFlag:()=>stored,setFlag:async(mod,key,patch)=>{assert.equal(mod,'gunbreaker-pf2e');assert.equal(key,'tracker');writes++;stored=merge(stored,patch);}};
 await writeTracker(actor,next);assert.equal(writes,1);assert.deepEqual(stored,next);assert.deepEqual(stored.once,{});assert(!('hypervelocity' in stored.cooldowns));assert.equal(stored.dailyUses.superbolide,1);assert.deepEqual(stored.cooldowns.aurora,[900]);
});
test('daily preparations clear daily uses with merge semantics; input states stay unchanged',()=>{
 const old={...initialState(),once:{discipline:true},dailyUses:{superbolide:1},dailyDay:0,cooldowns:{aurora:[86000]}},before=structuredClone(old);
 const next=transition(old,{type:'daily'},{time:86400,day:1,encounterId:null,round:0,turn:0,inTurn:false,learned:[],level:20,wielding:true},catalogue);
 assert.deepEqual(merge(old,trackerPatch(old,next)),next);assert.deepEqual(old,before);assert.deepEqual(next.dailyUses,{});
});
