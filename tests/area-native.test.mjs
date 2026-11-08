import {test} from 'node:test';
import assert from 'node:assert/strict';
import {areaSaveEvidence,scaledAreaDamage} from '../scripts/area-native.mjs';
import {validateIntent} from '../scripts/requests.mjs';
test('area evidence requires the correct native saving throw and rejects rerolls',()=>{
 const m={id:'save',isCheckRoll:true,actor:{uuid:'Actor.enemy'},flags:{pf2e:{context:{type:'saving-throw'}}},rolls:[{degreeOfSuccess:1,toJSON:()=>({degree:1,total:20})}]};
 assert.equal(areaSaveEvidence(m,'Actor.enemy').degree,1);assert.throws(()=>areaSaveEvidence(m,'Actor.other'));
 m.isReroll=true;assert.throws(()=>areaSaveEvidence(m));m.isReroll=false;m.flags.pf2e.context.type='attack-roll';assert.throws(()=>areaSaveEvidence(m));
});
test('scaled area damage delegates scaling to native Roll and never marks a critical attack',()=>{
 let args;
 class MockDamageRoll{static fromJSON(text){return new this(JSON.parse(text));}constructor(data){this.options=data.options??{};}alter(...a){args=a;return this;}}
 const data={options:{degreeOfSuccess:3}};
 const roll=scaledAreaDamage(MockDamageRoll,data,2);assert.deepEqual(args,[2,0]);assert.equal(roll.options.degreeOfSuccess,null);assert.equal(data.options.degreeOfSuccess,3);
 assert.throws(()=>scaledAreaDamage(MockDamageRoll,data,3));
});
test('player area requests have no client-supplied targets, rolls or damage',()=>{
 const raw={version:1,id:'click',actorUuid:'Actor.hero',sceneId:'scene',gmId:'gm',slug:'fated-circle',weaponId:'blade',map:0,targetIds:[],revision:0,encounterId:'combat',round:1,turn:1};
 assert.equal(validateIntent(raw).slug,'fated-circle');assert.throws(()=>validateIntent({...raw,targetIds:['Scene.scene.Token.enemy']}));assert.throws(()=>validateIntent({...raw,damage:100}));
});

test('targeted save intents preserve one selected enemy and reject standalone upgrades or MAP',()=>{
 const raw={version:1,id:'click',actorUuid:'Actor.hero',sceneId:'scene',gmId:'gm',slug:'danger-zone',weaponId:'blade',map:0,targetIds:['Scene.scene.Token.enemy'],revision:0,encounterId:'combat',round:1,turn:1};
 assert.deepEqual(validateIntent(raw).targetIds,raw.targetIds);
 assert.throws(()=>validateIntent({...raw,targetIds:[]}));assert.throws(()=>validateIntent({...raw,map:1}));assert.throws(()=>validateIntent({...raw,slug:'blasting-zone'}));
 for(const slug of ['double-down','bow-shock']){assert.throws(()=>validateIntent({...raw,slug}));assert.equal(validateIntent({...raw,slug,targetIds:[]}).slug,slug);}
});
