import assert from 'node:assert/strict';
import {createAreaRunner} from '../../scripts/area-native.mjs';
import {ActorQueue} from '../../scripts/queue.mjs';
import {initialState,transition} from '../../scripts/state.mjs';
import {catalogue} from '../../scripts/catalogue.mjs';
const MOD='gunbreaker-pf2e';
export function setup({slug='fated-circle',level=12,degrees=[1,0],distances=[],learned=[],calibration='fire',killOnApply=true}={}){
 const messages=new Map(),flags={},documents=new Map(),applied=[],saveArgs=[],rolls=[],dialogs=[];let seq=0;
 const users=[{id:'gm',isGM:true,active:true,color:'#ff9900'}],user=users[0];
 const c={time:1000,level,learned:[slug,'continuation',...learned],encounterId:'combat',round:1,turn:1,inTurn:true,wielding:true,targetIds:[]};
 const itemFor=slug=>({slug,type:'feat',system:{publication:{title:'Gunbreaker 1.4.0'},traits:{value:['gunbreaker','magical']}},getRollOptions:()=>['item:type:feat']});
 const actor={uuid:'Actor.hero',items:[itemFor(slug),...learned.map(itemFor)],hasCondition:()=>false,getReach:()=>h.reach??5,isEnemyOf:a=>a.uuid.startsWith('Actor.enemy'),alliance:'party',synthetics:{},
  getStatistic:slug=>{assert.equal(slug,'gunbreaker');return {dc:{value:22}};},getSelfRollOptions:()=>['self:trait:human'],getRollOptions:()=>[],
  getFlag:(_m,k)=>flags[k],setFlag:async(_m,k,v)=>{flags[k]=structuredClone(v);}};
 flags.tracker={...transition(initialState(),{type:'start'},c,catalogue),cartridges:3,calibration};
 function token(id,a,distance=5){const d={uuid:`Scene.scene.Token.${id}`,x:0,y:0,elevation:0,width:1,height:1,parent:{id:'scene'},actor:a};const t={document:d,actor:a,name:id,distance,distanceTo:other=>id==='self'?other.distance:other.adjacentDistance??other.distance,mechanicalBounds:{x:0,y:0,width:100,height:100}};d.testInsideRegion=()=>t.inLine!==false;d.object=t;documents.set(d.uuid,d);return t;}
 const self=token('self',actor),targets=degrees.map((degree,i)=>{
  const enemy={uuid:`Actor.enemy${i}`,alliance:'opposition',isDead:false,getSelfRollOptions:p=>[`${p??'self'}:trait:humanoid`]};
  const t=token(`enemy${i}`,enemy,distances[i]??5);
  enemy.saves={reflex:{check:{roll:async args=>{
   saveArgs.push(args);h.onSave?.(i);const roll={degreeOfSuccess:degree,toJSON:()=>({degree,total:degree===1?20:10})};
   const m=await ChatMessage.create({isCheckRoll:true,actor:enemy,rolls:[roll],flags:{pf2e:{context:{type:'saving-throw'}}}});args.callback(roll,null,m);return roll;
  }}}};
  enemy.getContextualClone=()=>({getSelfRollOptions:()=>['self:trait:humanoid'],applyDamage:async params=>{
   assert.equal(params.skipIWR,false);assert(params.rollOptions.has('origin:action:trait:magical'));assert.equal(params.rollOptions.has('area-damage'),!['danger-zone','reign-of-beasts','noble-blood','lion-heart'].includes(slug));assert.equal(params.damage.options.degreeOfSuccess,null);assert(!params.rollOptions.has('check:outcome:critical-success'));
   applied.push({target:t.document.uuid,total:params.damage.total,instances:structuredClone(params.damage.instances)});
   if(killOnApply)enemy.isDead=true;h.onApply?.(i);
  }});
  return t;
 });
 globalThis.game={user,users,combat:{turns:[{actor}]},pf2e:{settings:{iwr:true}},messages,settings:{get:()=> 'public'}};
 globalThis.canvas={ready:true,scene:{id:'scene'},level:null,grid:{isSquare:true,size:100},dimensions:{size:100,distance:5},tokens:{placeables:[self,...targets]},regions:{placeRegion:async data=>{
  h.placements++;if(h.placementWait)await h.placementWait;if(h.cancelPlacement)return null;
  const region={uuid:'Scene.scene.Region.line',parent:{id:'scene'},...structuredClone(data),elevation:{bottom:null,top:null},
    getCoverage:()=>({covered:h.covered,blocked:[]}),clearCoverage:()=>{},delete:async()=>{h.deleted++;documents.delete(region.uuid);}};
  h.region=region;documents.set(region.uuid,region);h.onPlace?.(region);return region;
 }}};
 globalThis.CONST={DOCUMENT_OWNERSHIP_LEVELS:{OWNER:3},REGION_VISIBILITY:{ALWAYS:2}};
 globalThis.ui={notifications:{info:()=>{},warn:()=>{}}};
 globalThis.fromUuid=async uuid=>documents.get(uuid);
 globalThis.ChatMessage={getSpeaker:()=>({actor:'hero'}),create:async data=>{
  const m={id:`message${++seq}`,author:user,...data,getFlag(_m,k){return this.flags?.[_m]?.[k];},async setFlag(_m,k,v){this.flags??={};this.flags[_m]??={};this.flags[_m][k]=structuredClone(v);}};
  messages.set(m.id,m);return m;
 }};
 class Pool{constructor(instances){this.rolls=instances;}static fromRolls(instances){return new this(instances);}}
 class DamageRoll{
  constructor(formula,_data={},options={}){this.formula=formula;this.options=options;this.instances=[{formula,total:formula.includes('persistent')?0:21,persistent:formula.includes('persistent'),options:{...options}}];this.terms=[new Pool(this.instances)];}
  get total(){return this.instances.reduce((n,i)=>n+i.total,0);}
  async evaluate(){rolls.push(this.formula);return this;}
  toJSON(){return {formula:this.formula,instances:this.instances,options:this.options};}
  async toMessage(data){return ChatMessage.create({...data,isDamageRoll:true,rolls:[this]});}
  static fromJSON(text){const d=JSON.parse(text),r=new this(d.formula);r.instances=d.instances;r.options=d.options;r.terms=[new Pool(r.instances)];return r;}
  static fromTerms(terms){const r=new this('combined');r.terms=terms;r.instances=terms[0].rolls;return r;}
  alter(n){this.instances=this.instances.map(i=>({...i,total:i.total*n,formula:`${n} * (${i.formula})`}));this.options.degreeOfSuccess=3;return this;}
 }
 globalThis.CONFIG={Dice:{rolls:[DamageRoll]}};
 globalThis.foundry={utils:{escapeHTML:s=>s,deepClone:structuredClone},applications:{api:{DialogV2:{wait:async options=>{
  dialogs.push(options);
  if(options.window.title==='Reign secondary enemies'){h.onSecondary?.();return options.buttons[0].callback(null,{form:{querySelectorAll:()=> (h.secondarySelection??[]).map(value=>({value}))}});}
  if(options.window.title.includes('Confirm area')){
   if(h.cancelConfirm)return null;h.onConfirm?.();
   const values=[...options.content.matchAll(/name="target" value="([^"]+)"/g)].map(m=>({value:m[1]}));
   return (await options.buttons[0].callback(null,{form:{elements:{verified:{checked:!h.unverifiedArea}},querySelectorAll:()=>values}}))??options.buttons[0].action;
  }
  const elements={verified:{checked:true}};
  for(const match of options.content.matchAll(/<select name="(scale\d+)">([\s\S]*?)<\/select>/g)){
   elements[match[1]]={value:match[2].match(/value="([^"]+)" selected/)[1]};
  }
  for(const match of options.content.matchAll(/name="(persistent\d+)" checked/g))elements[match[1]]={checked:true};
  h.review?.(elements);
  return (await options.buttons[0].callback(null,{form:{elements}}))??options.buttons[0].action;
 }}}}};
 const deps={authority:()=>{},contextFor:()=>structuredClone(c),actorToken:()=>self,weaponFor:()=>({id:'blade'})};
 const runner=createAreaRunner(deps,new ActorQueue());
 const h={deps,actor,self,flags,c,targets,messages,applied,saveArgs,rolls,dialogs,DamageRoll,runner,placements:0,deleted:0,covered:[{i:0,j:1}],req:{id:'request',slug,weaponId:'blade'}};
 return h;
}
