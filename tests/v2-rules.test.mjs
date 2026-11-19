import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=async f=>JSON.parse(await readFile(new URL(`../packs/_source/${f}.json`,import.meta.url),'utf8'));
// Evaluate a rule-element level formula the way PF2e would for a plain number.
const atLevel=(formula,level)=>Function('max','floor',`return ${formula.replaceAll('@actor.level',level)}`)(Math.max,Math.floor);

test('No Mercy is a level 1 class feature granted by the class', async ()=>{
 const feat=await src('gunbreaker-feats/no-mercy'),cls=await src('gunbreaker-class/gunbreaker');
 assert.equal(feat.system.category,'classfeature');assert.equal(feat.system.level.value,1);
 assert.equal(cls.system.items[feat._id]?.level,1);
 const effect=await src('gunbreaker-effects/no-mercy');
 const at=(v,L)=>v.brackets.find(x=>(x.start??0)<=L&&L<=(x.end??99)).value;
 assert.deepEqual([1,13,14,19,20].map(L=>at(effect.system.rules[0].value,L)),[2,2,3,3,4]);
});
test('Continuation follow-ups are free actions', async ()=>{
 for(const slug of ['hypervelocity','jugular-rip','abdomen-tear','eye-gouge','fated-brand']){
  const doc=await src(`gunbreaker-class/${slug}`);
  assert.equal(doc.system.actionType.value,'free',slug);assert.equal(doc.system.actions.value,null,slug);
 }
});
test('Burst Strike scales 1/2/3/4 dice at 1/5/14/20', async ()=>{
 const rule=(await src('gunbreaker-class/burst-strike')).system.rules.find(r=>r.key==='DamageDice');
 const at=L=>rule.diceNumber.brackets.find(b=>(b.start??0)<=L&&L<=(b.end??99)).value;
 assert.deepEqual([1,4,5,13,14,19,20].map(at),[1,1,2,2,3,3,4]);
});
test('Royal Guard projects a 5-foot enmity aura that penalizes attacks on others', async ()=>{
 const stance=await src('gunbreaker-effects/royal-guard-stance'),challenged=await src('gunbreaker-effects/royal-guard-challenged');
 const aura=stance.system.rules.find(r=>r.key==='Aura');
 assert.equal(aura.radius,5);assert.equal(aura.effects[0].affects,'enemies');assert.equal(aura.effects[0].removeOnExit,true);
 assert.equal(aura.effects[0].uuid,`Compendium.gunbreaker-pf2e.gunbreaker-effects.Item.${challenged._id}`);
 assert.ok(aura.predicate.includes('gunbreaker:wielding'));
 const penalty=challenged.system.rules[0];
 assert.equal(penalty.value,-1);assert.equal(penalty.type,'circumstance');
 assert.deepEqual(penalty.predicate,[{not:`target:effect:${stance.system.slug}`}]);
});
test("Lion's Legend reaches legendary armor", async ()=>{
 const doc=await src('gunbreaker-class/lions-legend');
 for(const k of ['light','medium','unarmored'])assert.equal(doc.system.subfeatures.proficiencies[k].rank,4,k);
});
test('every item carries the 2.0 publication', async ()=>{
 const {readdir}=await import('node:fs/promises');
 for(const pack of ['gunbreaker-class','gunbreaker-feats','gunbreaker-equipment','gunbreaker-effects']){
  for(const f of await readdir(new URL(`../packs/_source/${pack}/`,import.meta.url))){
   if(!f.endsWith('.json'))continue;const doc=await src(`${pack}/${f.slice(0,-5)}`);
   if(doc.system?.publication)assert.match(doc.system.publication.title,/2\.0\.0-beta\.1/,`${pack}/${f}`);
  }
 }
});
test('rule formulas never put a minus right after an injected property', async ()=>{
 // PF2e reads "@actor.level-8" as the property "level-8" (resolves to 0); brackets or spaces are required.
 const {readdir}=await import('node:fs/promises');
 for(const pack of ['gunbreaker-class','gunbreaker-feats','gunbreaker-equipment','gunbreaker-effects']){
  for(const f of await readdir(new URL(`../packs/_source/${pack}/`,import.meta.url))){
   if(!f.endsWith('.json'))continue;const doc=await src(`${pack}/${f.slice(0,-5)}`);
   const text=JSON.stringify(doc.system?.rules??[]);
   assert.doesNotMatch(text,/@[\w.]+-/,`${pack}/${f}`);
  }
 }
});
test('Gnashing steps and Sonic Break scale at 14 and 20', async ()=>{
 const at=(v,L)=>v.brackets.find(x=>(x.start??0)<=L&&L<=(x.end??99)).value;
 for(const [f,base] of [['gunbreaker-class/gnashing-fang',1],['gunbreaker-class/savage-claw',1],['gunbreaker-class/wicked-talon',2],['gunbreaker-feats/sonic-break',1]]){
  const rule=(await src(f)).system.rules.find(r=>r.key==='DamageDice');
  assert.deepEqual([13,14,19,20].map(L=>at(rule.diceNumber,L)),[base,base+1,base+1,base+2],f);
 }
});
