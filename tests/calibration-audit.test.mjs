import test from 'node:test';
import assert from 'node:assert/strict';
import {sources} from '../tools/sources.mjs';
import {CALIBRATED,calibrationType,damageType,calibratedTraits,calibratedItem,followupFormula} from '../scripts/mechanics.mjs';
import {areaFormula,areaPersistentFormula} from '../scripts/area.mjs';
import {reignFormula} from '../scripts/reign.mjs';
import {lightningWeapon} from '../scripts/lightning.mjs';
import {initialState,normalizeState,transition} from '../scripts/state.mjs';
import {catalogue} from '../scripts/catalogue.mjs';
import {setup} from './helpers/native-save-harness.mjs';
const entries=await sources(),items=new Map(entries.map(e=>[e.doc.system?.slug,e.doc]));
test('calibrated component list matches all ten approved abilities exactly',()=>{
 assert.deepEqual([...CALIBRATED].sort(),['burst-strike','hypervelocity','jugular-rip','abdomen-tear','eye-gouge','fated-circle','fated-brand','double-down','saturation-fire','overpowered-round'].sort());
 for(const slug of CALIBRATED)assert(items.has(slug));
});
for(const type of ['fire','cold','electricity'])test(`${type} applies to all calibrated formulas at every legal class level`,()=>{
 for(let level=1;level<=20;level++){
  for(const slug of CALIBRATED)assert.equal(damageType(slug,type),type);
  for(const slug of ['fated-circle','fated-brand','double-down','saturation-fire']){
   if(level<catalogue[slug].level)continue;
   const dice=slug==='fated-brand'?(level>=17?3:2):slug==='double-down'?(level>=18?12:10):Math.ceil(level/2);
   assert.equal(areaFormula(slug,level,type),`${dice}d6[${type}]`);
  }
  if(level>=7)for(const weaponDice of [1,2,3,4])assert.equal(followupFormula(level,weaponDice,type),`(${level>=17?4:level>=11?3:2}d6+${weaponDice})[${type}]`);
 }
});
test('Burst Strike activates exactly one bonus-dice rule without editing weapon/rune damage',()=>{
 const rules=items.get('burst-strike').system.rules;
 for(const type of ['fire','cold','electricity']){
  const options=new Set(['item:trait:gunbreaker','item:melee','gunbreaker:action:burst-strike',`gunbreaker:calibration:${type}`]);
  const enabled=rules.filter(r=>r.predicate.every(p=>options.has(p)));assert.equal(enabled.length,1);assert.equal(enabled[0].damageType,type);assert.equal(enabled[0].diceNumber,'1+floor((@actor.level+1)/6)');
  options.delete('gunbreaker:action:burst-strike');assert.equal(rules.filter(r=>r.predicate.every(p=>options.has(p))).length,0);
 }
 for(const slug of ['gnashing-fang','savage-claw','wicked-talon','reign-of-beasts','noble-blood','lion-heart'])assert(items.get(slug).system.rules.filter(r=>r.key==='DamageDice').every(r=>r.damageType==='slashing'));
 assert(items.get('sonic-break').system.rules.some(r=>r.damageType==='bleed'));
});
test('excluded abilities keep physical, fire and persistent components for every calibration',()=>{
 for(const type of ['fire','cold','electricity'])for(const level of [1,5,11,12,14,17,18,20]){
  assert.equal(areaFormula('demon-slice',level,type),`${Math.ceil(level/2)}d4[slashing]`);
  assert.equal(areaFormula('demon-slaughter',level,type),`${Math.ceil(level/2)}d4[slashing]`);
  assert.equal(areaFormula('danger-zone',level,type),`${Math.ceil(level/2)}d6[fire]`);
  if(level>=14)assert.equal(areaFormula('danger-zone',level,type,['blasting-zone']),`${Math.ceil(level/2)}d8[fire]`);
  assert.equal(areaFormula('bow-shock',level,type),`${Math.ceil(level/2)}d4[fire]`);assert.equal(areaPersistentFormula('bow-shock',level),`${level>=12?2:1}d4[persistent,fire]`);
  assert.equal(areaFormula('relentless-rush',level,type),'8d6[fire]');
  for(const [slug,n] of [['reign-of-beasts',2],['noble-blood',3],['lion-heart',4]])assert.equal(reignFormula(slug),`${n}d6[fire]`);
 }
 const source=structuredClone(items.get('gunblade')),before=structuredClone(source);source.system.runes.property=['flaming'];const shot=lightningWeapon(source);
 assert.equal(shot.system.damage.damageType,'fire');assert.deepEqual(shot.system.runes.property,['flaming']);assert.equal(source.system.damage.damageType,before.system.damage.damageType);
});
test('only a corresponding fire trait is replaced; source ability, other traits and weapons remain intact',()=>{
 assert.deepEqual(calibratedTraits('fated-circle',['gunbreaker','magical','fire','evocation'],'cold'),['gunbreaker','magical','cold','evocation']);
 assert.deepEqual(calibratedTraits('bow-shock',['magical','fire'],'cold'),['magical','fire']);
 assert.deepEqual(calibratedTraits('fated-circle',['magical'],'cold'),['magical']);
 const source={system:{traits:{value:['magical','fire']}},clone:(changes,options)=>({changes,options})};
 const copy=calibratedItem(source,'fated-circle','electricity');assert.deepEqual(copy.changes,{'system.traits.value':['magical','electricity']});assert.equal(copy.options.keepId,true);assert.deepEqual(source.system.traits.value,['magical','fire']);
 assert.equal(calibratedItem(source,'danger-zone','electricity'),source);
});
test('invalid calibration cannot become an arbitrary formula or silently remove Burst bonus dice',()=>{
 for(const type of ['void','cold],999[fire','',null,2]){
  assert.throws(()=>calibrationType(type),/Calibration/);assert.throws(()=>damageType('overpowered-round',type),/Calibration/);
  assert.throws(()=>normalizeState({...initialState(),calibration:type},{time:1,learned:[],level:1,encounterId:null}),/Calibration/);
 }
});
test('daily preparation changes calibration explicitly and encounter cleanup preserves the choice',()=>{
 const c={time:1000,level:7,learned:['aetheric-calibration'],encounterId:null,turn:0,round:0};
 let s=transition(initialState(),{type:'daily',calibration:'cold'},c,catalogue);assert.equal(s.calibration,'cold');
 s=transition(s,{type:'start'},{...c,encounterId:'combat'},catalogue);assert.equal(s.calibration,'cold');
 s=transition(s,{type:'end'},c,catalogue);assert.equal(s.calibration,'cold');
 assert.throws(()=>transition(initialState(),{type:'daily',calibration:'electricity'},{...c,learned:[]},catalogue),/not learned/);
});
test('calibrated area damage, saves and application use the same scoped ability traits',async()=>{
 const h=setup({slug:'fated-circle',level:12,calibration:'cold',degrees:[1],killOnApply:false});
 const item=h.actor.items.find(i=>i.slug==='fated-circle');item.system.traits.value.push('fire');
 item.clone=changes=>({...item,system:{...item.system,traits:{value:changes['system.traits.value']}},getRollOptions:()=>['item:type:feat','item:trait:cold']});
 h.onApply=()=>{};await h.runner.execute(h.actor,h.req);
 assert(h.saveArgs[0].traits.includes('cold'));assert(!h.saveArgs[0].traits.includes('fire'));assert(item.system.traits.value.includes('fire'));assert.deepEqual(h.rolls,['6d6[cold]']);
});
