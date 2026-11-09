import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativePanel,authority} from '../scripts/native.mjs';
test('native authority rejects multiple GMs, lost ownership and wrong scene',()=>{
 const users=[{id:'gm',active:true,isGM:true},{id:'player',active:true,isGM:false}];users.get=id=>users.find(u=>u.id===id);
 globalThis.game={user:users[0],users,settings:{get:()=>true}};globalThis.canvas={scene:{id:'scene'}};
 const actor={type:'character',isOwner:true,testUserPermission:()=>true},req={requesterId:'player',intent:{gmId:'gm',sceneId:'scene'}};
 assert.doesNotThrow(()=>authority(actor,req));
 users.push({id:'other',active:true,isGM:true});assert.throws(()=>authority(actor,req),/exactly one/);users.pop();
 actor.testUserPermission=()=>false;assert.throws(()=>authority(actor,req),/permission changed/);actor.testUserPermission=()=>true;
 canvas.scene.id='other';assert.throws(()=>authority(actor,req),/same scene/);
});
