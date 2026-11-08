import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sources} from '../tools/sources.mjs';
import {followupFormula,damageType,superbolideHP,stoneResistance} from '../scripts/mechanics.mjs';
import {planMigration,actorBackup} from '../scripts/migration.mjs';
const entries=await sources(),bySlug=new Map(entries.filter(e=>e.doc.type==='feat').map(e=>[e.doc.system.slug,e.doc]));
const baseline=JSON.parse(await readFile(new URL('../migrations/baseline-v1.3.json',import.meta.url),'utf8'));
test('revised feat identities and native frequency match the approved design',()=>{
 for(const s of ['guarded-advance','aetheric-calibration','reserved-cartridge','gunnhildr-escort'])assert(bySlug.has(s));
 assert(!bySlug.has('twin-cartridge'));assert(!bySlug.has('overcharged-gauge'));
 assert.equal(bySlug.get('camouflage').system.frequency.per,'PT1M');assert.equal(bySlug.get('guarded-advance').system.actions.value,2);
});
test('Continuation scales at actual breakpoints and uses the weapon snapshot, not level-inferred runes',()=>{
 assert.equal(followupFormula(7,2),'(2d6+2)[fire]');assert.equal(followupFormula(11,2),'(3d6+2)[fire]');assert.equal(followupFormula(17,3,'cold'),'(4d6+3)[cold]');assert.equal(followupFormula(19,1),'(4d6+1)[fire]');
});
test('Superbolide HP floor and enhanced Stone scale correctly',()=>{
 assert.equal(superbolideHP(2,10),1);assert.equal(superbolideHP(100,10),90);assert.throws(()=>superbolideHP(1,10));
 assert.equal(stoneResistance(7),5);assert.equal(stoneResistance(19,{enhanced:true,legend:true}),23);
});
test('calibration is limited to the explicit list and leaves excluded damage alone',()=>{
 for(const s of ['burst-strike','fated-brand','saturation-fire','overpowered-round'])assert.equal(damageType(s,'electricity'),'electricity');
 for(const s of ['lightning-shot','danger-zone','bow-shock','reign-of-beasts','relentless-rush'])assert.equal(damageType(s,'cold'),'fire');
});
test('Reign native rule dice match the unchanged 2/3/4 sequence',()=>{
 for(const [s,count] of [['reign-of-beasts',2],['noble-blood',3],['lion-heart',4]])assert.equal(bySlug.get(s).system.rules.find(r=>r.key==='DamageDice').diceNumber,count);
});
function owned(slug,id){const e=baseline.find(e=>e.doc.type==='feat'&&e.doc.system.slug===slug);const d=structuredClone(e.doc);d._id=id;d._stats={compendiumSource:e.uuid};d.system.location='class-8';return d;}
test('migration leaves retired feats untouched until the owner chooses',()=>{
 const actor={_id:'a',items:[owned('twin-cartridge','t'),owned('overcharged-gauge','o')]};
 const plan=planMigration(actor,baseline,entries);assert.equal(plan.decisions.length,2);assert.equal(plan.updates.length,0);
 const chosen=planMigration(actor,baseline,entries,{acceptReserved:['t']});assert.equal(chosen.updates[0].system.slug,'reserved-cartridge');assert.equal(chosen.updates[0].system.location,'class-8');assert.equal(chosen.decisions.length,1);
});
test('migration preserves custom rules and unrecognized items',()=>{
 const item=owned('burst-strike','b');item.system.rules=[{key:'FlatModifier',value:5}];
 const plan=planMigration({_id:'a',items:[item,{_id:'custom',type:'feat',system:{slug:'burst-strike'}}]},baseline,entries);
 assert(plan.conflicts.some(c=>c.field==='system.rules'));assert(!plan.updates.some(u=>u._id==='custom'));assert(!plan.updates[0]?.['system.rules']);
});
test('backup is detached and cannot recursively include earlier backups',()=>{
 const actor={_id:'a',items:[],flags:{'gunbreaker-pf2e':{backups:[1],tracker:{cartridges:2}}}};
 const backup=actorBackup(actor);assert(!backup.actor.flags['gunbreaker-pf2e'].backups);assert.deepEqual(actor.flags['gunbreaker-pf2e'].backups,[1]);
});
