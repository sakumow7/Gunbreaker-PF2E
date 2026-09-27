import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState,transition,normalizeState,capacity} from '../scripts/state.mjs';
import {sources,makeCatalogue} from '../tools/sources.mjs';
const {catalogue}=makeCatalogue(await sources());
const ctx=(changes={})=>({time:1000,level:20,learned:Object.keys(catalogue),encounterId:'combat1',round:1,turn:1,inTurn:true,targetIds:['enemy1'],wielding:true,...changes});
const start=(c=ctx())=>transition(initialState(),{type:'start'},c,catalogue);
const use=(s,slug,op={},c=ctx())=>transition(s,{type:'use',slug,...op},c,catalogue);
test('level 1 starts with one cartridge and misses complete the basic loop',()=>{
 const c=ctx({level:1,learned:['keen-edge','brutal-shell','solid-barrel','burst-strike']});
 let s=start(c);assert.equal(s.cartridges,1);
 for(const slug of ['keen-edge','brutal-shell','solid-barrel'])s=use(s,slug,{outcome:'miss'},c);
 assert.equal(s.cartridges,2);assert.equal(s.combo,null);
});
test('a failed spend does not mutate or consume the opening',()=>{
 const s={...start(),cartridges:0,combo:{next:'solid-barrel',untilTurn:2}},copy=structuredClone(s);
 assert.throws(()=>use(s,'burst-strike',{outcome:'miss'}),/Not enough/);assert.deepEqual(s,copy);
});
test('combo survives other actions but expires after the next own turn',()=>{
 let s=use(start(),'keen-edge',{outcome:'miss'});
 s=transition(s,{type:'other'},ctx(),catalogue);
 assert.equal(normalizeState(s,ctx({turn:2})).combo.next,'brutal-shell');
 assert.equal(normalizeState(s,ctx({turn:2,inTurn:false})).combo,null);
 assert.throws(()=>use(s,'brutal-shell',{outcome:'hit'},ctx({turn:3})),/opening/);
});
test('opening another route replaces the existing route',()=>{
 let s=use(start(),'keen-edge',{outcome:'hit'});s=use(s,'demon-slice');
 assert.throws(()=>use(s,'brutal-shell',{outcome:'hit'}),/opening/);assert.equal(s.combo.next,'demon-slaughter');
});
test('Continuation is hit-confirmed, target-bound, next-action and once per round',()=>{
 let s=use(start(),'burst-strike',{outcome:'miss'});assert.equal(s.continuation,null);
 s=use(start(),'burst-strike',{outcome:'critical'});
 assert.throws(()=>use(s,'hypervelocity',{},ctx({targetIds:['enemy2']})),/original/);
 assert.throws(()=>use(transition(s,{type:'other'},ctx(),catalogue),'hypervelocity'),/opening/);
 s=use(s,'hypervelocity');s={...s,cartridges:1};s=use(s,'burst-strike',{outcome:'hit'});
 assert.throws(()=>use(s,'hypervelocity'),/once|one Continuation/);
});
test('Continuation unlock requires its class feature',()=>{
 const c=ctx({level:6,learned:['gnashing-fang','jugular-rip']});
 const s=use(start(c),'gnashing-fang',{outcome:'hit'},c);assert.equal(s.continuation,null);
 assert.throws(()=>use(s,'jugular-rip',{},c),/level|learned/);
});
test('Gnashing and Reign take separate turns and do not refill openings on a miss',()=>{
 let s=use(start(),'gnashing-fang',{outcome:'miss'});
 assert.throws(()=>use(s,'savage-claw',{outcome:'hit'}),/one Gnashing/);
 s=use(s,'savage-claw',{outcome:'miss'},ctx({round:2,turn:2,time:1006}));
 s=use(s,'wicked-talon',{outcome:'miss'},ctx({round:3,turn:3,time:1012}));assert.equal(s.combo,null);
 let r=use(start(),'bloodfest');r=use(r,'reign-of-beasts',{outcome:'hit'});
 assert.equal(r.reignUntil,0);assert.throws(()=>use(r,'noble-blood',{outcome:'hit'}),/one Reign/);
});
test('Bloodfest grows capacity before adding cartridges and expiry clamps it',()=>{
 let s={...start(),cartridges:5};s=use(s,'bloodfest');assert.equal(s.cartridges,8);
 assert.equal(capacity(s,ctx()),8);assert.equal(normalizeState(s,ctx({time:1060})).cartridges,5);
});
test('encounter initialization cannot farm resources or reset cooldowns',()=>{
 let s=use(start(),'bloodfest');assert.throws(()=>transition(s,{type:'start'},ctx(),catalogue),/already/);
 assert.throws(()=>transition(s,{type:'end'},ctx(),catalogue),/End Foundry/);
 s=transition(s,{type:'end'},ctx({encounterId:null}),catalogue);
 const c=ctx({encounterId:'combat2',time:1010});s=transition(s,{type:'start'},c,catalogue);
 assert.equal(s.cartridges,2);assert.throws(()=>use(s,'bloodfest',{},c),/no uses/);
});
test('daily reset is unavailable during combat',()=>{
 const s=start();assert.throws(()=>transition(s,{type:'daily'},ctx(),catalogue),/End combat/);
 assert.equal(transition(s,{type:'daily'},ctx({encounterId:null}),catalogue).encounter,null);
});
test('Aurora can be recorded during exploration without generating resources',()=>{
 const c=ctx({encounterId:null,inTurn:false,turn:0,round:0,learned:['aurora']});
 const s=use(initialState(),'aurora',{},c);
 assert.equal(s.cartridges,0);assert.equal(s.cooldowns.aurora.length,1);
 assert.throws(()=>use(s,'aurora',{},c),/no uses/);
 assert.throws(()=>transition(s,{type:'adjust',delta:1},c,catalogue),/Initialize/);
});
test('ending combat dissipates cartridges and encounter buffs while preserving cooldowns',()=>{
 const s=use(start(),'bloodfest');
 const expired=normalizeState(s,ctx({encounterId:null}));
 assert.equal(expired.cartridges,0);assert.equal(expired.bloodfestUntil,0);assert.equal(expired.reignUntil,0);
 assert.equal(expired.cooldowns.bloodfest.length,1);
});
test('an intervening reaction closes Continuation',()=>{
 let s=use(start(),'burst-strike',{outcome:'hit'});s=use(s,'heart-of-stone');
 assert.equal(s.continuation,null);
});
test('Fated Brand admits only failed-save targets and shares Continuation cap',()=>{
 const c=ctx({targetIds:['enemy1','enemy2']});
 let s=use(start(c),'fated-circle',{outcome:'failed',failedTargetIds:['enemy1']},c);
 assert.throws(()=>use(s,'fated-brand',{},ctx({targetIds:['enemy2']})),/original/);
 s=use(s,'fated-brand');assert.equal(s.lastFollowRound,1);
});
test('Heart of Stone pays only the optional cost; self protection requires Ward',()=>{
 const c=ctx({learned:['heart-of-stone']});let s=start(c);
 s=use(s,'heart-of-stone',{},c);assert.equal(s.cartridges,1);
 assert.throws(()=>use(s,'heart-of-stone',{self:true,enhance:true},c),/aetheric-ward/);
 s=use(s,'heart-of-stone',{enhance:true},c);assert.equal(s.cartridges,0);
 assert.throws(()=>use(s,'heart-of-stone',{enhance:true},c),/Not enough/);
});
test('finisher enhancements cannot stack and preserve failures atomically',()=>{
 let s=use(start(),'keen-edge',{outcome:'miss'});s=use(s,'brutal-shell',{outcome:'miss'});
 assert.throws(()=>use(s,'solid-barrel',{outcome:'miss',expertise:true,twin:true}),/cannot combine/);
 s=use(s,'solid-barrel',{outcome:'miss',expertise:true});assert.equal(s.cartridges,4);assert.equal(s.once.expertise,true);
});
test('Perfect Chamber discounts only one spender per round',()=>{
 let s=use(start(),'perfect-chamber');s=use(s,'burst-strike',{outcome:'miss',perfect:true});assert.equal(s.cartridges,2);
 assert.throws(()=>use(s,'burst-strike',{outcome:'miss',perfect:true}),/cannot reduce/);
 s=use(s,'burst-strike',{outcome:'miss',perfect:true},ctx({round:2,turn:2,time:1006}));assert.equal(s.cartridges,2);
});
test('upgrades do not grant duplicate active uses and Aurora keeps two charges',()=>{
 assert.throws(()=>use(start(),'great-nebula'),/original action/);
 let s=use(start(),'aurora');s=use(s,'aurora');assert.throws(()=>use(s,'aurora'),/no uses/);
});
test('action ownership, prerequisites, level, wielding and outcome are checked',()=>{
 assert.throws(()=>use(start(),'burst-strike',{},ctx()),/outcome/);
 assert.throws(()=>use(start(),'burst-strike',{outcome:'hit'},ctx({wielding:false})),/wield/);
 assert.throws(()=>use(start(),'double-down',{},ctx({level:1})),/above/);
 assert.throws(()=>use(start(),'no-mercy',{},ctx({learned:[]})),/learned/);
 assert.throws(()=>use(start(),'sonic-break',{outcome:'hit'},ctx({learned:['sonic-break']})),/no-mercy/);
});
