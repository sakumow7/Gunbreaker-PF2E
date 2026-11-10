import {writeTracker} from './tracker-storage.mjs';
import {nativeDamageContext} from './native-damage.mjs';
import {assertFreshIntent} from './requests.mjs';
import {calibratedItem,damageType} from './mechanics.mjs';
const MOD='gunbreaker-pf2e';
const position=t=>JSON.stringify([t.document.parent.id,t.document.x,t.document.y,t.document.elevation,t.document.width,t.document.height]);
const coordinator=()=>{if(!game.user.isGM||game.users.filter(u=>u.active&&u.isGM).length!==1)throw Error('Riders require exactly one active GM.');};
export function tempHPEffect(name,source,c,value,id,expiry='turn-start'){
 return {name,type:'effect',img:'icons/magic/defensive/shield-barrier-glowing-blue.webp',system:{slug:`gunbreaker-${name.toLowerCase().replaceAll(' ','-')}`,level:{value:c.level},duration:{value:1,unit:'rounds',expiry,sustained:false},start:{value:c.time,initiative:source.combatant?.initiative??null},context:{origin:{actor:source.uuid,token:null,item:null,rollOptions:[]},target:null,roll:null},rules:[{key:'TempHP',value}]},flags:{[MOD]:{execution:id}}};
}
export async function vortexGuard(actor,request,c,state,self,deps={}){
 if(!c.learned.includes('vortex-guard')||state.once.vortexRound===c.round)return;
 const allies=canvas.tokens.placeables.filter(t=>t.actor&&t.actor.uuid!==actor.uuid&&actor.isAllyOf(t.actor)&&!t.actor.isDead&&!t.document.hidden&&t.isVisible!==false&&self.distanceTo(t)<=5);
 if(!allies.length)return;
 const origin=position(self),checkpoint={revision:state.revision,encounterId:c.encounterId,round:c.round,turn:c.turn};
 let selected;
 if(request.requesterId){
  if(!deps.ownerChoices)throw Error('Owner rider choices are unavailable; reconcile the parent action.');
  const options=allies.map((t,i)=>({id:`ally${i}`,label:`Protect ${t.name}`,target:t.document.uuid}));
  const id=await deps.ownerChoices.ask(actor,request,{title:'Vortex Guard',text:'Grant the Brutal Shell barrier to one adjacent ally? Skip preserves this round’s Vortex Guard use.',choices:options.map(({id,label})=>({id,label}))});
  if(id!==null&&!options.some(o=>o.id===id))throw Error('Invalid owner rider choice.');
  selected=options.find(o=>o.id===id)?.target??null;
 }else selected=await foundry.applications.api.DialogV2.wait({window:{title:'Vortex Guard'},content:'<p>Grant the Brutal Shell barrier to one adjacent ally?</p>',rejectClose:false,buttons:[...allies.map(t=>({action:t.id??t.document.id,label:t.name,callback:()=>t.document.uuid})),{action:'skip',label:'Skip',callback:()=>false}]});
 if(deps.contextFor){
  const now=deps.contextFor(actor);assertFreshIntent(checkpoint,now,actor.getFlag(MOD,'tracker'));
  if(!now.learned.includes('vortex-guard')||now.level!==c.level||!now.inTurn||!now.wielding)throw Error('Vortex Guard source eligibility changed.');
 }
 if(!selected)return;
 if(actor.isDead||['unconscious','paralyzed','stunned'].some(s=>actor.hasCondition(s)))throw Error('The source can no longer use Vortex Guard.');
 coordinator();if(origin!==position(self))throw Error('Vortex Guard source moved.');
 const target=allies.find(t=>t.document.uuid===selected);
 if(!target||target.actor.isDead||target.document.hidden||target.isVisible===false||!request.lockedActors?.includes(target.actor.uuid)||!actor.isAllyOf(target.actor)||self.distanceTo(target)>5)throw Error('Vortex Guard recipient changed.');
 state.once.vortexRound=c.round;await writeTracker(actor,state);
 await target.actor.createEmbeddedDocuments('Item',[tempHPEffect('Vortex Guard',actor,c,Math.max(1,Math.floor(c.level/2)),request.id,'turn-end')]);
}
export async function overpoweredRound(actor,request,c,state,primary,weapon){
 if(!c.learned.includes('overpowered-round'))return;
 const targets=canvas.tokens.placeables.filter(t=>t.actor&&t.actor.uuid!==actor.uuid&&t.actor.uuid!==primary.actor.uuid&&actor.isEnemyOf(t.actor)&&!t.actor.isDead&&primary.distanceTo(t)<=5);
 if(!targets.length)return;
 if(targets.length>50||new Set(targets.map(t=>t.actor.uuid)).size!==targets.length)throw Error('Overpowered Round requires distinct recipient actors.');
 const origin=position(primary),positions=targets.map(position);
 if(targets.some(t=>t.document.hidden||t.isVisible===false))throw Error('Overpowered Round visibility needs adjudication.');
 const yes=await foundry.applications.api.DialogV2.confirm({window:{title:'Overpowered Round'},content:'<p>Apply secondary damage to the other enemies within 5 feet of the primary target? Confirm line of effect and that no other control has applied it.</p>',rejectClose:false});if(!yes)return;coordinator();
 if(position(primary)!==origin||targets.some((t,i)=>position(t)!==positions[i]))throw Error('Overpowered Round positions changed during confirmation.');
 const DamageRoll=CONFIG.Dice.rolls.find(r=>r.name==='DamageRoll'),roll=await new DamageRoll(`${c.weaponDice}[${damageType('overpowered-round',state.calibration)}]`).evaluate();
 const item=calibratedItem(actor.items.find(i=>(i.slug??i.system.slug)==='overpowered-round'),'overpowered-round',state.calibration);
 const options=[...actor.getSelfRollOptions('self'),...item.getRollOptions('item'),...[...new Set([...item.system.traits.value,'magical'])].map(t=>`origin:action:trait:${t}`),'area-damage','origin:action:slug:overpowered-round'];
 await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:'Overpowered Round',flags:{pf2e:{suppressDamageButtons:true},[MOD]:{execution:request.id}}});
 for(const target of targets){
  coordinator();
  if(position(primary)!==origin||position(target)!==positions[targets.indexOf(target)]||!request.lockedActors?.includes(target.actor.uuid)||target.actor.isDead||target.document.hidden||target.isVisible===false||primary.distanceTo(target)>5||!actor.isEnemyOf(target.actor))throw Error('A secondary enemy changed before Overpowered Round.');
  const marker=actor.getFlag(MOD,'execution');await actor.setFlag(MOD,'execution',{...marker,riders:[...(marker.riders??[]),{kind:'overpowered-round',actor:target.actor.uuid,status:'applying'}]});
  const {clone,rollOptions}=await nativeDamageContext(target.actor,{actor,item,flags:{pf2e:{context:{options}}}});
  roll.options.degreeOfSuccess=null;
  await clone.applyDamage({damage:roll,token:target.document,item,rollOptions,skipIWR:false});
  const updated=actor.getFlag(MOD,'execution');updated.riders.at(-1).status='complete';await actor.setFlag(MOD,'execution',updated);
 }
}
