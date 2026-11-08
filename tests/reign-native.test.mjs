import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReignRunner,reignAttackEvidence} from '../scripts/reign-native.mjs';
import {createNativeRunner} from '../scripts/native.mjs';
import {sourceIds} from '../scripts/catalogue.mjs';
import {ActorQueue} from '../scripts/queue.mjs';
import {validateIntent} from '../scripts/requests.mjs';
import {setup} from './helpers/native-save-harness.mjs';
function reign({slug='reign-of-beasts',degree=2,...options}={}){
 const h=setup({slug,level:18,learned:['bloodfest','reign-of-beasts'],degrees:[1,1,0],...options});
 h.actor.deleteEmbeddedDocuments=async()=>{};
 h.flags.tracker.reignUntil=1060;h.flags.tracker.calibration='cold';h.req.targetIds=[h.targets[0].document.uuid];h.req.map=1;
 h.secondarySelection=h.targets.slice(1).map(t=>t.document.uuid);h.attackCalls=[];h.primaryCalls=[];
 h.deps.strikeFor=()=>({variants:[0,1,2].map(map=>({roll:async args=>{
  h.attackCalls.push({map,...args});if(h.cancelAttack)return null;
  const roll={degreeOfSuccess:degree,toJSON:()=>({degree,total:31})};
  h.attackMessage=await ChatMessage.create({isCheckRoll:true,actor:h.actor,item:{id:'blade'},rolls:[roll],flags:{pf2e:{context:{type:'attack-roll',action:'strike',target:{token:h.req.targetIds[0]}}}}});
  args.callback(roll,null,h.attackMessage);return roll;
 }})),...Object.fromEntries(['damage','critical'].map(kind=>[kind,async args=>{
  h.primaryCalls.push({kind,...args});if(h.cancelPrimary)return null;
  const roll=await new h.DamageRoll('native weapon damage').evaluate();roll.options.degreeOfSuccess=degree;
  const data={isDamageRoll:true,actor:h.actor,item:{id:'blade'},rolls:[roll],flags:{pf2e:{context:{sourceType:'attack',target:{token:h.req.targetIds[0]}}}}};
  if(!h.omitPrimaryCard)await ChatMessage.create(data);
  if(h.duplicatePrimaryCard)await ChatMessage.create(data);
  return roll;
 }]))});
 h.runner=createReignRunner(h.deps,new ActorQueue());return h;
}
test('native Reign uses chosen MAP and Strike bonus option then independently saves uncalibrated fire secondaries',async()=>{
 const h=reign({degree:3});await h.runner.execute(h.actor,h.req);
 assert.equal(h.attackCalls[0].map,1);assert(h.attackCalls[0].options.includes('gunbreaker:action:reign-of-beasts'));
 assert.equal(h.primaryCalls[0].kind,'critical');assert.equal(h.primaryCalls[0].mapIncreases,1);
 assert.deepEqual(h.rolls,['native weapon damage','2d6[fire]']);assert.deepEqual(h.applied.map(a=>a.total),[21,42]);
 assert.equal(h.flags.tracker.combo.next,'noble-blood');assert.equal(h.flags.tracker.reignUntil,0);assert.equal(h.flags.tracker.continuation,null);
 assert(h.saveArgs.every(a=>a.dc.slug==='gunbreaker'&&!a.extraRollOptions.includes('area-damage')));
});
test('native Reign eligibility excludes primary, allies, unreachable and nonadjacent enemies',async()=>{
 const h=reign({degrees:[1,1,1,1,1]});h.targets[2].distance=10;h.targets[3].adjacentDistance=10;h.targets[4].actor.uuid='Actor.ally';h.secondarySelection=[h.targets[1].document.uuid];
 await h.runner.execute(h.actor,h.req);assert.equal(h.saveArgs.length,1);assert.equal(h.applied[0].target,h.targets[1].document.uuid);
 const prompt=h.dialogs.find(d=>d.window.title==='Reign secondary enemies');assert(prompt.content.includes('enemy1'));assert(!prompt.content.includes('enemy2'));assert(!prompt.content.includes('enemy3'));assert(!prompt.content.includes('enemy4'));
});
test('native Reign cancel and miss create no primary damage or secondary save',async()=>{
 for(const cancel of [false,true]){
  const h=reign({degree:1});h.cancelAttack=cancel;const before=structuredClone(h.flags.tracker);
  await h.runner.execute(h.actor,h.req);assert.equal(h.primaryCalls.length,0);assert.equal(h.saveArgs.length,0);
  if(cancel)assert.deepEqual(h.flags.tracker,before);else assert.equal(h.flags.tracker.combo.next,'noble-blood');
 }
});
test('rerolling the primary before secondary resolution blocks further rolls and preserves recovery evidence',async()=>{
 const h=reign();h.onSecondary=()=>{h.attackMessage.isReroll=true;};
 await assert.rejects(()=>h.runner.execute(h.actor,h.req),/rerolled/);assert.equal(h.saveArgs.length,0);assert.equal(h.flags.execution.status,'recovery');assert.equal(h.flags.tracker.reignUntil,0);
});
test('primary evidence and requests reject a different target, forged result or standalone secondary selection',()=>{
 const m={id:'attack',isCheckRoll:true,actor:{uuid:'Actor.hero'},item:{id:'blade'},rolls:[{degreeOfSuccess:2,toJSON:()=>({total:30})}],flags:{pf2e:{context:{type:'attack-roll',action:'strike',target:{token:'Scene.scene.Token.primary'}}}}};
 assert.equal(reignAttackEvidence(m,'Actor.hero','blade','Scene.scene.Token.primary').degree,2);assert.throws(()=>reignAttackEvidence(m,'Actor.hero','blade','other'));
 const r={version:1,id:'click',actorUuid:'Actor.hero',sceneId:'scene',gmId:'gm',slug:'reign-of-beasts',weaponId:'blade',map:2,targetIds:['Scene.scene.Token.primary'],revision:0,encounterId:'combat',round:1,turn:1};
 assert.equal(validateIntent(r).map,2);assert.throws(()=>validateIntent({...r,secondaryTargets:[]}));assert.throws(()=>validateIntent({...r,targetIds:[]}));assert.throws(()=>validateIntent({...r,degree:3}));
 assert.equal(validateIntent({...r,slug:'bloodfest'}).slug,'bloodfest');
});

