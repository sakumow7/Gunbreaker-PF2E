import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ROLES,STRIKE_FX,FOLLOWUP_FX,AREA_FX,EFFECT_FX,resolveRole,messagePayload,effectPayload,cues,actionSlug} from '../scripts/fx-catalogue.mjs';
import {FxPlayer,Indicators,isGunbreaker} from '../scripts/fx.mjs';
import {catalogue} from '../scripts/catalogue.mjs';
import {FOLLOWUPS} from '../scripts/state.mjs';

const DB=['jb2a.melee_generic.slash.01.orange','jb2a.melee_generic.slash.01.blue','jb2a.impact.001.blue','jb2a.impact.001.orange','jb2a.explosion.01.blue','jb2a.explosion.01.orange',
 'jb2a.shield.01.complete.01.blue','jb2a.extras.tmfx.outflow.circle.01','jb2a.claws.400px.red','jb2a.bullet.01.orange.05ft','jb2a.shockwave.01.blue','jb2a.markers.light.complete.yellow'];
const attack=(slug,outcome,extra={})=>({speaker:{scene:'S',token:'A'},flags:{pf2e:{context:{type:'attack-roll',outcome,options:['self:x',`gunbreaker:action:${slug}`],target:{token:'Scene.S.Token.B'},...extra}}}});

test('every action the catalogue can roll has an effect mapping', ()=>{
 for(const slug of Object.keys(STRIKE_FX))assert.ok(catalogue[slug],slug);
 for(const slug of Object.values(FOLLOWUPS))assert.ok(FOLLOWUP_FX[slug],slug);
 for(const slug of Object.keys(AREA_FX))assert.ok(catalogue[slug],slug);
});
test('every role resolves to some artwork in a modest JB2A database', ()=>{
 const missing=Object.keys(ROLES).filter(r=>!resolveRole(r,DB));
 assert.deepEqual(missing,[]);
});
test('palette prefers an exact color and keeps numbered children collapsed', ()=>{
 assert.deepEqual(resolveRole('cartridge-hit',DB),{file:'jb2a.explosion.01.orange'});
 assert.deepEqual(resolveRole('blast',DB),{file:'jb2a.explosion.01.blue'});
 assert.deepEqual(resolveRole('tracer',DB),{file:'jb2a.bullet.01.orange'});
 assert.deepEqual(resolveRole('slash',DB,{override:'my/file.webm'}),{file:'my/file.webm'});
});
test('attack cards become Strike payloads; misses still swing', ()=>{
 const p=messagePayload(attack('wicked-talon','criticalSuccess'));
 assert.deepEqual(p,{slug:'wicked-talon',sceneId:'S',tokenId:'A',kind:'strike',targets:[{tokenId:'B',degree:3}]});
 const c=cues(p);assert.ok(c.some(x=>x.role==='cartridge-hit'&&x.scale===1.3));assert.ok(c.some(x=>x.shake));
 const miss=cues(messagePayload(attack('keen-edge','failure')));
 assert.deepEqual(miss.map(x=>[x.role,x.missed]),[['slash',true]]);
});
test('Strike damage is ignored so a hit plays once; Continuation and area damage play', ()=>{
 const dmg=(slug,key='origin:action:slug')=>({speaker:{scene:'S',token:'A'},flags:{pf2e:{context:{type:'damage-roll',options:[`${key}:${slug}`],target:{token:'Scene.S.Token.B'}}}}});
 assert.equal(messagePayload(dmg('burst-strike','gunbreaker:action')),null);
 assert.equal(messagePayload(dmg('hypervelocity')).kind,'followup');
 assert.ok(cues(messagePayload(dmg('fated-brand'))).some(x=>x.role==='fated-ring'));
 const area=cues(messagePayload(dmg('demon-slice')));assert.deepEqual(area[0],{role:'demon-ring',at:'emanation',radius:5});
 assert.ok(cues(messagePayload(dmg('double-down'))).some(x=>x.shake===6));
 assert.equal(messagePayload({flags:{pf2e:{context:{type:'attack-roll',options:['item:slug:longsword']}}}}),null);
 assert.equal(messagePayload({}),null);
 assert.equal(actionSlug(['origin:action:slug:nebula']),'nebula');
});
test('new effects announce on their token; unknown effects stay quiet', ()=>{
 assert.deepEqual(cues(effectPayload('no-mercy',{sceneId:'S',tokenId:'A'})),[{role:'mercy-burst',at:'source',scale:1.6}]);
 assert.equal(effectPayload('frightened',{sceneId:'S',tokenId:'A'}),null);
 assert.equal(effectPayload('no-mercy',{sceneId:'S'}),null);
});
test('effect mappings name real effect slugs from the compendium or runtime', async ()=>{
 const runtime=['gunbreaker-heart-of-stone-scoped','gunbreaker-heart-of-corundum','gunbreaker-heart-of-light','gunbreaker-aurora','gunbreaker-brutal-shell-barrier','gunbreaker-relentless-rush-resistance','gunbreaker-continued-assault','gunbreaker-fated-resolve','gunbreaker-vortex-guard'];
 for(const slug of Object.keys(EFFECT_FX)){
  if(runtime.includes(slug))continue;
  const file=slug==='royal-guard-stance'?'royal-guard-stance':slug;
  const doc=JSON.parse(await readFile(new URL(`../packs/_source/gunbreaker-effects/${file}.json`,import.meta.url),'utf8'));
  assert.equal(doc.system.slug,slug);
 }
});

