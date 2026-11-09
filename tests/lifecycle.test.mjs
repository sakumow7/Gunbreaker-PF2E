import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEncounterLifecycle} from '../scripts/lifecycle.mjs';
import {ActorQueue} from '../scripts/queue.mjs';
import {initialState} from '../scripts/state.mjs';
const MOD='gunbreaker-pf2e';
function fixture(){
 const flags={tracker:{...initialState(),cooldowns:{aurora:[900]},dailyUses:{superbolide:1}}},c={time:1000,encounterId:'combat',round:1,turn:1,inTurn:true,learned:[],level:18,wielding:true};let writes=0;
 const a={uuid:'Actor.hero',type:'character',isOwner:true,items:[{type:'class',slug:'gunbreaker'},{id:'stance',type:'effect',slug:'royal-guard-stance',flags:{[MOD]:{execution:'x'}}}],getActiveTokens:()=>[{document:{parent:{id:'scene'}}}],hasCondition:()=>false,getFlag:(_m,k)=>flags[k],setFlag:async(_m,k,v)=>{flags[k]=structuredClone(v);writes++;},deleteEmbeddedDocuments:async(_t,ids)=>{a.items=a.items.filter(i=>!ids.includes(i.id));}};
 globalThis.game={user:{isGM:true},users:[{active:true,isGM:true}],combat:{turns:[{actor:a}]}};globalThis.canvas={scene:{id:'scene'}};
 return {actor:a,c,flags,life:createEncounterLifecycle(()=>c,new ActorQueue()),get writes(){return writes;}};
}
test('encounter lifecycle initializes once and preserves minute and daily uses across combat changes',async()=>{
 const h=fixture();await h.life.sync(h.actor);await h.life.sync(h.actor);assert.equal(h.writes,1);assert.equal(h.flags.tracker.cartridges,1);assert.deepEqual(h.flags.tracker.cooldowns.aurora,[900]);assert.equal(h.flags.tracker.dailyUses.superbolide,1);
 h.c.encounterId=null;await h.life.sync(h.actor);assert.equal(h.flags.tracker.encounter,null);assert.equal(h.flags.tracker.cartridges,0);assert.equal(h.actor.items.length,1);
 h.c.encounterId='second';h.c.learned=['lions-legend'];await h.life.sync(h.actor);assert.equal(h.flags.tracker.cartridges,2);assert.equal(h.flags.tracker.dailyUses.superbolide,1);
});
test('Royal Guard ends on unconsciousness, death or loss of the gunblade and does not return',async()=>{
 for(const mode of ['unconscious','dead','weapon']){const h=fixture();await h.life.sync(h.actor);if(mode==='unconscious')h.actor.hasCondition=()=>true;if(mode==='dead')h.actor.isDead=true;if(mode==='weapon')h.c.wielding=false;await h.life.sync(h.actor);assert.equal(h.actor.items.length,1);h.c.wielding=true;h.actor.isDead=false;h.actor.hasCondition=()=>false;await h.life.sync(h.actor);assert.equal(h.actor.items.length,1);}
});
test('busy, retired, shared-combatant, off-scene and multi-GM states are left for adjudication',async()=>{
 for(const mode of ['busy','retired','shared','offscene','multiGM']){const h=fixture();if(mode==='busy')h.flags.execution={status:'recovery'};if(mode==='retired')h.c.learned=['twin-cartridge'];if(mode==='shared')game.combat.turns.push({actor:h.actor});if(mode==='offscene')canvas.scene.id='other';if(mode==='multiGM')game.users.push({active:true,isGM:true});await h.life.sync(h.actor);assert.equal(h.writes,0);assert.equal(h.actor.items.length,2);}
});
test('lifecycle preserves unrelated stance effects with the same display slug',async()=>{
 const h=fixture();h.actor.items[1].flags={};h.c.wielding=false;await h.life.sync(h.actor);assert.equal(h.actor.items.length,2);
});
