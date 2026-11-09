import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lightningWeapon,lightningStrike} from '../scripts/lightning.mjs';
const weapon={_id:'blade',system:{traits:{value:['gunbreaker','two-hand-d12','finesse']},damage:{die:'d8',dice:3,damageType:'slashing'},runes:{potency:2,striking:2,property:['flaming']},range:null,reload:{value:''}}};
test('Lightning Shot overlays the one-handed base die and runes without changing the actual weapon',()=>{
 const before=structuredClone(weapon),shot=lightningWeapon(weapon);assert.deepEqual(weapon,before);
 assert.equal(shot.system.damage.die,'d8');assert.equal(shot.system.damage.dice,3);assert.equal(shot.system.damage.damageType,'fire');
 assert.equal(shot.system.range,30);assert.equal(shot.system.maxRange,null);assert.equal(shot.system.reload.value,null);assert.deepEqual(shot.system.runes,weapon.system.runes);
 assert.deepEqual(shot.system.traits.value,['gunbreaker']);
});
test('Lightning Shot blocks unknown and restricted runes instead of applying melee-only damage',()=>{
 for(const property of [['serrating'],['returning'],['unknown']])assert.throws(()=>lightningWeapon({...weapon,system:{...weapon.system,runes:{property}}}),/eligibility/);
});
test('Lightning Shot uses a detached actor with the same embedded weapon identity',()=>{
 const actor={toObject:()=>({items:[weapon,{_id:'other'}]}),clone:(data,options)=>{assert(options.keepId);assert.equal(data.items.length,2);assert.equal(data.items[0]._id,'blade');assert.equal(data.items[0].system.range,30);return {system:{actions:[{item:{id:'blade',isRanged:true}}]}};}};
 assert.equal(lightningStrike(actor,'blade').item.id,'blade');
});
