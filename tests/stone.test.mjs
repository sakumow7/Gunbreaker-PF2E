import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StoneRunner,stoneAttack,stoneDamage,stoneOptions,stoneEffect} from '../scripts/stone.mjs';
import {initialState,transition} from '../scripts/state.mjs';
import {catalogue} from '../scripts/catalogue.mjs';
function context(){return {time:1000,level:19,learned:['heart-of-stone','reserved-cartridge','aetheric-ward','guardians-instinct','lions-legend'],encounterId:'combat',round:1,turn:1,inTurn:false,wielding:true,targetIds:['Scene.scene.Token.ally'],selfTargetIds:[]};}
const facts=()=>({self:false,ally:true,enemy:true,conscious:true,seesBoth:true,distance:15,attackKind:'strike'});
function attackMessage(){return {id:'attack',isCheckRoll:true,actor:{uuid:'Actor.enemy'},token:{uuid:'Scene.scene.Token.enemy'},item:{uuid:'Actor.enemy.Item.sword',type:'weapon',dealsDamage:true,damageKinds:new Set(['damage'])},flags:{pf2e:{context:{type:'attack-roll',action:'strike',target:{token:'Scene.scene.Token.ally'}}}},rolls:[{degreeOfSuccess:2,toJSON:()=>({total:25,degree:2})}]};}
class DamageRoll{constructor(){this.total=25;this.instances=[{persistent:false}];this.options={degreeOfSuccess:2};}toJSON(){return {total:this.total,options:this.options};}}
function damageMessage(){const m=attackMessage();return {...m,id:'damage',isCheckRoll:false,isDamageRoll:true,flags:{pf2e:{context:{type:'damage-roll',sourceType:'attack',target:{token:'Scene.scene.Token.ally'}}}},rolls:[new DamageRoll()]};}
function setup(){
 const actor={uuid:'Actor.hero',id:'hero'},c=context(),f=facts(),attack=stoneAttack(attackMessage());
 let state=transition(initialState(),{type:'start'},c,catalogue),journal=null,applied=false,applications=0;
 let window={attack,status:'awaiting',revision:0,declined:[],candidates:[{actor:actor.uuid}]};
 const p={authorize:()=>{},gm:()=>{},readWindow:()=>structuredClone(window),writeWindow:(_id,w)=>{window=structuredClone(w);},attack:()=>attack,sameTurn:()=>true,
 context:()=>c,facts:()=>f,readActor:()=>structuredClone(state),writeActor:(_a,s)=>{state=structuredClone(s);},journal:()=>journal,saveJournal:(_a,j)=>{journal=structuredClone(j);},
 damage:(a)=>stoneDamage(a,damageMessage()),targetActor:()=>({uuid:'Actor.ally'}),applied:()=>applied,markApplied:()=>{applied=true;},applyNative:(_a,_attack,_damage,resistance)=>{applications++;assert.equal(resistance,window.choice?.resistance??0);}};
 return {actor,c,f,p,runner:new StoneRunner(p),get window(){return window;},get state(){return state;},set state(s){state=s;},get journal(){return journal;},get applications(){return applications;}};
}
test('native attack evidence admits successful Strikes and spell attacks, excluding saves, misses and rerolls',()=>{
 const m=attackMessage();assert.equal(stoneAttack(m).kind,'strike');m.item.type='spell';assert.equal(stoneAttack(m).kind,'spell');
 m.rolls[0].degreeOfSuccess=3;assert.equal(stoneAttack(m).degree,3);
 m.rolls[0].degreeOfSuccess=1;assert.equal(stoneAttack(m),null);m.rolls[0].degreeOfSuccess=2;
 m.flags.pf2e.context.type='saving-throw';assert.equal(stoneAttack(m),null);m.flags.pf2e.context.type='attack-roll';
 m.isReroll=true;assert.equal(stoneAttack(m),null);
});
test('damage pairing verifies attacker, item, target, native outcome and excludes persistent ticks',()=>{
 const a=stoneAttack(attackMessage());assert.equal(stoneDamage(a,damageMessage()).id,'damage');
 for(const mutate of [m=>m.actor.uuid='Actor.other',m=>m.item.uuid='Item.other',m=>m.flags.pf2e.context.target.token='other',m=>m.rolls[0].options.degreeOfSuccess=3,m=>m.rolls[0].instances=[{persistent:true}],m=>m.rolls[0].instances[0].options={evaluatePersistent:true},m=>m.flags.pf2e.context.sourceType='save']){
  const m=damageMessage();mutate(m);assert.throws(()=>stoneDamage(a,m));
 }
});
test('native mixed immediate/persistent roll remains eligible; its later ticks are separate',()=>{
 const m=damageMessage();m.rolls[0].instances.push({persistent:true});assert.doesNotThrow(()=>stoneDamage(stoneAttack(attackMessage()),m));
});
test('choices scale resistance and require threat, range, sight and ability to react',()=>{
 const c=context(),raw=transition(initialState(),{type:'start'},c,catalogue),options=stoneOptions(raw,c,facts());
 assert.equal(options.find(o=>o.id==='base-regular').resistance,11);assert.equal(options.find(o=>o.id==='enhanced-regular').resistance,23);
 for(const patch of [{enemy:false},{ally:false},{conscious:false},{seesBoth:false},{distance:31}])assert.deepEqual(stoneOptions(raw,c,{...facts(),...patch}),[]);
 assert(stoneOptions(raw,c,{...facts(),distance:30}).length);c.learned=c.learned.filter(s=>s!=='guardians-instinct');assert.equal(stoneOptions(raw,c,{...facts(),distance:16}).length,0);
});
test('zero-cartridge reserve uses the regular reaction; extra reaction starts on first own turn',()=>{
 const c=context(),raw=transition(initialState(),{type:'start'},c,catalogue);raw.cartridges=0;
 const options=stoneOptions(raw,c,facts());assert(options.some(o=>o.id==='reserved-regular'));assert(!options.some(o=>o.id==='reserved-instinct'||o.id.startsWith('enhanced')));
 c.turn=0;assert(!stoneOptions(raw,c,facts()).some(o=>o.id.endsWith('instinct')));
});
test('Aetheric Ward excludes spell attacks, reserves, extra reactions and free discounts',()=>{
 const c=context(),raw=transition(initialState(),{type:'start'},c,catalogue);raw.perfectUntil=1100;raw.perfectRound=null;
 assert.deepEqual(stoneOptions(raw,c,{...facts(),self:true,attackKind:'spell'}),[]);
 const options=stoneOptions(raw,c,{...facts(),self:true});assert.deepEqual(options.map(o=>o.id),['enhanced-regular']);
});
test('accepted enhancement spends once, marks reaction and preserves Continuation',async()=>{
 const h=setup();h.state={...h.state,continuation:{slug:'hypervelocity',turn:1,targets:h.c.targetIds,weaponDice:2}};h.c.inTurn=true;
 await h.runner.choose('window',h.actor,'enhanced-regular','owner',0);
 assert.equal(h.state.cartridges,1);assert.equal(h.state.lastReactionTurn,1);assert.equal(h.state.continuation.slug,'hypervelocity');assert.equal(h.window.status,'accepted');
 await assert.rejects(()=>h.runner.choose('window',h.actor,'enhanced-regular','owner',0),/changed or closed/);assert.equal(h.state.cartridges,1);
});
test('a decline spends nothing; pending damage requires explicit continuation',async()=>{
 const h=setup(),before=h.state;await assert.rejects(()=>h.runner.apply('window','damage'),/Resolve the reaction/);assert.equal(h.applications,0);
 await h.runner.choose('window',h.actor,'decline','owner',0);assert.deepEqual(h.state,before);assert.equal(h.window.status,'declined');
 await h.runner.apply('window','damage');assert.equal(h.applications,1);
 const pending=setup();await pending.runner.continue('window');assert.equal(pending.window.status,'declined');assert.equal(pending.journal,null);
});
test('stale attack, turn, permission or reaction costs cause no spend',async()=>{
 for(const mutate of [h=>h.p.attack=()=>null,h=>h.p.sameTurn=()=>false,h=>h.p.authorize=()=>{throw Error('permission');},h=>h.state={...h.state,lastReactionTurn:1}]){
  const h=setup();mutate(h);const before=h.state;await assert.rejects(()=>h.runner.choose('window',h.actor,'base-regular','owner',0));assert.deepEqual(h.state,before);assert.equal(h.journal,null);
 }
});
test('reserved protection works at zero and creates no cartridge',async()=>{
 const h=setup();h.state={...h.state,cartridges:0};await h.runner.choose('window',h.actor,'reserved-regular','owner',0);
 assert.equal(h.state.cartridges,0);assert.equal(h.state.once.reserve,true);assert.equal(h.window.choice.resistance,23);
});
test('regular and extra ally reaction pools remain separate',async()=>{
 const h=setup();h.state={...h.state,lastReactionTurn:1};await h.runner.choose('window',h.actor,'base-instinct','owner',0);
 assert.equal(h.state.lastReactionTurn,1);assert.equal(h.state.lastInstinctTurn,1);
});
test('simultaneous accepts and duplicate applications execute only once',async()=>{
 const h=setup();const choices=await Promise.allSettled([h.runner.choose('window',h.actor,'enhanced-regular','owner',0),h.runner.choose('window',h.actor,'enhanced-regular','owner',0)]);
 assert.equal(choices.filter(r=>r.status==='fulfilled').length,1);
 const applications=await Promise.allSettled([h.runner.apply('window','damage'),h.runner.apply('window','damage')]);
 assert.equal(applications.filter(r=>r.status==='fulfilled').length,1);assert.equal(h.applications,1);
});
test('failure after resource write leaves recovery and prevents another spend',async()=>{
 const h=setup(),save=h.p.saveJournal;h.p.saveJournal=(a,j)=>{if(j.status==='complete')throw Error('write failed');return save(a,j);};
 await assert.rejects(()=>h.runner.choose('window',h.actor,'enhanced-regular','owner',0),/write failed/);
 assert.equal(h.state.cartridges,1);assert.equal(h.window.status,'recovery');assert.equal(h.journal.status,'reserved');
 await assert.rejects(()=>h.runner.choose('window',h.actor,'enhanced-regular','owner',1));assert.equal(h.state.cartridges,1);
});
test('failed or uncertain HP application persists recovery and is never replayed by a fresh runner',async()=>{
 const h=setup();await h.runner.choose('window',h.actor,'base-regular','owner',0);let calls=0;h.p.applyNative=()=>{calls++;throw Error('uncertain HP write');};
 await assert.rejects(()=>h.runner.apply('window','damage'),/uncertain/);assert.equal(h.window.status,'recovery');
 const reconnected=new StoneRunner(h.p);await assert.rejects(()=>reconnected.apply('window','damage'));assert.equal(calls,1);
});
test('reroll after acceptance and already-managed damage are blocked before applying HP',async()=>{
 for(const mutate of [h=>h.p.attack=()=>null,h=>h.p.applied=()=>true]){
  const h=setup();await h.runner.choose('window',h.actor,'base-regular','owner',0);mutate(h);await assert.rejects(()=>h.runner.apply('window','damage'));assert.equal(h.applications,0);
 }
});
test('resistance is represented by one native all-damage rule, not a post-IWR subtraction',()=>{
 assert.deepEqual(stoneEffect(11,'attack').system.rules,[{key:'Resistance',type:'all-damage',value:11}]);
 assert.throws(()=>stoneEffect(-1,'attack'));
});
test('Bulwark checks original eligibility before planning and preserves the original attack target',async()=>{
 const h=setup();h.c.learned.push('bulwark-protocol');h.c.inTurn=true;h.state.continuation={slug:'hypervelocity',turn:1,targets:['enemy']};let moved=0;
 h.p.prepareStep=()=>({});h.p.validateStep=()=>{};h.p.stepEvidence=()=>({path:'verified'});h.p.moveStep=(_a,w)=>{assert.equal(w.status,'reserving');assert.equal(h.journal.status,'reserved');assert.equal(h.state.cartridges,1);assert.equal(w.attack.target,'Scene.scene.Token.ally');moved++;};
 await h.runner.choose('window',h.actor,'enhanced-regular','owner',0,{bulwark:true});assert.equal(moved,1);assert.equal(h.window.status,'accepted');assert.equal(h.window.attack.target,'Scene.scene.Token.ally');assert.equal(h.state.continuation.slug,'hypervelocity');
});
test('Bulwark cannot move into original reaction range or protect self',async()=>{
 for(const mode of ['range','self','missing']){const h=setup();let planned=0;h.p.prepareStep=()=>{planned++;return {};};if(mode!=='missing')h.c.learned.push('bulwark-protocol');if(mode==='range')h.f.distance=35;if(mode==='self'){h.f.self=true;h.c.selfTargetIds=h.c.targetIds;}
 await assert.rejects(h.runner.choose('window',h.actor,'enhanced-regular','owner',0,{bulwark:true}));assert.equal(planned,0);assert.equal(h.window.status,'awaiting');}
});
test('canceled Bulwark preview still accepts the chosen protection without moving',async()=>{const h=setup();h.c.learned.push('bulwark-protocol');h.p.prepareStep=()=>null;h.p.moveStep=()=>{throw Error('unexpected move');};await h.runner.choose('window',h.actor,'base-regular','owner',0,{bulwark:true});assert.equal(h.window.status,'accepted');assert.equal(h.window.bulwark,undefined);});
test('interrupted Bulwark reserves cost, prevents protection application and cannot replay',async()=>{const h=setup();h.c.learned.push('bulwark-protocol');let moves=0;h.p.prepareStep=()=>({});h.p.validateStep=()=>{};h.p.stepEvidence=()=>({});h.p.moveStep=()=>{moves++;throw Error('interrupted');};await assert.rejects(h.runner.choose('window',h.actor,'enhanced-regular','owner',0,{bulwark:true}),/interrupted/);assert.equal(h.window.status,'recovery');assert.equal(h.state.cartridges,1);assert.equal(h.journal.status,'reserved');await assert.rejects(h.runner.apply('window','damage'));await assert.rejects(h.runner.choose('window',h.actor,'enhanced-regular','owner',1,{bulwark:true}));assert.equal(moves,1);});
test('Bulwark rejects eligibility lost during movement without accepting protection',async()=>{const h=setup();h.c.learned.push('bulwark-protocol');h.p.prepareStep=()=>({});h.p.validateStep=()=>{};h.p.stepEvidence=()=>({});h.p.moveStep=()=>{h.f.conscious=false;};await assert.rejects(h.runner.choose('window',h.actor,'base-regular','owner',0,{bulwark:true}),/eligibility changed/);assert.equal(h.window.status,'recovery');assert.equal(h.state.lastReactionTurn,1);});
test('Bulwark releases the actor queue during native Step while reserving its window',async()=>{const h=setup();h.c.learned.push('bulwark-protocol');let moving,resume;const ready=new Promise(r=>moving=r),paused=new Promise(r=>resume=r);h.p.prepareStep=()=>({});h.p.validateStep=()=>{};h.p.stepEvidence=()=>({});h.p.moveStep=async()=>{moving();await paused;};const choosing=h.runner.choose('window',h.actor,'base-regular','owner',0,{bulwark:true});await ready;let acquired=false;await h.runner.actors.run(h.actor,()=>acquired=true);assert(acquired);assert.equal(h.window.status,'reserving');resume();await choosing;assert.equal(h.window.status,'accepted');});
