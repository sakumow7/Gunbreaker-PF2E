import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNativeRunner} from '../scripts/native.mjs';
import {outsideActivityRequest} from '../scripts/outside-controls.mjs';
import {validateIntent,RequestRouter} from '../scripts/requests.mjs';
import {ActorQueue} from '../scripts/queue.mjs';
import {initialState} from '../scripts/state.mjs';
function fixture(){
 const c={time:1000,encounterId:'combat',round:2,turn:2,inTurn:true,level:17,learned:['continuation'],wielding:false};
 const flags={tracker:{...initialState(),encounter:'combat',revision:4,cartridges:2,combo:{next:'wicked-talon',untilTurn:3},continuation:{slug:'jugular-rip',turn:2,targets:['Scene.scene.Token.enemy'],weaponDice:2,weaponId:'blade'},cooldowns:{aurora:[900]},dailyUses:{superbolide:1}},execution:{id:'previous',status:'complete'}};
 let writes=0;
 const actor={uuid:'Actor.hero',type:'character',isOwner:true,items:[{type:'class',slug:'gunbreaker'}],testUserPermission:()=>true,getActiveTokens:()=>[{document:{parent:{id:'scene'}}}],getFlag:(_m,k)=>flags[k],setFlag:async(_m,k,v)=>{writes++;flags[k]=structuredClone(v);}};
 const users=[{id:'gm',active:true,isGM:true},{id:'player',active:true,isGM:false,viewedScene:'scene'}];users.get=id=>users.find(u=>u.id===id);
 globalThis.game={user:users[0],users,settings:{get:()=>true},combat:{turns:[{actor}]}};globalThis.canvas={scene:{id:'scene'}};
 const queue=new ActorQueue(),runner=createNativeRunner(()=>c,queue);
 const request=(reaction=false)=>outsideActivityRequest(reaction?'record-other-reaction':'record-other-action','record',{revision:4,encounterId:'combat',round:2,turn:2});
 return {actor,flags,c,queue,runner,users,request,get writes(){return writes;}};
}
test('recording an outside action closes only Continuation in one write, with no weapon or roll dependency',async()=>{
 const h=fixture(),old=structuredClone(h.flags);const result=await h.runner.execute(h.actor,h.request());
 assert.equal(result.status,'complete');assert.equal(h.writes,1);assert.equal(h.flags.tracker.continuation,null);
 assert.deepEqual(h.flags.tracker.combo,old.tracker.combo);assert.equal(h.flags.tracker.cartridges,2);assert.deepEqual(h.flags.tracker.cooldowns,old.tracker.cooldowns);assert.deepEqual(h.flags.tracker.dailyUses,old.tracker.dailyUses);
 assert.deepEqual(h.flags.execution,old.execution);assert.equal(h.flags.tracker.lastReactionTurn,null);assert.equal(h.flags.tracker.revision,5);
 assert(h.flags.tracker.events.includes('record'));assert.equal(h.flags.tracker.lastOutsideActivity.slug,'record-other-action');
});
test('regular reaction preserves own-turn Continuation, spends regular pool and cannot consume extra pool',async()=>{
 const h=fixture(),opening=structuredClone(h.flags.tracker.continuation);await h.runner.execute(h.actor,h.request(true));
 assert.deepEqual(h.flags.tracker.continuation,opening);assert.equal(h.flags.tracker.lastReactionTurn,2);assert.equal(h.flags.tracker.lastInstinctTurn,null);
 const req={...h.request(true),id:'second',expected:{...h.request().expected,revision:5}};
 await assert.rejects(h.runner.execute(h.actor,req),/already spent/);assert.equal(h.writes,1);
});
test('regular reaction can be recorded off turn; another action cannot',async()=>{
 const h=fixture();h.c.inTurn=false;
 await assert.rejects(h.runner.execute(h.actor,h.request()),/own turn/);await h.runner.execute(h.actor,h.request(true));
 assert.equal(h.flags.tracker.lastReactionTurn,2);assert.equal(h.flags.tracker.continuation,null);
});
test('duplicate delivery cannot consume a later opening or reaction, even after turn changes',async()=>{
 const h=fixture();await h.runner.execute(h.actor,h.request());h.c.turn=3;h.c.round=3;
 h.flags.tracker.continuation={slug:'eye-gouge',turn:3};h.flags.tracker.revision++;
 const result=await h.runner.execute(h.actor,h.request());assert.equal(result.duplicate,true);assert.equal(h.writes,1);assert.equal(h.flags.tracker.continuation.slug,'eye-gouge');
});
test('lost acknowledgement after an atomic write can be inspected and retried with the same ID without replay',async()=>{
 const h=fixture(),save=h.actor.setFlag;h.actor.setFlag=async(...args)=>{await save(...args);throw Error('uncertain acknowledgement');};
 await assert.rejects(h.runner.execute(h.actor,h.request()),/uncertain/);assert.equal(h.flags.tracker.lastOutsideActivity.id,'record');
 assert.equal((await h.runner.execute(h.actor,h.request())).duplicate,true);assert.equal(h.writes,1);
});
for(const [name,change] of Object.entries({
 revision:h=>h.flags.tracker.revision++,turn:h=>h.c.turn++,round:h=>h.c.round++,encounter:h=>h.c.encounterId='next',
 uninitialized:h=>h.flags.tracker.encounter=null,offscene:()=>canvas.scene.id='other',shared:h=>game.combat.turns.push({actor:h.actor}),
 ownership:h=>h.actor.isOwner=false,multigm:h=>h.users.push({id:'other',active:true,isGM:true}),class:h=>h.actor.items=[],
 execution:h=>h.flags.execution.status='recovery',rider:h=>h.flags.followup={status:'prompting'},retired:h=>h.c.learned.push('twin-cartridge')
}))test(`outside activity rejects ${name} changes without writes`,async()=>{
 const h=fixture();change(h);await assert.rejects(h.runner.execute(h.actor,h.request()));assert.equal(h.writes,0);
});
test('queued recording rechecks state and copies the request before waiting',async()=>{
 const h=fixture();let release;const blocker=h.queue.run(h.actor,()=>new Promise(r=>release=r));
 await new Promise(r=>setImmediate(r));const req=h.request(),pending=h.runner.execute(h.actor,req);req.slug='record-other-reaction';
 h.flags.tracker.revision++;release();await blocker;await assert.rejects(pending,/Tracker changed/);assert.equal(h.writes,0);
});
test('concurrent new IDs use one checkpoint; only one activity can commit',async()=>{
 const h=fixture();const results=await Promise.allSettled([h.runner.execute(h.actor,h.request()),h.runner.execute(h.actor,{...h.request(true),id:'second'})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(h.writes,1);assert.equal(h.flags.tracker.lastReactionTurn,null);
});
test('outside intents use a bounded target-free schema and reject payloads for other actions',()=>{
 const h=fixture(),req=h.request();const raw={version:1,id:req.id,actorUuid:h.actor.uuid,sceneId:'scene',gmId:'gm',slug:req.slug,weaponId:req.weaponId,map:0,targetIds:[],options:{},...req.expected};
 assert.equal(validateIntent(raw).slug,req.slug);
 for(const patch of [{weaponId:'blade'},{map:1},{targetIds:['Scene.scene.Token.enemy']},{options:{instinct:true}},{options:{reserve:true}},{options:{perfect:true}},{outcome:'critical'}])assert.throws(()=>validateIntent({...raw,...patch}));
});
test('actual player router dispatches outside records without a weapon, with current scene and permission checks',async()=>{
 const h=fixture(),req=h.request(true);const intent={version:1,id:req.id,actorUuid:h.actor.uuid,sceneId:'scene',gmId:'gm',slug:req.slug,weaponId:req.weaponId,map:0,targetIds:[],...req.expected};
 const router=new RequestRouter({enabled:()=>true,localId:()=> 'gm',coordinatorId:()=> 'gm',user:id=>h.users.get(id),actor:async()=>h.actor,owns:(a,u)=>a.testUserPermission(u,'OWNER'),execute:(a,r)=>h.runner.execute(a,r)});
 h.users[1].viewedScene='other';await assert.rejects(router.receive(intent,'player'),/same scene/);assert.equal(h.writes,0);
 h.users[1].viewedScene='scene';await router.receive(intent,'player');assert.equal(h.flags.tracker.lastOutsideActivity.id,'player:record');assert.equal(h.writes,1);
});
