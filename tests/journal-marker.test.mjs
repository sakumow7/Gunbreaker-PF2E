import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {writeMarker} from '../scripts/tracker-storage.mjs';

// Mimics Foundry's setFlag: a recursive merge where "-=key" deletes.
function fakeActor(){
 const flags={};
 const merge=(target,patch)=>{for(const [k,v] of Object.entries(patch)){
  if(k.startsWith('-='))delete target[k.slice(2)];
  else if(v&&typeof v==='object'&&!Array.isArray(v)){target[k]=target[k]&&typeof target[k]==='object'?target[k]:{};merge(target[k],v);}
  else target[k]=v;}};
 return {flags,getFlag:(_m,k)=>flags[k],setFlag:async(_m,k,v)=>{if(v&&typeof v==='object'){flags[k]??={};merge(flags[k],v);}else flags[k]=v;}};
}

test('a new execution journal does not inherit riders from the previous action', async ()=>{
 const actor=fakeActor();
 await writeMarker(actor,'execution',{id:'a',slug:'eye-gouge',status:'complete',riders:[{kind:'continuation-damage'}]});
 await writeMarker(actor,'execution',{id:'b',slug:'hypervelocity',status:'reserved'});
 assert.deepEqual(actor.getFlag('m','execution'),{id:'b',slug:'hypervelocity',status:'reserved'});
});

test('no module code writes the execution or follow-up journal with a merging setFlag', async ()=>{
 for(const f of ['area-native','continuation-damage','demoralize-native','followup-native','maintenance','movement-native','native','riders','stone-native']){
  const s=await readFile(new URL(`../scripts/${f}.mjs`,import.meta.url),'utf8');
  assert.doesNotMatch(s,/setFlag\(MOD,'(execution|followup)'/,f);
 }
});

test('Reign damage evidence ignores Dice So Nice annotations and avoids structuredClone of rolls', async ()=>{
 const s=await readFile(new URL('../scripts/reign-native.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(s,/same\(m\.rolls/);
 assert.doesNotMatch(s,/structuredClone\(roll\.toJSON\(\)\)/);
});
