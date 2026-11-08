import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resourceOptions,validateResourceOptions} from '../scripts/options.mjs';
import {areaCommit,areaFinish} from '../scripts/area.mjs';
import {initialState,transition} from '../scripts/state.mjs';
import {catalogue} from '../scripts/catalogue.mjs';
function fixture(slug){const c={time:1000,level:20,encounterId:'combat',round:1,turn:1,inTurn:true,wielding:true,targetIds:['target'],learned:[slug,'perfect-chamber','executioners-cadence','cartridge-expertise','fated-resolve']};return {c,s:{...transition(initialState(),{type:'start'},c,catalogue),cartridges:1,perfectUntil:1060}};}
test('invalid, mixed or inapplicable native resource choices fail before execution',()=>{
 for(const options of [{bogus:true},{perfect:'true'},{cadence:true,discipline:true}])assert.throws(()=>resourceOptions(options));
 const {c,s}=fixture('fated-circle');assert.throws(()=>validateResourceOptions({cadence:true},'fated-circle',c,s),/unavailable/);
});
test('Double Down discount is committed before saves, and Cadence only rewards an actual critical failure',()=>{
 for(const degree of [0,1,2,3]){
  const {c,s}=fixture('double-down'),opts={perfect:true,cadence:true};
  const committed=areaCommit(s,'double-down',c,'id',opts);assert.equal(committed.cartridges,0);assert.equal(committed.perfectRound,1);assert.equal(committed.once.fatedRound,1);
  const after=areaFinish(s,committed,'double-down',c,'id',[{target:'target',degree}],opts);assert.equal(after.cartridges,degree===0?1:0);assert.equal(after.lastCadenceRound,degree===0?1:null);
 }
});
test('Cartridge Expertise rewards a completed Demon Slaughter once, even when the enemy saves',()=>{
 const {c,s}=fixture('demon-slaughter');s.combo={next:'demon-slaughter',untilTurn:2};s.cartridges=0;
 const committed=areaCommit(s,'demon-slaughter',c,'id',{expertise:true});assert.equal(committed.cartridges,0);assert.equal(committed.once.expertise,undefined);
 const after=areaFinish(s,committed,'demon-slaughter',c,'id',[{target:'target',degree:3}],{expertise:true});assert.equal(after.cartridges,2);assert.equal(after.once.expertise,true);
});
