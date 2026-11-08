import {ActionRunner,CORE_STRIKES,CORE_FOLLOWUPS,SUPPORTED} from './execution.mjs';
import {damageType,followupFormula,superbolideHP,nativeWeaponDice} from './mechanics.mjs';
import {sourceIds,catalogue} from './catalogue.mjs';
import {assertFreshIntent} from './requests.mjs';
const MOD='gunbreaker-pf2e';
const slug=i=>i.slug??i.system?.slug;
const effectUuid=name=>Object.entries(sourceIds).find(([id,s])=>s===name&&id.includes('gunbreaker-effects'))?.[0];
const isHeld=w=>w.type==='weapon'&&w.system.traits.value.includes('gunbreaker')&&w.system.equipped.carryType==='held'&&w.system.equipped.handsHeld>0;
const esc=s=>foundry.utils.escapeHTML(String(s));
export function activeGM(){return game.users.filter(u=>u.active&&u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0];}
export function authority(actor,req){
  if(!game.user.isGM || activeGM()?.id!==game.user.id)throw Error('Native execution requires the active GM coordinator.');
  if(actor.type!=='character'||!actor.isOwner)throw Error('Select an owned character.');
  if(game.settings.get(MOD,'playerRequests')&&game.users.filter(u=>u.active&&u.isGM).length!==1)throw Error('Experimental player routing requires exactly one active GM.');
  if(req?.requesterId){
    const user=game.users.get(req.requesterId);
    if(!game.settings.get(MOD,'playerRequests')||req.intent.gmId!==game.user.id||!user?.active||!actor.testUserPermission(user,'OWNER'))throw Error('Player action permission changed; submit a new request.');
    if(canvas.scene?.id!==req.intent.sceneId)throw Error('The GM coordinator must view the same scene before this action can run.');
  }
}
function actorToken(actor){
  const tokens=actor.getActiveTokens();
  if(tokens.length!==1)throw Error('Native execution needs exactly one active token for this actor.');
  return tokens[0];
}
async function target(context){
  const doc=await fromUuid(context.targetIds?.[0]??'');
  if(!doc?.object?.actor)throw Error('The target is no longer on the scene.');return doc.object;
}
function weaponFor(actor,id){
  const weapons=actor.itemTypes.weapon.filter(isHeld);
  const weapon=id?weapons.find(w=>w.id===id):weapons.length===1?weapons[0]:null;
  if(!weapon)throw Error('Choose exactly one held gunblade.');return weapon;
}
function strikeFor(actor,weaponId){
  const strike=actor.system.actions.find(s=>s.item.id===weaponId);
  if(!strike)throw Error('PF2e has no native Strike for this weapon.');return strike;
}
async function applyEffect(actor,name,requestId){
  const uuid=effectUuid(name);if(!uuid)throw Error(`Missing effect ${name}.`);
  const effect=await fromUuid(uuid);if(!effect)throw Error(`Cannot load effect ${name}.`);
  const data=effect.toObject();delete data._id;
  data.flags??={};data.flags[MOD]={execution:requestId};
  data.system.start={value:game.time.worldTime,initiative:actor.combatant?.initiative??null};
  await actor.createEmbeddedDocuments('Item',[data]);
}
export function createNativeRunner(contextFor,queue){
  return new ActionRunner({
    authorize:async(actor,req)=>authority(actor,req),
    preflight:async(actor,req,c,state)=>{if(req.intent||req.expected)assertFreshIntent(req.intent??req.expected,c,state);},
    context:async(actor,req)=>{
      const c=contextFor(actor),w=weaponFor(actor,req.weaponId);
      if(req.targetIds)c.targetIds=[...req.targetIds];
      const old=actor.getFlag(MOD,'tracker');
      if(CORE_FOLLOWUPS.has(req.slug))c.targetIds=[...(old?.continuation?.targets??[])];
      return {...c,weaponDice:nativeWeaponDice(w),weaponId:w.id,map:req.map??0};
    },
    read:actor=>actor.getFlag(MOD,'tracker'),write:(actor,state)=>{authority(actor);return actor.setFlag(MOD,'tracker',state);},
    journal:actor=>actor.getFlag(MOD,'execution'),saveJournal:(actor,entry)=>{authority(actor);return actor.setFlag(MOD,'execution',entry);},
    validate:async(actor,req,c,state)=>{
      if(actor.hasCondition('unconscious')||actor.hasCondition('paralyzed'))throw Error('This character cannot act.');
      const matches=game.combat?.turns.filter(t=>t.actor?.uuid===actor.uuid)??[];
      if(matches.length>1)throw Error('Multiple combatants share this actor; native execution is blocked.');
      if(!Number.isInteger(c.map)||c.map<0||c.map>2)throw Error('Choose a valid MAP stage.');
      const item=actor.items.find(i=>slug(i)===req.slug);
      if(!item?.system.publication?.title?.includes('1.4.0'))throw Error('Update this action from the v1.4 compendium before native execution.');
      if(req.slug==='superbolide')superbolideHP(actor.system.attributes.hp.value,actor.level);
      if(req.slug==='royal-guard'&&actor.itemTypes.effect.some(i=>slug(i)==='royal-guard-stance'))throw Error('Royal Guard is already active.');
      if(CORE_STRIKES.has(req.slug)||CORE_FOLLOWUPS.has(req.slug)){
        if(c.targetIds.length!==1)throw Error('Select one enemy target.');
        const t=await target(c),self=actorToken(actor),w=weaponFor(actor,c.weaponId);
        if(t.document.parent?.id!==self.document.parent?.id)throw Error('The target must be on the character’s scene.');
        if(!actor.isEnemyOf(t.actor))throw Error('Select a genuine enemy; the GM must adjudicate unusual allegiances.');
        if(self.distanceTo(t)>actor.getReach({action:'attack',weapon:w}))throw Error('Target is outside melee reach.');
        if(!t.isVisible||(req.requesterId&&!game.users.get(req.requesterId)?.isGM&&t.document.hidden))throw Error('Target visibility requires GM adjudication.');
        if(CORE_FOLLOWUPS.has(req.slug)&&state.continuation?.weaponId!==w.id)throw Error('Use the opening gunblade for this follow-up.');
      }
    },
    attack:async(actor,req,c)=>{
      if(req.intent||req.expected)assertFreshIntent(req.intent??req.expected,contextFor(actor),actor.getFlag(MOD,'tracker'));
      const w=weaponFor(actor,c.weaponId),strike=strikeFor(actor,w.id),t=await target(c);
      const calibration=actor.getFlag(MOD,'tracker')?.calibration??'fire';
      let messageId=null;
      const roll=await strike.variants[c.map].roll({target:t,options:[`gunbreaker:action:${req.slug}`,`gunbreaker:calibration:${calibration}`],callback:(_roll,_outcome,message)=>{messageId=message?.id??null;}});
      if(!roll)return null;
      return {degree:roll.degreeOfSuccess,weaponDice:nativeWeaponDice(w),weaponId:w.id,messageId};
    },
    resolve:async(actor,req,c,before,after,result)=>{
      authority(actor,req);
      if(CORE_STRIKES.has(req.slug)){
        if(result.degree<2)return;
        // Native damage includes critical doubling, property runes and action-predicated DamageDice.
        const strike=strikeFor(actor,c.weaponId),t=await target(c);
        const message=game.messages.get(result.messageId);
        await strike[result.degree===3?'critical':'damage']({target:t,mapIncreases:c.map,checkContext:message?.flags?.pf2e?.context,
          options:new Set([`gunbreaker:action:${req.slug}`,`gunbreaker:calibration:${after.calibration}`])});
        if(req.slug==='brutal-shell' && before.once.brutalRound!==c.round){
          // Store the rider gate before HP/effect writes; a recovery must never re-award it.
          after.once.brutalRound=c.round;await actor.setFlag(MOD,'tracker',after);
          const value=Math.max(1,Math.floor(actor.level/2));
          await actor.applyDamage({damage:-value,token:actorToken(actor).document});
          await actor.createEmbeddedDocuments('Item',[{name:'Brutal Shell Barrier',type:'effect',img:'icons/magic/defensive/shield-barrier-glowing-blue.webp',system:{slug:'gunbreaker-brutal-shell-barrier',level:{value:actor.level},duration:{value:1,unit:'rounds',expiry:'turn-end',sustained:false},start:{value:game.time.worldTime,initiative:actor.combatant?.initiative??null},rules:[{key:'TempHP',value}]},flags:{[MOD]:{execution:req.id}}}]);
        }
      }else if(CORE_FOLLOWUPS.has(req.slug)){
        const DamageRoll=CONFIG.Dice.rolls.find(r=>r.name==='DamageRoll');
        if(!DamageRoll)throw Error('PF2e DamageRoll is unavailable.');
        const formula=followupFormula(actor.level,before.continuation.weaponDice,damageType(req.slug,after.calibration));
        const roll=await new DamageRoll(formula).evaluate();
        await roll.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:catalogue[req.slug].name,flags:{[MOD]:{execution:req.id,target:c.targetIds[0]}}});
        // Use native damage controls; do not write unowned HP or bypass native IWR.
      }else if(req.slug==='release-royal-guard'){
        await actor.deleteEmbeddedDocuments('Item',actor.itemTypes.effect.filter(i=>slug(i)==='royal-guard-stance').map(i=>i.id));
      }else if(req.slug==='perfect-chamber'){
        // Resource discount is entirely represented by the committed state.
      }else{
        if(req.slug==='superbolide')await actor.update({'system.attributes.hp.value':superbolideHP(actor.system.attributes.hp.value,actor.level)},{gunbreakerHPCost:true});
        if(req.slug==='royal-guard')await actor.deleteEmbeddedDocuments('Item',actor.itemTypes.effect.filter(i=>i.system.traits.value.includes('stance')).map(i=>i.id));
        const name=req.slug==='royal-guard'?'royal-guard-stance':req.slug==='nebula'&&c.learned.includes('great-nebula')?'great-nebula':req.slug;
        await applyEffect(actor,name,req.id);
      }
    }
  },queue);
}
export async function nativePanel(actor,runner,contextFor){
  if(!actor?.isOwner||actor.type!=='character')throw Error('Select an owned character.');
  if(!game.user.isGM&&!game.settings.get(MOD,'playerRequests'))throw Error('The GM has not enabled experimental player requests.');
  const c=contextFor(actor),state=actor.getFlag(MOD,'tracker');
  const expected={revision:state?.revision??0,encounterId:c.encounterId,round:c.round,turn:c.turn};
  const choices=[...SUPPORTED].filter(s=>c.learned.includes(s)&&catalogue[s].level<=c.level);
  const weapons=actor.itemTypes.weapon.filter(isHeld);
  const content=`<p>Native execution beta · Cartridges ${state?.cartridges??0}. Costs and combo outcomes update automatically. Native damage controls remain available.</p><label>Ability<select name="ability">${choices.map(s=>`<option value="${s}">${esc(catalogue[s].name)}</option>`).join('')}</select></label><label>Gunblade<select name="weapon">${weapons.map(w=>`<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select></label><label>Attack stage<select name="map"><option value="0">First attack</option><option value="1">Second attack</option><option value="2">Third or later attack</option></select></label><p>Player requests go to the GM coordinator. Check action availability and terrain. Party protection, area saves and movement are still pending.</p>`;
  const req=await foundry.applications.api.DialogV2.wait({window:{title:'Gunbreaker — Native Actions Beta'},content,rejectClose:false,buttons:[{action:'execute',label:'Use ability',callback:(_event,b)=>({id:foundry.utils.randomID(),slug:b.form.elements.ability.value,weaponId:b.form.elements.weapon.value,map:Number(b.form.elements.map.value)})}]});
  if(!req||typeof req!=='object')return;
  // Snapshot when the panel opens: a stale selection must not spend changed resources.
  req.targetIds=[...c.targetIds];
  req.expected=expected;
  try{return await runner.execute(actor,req);}catch(e){ui.notifications.error(e.message);}
}
