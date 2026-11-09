import test from 'node:test';
import assert from 'node:assert/strict';
import {followupFeat,followupAvailable,commitFollowup} from '../scripts/followup-riders.mjs';
import {createFollowupRunner} from '../scripts/followup-native.mjs';
import {createNativeRunner} from '../scripts/native.mjs';
import {ActorQueue} from '../scripts/queue.mjs';
import {setup} from './helpers/native-save-harness.mjs';
function fixture(slug='solid-barrel'){
 const feat=followupFeat(slug),h=setup({slug,level:18,learned:[feat],degrees:[1],killOnApply:false});
 h.flags.tracker.events=['parent'];h.flags.tracker.combo={next:'savage-claw',untilTurn:2};h.flags.execution={id:'parent',slug,status:'complete',revision:h.flags.tracker.revision};
 h.req.id='parent';h.actor.itemTypes={effect:[]};h.actor.isAllyOf=a=>a.alliance==='party';h.targets[0].actor.alliance='party';h.targets[0].document.x=200;h.actor.isOwner=true;
 h.effects=[];h.targets[0].actor.createEmbeddedDocuments=async(_t,data)=>{h.onEffect?.();h.effects.push(...data);};
 h.choice={kind:'step'};h.plans=0;h.moves=0;h.dialogs=0;
 const steps={prepare:async()=>{h.plans++;h.onPlan?.();if(h.planWait)await h.planWait;return h.cancelPlan?null:{destination:{x:100,y:0}};},validate:()=>{if(h.invalidPath)throw Error('invalid path');},evidence:p=>p,
 move:async()=>{h.moves++;h.onMove?.();if(h.moveWait)await h.moveWait;if(h.stopMove)throw Error('Step interrupted');h.self.document.x=100;}};
 foundry.applications.api.DialogV2.wait=async()=>{h.dialogs++;h.onPrompt?.();return h.choice;};
 h.queue=new ActorQueue();h.runner=createFollowupRunner(h.deps,h.queue,steps);h.parent={id:'parent',status:'complete',revision:h.flags.tracker.revision};h.trigger=structuredClone(h.c);return h;
}
test('only actual finisher/follow-up slugs offer the correct rider',()=>{
 for(const slug of ['solid-barrel','demon-slaughter'])assert.equal(followupFeat(slug),'relentless-combo');for(const slug of ['hypervelocity','jugular-rip','abdomen-tear','eye-gouge','fated-brand'])assert.equal(followupFeat(slug),'continued-assault');for(const slug of ['burst-strike','keen-edge','lion-heart','heart-of-stone'])assert.equal(followupFeat(slug),null);
});
test('committing a rider preserves resources/combo, consumes one round use and advances revision',()=>{const h=fixture(),before=h.flags.tracker,after=commitFollowup(before,h.c,'relentless-combo','parent');assert.equal(after.cartridges,before.cartridges);assert.deepEqual(after.combo,before.combo);assert.equal(after.revision,before.revision+1);assert(!followupAvailable(after,h.c,'relentless-combo'));assert(!before.once['relentless-combo']);});
for(const slug of ['solid-barrel','demon-slaughter','hypervelocity','fated-brand'])test(`${slug} completion offers an immediate optional Step once`,async()=>{
 const h=fixture(slug);const r=await h.runner.execute(h.actor,h.req,h.parent,h.trigger);assert.equal(r.status,'complete');assert.equal(h.moves,1);assert.equal(h.flags.followup.status,'complete');assert.equal(h.flags.execution.status,'complete');assert.equal(h.flags.tracker.once[followupFeat(slug)],1);
 await h.runner.execute(h.actor,h.req,h.parent,h.trigger);assert.equal(h.moves,1);assert.equal(h.dialogs,1);
});
for(const mode of ['decline','cancelPlan'])test(`${mode} leaves the gate and source state unchanged`,async()=>{const h=fixture(),before=structuredClone(h.flags.tracker);if(mode==='decline')h.choice=null;else h.cancelPlan=true;await h.runner.execute(h.actor,h.req,h.parent,h.trigger);assert.deepEqual(h.flags.tracker,before);assert.equal(h.flags.followup.status,'declined');assert.equal(h.moves,0);await h.runner.execute(h.actor,h.req,h.parent,h.trigger);assert.equal(h.dialogs,1);});
test('no rider is offered after canceled, duplicate, superseded or underlevel actions',async()=>{
 for(const mode of ['cancel','duplicate','superseded','level']){const h=fixture('hypervelocity');if(mode==='cancel')h.parent.status='canceled';if(mode==='duplicate')h.parent.duplicate=true;if(mode==='superseded')h.flags.tracker.events.push('other');if(mode==='level')h.c.level=11;await h.runner.execute(h.actor,h.req,h.parent,h.trigger);assert.equal(h.dialogs,0);assert.equal(h.moves,0);}
});
test('Continued Assault shield uses adjacent ally, Royal Guard, half-level TempHP and source-turn expiry',async()=>{
 const h=fixture('hypervelocity');h.actor.itemTypes.effect=[{slug:'royal-guard-stance'}];h.choice={kind:'barrier',target:h.targets[0].document.uuid};await h.runner.execute(h.actor,h.req,h.parent,h.trigger);
 assert.equal(h.moves,0);assert.equal(h.effects.length,1);assert.deepEqual(h.effects[0].system.rules,[{key:'TempHP',value:9}]);assert.equal(h.effects[0].system.duration.expiry,'turn-start');assert.equal(h.effects[0].system.context.origin.actor,h.actor.uuid);
});
for(const mode of ['stance','ally','turn','revision'])test(`changed ${mode} rejects a stale rider before spending`,async()=>{
 const h=fixture('hypervelocity'),before=structuredClone(h.flags.tracker);h.actor.itemTypes.effect=[{slug:'royal-guard-stance'}];h.choice={kind:'barrier',target:h.targets[0].document.uuid};h.onPrompt=()=>{if(mode==='stance')h.actor.itemTypes.effect=[];if(mode==='ally')h.targets[0].actor.alliance='opposition';if(mode==='turn')h.c.turn++;if(mode==='revision')h.flags.tracker.revision++;};
 await assert.rejects(h.runner.execute(h.actor,h.req,h.parent,h.trigger));assert.equal(h.effects.length,0);assert.equal(h.flags.tracker.once['continued-assault'],undefined);assert.equal(h.flags.followup.status,'recovery');assert.equal(h.flags.execution.status,'recovery');
});
test('interrupted Step retains spent gate and cannot replay',async()=>{const h=fixture();h.stopMove=true;await assert.rejects(h.runner.execute(h.actor,h.req,h.parent,h.trigger),/interrupted/);assert.equal(h.flags.tracker.once['relentless-combo'],1);assert.equal(h.flags.followup.status,'recovery');await h.runner.execute(h.actor,h.req,h.parent,h.trigger);assert.equal(h.moves,1);});
test('uncertain shield write is claimed before the native TempHP operation',async()=>{const h=fixture('hypervelocity');h.actor.itemTypes.effect=[{slug:'royal-guard-stance'}];h.choice={kind:'barrier',target:h.targets[0].document.uuid};h.onEffect=()=>{assert.equal(h.flags.followup.status,'applying');assert.equal(h.flags.tracker.once['continued-assault'],1);throw Error('uncertain write');};await assert.rejects(h.runner.execute(h.actor,h.req,h.parent,h.trigger),/uncertain/);assert.equal(h.flags.followup.status,'recovery');});
test('a paused Step does not retain actor queue locks',async()=>{
 const h=fixture();let moving,resume;const ready=new Promise(r=>moving=r);h.moveWait=new Promise(r=>resume=r);h.onMove=moving;const result=h.runner.execute(h.actor,h.req,h.parent,h.trigger);await ready;let acquired=false;await h.queue.run(h.actor,()=>{acquired=true;});assert(acquired);resume();await result;
});
test('native entry offers Relentless Combo after a missed Solid Barrel and captures the triggering request',async()=>{
 const h=setup({slug:'solid-barrel',level:18,learned:['relentless-combo'],degrees:[1]});
 const weapon={id:'blade',type:'weapon',system:{traits:{value:['gunbreaker']},equipped:{carryType:'held',handsHeld:1},damage:{dice:2}}};
 h.actor.type='character';h.actor.isOwner=true;h.actor.itemTypes={weapon:[weapon],effect:[]};h.actor.getActiveTokens=()=>[h.self];
 h.targets[0].isVisible=true;h.c.targetIds=[h.targets[0].document.uuid];h.req.targetIds=[...h.c.targetIds];
 h.flags.tracker.combo={next:'solid-barrel',untilTurn:2};h.flags.tracker.cartridges=0;let attacks=0,prompts=0;
 h.actor.system={actions:[{item:weapon,variants:[{roll:async()=>{attacks++;h.req.id='mutated';h.req.slug='keen-edge';return {degreeOfSuccess:1};}}]}]};
 foundry.applications.api.DialogV2.wait=async options=>{prompts++;assert.equal(options.window.title,'Relentless Combo');return null;};
 const runner=createNativeRunner(h.deps.contextFor,new ActorQueue()),original=structuredClone(h.req);
 const result=await runner.execute(h.actor,h.req);
 assert.equal(result.status,'complete');assert.equal(h.flags.tracker.cartridges,1);assert.equal(h.flags.followup.parentId,original.id);assert.equal(h.flags.followup.status,'declined');assert.equal(prompts,1);
 await runner.execute(h.actor,original);assert.equal(attacks,1);assert.equal(prompts,1);
 h.flags.followup.status='recovery';await assert.rejects(runner.execute(h.actor,{...original,id:'new'}),/pending optional rider/);assert.equal(attacks,1);
});
test('player Continued Assault maps only an offered owner choice to an adjacent ally',async()=>{
 const h=fixture('hypervelocity');h.req.requesterId='player';h.actor.itemTypes.effect=[{slug:'royal-guard-stance'}];
 h.deps.ownerChoices={ask:async(actor,req,options)=>{assert.equal(actor,h.actor);assert.equal(req.requesterId,'player');assert.equal(options.title,'Continued Assault');assert.deepEqual(options.choices.map(c=>c.id),['step','ally0']);return 'ally0';}};
 await h.runner.execute(h.actor,h.req,h.parent,h.trigger);assert.equal(h.dialogs,0);assert.equal(h.effects.length,1);assert.equal(h.flags.followup.status,'complete');
});
test('player Skip preserves the rider use and never falls back to a GM choice',async()=>{
 const h=fixture();h.req.requesterId='player';h.deps.ownerChoices={ask:async()=>null};const before=structuredClone(h.flags.tracker);
 await h.runner.execute(h.actor,h.req,h.parent,h.trigger);assert.equal(h.dialogs,0);assert.equal(h.moves,0);assert.deepEqual(h.flags.tracker,before);assert.equal(h.flags.followup.status,'declined');
});
for(const mode of ['timeout','forged','stale','missing'])test(`owner rider ${mode} leaves the parent in recovery without spending the optional use`,async()=>{
 const h=fixture();h.req.requesterId='player';
 if(mode!=='missing')h.deps.ownerChoices={ask:async()=>{if(mode==='timeout')throw Error('owner timeout');if(mode==='stale')h.c.turn++;return mode==='forged'?'unoffered':'step';}};
 await assert.rejects(h.runner.execute(h.actor,h.req,h.parent,h.trigger));assert.equal(h.dialogs,0);assert.equal(h.moves,0);assert.equal(h.flags.tracker.once['relentless-combo'],undefined);assert.equal(h.flags.followup.status,'recovery');assert.equal(h.flags.execution.status,'recovery');
});
