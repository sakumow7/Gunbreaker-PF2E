import test from 'node:test';
import assert from 'node:assert/strict';
import {suppressingAction,demoralizeEvidence,immunityActive,immunityEntry,frightenedValue,setFrightenedAtLeast,installDemoralizeObserver} from '../scripts/demoralize.mjs';
import {createDemoralizeRunner} from '../scripts/demoralize-native.mjs';
import {ActorQueue} from '../scripts/queue.mjs';
import {setup} from './helpers/native-save-harness.mjs';
class NativeAction{constructor(data){Object.assign(this,data);}async use(args){return this.run?.(args);}}
test('Suppressing Fire constructs an isolated visual native Demoralize without language penalty',()=>{
 const base=new NativeAction({slug:'demoralize',traits:['auditory','fear'],modifiers:[{modifier:-4}],notes:['success']});
 const action=suppressingAction(base);assert.equal(action.slug,'demoralize');assert.equal(action.statistic,'intimidation');assert.equal(action.difficultyClass,'will');assert(action.traits.includes('visual'));assert(!action.traits.includes('auditory'));assert.deepEqual(action.modifiers,[]);assert.deepEqual(base.traits,['auditory','fear']);assert.deepEqual(base.modifiers,[{modifier:-4}]);assert.deepEqual(action.notes,base.notes);
});
test('Demoralize degrees, source-specific immunity and expiration',()=>{
 assert.deepEqual([0,1,2,3].map(frightenedValue),[0,0,1,2]);assert.throws(()=>frightenedValue(undefined));const entries=[immunityEntry('A',100,'check')];assert(immunityActive(entries,'A',699));assert(!immunityActive(entries,'B',699));assert(!immunityActive(entries,'A',700));
});
test('frightened minimum preserves stronger conditions and compensates for native additive API',async()=>{
 for(const current of [0,1,2,3])for(const desired of [1,2]){let actual=current,calls=0;const actor={getCondition:()=>({value:actual}),increaseCondition:async(_s,{value,max})=>{calls++;actual=Math.min(max,actual+value);return {value:actual};}};await setFrightenedAtLeast(actor,desired);assert.equal(actual,Math.max(current,desired));assert.equal(calls,Number(current<desired));}
});
test('observer accepts resolved native Demoralize, ignores rule cards and rerolls',()=>{
 const m={id:'check',isCheckRoll:true,actor:{uuid:'A'},rolls:[{degreeOfSuccess:2}],flags:{pf2e:{context:{type:'skill-check',target:{actor:'B'},options:['action:demoralize']}}}};
 assert.equal(demoralizeEvidence(m).target,'B');assert.equal(demoralizeEvidence({...m,isCheckRoll:false}),null);m.flags.pf2e.context.isReroll=true;assert.equal(demoralizeEvidence(m),null);
});
function harness({degree=2,frightened=0,immune=false}={}){
 const h=setup({slug:'suppressing-fire',degrees:[1],level:8});h.c.targetIds=[h.targets[0].document.uuid];h.req.targetIds=h.c.targetIds;
 h.actor.isOwner=true;h.actor.type='character';h.actor.level=8;
 const target=h.targets[0].actor,flags={};target.isOwner=true;target.hasCondition=()=>false;target.getFlag=(_m,k)=>flags[k];target.setFlag=async(_m,k,v)=>{h.onTargetWrite?.();flags[k]=structuredClone(v);};target.getCondition=()=>({value:frightened});target.isImmuneTo=()=>immune;
 target.increaseCondition=async(_s,{value,max})=>{h.onCondition?.();h.conditions++;frightened=Math.min(max,frightened+value);return {value:frightened};};
 game.time={worldTime:h.c.time};game.users.get=id=>game.users.find(u=>u.id===id);
 class CheckAction extends NativeAction{async use(args){h.checks++;h.checkArgs=args;h.action=this;h.onCheck?.();return h.cancelRoll?[]:[{actor:h.actor,roll:{degreeOfSuccess:degree},message:{id:'native'}}];}}
 game.pf2e.actions=new Map([['demoralize',new CheckAction({slug:'demoralize',traits:['auditory'],notes:[]})]]);
 foundry.applications.api.DialogV2.confirm=async()=>{h.onConfirm?.();return !h.cancelConfirm;};
 h.checks=0;h.conditions=0;h.targetFlags=flags;h.frightened=()=>frightened;
 h.runner=createDemoralizeRunner(h.deps,new ActorQueue());return h;
}
for(const degree of [0,1,2,3])test(`native Suppressing Fire degree ${degree} sets immunity and correct frightened`,async()=>{
 const h=harness({degree}),cartridges=h.flags.tracker.cartridges;h.flags.tracker.continuation={slug:'hypervelocity',turn:1,targets:h.c.targetIds};
 assert.equal((await h.runner.execute(h.actor,h.req)).status,'complete');assert.equal(h.flags.tracker.cartridges,cartridges);assert.equal(h.flags.tracker.continuation,null);assert.equal(h.frightened(),Math.max(0,degree-1));assert(immunityActive(h.targetFlags.demoralizeImmunity,h.actor.uuid,h.c.time));assert.equal(h.checkArgs.target,h.targets[0]);
 await h.runner.execute(h.actor,h.req);assert.equal(h.checks,1);
 await assert.rejects(h.runner.execute(h.actor,{...h.req,id:'other'}),/immune/);
});
test('native fear immunity prevents frightened but still records the attempt',async()=>{const h=harness({immune:true,degree:3});await h.runner.execute(h.actor,h.req);assert.equal(h.conditions,0);assert.equal(h.targetFlags.demoralizeImmunity.length,1);});
test('native stronger frightened does not stack or decrease',async()=>{const h=harness({frightened:3,degree:3});await h.runner.execute(h.actor,h.req);assert.equal(h.frightened(),3);assert.equal(h.conditions,0);});
for(const key of ['cancelConfirm','cancelRoll'])test(`${key} leaves tracker and target unchanged`,async()=>{const h=harness(),before=structuredClone(h.flags.tracker);h[key]=true;assert.equal((await h.runner.execute(h.actor,h.req)).status,'canceled');assert.deepEqual(h.flags.tracker,before);assert.deepEqual(h.targetFlags,{});});
test('movement during confirmation rejects before rolling',async()=>{const h=harness();h.onConfirm=()=>h.targets[0].document.x=100;await assert.rejects(h.runner.execute(h.actor,h.req),/Positions changed/);assert.equal(h.checks,0);});
test('combat changes after native check are recoverable and never replayed',async()=>{const h=harness();h.onCheck=()=>h.c.turn++;await assert.rejects(h.runner.execute(h.actor,h.req),/Combat advanced/);assert.equal(h.flags.execution.status,'recovery');await assert.rejects(h.runner.execute(h.actor,h.req),/pending/);assert.equal(h.checks,1);});
test('partial condition failure retains attempt evidence and immunity, blocking replay',async()=>{const h=harness();h.onCondition=()=>{throw Error('write interrupted');};await assert.rejects(h.runner.execute(h.actor,h.req),/write interrupted/);assert.equal(h.flags.execution.messageId,'native');assert.equal(h.flags.execution.application,'applying');assert.equal(h.flags.execution.status,'recovery');assert.equal(h.targetFlags.demoralizeImmunity.length,1);await assert.rejects(h.runner.execute(h.actor,h.req),/pending/);});
test('ordinary native Demoralize observer records immunity once without extending it',async()=>{
 const h=harness();let hook;globalThis.Hooks={on:(_n,fn)=>hook=fn};h.actor.testUserPermission=()=>true;
 const original=fromUuid;globalThis.fromUuid=async id=>id===h.targets[0].actor.uuid?h.targets[0].actor:original(id);
 installDemoralizeObserver(new ActorQueue());const message={id:'ordinary',author:{id:'gm'},isCheckRoll:true,actor:h.actor,rolls:[{degreeOfSuccess:1}],flags:{pf2e:{context:{type:'skill-check',target:{actor:h.targets[0].actor.uuid},options:['action:demoralize']}}}};
 hook(message,{},'gm');await new Promise(setImmediate);assert.equal(h.targetFlags.demoralizeImmunity[0].until,1600);
 game.time.worldTime=1100;hook({...message,id:'repeat'}, {},'gm');await new Promise(setImmediate);assert.equal(h.targetFlags.demoralizeImmunity[0].until,1600);
});
