import {initialState,normalizeState,capacity,transition} from './state.mjs';
import {catalogue,sourceIds} from './catalogue.mjs';
const MOD='gunbreaker-pf2e',openActors=new Set(),queues=new Map();
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug=item=>sourceIds[item.sourceId ?? item.flags?.core?.sourceId] ?? item.slug ?? item.system?.slug;
function registerTraits(){
  const cfg=CONFIG.PF2E;if(!cfg)return;
  for(const key of ['classTraits','featTraits','actionTraits','weaponTraits','creatureTraits','effectTraits'])if(cfg[key])cfg[key].gunbreaker='GUNBREAKER.TraitGunbreaker';
  if(cfg.baseWeaponTypes)cfg.baseWeaponTypes.gunblade='Gunblade';
}
Hooks.once('init',registerTraits);Hooks.once('setup',registerTraits);
export function contextFor(actor){
  const combat=game.combat?.started?game.combat:null;
  const index=combat?.turns.findIndex(c=>c.actor?.uuid===actor.uuid)??-1;
  const active=combat && index>=0;
  return {time:game.time.worldTime,level:actor.level??actor.system.details.level.value,
    learned:actor.items.filter(i=>i.type==='feat'||i.type==='action').map(slug),
    encounterId:active?combat.id:null,round:active?combat.round:0,
    turn:active?combat.round-(combat.turn<index?1:0):0,inTurn:!!active&&combat.turn===index,
    targetIds:[...(game.user.targets??[])].map(t=>t.document.uuid),
    selfTargetIds:[...(game.user.targets??[])].filter(t=>t.actor?.uuid===actor.uuid).map(t=>t.document.uuid),
    wielding:actor.itemTypes.weapon.some(w=>w.system.traits.value.includes('gunbreaker') && w.system.equipped.carryType==='held' && w.system.equipped.handsHeld>0)};
}
function permitted(actor){
  if(!actor || actor.type!=='character' || !actor.isOwner)throw Error('Select one character you own.');
  if(!actor.items.some(i=>i.type==='class' && (i.slug==='gunbreaker'||i.name==='Gunbreaker')))throw Error('This character needs the Gunbreaker class.');
}
function queue(actor,fn){
  const task=(queues.get(actor.uuid)??Promise.resolve()).catch(()=>{}).then(fn);queues.set(actor.uuid,task);
  return task.finally(()=>{if(queues.get(actor.uuid)===task)queues.delete(actor.uuid);});
}
/** Commit the entire transition in one flag update. Use one operator per character. */
export async function record(actor,op,expected){
  permitted(actor);
  return queue(actor,async()=>{
    permitted(actor);
    const raw=actor.getFlag(MOD,'tracker')??initialState();
    if(expected!==undefined && raw.revision!==expected)throw Error('Tracker changed while open. Refreshed; record the action again.');
    const next=transition(raw,op,contextFor(actor),catalogue);
    await actor.setFlag(MOD,'tracker',next);return next;
  });
}
export async function tracker(explicitActor){
  const selected=canvas.tokens?.controlled??[];
  if(!explicitActor && selected.length>1)return ui.notifications.warn('Select only one Gunbreaker token.');
  const actor=explicitActor??selected[0]?.actor??game.user.character;
  try{permitted(actor);}catch(e){return ui.notifications.warn(e.message);}
  if(openActors.has(actor.uuid))return ui.notifications.info('This character’s tracker is already open.');
  openActors.add(actor.uuid);
  try{
    while(actor.isOwner){
      const raw=actor.getFlag(MOD,'tracker')??initialState(),context=contextFor(actor),state=normalizeState(raw,context);
      const learned=new Set(context.learned),label=s=>catalogue[s]?.name??s;
      const options=Object.entries(catalogue).filter(([s,v])=>learned.has(s)&&v.level<=context.level&&['action','reaction','free'].includes(v.actionType)&&s!=='twin-cartridge');
      const checks=[['enhance','Spend a cartridge to enhance Heart of Stone'],['self','Heart of Stone targets me (Aetheric Ward)'],['expertise','Use Cartridge Expertise on this finisher'],['twin','Use Twin Cartridge on this finisher'],['discipline','Use Powder Discipline on this critical hit'],['cadence','Use Executioner’s Cadence'],['perfect','Use this round’s Perfect Chamber discount']];
      const content=`<div class="gunbreaker-tracker"><p><strong>${escape(actor.name)}</strong> · Cartridges <strong>${state.cartridges}/${capacity(state,context)}</strong></p>
        <p>Combo: ${escape(state.combo?label(state.combo.next):'none')} · Continuation: ${escape(state.continuation?label(state.continuation.slug):'none')}</p>
        <p>Ready to Break: ${state.breakUntil>context.time?'yes':'no'} · Ready to Reign: ${state.reignUntil>context.time?'yes':'no'}</p>
        <label>Action <select name="action">${options.map(([s,v])=>`<option value="${s}">${escape(v.name)}</option>`).join('')}</select></label>
        <label>Resolved outcome <select name="outcome"><option value="">Choose when required</option><option value="miss">Strike missed</option><option value="hit">Strike hit</option><option value="critical">Strike critically hit</option><option value="none">No Fated Circle target failed</option><option value="failed">Fated Circle: selected enemies failed</option><option value="critical-failure">Double Down: an enemy critically failed</option></select></label>
        <fieldset><legend>Fated Circle failed-save targets</legend>${[...(game.user.targets??[])].map(t=>`<label><input type="checkbox" name="failed-target" value="${escape(t.document.uuid)}"> ${escape(t.name)}</label>`).join('')||'Target tokens before opening the tracker.'}</fieldset>
        <details><summary>Optional cartridge features</summary>${checks.map(([key,text])=>`<label><input type="checkbox" name="${key}"> ${escape(text)}</label>`).join('')}</details>
        <p class="note">Resolve rolls first, then record once. Costs are still owed on a miss. Select the primary Strike target or the protected Heart of Stone target. Check range, action availability, saves, genuine threats, HP, and reaction limits with the GM. Apply damage, healing, and linked effects manually.</p>
        <p class="note">Record other actions to close unused Continuation. Initializing an encounter does not refresh cooldowns. Use one tracker operator per character.</p></div>`;
      const button=(action,label,op)=>({action,label,callback:()=>op});
      const op=await foundry.applications.api.DialogV2.wait({window:{title:'Gunbreaker — Powder Gauge'},classes:['gunbreaker-dialog'],position:{width:620},rejectClose:false,content,buttons:[
        {action:'record',label:'Record resolved action',callback:(_e,b)=>({type:'use',slug:b.form.elements.action.value,outcome:b.form.elements.outcome.value,
          failedTargetIds:[...b.form.querySelectorAll('input[name="failed-target"]:checked')].map(e=>e.value),
          ...Object.fromEntries(checks.map(([key])=>[key,b.form.elements[key].checked]))})},
        button('other','Record other action',{type:'other'}),button('start','Initialize encounter',{type:'start'}),
        button('end','Clear ended encounter',{type:'end'}),button('plus','Correct gauge +1',{type:'adjust',delta:1}),
        button('minus','Correct gauge −1',{type:'adjust',delta:-1}),button('daily','Daily preparations',{type:'daily'}),button('close','Close',null)
      ]});
      if(!op || typeof op!=='object')break;
      try{
        if(op.type==='daily' && !await foundry.applications.api.DialogV2.confirm({window:{title:'Daily preparations'},content:'<p>Have you completed daily preparations? This refreshes daily and timed uses and clears encounter resources.</p>',rejectClose:false}))continue;
        await record(actor,op,raw.revision);
      }catch(e){ui.notifications.warn(e.message);}
    }
  }finally{openActors.delete(actor.uuid);}
}
Hooks.once('ready',()=>{
  if(game.system.id!=='pf2e')return;
  game.modules.get(MOD).api={tracker,record,adjustCartridges:(actor,delta)=>record(actor,{type:'adjust',delta}),getState:actor=>normalizeState(actor.getFlag(MOD,'tracker'),contextFor(actor))};
});
// A chat rules card never executes a tracker transition.
