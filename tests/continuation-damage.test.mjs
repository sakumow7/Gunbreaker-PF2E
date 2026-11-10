import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeRunner} from '../scripts/native.mjs';
import {ActorQueue} from '../scripts/queue.mjs';
import {setup} from './helpers/native-save-harness.mjs';
const MOD='gunbreaker-pf2e';
function fixture(slug='hypervelocity',calibration='cold',level=17){
 const h=setup({slug,level,calibration,degrees:[1],learned:['continuation'],killOnApply:false});
 const weapon={id:'blade',type:'weapon',system:{traits:{value:['gunbreaker']},equipped:{carryType:'held',handsHeld:1},damage:{dice:4}}};
 h.actor.type='character';h.actor.isOwner=true;h.actor.level=level;h.actor.itemTypes={weapon:[weapon],effect:[]};h.actor.getActiveTokens=()=>[h.self];
 h.flags.tracker.continuation={slug,turn:1,targets:[h.targets[0].document.uuid],weaponId:'blade',weaponDice:2};
 h.req.targetIds=['Scene.scene.Token.unrelated'];
 h.item=h.actor.items.find(i=>i.slug===slug);h.item.name=slug;h.item.getOriginData=()=>({actor:h.actor.uuid,uuid:`${h.actor.uuid}.Item.followup`,type:'feat'});
 h.target=h.targets[0];h.target.isVisible=true;
 h.applications=[];
 h.target.actor.getContextualClone=(options,effects)=>({getSelfRollOptions:()=>['self:trait:undead'],applyDamage:async params=>{h.onApply?.(params);h.applications.push(params);if(h.uncertain)throw Error('uncertain native HP write');}});
 h.runner=createNativeRunner(h.deps.contextFor,new ActorQueue());return h;
}
for(const slug of ['hypervelocity','jugular-rip','abdomen-tear','eye-gouge'])for(const type of ['fire','cold','electricity'])test(`${slug} applies one separate ${type} effect to the opening target`,async()=>{
 const h=fixture(slug,type);const before=h.flags.tracker.cartridges;
 const result=await h.runner.execute(h.actor,h.req);
 assert.equal(result.status,'complete');assert.deepEqual(h.rolls,[`(4d6+2)[${type}]`]);assert.equal(h.applications.length,1);
 const applied=h.applications[0];assert.equal(applied.token,h.target.document);assert.equal(applied.item,h.item);assert.equal(applied.skipIWR,false);assert.equal(applied.shieldBlockRequest,false);
 assert.equal(applied.damage.options.degreeOfSuccess,null);assert.equal(applied.outcome,undefined);assert(applied.rollOptions.has('origin:action:trait:magical'));assert(applied.rollOptions.has(`origin:action:slug:${slug}`));assert(!applied.rollOptions.has('area-damage'));
 const message=[...h.messages.values()].find(m=>m.isDamageRoll);assert.equal(message.flags.pf2e.suppressDamageButtons,true);assert.equal(message.flags.pf2e.origin.type,'feat');assert.equal(message.flags.pf2e.context.target.token,h.target.document.uuid);
 assert.equal(h.flags.tracker.continuation,null);assert.equal(h.flags.tracker.cartridges,before);assert.equal(h.flags.execution.riders[0].status,'complete');
 await h.runner.execute(h.actor,h.req);assert.equal(h.applications.length,1);assert.equal(h.rolls.length,1);
});
test('IWR disabled or corrupt calibration rejects before consuming the opening',async()=>{
 for(const mode of ['iwr','calibration']){
  const h=fixture();if(mode==='iwr')game.pf2e.settings.iwr=false;else h.flags.tracker.calibration='void';
  await assert.rejects(h.runner.execute(h.actor,h.req),/IWR|Calibration/);assert(h.flags.tracker.continuation);assert.equal(h.rolls.length,0);assert.equal(h.applications.length,0);
 }
});
for(const change of ['target','source','turn','ability','calibration','permission'])test(`changed ${change} after the roll stops before HP and retains recovery evidence`,async()=>{
 const h=fixture(),evaluate=h.DamageRoll.prototype.evaluate;
 h.DamageRoll.prototype.evaluate=async function(){const r=await evaluate.call(this);if(change==='target')h.target.document.x++;if(change==='source')h.self.document.x++;if(change==='turn')h.c.turn++;if(change==='ability')h.actor.items=[];if(change==='calibration')h.flags.tracker.calibration='electricity';if(change==='permission')h.actor.isOwner=false;return r;};
 await assert.rejects(h.runner.execute(h.actor,h.req));assert.equal(h.applications.length,0);assert.equal(h.flags.tracker.continuation,null);assert.equal(h.flags.execution.status,change==='permission'?'committed':'recovery');
});
test('failed/uncertain application is claimed first and cannot repeat after recovery',async()=>{
 const h=fixture();h.onApply=()=>assert.equal(h.flags.execution.riders[0].status,'applying');h.uncertain=true;
 await assert.rejects(h.runner.execute(h.actor,h.req),/uncertain/);assert.equal(h.applications.length,1);assert.equal(h.flags.execution.status,'recovery');assert.equal(h.flags.execution.riders[0].status,'applying');
 await assert.rejects(h.runner.execute(h.actor,h.req),/recovery/);assert.equal(h.applications.length,1);
});
test('changed native damage evidence is never applied',async()=>{
 const h=fixture();h.actor.synthetics.ephemeralEffects={'damage-received':{target:[async()=>{[...h.messages.values()].find(m=>m.isDamageRoll).rolls[0].formula='999[fire]';return null;}]}};
 await assert.rejects(h.runner.execute(h.actor,h.req),/evidence changed/);assert.equal(h.applications.length,0);assert.equal(h.flags.execution.status,'recovery');
});
