import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAreaRunner} from '../scripts/area-native.mjs';
import {ActorQueue} from '../scripts/queue.mjs';
import {initialState,transition} from '../scripts/state.mjs';
import {catalogue} from '../scripts/catalogue.mjs';
test('native area adapter preserves class DC, private evidence and one application per enemy even when the first dies',async()=>{
 const MOD='gunbreaker-pf2e',messages=new Map(),flags={},documents=new Map(),applied=[],saveArgs=[];let seq=0;
 const users=[{id:'gm',isGM:true,active:true}],user=users[0];
 const c={time:1000,level:12,learned:['fated-circle','continuation'],encounterId:'combat',round:1,turn:1,inTurn:true,wielding:true,targetIds:[]};
 const item={slug:'fated-circle',type:'feat',system:{publication:{title:'Gunbreaker 1.4.0'},traits:{value:['gunbreaker','magical']}},getRollOptions:()=>['item:type:feat']};
 const actor={uuid:'Actor.hero',items:[item],hasCondition:()=>false,isEnemyOf:a=>a.uuid.startsWith('Actor.enemy'),alliance:'party',synthetics:{},
  getStatistic:slug=>{assert.equal(slug,'gunbreaker');return {dc:{value:22}};},getSelfRollOptions:()=>['self:trait:human'],getRollOptions:()=>[],
  getFlag:(_m,k)=>flags[k],setFlag:async(_m,k,v)=>{flags[k]=structuredClone(v);}};
 flags.tracker=transition(initialState(),{type:'start'},c,catalogue);
 function token(id,a){const d={uuid:`Scene.scene.Token.${id}`,x:0,y:0,elevation:0,width:1,height:1,parent:{id:'scene'},actor:a};const t={document:d,actor:a,name:id,distanceTo:()=>5};d.object=t;documents.set(d.uuid,d);return t;}
 const self=token('self',actor),targets=[1,0].map((degree,i)=>{
  const enemy={uuid:`Actor.enemy${i}`,alliance:'opposition',isDead:false,getSelfRollOptions:p=>[`${p??'self'}:trait:humanoid`]};
  const t=token(`enemy${i}`,enemy);
  enemy.saves={reflex:{check:{roll:async args=>{
   saveArgs.push(args);const roll={degreeOfSuccess:degree,toJSON:()=>({degree,total:degree===1?20:10})};
   const m=await ChatMessage.create({isCheckRoll:true,actor:enemy,rolls:[roll],flags:{pf2e:{context:{type:'saving-throw'}}}});args.callback(roll,null,m);return roll;
  }}}};
  enemy.getContextualClone=()=>({getSelfRollOptions:()=>['self:trait:humanoid'],applyDamage:async params=>{
   assert.equal(params.skipIWR,false);assert.equal(params.damage.options.degreeOfSuccess,null);assert(!params.rollOptions.has('check:outcome:critical-success'));
   applied.push({target:t.document.uuid,total:params.damage.total});enemy.isDead=true;
  }});
  return t;
 });
 globalThis.game={user,users,combat:{turns:[{actor}]},pf2e:{settings:{iwr:true}},messages,settings:{get:()=> 'public'}};
 globalThis.canvas={scene:{id:'scene'},tokens:{placeables:[self,...targets]}};
 globalThis.fromUuid=async uuid=>documents.get(uuid);
 globalThis.ChatMessage={getSpeaker:()=>({actor:'hero'}),create:async data=>{
  const m={id:`message${++seq}`,author:user,...data,getFlag(_m,k){return this.flags?.[_m]?.[k];},async setFlag(_m,k,v){this.flags??={};this.flags[_m]??={};this.flags[_m][k]=structuredClone(v);}};
  messages.set(m.id,m);return m;
 }};
 class DamageRoll{
  constructor(formula){this.formula=formula;this.total=21;this.options={};}
  async evaluate(){return this;}
  toJSON(){return {formula:this.formula,total:this.total,options:this.options};}
  async toMessage(data){return ChatMessage.create({...data,isDamageRoll:true,rolls:[this]});}
  static fromJSON(text){const d=JSON.parse(text),r=new this(d.formula);r.total=d.total;r.options=d.options;return r;}
  alter(n){this.total*=n;this.options.degreeOfSuccess=3;return this;}
 }
 globalThis.CONFIG={Dice:{rolls:[DamageRoll]}};
 globalThis.foundry={utils:{escapeHTML:s=>s,deepClone:structuredClone},applications:{api:{DialogV2:{wait:async options=>options.window.title.includes('Confirm area')?targets.map(t=>t.document.uuid):targets.map((t,i)=>({target:t.document.uuid,multiplier:i===0?1:2}))}}}};
 const runner=createAreaRunner({authority:()=>{},contextFor:()=>structuredClone(c),actorToken:()=>self,weaponFor:()=>({})},new ActorQueue());
 await runner.execute(actor,{id:'request',slug:'fated-circle',weaponId:'blade'});
 assert.deepEqual(applied.map(a=>a.total),[21,42]);assert.equal(saveArgs.length,2);assert(saveArgs.every(a=>a.dc.value===22&&a.dc.slug==='gunbreaker'&&a.damaging));
 assert.deepEqual(flags.tracker.continuation.targets,targets.map(t=>t.document.uuid));assert.equal(flags.execution.status,'complete');
 assert(!flags.execution.saves);assert(!flags.execution.prepared);
 const log=messages.get(flags.execution.journalId);assert.deepEqual(log.whisper,['gm']);assert.equal(log.getFlag(MOD,'areaJournal').applications.length,2);
});