function fakeRuntime({level='full',enabled=true,entries=DB,scene='S'}={}){
 const calls=[],hooks=[];
 class Effect{constructor(){this.ops=[];calls.push(this.ops);}}
 for(const m of ['file','filter','tint','belowTokens','delay','missed','atLocation','scaleToObject','size','stretchTo','name','persist','opacity','fadeIn','fadeOut','attachTo'])Effect.prototype[m]=function(...a){this.ops.push([m,...a]);return this;};
 class Sequence{constructor(){this.items=[];}effect(){const e=new Effect();this.items.push(e);return e;}canvasPan(){const self=this,o={delay:()=>o,shake:()=>{calls.push([['shake']]);return self;}};return o;}async play(){return true;}}
 const tokens={A:{id:'A',w:100,center:{x:50,y:50}},B:{id:'B',w:100,center:{x:250,y:50}}};
 return {calls,hooks,Sequence,Sequencer:{Database:{flattenedEntries:entries}},Hooks:{call:(...a)=>{hooks.push(a);return true;}},
  canvas:{ready:true,scene:{id:scene},grid:{size:100},dimensions:{distance:5},tokens:{get:id=>tokens[id]}},
  game:{settings:{get:(_m,k)=>({fxEnabled:enabled,fxLevel:level,fxOverrides:''})[k]}}};
}
test('player queues effects and honours the client level', async ()=>{
 const p=messagePayload(attack('wicked-talon','criticalSuccess'));
 const full=fakeRuntime();assert.equal(await new FxPlayer(full).play(p),4);assert.ok(full.calls.some(c=>c[0][0]==='shake'));
 const reduced=fakeRuntime({level:'reduced'});assert.equal(await new FxPlayer(reduced).play(p),3);
 assert.equal(await new FxPlayer(fakeRuntime({level:'off'})).play(p),0);
 assert.equal(await new FxPlayer(fakeRuntime({enabled:false})).play(p),0);
 assert.equal(await new FxPlayer(fakeRuntime({scene:'other'})).play(p),0);
 assert.equal(await new FxPlayer(fakeRuntime({entries:[]})).play(p),1,'only the shake plays without artwork');
});
test('player never throws', async ()=>{
 const r=fakeRuntime();r.Sequence=function(){throw Error('boom');};
 const warn=console.warn;console.warn=()=>{};
 try{assert.equal(await new FxPlayer(r).play(messagePayload(attack('keen-edge','success'))),0);}finally{console.warn=warn;}
});
test('cartridge gauge reads the tracker and widens for Bloodfest', ()=>{
 const r=fakeRuntime();r.game.time={worldTime:100};
 const actor=(flags,items=[])=>({items:[{type:'class',slug:'gunbreaker'},...items],level:12,flags:{'gunbreaker-pf2e':{tracker:flags}}});
 const marks=new Indicators(r,new FxPlayer(r));
 assert.deepEqual(marks.gauge({actor:actor({encounter:'C',cartridges:2})}),{cartridges:2,max:3,extra:0});
 assert.deepEqual(marks.gauge({actor:actor({encounter:'C',cartridges:5,bloodfestUntil:160},[{slug:'expanded-gauge'}])}),{cartridges:5,max:7,extra:3});
 assert.equal(marks.gauge({actor:actor({encounter:null,cartridges:2})}),null);
 assert.equal(isGunbreaker({items:[{type:'class',slug:'fighter'}]}),false);
});
