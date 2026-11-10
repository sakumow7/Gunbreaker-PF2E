import {controlsModel,controlRequest,RESOURCE_LABELS} from './player-controls.mjs';
import {outsideActivityRequest} from './outside-controls.mjs';
const MOD='gunbreaker-pf2e',open=new Set();
const esc=s=>foundry.utils.escapeHTML(String(s));
const held=w=>w.type==='weapon'&&w.system.traits.value.includes('gunbreaker')&&w.system.equipped.carryType==='held'&&w.system.equipped.handsHeld>0;
const busy=actor=>['reserved','committed','recovery'].includes(actor.getFlag(MOD,'execution')?.status)||['prompting','planning','applying','recovery'].includes(actor.getFlag(MOD,'followup')?.status);

export function panelContent(actor,model,weapons,group){
  const unavailable=model.rows.filter(r=>r.reason);
  return `<div class="gunbreaker-controls"><p class="gb-gauge"><strong>${esc(actor.name)} · ${model.state.cartridges} / ${model.capacity} cartridges</strong></p>
    <dl><dt>Next combo</dt><dd>${esc(model.combo)}</dd><dt>Continuation</dt><dd>${esc(model.continuation)}</dd><dt>Reaction tracker</dt><dd>${esc(model.reaction)}</dd></dl>
    <p><strong>${{strikes:'Strikes',powers:'Powers',area:'Area abilities',support:'Protection & movement'}[group]}</strong> · Select your target, then choose an ability. Range and targets are checked on use. Choose the attack stage for each Strike.</p>
    ${weapons.length===1?`<input type="hidden" name="weapon" value="${esc(weapons[0].id)}"><p>Gunblade: ${esc(weapons[0].name)}</p>`:`<label>Gunblade<select name="weapon">${weapons.map(w=>`<option value="${esc(w.id)}">${esc(w.name)}</option>`).join('')}</select></label>`}
    <label>Attack stage (Strikes only)<select name="map"><option value="0">First attack</option><option value="1">Second attack</option><option value="2">Third or later attack</option></select></label>
    ${unavailable.length?`<details><summary>Unavailable abilities (${unavailable.length})</summary><ul>${unavailable.map(r=>`<li><strong>${esc(r.name)}:</strong> ${esc(r.reason)}</li>`).join('')}</ul></details>`:''}
    <details><summary>Play notes</summary><p>Continuation uses its original target. Optional resources are offered only when relevant. Damage cards and GM confirmations remain part of this beta. Refresh after outside changes; changed tracker or combat state rejects a stale action.</p><p>After completing an action or regular reaction outside this panel, use Record outside activity. Other actions close Continuation; regular reactions mark it spent without closing a current opening. Do not record an activity already handled by this panel.</p></details></div>`;
}

async function resourcesFor(row){
  if(!row.resources.length)return {};
  return foundry.applications.api.DialogV2.wait({window:{title:row.name},rejectClose:false,
    content:`<p>Optional resources${row.needsPerfect?' — this action needs the Perfect Chamber discount':''}. Nothing is spent until execution.</p>${row.resources.map(key=>`<label class="gb-resource"><input type="checkbox" name="${key}"> ${esc(RESOURCE_LABELS[key])}</label>`).join('')}`,
    buttons:[{action:'use',label:'Use ability',callback:(_e,b)=>Object.fromEntries(row.resources.filter(key=>b.form.elements[key].checked).map(key=>[key,true]))},{action:'cancel',label:'Cancel',callback:()=>false}]});
}

