import {test} from 'node:test';
import assert from 'node:assert/strict';
import {supportEffect,damageReceipt} from '../scripts/support.mjs';
import {createSupportRunner,createSupportLifecycle} from '../scripts/support-native.mjs';
import {ActorQueue} from '../scripts/queue.mjs';
import {setup} from './helpers/native-save-harness.mjs';
const MOD='gunbreaker-pf2e';
function fixture(slug='aurora',options={}){
 const h=setup({slug,level:18,degrees:[1],killOnApply:false,learned:options.learned??[]});
 const ally=h.targets[0].actor;ally.uuid='Actor.ally';ally.items=[];ally.flags={};ally.combatant={id:'ally-turn'};ally.modeOfBeing='living';ally.hitPoints={value:40,max:100};ally.isOwner=true;ally.rules=[];
 h.actor.combatant={id:'hero-turn',initiative:20};h.actor.isAllyOf=a=>a.uuid===ally.uuid;
 game.combat={id:'combat',started:true,round:1,turn:0,turns:[{id:'hero-turn',actor:h.actor},{id:'ally-turn',actor:ally}]};game.time={worldTime:1000};game.users.get=id=>game.users.find(u=>u.id===id);game.actors=[h.actor,ally];
 h.req.targetIds=[h.targets[0].document.uuid];h.c.targetIds=h.req.targetIds;
 foundry.applications.api.DialogV2.confirm=async()=>!h.cancel;
 let ids=0;h.heals=[];
 for(const actor of [h.actor,ally]){
  actor.items.get=id=>actor.items.find(i=>i.id===id);actor.testUserPermission=()=>true;
  if(actor===ally){actor.getFlag=(_m,key)=>actor.flags[key];actor.setFlag=async(_m,key,value)=>{actor.flags[key]=structuredClone(value);};}
  actor.createEmbeddedDocuments=async(_type,items)=>{for(const item of items){const effect={...structuredClone(item),id:`effect${++ids}`,remainingDuration:{expired:false},setFlag:async(_m,key,value)=>{effect.flags[MOD][key]=structuredClone(value);}};actor.items.push(effect);}return actor.items;};
  actor.updateEmbeddedDocuments=async(_type,updates)=>{for(const u of updates){const effect=actor.items.get(u._id);if(u[`flags.${MOD}.support`])effect.flags[MOD].support=structuredClone(u[`flags.${MOD}.support`]);}};
  actor.deleteEmbeddedDocuments=async(_type,ids)=>{for(let i=actor.items.length-1;i>=0;i--)if(ids.includes(actor.items[i].id))actor.items.splice(i,1);};
 }
 ally.getActiveTokens=()=>[h.targets[0]];
 ally.applyDamage=async({damage})=>{if(h.failHeal)throw Error('HP uncertain');h.heals.push(-damage);ally.hitPoints.value=Math.min(100,ally.hitPoints.value-damage);};
 const original=globalThis.fromUuid;globalThis.fromUuid=async uuid=>uuid===ally.uuid?ally:original(uuid);
 globalThis.Roll=class{constructor(formula){this.formula=formula;this.total=27;}async evaluate(){return this;}async toMessage(){return {id:'healing-roll'};}};
 h.queue=new ActorQueue();h.runner=createSupportRunner(h.deps,h.queue);h.lifecycle=createSupportLifecycle(h.queue);h.ally=ally;
 h.turn=(round)=>({id:`combat:${round}:ally-turn`,encounterId:'combat',round,combatantId:'ally-turn'});
 h.receipt=(id='damage')=>({id,author:{id:'gm'},flags:{pf2e:{context:{type:'damage-taken'},appliedDamage:{uuid:ally.uuid,isHealing:false,updates:[{path:'system.attributes.hp.value',value:10}]}}}});
 return h;
}
test('support rule data uses source level/initiative and spell-only custom resistance',()=>{
 const source={uuid:'Actor.source',combatant:{id:'turn',initiative:22}},c={time:1000,level:19,round:1,encounterId:'combat',sourceToken:'token',combatTurn:0,recipientIndex:1};
 const light=supportEffect('heart-of-light',source,c,{},'event');assert.equal(light.system.start.initiative,22);assert.equal(light.system.duration.value,2);
 assert.deepEqual(light.system.rules[1].definition,['damage',{or:['item:type:spell','item:from-spell']}]);assert.equal(light.system.rules[1].value,9);
 assert.equal(supportEffect('gunmetal-soul',source,c,{},'event').system.rules[0].value,19);
});
test('Aurora applies once, spends source frequency and enforces source-specific immunity',async()=>{
 const h=fixture('aurora',{learned:['auroral-mastery']});await h.runner.execute(h.actor,h.req);await h.runner.execute(h.actor,h.req);
 assert.equal(h.ally.items.length,1);assert.deepEqual(h.flags.tracker.cooldowns.aurora,[1000]);assert.equal(h.ally.flags.auroraImmunity[0].until,1600);
 await assert.rejects(()=>h.runner.execute(h.actor,{...h.req,id:'second'}),/immune/);assert.equal(h.ally.items.length,1);
});
test('Aurora heals at the recipient next three starts, not source starts, and duplicate delivery does not heal twice',async()=>{
 const h=fixture();await h.runner.execute(h.actor,h.req);
 await h.lifecycle.tick(h.ally,{id:'source',encounterId:'combat',round:1,combatantId:'hero-turn'});assert.equal(h.heals.length,0);
 for(let round=1;round<=3;round++){await h.lifecycle.tick(h.ally,h.turn(round));await h.lifecycle.tick(h.ally,h.turn(round));}
 assert.deepEqual(h.heals,[9,9,9]);assert.equal(h.ally.items.length,0);assert.equal(h.ally.hitPoints.value,67);
});
test('multiple Auroras use the highest value once and advance both durations',async()=>{
 const h=fixture();await h.runner.execute(h.actor,h.req);const extra=structuredClone({...h.ally.items[0],setFlag:undefined});delete extra.id;delete extra.setFlag;
 extra.flags[MOD].support.value=12;extra.flags[MOD].support.source='Actor.other';await h.ally.createEmbeddedDocuments('Item',[extra]);
 await h.lifecycle.tick(h.ally,h.turn(1));assert.deepEqual(h.heals,[12]);assert(h.ally.items.every(e=>e.flags[MOD].support.ticks===1));
});
test('Aurora healing failure is claimed before HP and never retried',async()=>{
 const h=fixture();await h.runner.execute(h.actor,h.req);h.failHeal=true;
 await assert.rejects(()=>h.lifecycle.tick(h.ally,h.turn(1)),/HP uncertain/);assert.equal(h.ally.items[0].flags[MOD].support.status,'recovery');
 h.failHeal=false;await h.lifecycle.tick(h.ally,h.turn(1));assert.equal(h.heals.length,0);
});
test('Aurora rejects undead, missing recipient combatants, missed turns and conflicting fast healing',async()=>{
 for(const mode of ['undead','no-combatant']){const h=fixture();if(mode==='undead')h.ally.modeOfBeing='undead';else game.combat.turns.pop();await assert.rejects(()=>h.runner.execute(h.actor,h.req));assert.equal(h.ally.items.length,0);}
 const h=fixture();await h.runner.execute(h.actor,h.req);await assert.rejects(()=>h.lifecycle.tick(h.ally,h.turn(2)),/missed/);
 const other=fixture();await other.runner.execute(other.actor,other.req);other.ally.rules=[{key:'FastHealing',ignored:false}];await assert.rejects(()=>other.lifecycle.tick(other.ally,other.turn(1)),/fast-healing/);assert.equal(other.heals.length,0);
});
test('native damage receipts exclude HP edits, healing, undo, shield-only and non-HP updates',()=>{
 const h=fixture(),m=h.receipt();assert.equal(damageReceipt(m).lost,10);
 assert.equal(damageReceipt({id:'edit',flags:{}}),null);
 for(const changed of [{isHealing:true},{isReverted:true},{updates:[{path:'system.attributes.hp.temp',value:-10}]},{updates:[{path:'shield',value:10}]}])assert.equal(damageReceipt({...m,flags:{pf2e:{...m.flags.pf2e,appliedDamage:{...m.flags.pf2e.appliedDamage,...changed}}}}),null);
});
test('Corundum heals once after actual damage below half HP, including a previously wounded target',async()=>{
 const h=fixture('heart-of-corundum');await h.runner.execute(h.actor,h.req);
 await h.lifecycle.damage(h.receipt(), 'gm');assert.deepEqual(h.heals,[27]);assert.equal(h.ally.items[0].flags[MOD].support.healing,'complete');
 h.ally.hitPoints.value=30;await h.lifecycle.damage(h.receipt('later'),'gm');assert.equal(h.heals.length,1);
});
test('Corundum does not heal dead, expired or above-half recipients, and stops after uncertain healing',async()=>{
 for(const mode of ['dead','expired','healthy','uncertain']){
  const h=fixture('heart-of-corundum');await h.runner.execute(h.actor,h.req);
  if(mode==='dead')h.ally.isDead=true;if(mode==='expired')h.ally.items[0].remainingDuration.expired=true;if(mode==='healthy')h.ally.hitPoints.value=60;
  if(mode==='uncertain'){h.failHeal=true;await assert.rejects(()=>h.lifecycle.damage(h.receipt(),'gm'));h.failHeal=false;}else await h.lifecycle.damage(h.receipt(),'gm');
  await h.lifecycle.damage(h.receipt(),'gm');assert.equal(h.heals.length,0);
 }
});
test('party protections apply to self and current allies without retaining a moving aura',async()=>{
 const h=fixture('gunmetal-soul');h.c.level=20;h.req.targetIds=[];h.targets[0].distance=25;await h.runner.execute(h.actor,h.req);
 assert(h.actor.items.some(i=>i.type==='effect'));assert.equal(h.ally.items.length,1);assert.equal(h.ally.items[0].system.duration.value,1);
 assert.equal(h.ally.items[0].system.context.origin.actor,h.actor.uuid);h.targets[0].distance=100;assert.equal(h.ally.items[0].system.rules[0].value,20);
});
test('support confirmation cancellation and position changes spend no frequency',async()=>{
 const h=fixture();h.cancel=true;await h.runner.execute(h.actor,h.req);assert.equal(h.flags.tracker.cooldowns.aurora,undefined);
 foundry.applications.api.DialogV2.confirm=async()=>{h.targets[0].document.x=100;return true;};await assert.rejects(()=>h.runner.execute(h.actor,h.req),/moved/);assert.equal(h.flags.tracker.cooldowns.aurora,undefined);
});