test('Bloodfest native entry validates its enemy, spends frequency and creates reminder effects once',async()=>{
 const h=setup({slug:'bloodfest',level:10,degrees:[1],distances:[30]});
 const weapon={id:'blade',type:'weapon',system:{traits:{value:['gunbreaker']},equipped:{carryType:'held',handsHeld:1},damage:{dice:2}}};
 h.actor.type='character';h.actor.isOwner=true;h.actor.itemTypes={weapon:[weapon],effect:[]};h.actor.getActiveTokens=()=>[h.self];h.c.targetIds=[h.targets[0].document.uuid];h.req.targetIds=[...h.c.targetIds];
 game.time={worldTime:1000};const created=[];h.actor.createEmbeddedDocuments=async(_type,data)=>{created.push(...data);};
 const original=globalThis.fromUuid;globalThis.fromUuid=async uuid=>uuid.startsWith('Compendium.')?{toObject:()=>({type:'effect',system:{slug:sourceIds[uuid]}})}:original(uuid);
 const runner=createNativeRunner(h.deps.contextFor,new ActorQueue());await runner.execute(h.actor,h.req);
 assert.equal(h.flags.tracker.cartridges,6);assert.equal(h.flags.tracker.reignUntil,1060);assert.deepEqual(created.map(i=>i.system.slug),['bloodfest','ready-to-reign']);
 assert.deepEqual(h.flags.tracker.cooldowns.bloodfest,[1000]);await assert.rejects(()=>runner.execute(h.actor,{...h.req,id:'again'}),/frequency/);assert.equal(created.length,2);
 h.flags.tracker.cooldowns.bloodfest=[];h.targets[0].distance=31;
 await assert.rejects(()=>runner.execute(h.actor,{...h.req,id:'far'}),/within 30 feet/);assert.equal(created.length,2);
});
test('starting Reign removes only its module-managed readiness reminder, including on a miss',async()=>{
 const h=reign({degree:1});const deleted=[];
 h.actor.items.push({id:'owned',type:'effect',slug:'ready-to-reign',flags:{'gunbreaker-pf2e':{execution:'bloodfest'}}},{id:'custom',type:'effect',slug:'ready-to-reign'});
 h.actor.deleteEmbeddedDocuments=async(_type,ids)=>deleted.push(...ids);
 await h.runner.execute(h.actor,h.req);assert.deepEqual(deleted,['owned']);assert.equal(h.flags.tracker.reignUntil,0);
});
test('too many secondary choices prompt again without repeating the primary Strike',async()=>{
 const h=reign({degrees:[1,1,1,1]});let choices=0;
 h.onSecondary=()=>{choices++;h.secondarySelection=choices===1?h.targets.slice(1).map(t=>t.document.uuid):[h.targets[1].document.uuid];};
 await h.runner.execute(h.actor,h.req);assert.equal(choices,2);assert.equal(h.attackCalls.length,1);assert.equal(h.saveArgs.length,1);
});

test('Noble Blood and Lion Heart use their own native Strike options and fixed secondary dice',async()=>{
 for(const [slug,dice] of [['noble-blood',3],['lion-heart',4]]){
  const h=reign({slug});h.flags.tracker.combo={next:slug,untilTurn:2};
  await h.runner.execute(h.actor,h.req);
  assert(h.attackCalls[0].options.includes(`gunbreaker:action:${slug}`));assert.deepEqual(h.rolls,['native weapon damage',`${dice}d6[fire]`]);
  assert.equal(h.flags.tracker.combo?.next??null,slug==='noble-blood'?'lion-heart':null);
 }
});

test('native damage returns a roll; missing or ambiguous new cards stop secondary HP writes',async()=>{
 for(const mode of ['omitPrimaryCard','duplicatePrimaryCard']){
  const h=reign();h[mode]=true;
  await assert.rejects(()=>h.runner.execute(h.actor,h.req),/unavailable or ambiguous/);
  assert.equal(h.flags.execution.status,'recovery');assert.equal(h.saveArgs.length,0);assert.equal(h.applied.length,0);
 }
});