export async function nativePanel(actor,runner,contextFor){
  if(!actor?.isOwner||actor.type!=='character')throw Error('Select an owned character.');
  if(!game.user.isGM&&!game.settings.get(MOD,'playerRequests'))throw Error('The GM has not enabled experimental player requests.');
  if(open.has(actor.uuid))return ui.notifications.info('This character’s action panel is already open.');
  open.add(actor.uuid);
  let group='strikes',lastResult;
  try{
    while(actor.isOwner){
      const c=contextFor(actor),raw=actor.getFlag(MOD,'tracker');
      const model=controlsModel(raw,c,{busy:busy(actor)}),weapons=actor.itemTypes.weapon.filter(held);
      const expected={revision:raw?.revision??0,encounterId:c.encounterId,round:c.round,turn:c.turn};
      const rows=model.rows.filter(r=>r.group===group||r.continuation).sort((a,b)=>Number(b.continuation)-Number(a.continuation));
      const choice=await foundry.applications.api.DialogV2.wait({window:{title:'Gunbreaker — Actions'},classes:['gunbreaker-controls-dialog'],position:{width:520},rejectClose:false,
        content:panelContent(actor,model,weapons,group),buttons:[
          ...rows.map(row=>({action:row.slug,label:`${row.continuation?'Continuation: ':''}${row.name} · ${row.cost}${row.needsPerfect?' *':''}`,disabled:!!row.reason,tooltip:`${row.name}: ${row.reason??(row.needsPerfect?'Requires your Perfect Chamber choice.':'Use this ability')}`,
            callback:(_e,b)=>({row,request:controlRequest(row.slug,{state:model.state,context:contextFor(actor),expected,weaponId:b.form.elements.weapon.value,map:Number(b.form.elements.map.value),id:foundry.utils.randomID()})})})),
          ...['strikes','powers','area','support'].filter(g=>g!==group).map(g=>({action:g,label:{strikes:'Strikes',powers:'Powers',area:'Area abilities',support:'Protection & movement'}[g],callback:()=>({group:g})})),
          {action:'refresh',label:'Refresh',callback:()=>({refresh:true})},
          {action:'outside',label:'Record outside activity',disabled:busy(actor)||!c.encounterId||raw?.encounter!==c.encounterId,callback:()=>({outside:true})},
          ...(game.user.isGM?[{action:'tools',label:'GM tools',callback:()=>({tools:true})}]:[]),
          {action:'close',label:'Close',callback:()=>false}
        ]});
      if(!choice||typeof choice!=='object')break;
      if(choice.group){group=choice.group;continue;}
      if(choice.refresh)continue;
      try{
        if(choice.outside){
          const slug=await foundry.applications.api.DialogV2.wait({window:{title:'Record a completed outside activity'},rejectClose:false,
            content:'<p>Use this only after resolving an activity outside the Gunbreaker panel. It updates the tracker; it does not roll, move, apply damage or spend Foundry actions.</p><p>Another action closes unused Continuation. A regular reaction marks that reaction spent and preserves a current Continuation. Do not record a subordinate check, an already recorded activity, or an extra reaction granted by another feature.</p>',
            buttons:[{action:'record-other-action',label:'Used another action',disabled:!c.inTurn,callback:()=> 'record-other-action'},
              {action:'record-other-reaction',label:'Used my regular reaction',disabled:model.state.lastReactionTurn===c.turn,callback:()=> 'record-other-reaction'},
              {action:'cancel',label:'Cancel',callback:()=>false}]});
          if(!slug)continue;
          lastResult=await runner.execute(actor,outsideActivityRequest(slug,foundry.utils.randomID(),expected));
          continue;
        }
        if(choice.tools){
          const action=await foundry.applications.api.DialogV2.wait({window:{title:'Gunbreaker — GM tools'},rejectClose:false,content:'<p>Review recovery or character setup.</p>',buttons:[['recover','Recovery'],['migrate','Migration'],['rollback','Rollback migration'],['escort','Escort setup']].map(([action,label])=>({action,label,callback:()=>action}))});
          if(['recover','migrate','rollback','escort'].includes(action))await game.modules.get(MOD).api.maintenance[action](actor);
          continue;
        }
        const options=await resourcesFor(choice.row);
        if(!options||typeof options!=='object')continue;
        // Keep the panel-opening checkpoint through optional dialogs. A changed turn or revision must fail closed.
        lastResult=await runner.execute(actor,{...choice.request,options});
        if(lastResult?.status==='recovery')ui.notifications.warn('The GM must reconcile this action before continuing.');
      }catch(e){ui.notifications.error(e.message);}
    }
    return lastResult;
  }finally{open.delete(actor.uuid);}
}

/** PF2e 8.7 character sheets use the v1 ActorSheet header-button hook. */
export function installPanelButton(openPanel){
  Hooks.on('getActorSheetHeaderButtons',(sheet,buttons)=>{
    const actor=sheet.actor;
    if(!actor?.isOwner||actor.type!=='character'||!actor.items.some(i=>i.type==='class'&&(i.slug==='gunbreaker'||i.name==='Gunbreaker')))return;
    if(!game.user.isGM&&!game.settings.get(MOD,'playerRequests'))return;
    if(buttons.some(b=>b.class==='gunbreaker-actions'))return;
    buttons.unshift({label:'Gunbreaker',class:'gunbreaker-actions',icon:'fas fa-bolt',onclick:()=>openPanel(actor).catch(e=>ui.notifications.error(e.message))});
  });
}
