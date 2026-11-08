import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativePanel,authority} from '../scripts/native.mjs';
test('native panel snapshots revision before awaiting user input',async()=>{
 const state={revision:2,cartridges:1};let request;
 globalThis.game={user:{isGM:true},settings:{get:()=>false}};
 globalThis.foundry={utils:{escapeHTML:s=>s},applications:{api:{DialogV2:{wait:async()=>{state.revision=3;return {id:'click',slug:'keen-edge',weaponId:'blade',map:0};}}}}};
 globalThis.ui={notifications:{error:message=>assert.fail(message)}};
 const actor={isOwner:true,type:'character',getFlag:()=>state,itemTypes:{weapon:[]}};
 await nativePanel(actor,{execute:async(_a,r)=>{request=r;}},()=>({level:1,learned:['keen-edge'],encounterId:'combat',round:1,turn:1,targetIds:['Scene.scene.Token.enemy']}));
 assert.equal(request.expected.revision,2);assert.deepEqual(request.targetIds,['Scene.scene.Token.enemy']);
});
test('native authority rejects multiple GMs, lost ownership and wrong scene',()=>{
 const users=[{id:'gm',active:true,isGM:true},{id:'player',active:true,isGM:false}];users.get=id=>users.find(u=>u.id===id);
 globalThis.game={user:users[0],users,settings:{get:()=>true}};globalThis.canvas={scene:{id:'scene'}};
 const actor={type:'character',isOwner:true,testUserPermission:()=>true},req={requesterId:'player',intent:{gmId:'gm',sceneId:'scene'}};
 assert.doesNotThrow(()=>authority(actor,req));
 users.push({id:'other',active:true,isGM:true});assert.throws(()=>authority(actor,req),/exactly one/);users.pop();
 actor.testUserPermission=()=>false;assert.throws(()=>authority(actor,req),/permission changed/);actor.testUserPermission=()=>true;
 canvas.scene.id='other';assert.throws(()=>authority(actor,req),/same scene/);
});