test('support revalidates allegiance and life after confirmation without spending',async()=>{
 for(const change of [h=>h.actor.isAllyOf=()=>false,h=>h.ally.isDead=true,h=>h.ally.modeOfBeing='undead']){
  const h=fixture();foundry.applications.api.DialogV2.confirm=async()=>{change(h);return true;};
  await assert.rejects(()=>h.runner.execute(h.actor,h.req),/eligibility/);assert.equal(h.ally.items.length,0);assert.equal(h.flags.tracker.cooldowns.aurora,undefined);
 }
});
test('Aurora converts remaining ticks after combat and stops uncertain reconnect healing',async()=>{
 const h=fixture();await h.runner.execute(h.actor,h.req);await h.lifecycle.tick(h.ally,h.turn(1));
 game.combat.started=false;await h.lifecycle.reconcile(h.ally);assert.equal(h.ally.items[0].flags[MOD].support.nextTime,1006);
 for(const time of [1006,1012]){game.time.worldTime=time;await h.lifecycle.tick(h.ally,{id:`time:${time}`,time});}
 assert.deepEqual(h.heals,[9,9,9]);assert.equal(h.ally.items.length,0);
 const fresh=fixture();await fresh.runner.execute(fresh.actor,fresh.req);await fresh.lifecycle.reconcile(fresh.ally,{reconnect:true});
 assert.equal(fresh.ally.items[0].flags[MOD].support.status,'recovery');await fresh.lifecycle.tick(fresh.ally,fresh.turn(1));assert.equal(fresh.heals.length,0);
});
test('expired module effects are deleted but uncertain healing and unrelated effects remain',async()=>{
 const h=fixture('heart-of-corundum');await h.runner.execute(h.actor,h.req);const e=h.ally.items[0];e.remainingDuration.expired=true;
 e.flags[MOD].support.healing='recovery';await h.lifecycle.reconcile(h.ally);assert.equal(h.ally.items.length,1);
 e.flags[MOD].support.healing='complete';await h.lifecycle.reconcile(h.ally);assert.equal(h.ally.items.length,0);
 h.ally.items.push({id:'foreign',type:'effect',remainingDuration:{expired:true},flags:{other:{}}});await h.lifecycle.reconcile(h.ally);assert.equal(h.ally.items.length,1);
});
test('a skipped outside-combat interval enters recovery without retrospective healing',async()=>{
 const h=fixture();h.c.encounterId=null;await h.runner.execute(h.actor,h.req);
 await assert.rejects(()=>h.lifecycle.tick(h.ally,{id:'time:1100',time:1100}),/missed/);assert.equal(h.heals.length,0);assert.equal(h.ally.items[0].flags[MOD].support.status,'recovery');
});

test('overlapping Corundum healing stops for adjudication instead of stacking same-effect triggers',async()=>{
 const h=fixture('heart-of-corundum');await h.runner.execute(h.actor,h.req);
 const extra={...h.ally.items[0]};delete extra.setFlag;delete extra.id;await h.ally.createEmbeddedDocuments('Item',[extra]);
 await assert.rejects(()=>h.lifecycle.damage(h.receipt(),'gm'),/Overlapping/);assert.equal(h.heals.length,0);assert(h.ally.items.every(e=>e.flags[MOD].support.healing==='recovery'));
});
