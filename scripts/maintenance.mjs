import {actorBackup,planMigration,rollbackMigration} from './migration.mjs';
const MOD='gunbreaker-pf2e';
const esc=s=>foundry.utils.escapeHTML(String(s));
function gm(actor){if(!game.user.isGM||!actor?.isOwner||game.users.filter(u=>u.active&&u.isGM).length!==1)throw Error('Maintenance requires exactly one active GM and an owned actor.');}
async function backup(actor,purpose){
 const data=actorBackup(actor.toObject());
 const message=await ChatMessage.create({whisper:game.users.filter(u=>u.isGM).map(u=>u.id),content:`<p>Gunbreaker ${esc(purpose)} backup — ${esc(actor.name)}. This private record preserves the pre-change actor.</p>`,flags:{[MOD]:{backup:data,purpose}}});
 if(!message?.id)throw Error('Backup could not be saved.');return message.id;
}
function stoppedForRecovery(actor){if(actor.getActiveTokens?.().some(t=>['planned','pending','paused'].includes(t.document.movement?.state)))throw Error('Stop the pending native movement before accepting recovery.');}
export function createMaintenance(queue){
 return {
  async recover(actor){
   gm(actor);stoppedForRecovery(actor);const marker=structuredClone(actor.getFlag(MOD,'execution')),rush=structuredClone(actor.getFlag(MOD,'rush')),followup=structuredClone(actor.getFlag(MOD,'followup'));
   const effects=actor.items.filter(i=>i.flags?.[MOD]?.support&&(['applying','recovery'].includes(i.flags[MOD].support.status)||['applying','recovery'].includes(i.flags[MOD].support.healing)));
   const effectSnapshot=JSON.stringify(effects.map(e=>[e.id,e.flags[MOD].support]));
   if(!['reserved','committed','recovery'].includes(marker?.status)&&!['arming','resolving','recovery'].includes(rush?.status)&&!effects.length&&!['prompting','planning','applying','recovery'].includes(followup?.status))throw Error('No interrupted automation was found.');
   const decision=await foundry.applications.api.DialogV2.wait({window:{title:'Resolve interrupted Gunbreaker automation'},rejectClose:false,
    content:`<p>${esc(actor.name)} · action ${esc(marker?.slug??'none')} · ${esc(marker?.status??'none')}.</p><p>Inspect native chat, position, HP, effects and the private journal first. Stop any pending native movement before accepting. Accepting preserves current HP, effects and resources, closes interrupted follow-ups, and unlocks future actions. It never replays damage or refunds a cost.</p><label>Reconciliation note<textarea name="note"></textarea></label><label><input type="checkbox" name="verified"> I have reconciled the actual outcome and resource cost.</label>`,
    buttons:[{action:'accept',label:'Accept current outcome',callback:(_e,b)=>b.form.elements.verified.checked?b.form.elements.note.value.trim():false}]});
   if(!decision)return;
   return queue.run(actor,async()=>{
    gm(actor);stoppedForRecovery(actor);if(effectSnapshot!==JSON.stringify(effects.map(e=>[e.id,actor.items.get(e.id)?.flags[MOD]?.support])))throw Error('Support recovery changed; review it again.');if(JSON.stringify(followup)!==JSON.stringify(actor.getFlag(MOD,'followup'))||JSON.stringify(marker)!==JSON.stringify(actor.getFlag(MOD,'execution'))||JSON.stringify(rush)!==JSON.stringify(actor.getFlag(MOD,'rush')))throw Error('The pending record changed; review it again.');
    const backupId=await backup(actor,'recovery');
    if(marker)await actor.setFlag(MOD,'execution',{...marker,status:'complete',reconciliation:{note:decision.slice(0,2000),backupId,time:game.time.worldTime}});
    if(followup&&['prompting','planning','applying','recovery'].includes(followup.status))await actor.setFlag(MOD,'followup',{...followup,status:'reconciled',reconciliation:{note:decision.slice(0,2000),backupId,time:game.time.worldTime}});
    if(rush&&['arming','resolving','recovery'].includes(rush.status))await actor.setFlag(MOD,'rush',{...rush,status:'skipped',reconciliation:backupId});
    for(const effect of effects){const s=effect.flags[MOD].support;await effect.setFlag(MOD,'support',{...s,status:s.kind==='aurora'?'complete':'active',healing:'complete',reconciliation:backupId});}
    return {backupId};
   });
  },
  async migrate(actor){
   gm(actor);const [baseline,revised]=await Promise.all(['baseline-v1.3.json','current-source.json'].map(async name=>{const r=await fetch(`modules/${MOD}/migrations/${name}`);if(!r.ok)throw Error('Migration data unavailable.');return r.json();}));
   const before=actor.toObject();let plan=planMigration(before,baseline,revised);
   const replaceable=plan.decisions.filter(d=>d.choices.includes('Accept Reserved Cartridge'));
   if(replaceable.length){
    const accepted=await foundry.applications.api.DialogV2.wait({window:{title:'Retired Gunbreaker feats'},rejectClose:false,content:`<p>Choose which retired feats to replace with Reserved Cartridge. This replaces that item's rules and description. Unselected feats and other retired feats require retraining first.</p>${replaceable.map(d=>`<label><input type="checkbox" name="reserved" value="${esc(d.itemId)}"> ${esc(d.name)}</label>`).join('')}`,buttons:[{action:'review',label:'Preview choices',callback:(_e,b)=>[...b.form.querySelectorAll('input[name="reserved"]:checked')].map(e=>e.value)}]});
    if(!accepted)return;plan=planMigration(before,baseline,revised,{acceptReserved:accepted});
   }
   if(!plan.ready){
    await foundry.applications.api.DialogV2.wait({window:{title:'Migration needs decisions'},content:`<p>No actor changes were made. Resolve retired-feat choices and custom-field conflicts before applying.</p><pre>${esc(JSON.stringify({decisions:plan.decisions,conflicts:plan.conflicts},null,2))}</pre>`,buttons:[{action:'close',label:'Close'}]});return plan;
   }
   if(!plan.updates.length)return plan;
   const yes=await foundry.applications.api.DialogV2.confirm({window:{title:'Apply reviewed Gunbreaker migration'},content:`<p>Update ${plan.updates.length} matching items on ${esc(actor.name)}? Custom fields have passed conflict checks. A private complete actor backup will be saved first.</p><pre>${esc(JSON.stringify(plan.updates.map(u=>({item:u._id,fields:Object.keys(u).filter(k=>k!=='_id')})),null,2))}</pre>`,rejectClose:false});if(!yes)return plan;
   return queue.run(actor,async()=>{
    gm(actor);if(JSON.stringify(actor.toObject())!==JSON.stringify(before))throw Error('Actor changed after preview. Reopen migration.');
    if(['reserved','committed','recovery'].includes(actor.getFlag(MOD,'execution')?.status))throw Error('Resolve pending automation before migration.');
    const backupId=await backup(actor,'migration');await actor.setFlag(MOD,'migration',{status:'applying',backupId});
    try{await actor.updateEmbeddedDocuments('Item',plan.updates);await game.messages.get(backupId).setFlag(MOD,'migrationUndo',{after:actor.toObject(),changes:plan.updates});await actor.setFlag(MOD,'migration',{status:'complete',backupId});return {...plan,backupId};}
    catch(e){await actor.setFlag(MOD,'migration',{status:'recovery',backupId,error:e.message});throw e;}
   });
  },
  async rollback(actor){
   gm(actor);const marker=actor.getFlag(MOD,'migration');
   if(marker?.status!=='complete')throw Error('Only a completed migration with an intact backup can be rolled back automatically.');
   const message=game.messages.get(marker.backupId),saved=message?.getFlag(MOD,'backup'),undo=message?.getFlag(MOD,'migrationUndo');
   if(!saved?.actor||!undo||saved.actor._id!==actor.id)throw Error('The migration backup is missing or belongs to another actor.');
   const before=actor.toObject(),plan=rollbackMigration(before,saved.actor,undo.after,undo.changes);
   if(!plan.ready)throw Error('Migrated fields were edited later. Resolve conflicts against the private backup before rollback.');
   if(!await foundry.applications.api.DialogV2.confirm({window:{title:'Roll back Gunbreaker migration'},content:`<p>Restore ${plan.updates.length} migrated items to their backed-up rules? HP, resources and unrelated actor changes are retained. A new backup will be saved before rollback.</p>`,rejectClose:false}))return;
   return queue.run(actor,async()=>{
    gm(actor);if(JSON.stringify(before)!==JSON.stringify(actor.toObject()))throw Error('Actor changed after rollback preview.');
    if(['reserved','committed','recovery'].includes(actor.getFlag(MOD,'execution')?.status))throw Error('Resolve pending automation before rollback.');
    const backupId=await backup(actor,'pre-rollback');await actor.setFlag(MOD,'migration',{...marker,status:'rolling-back',rollbackBackup:backupId});
    try{await actor.updateEmbeddedDocuments('Item',plan.updates);await actor.setFlag(MOD,'migration',{...marker,status:'rolled-back',rollbackBackup:backupId});return plan;}
    catch(e){await actor.setFlag(MOD,'migration',{...marker,status:'recovery',rollbackBackup:backupId,error:e.message});throw e;}
   });
  },
  async escort(actor){
   gm(actor);const feat=actor.items.find(i=>(i.slug??i.system.slug)==='gunnhildr-escort');
   if(!feat)throw Error('Gunnhildr Escort is not learned.');if(feat.getFlag(MOD,'training'))throw Error('Escort training is already recorded; inspect the backup before changing it.');
   const hasLore=()=>actor.items.some(i=>i.type==='lore'&&(i.slug==='escort-lore'||i.name.toLowerCase()==='escort lore'));
   const diplomacy=actor.skills.diplomacy.rank>0,lore=actor.items.some(i=>i.type==='lore'&&(i.slug==='escort-lore'||i.name.toLowerCase()==='escort lore'));
   const choices=Object.keys(CONFIG.PF2E.skills).filter(k=>actor.skills[k]?.rank===0),count=Number(diplomacy)+Number(lore);
   const selected=count?await foundry.applications.api.DialogV2.wait({window:{title:'Gunnhildr Escort training'},rejectClose:false,content:`<p>Choose ${count} different untrained replacement skill(s).</p>${Array.from({length:count},(_,i)=>`<select name="skill${i}">${choices.map(k=>`<option value="${k}">${esc(game.i18n.localize(CONFIG.PF2E.skills[k].label??CONFIG.PF2E.skills[k]))}</option>`).join('')}</select>`).join('')}`,buttons:[{action:'train',label:'Apply training',callback:(_e,b)=>Array.from({length:count},(_,i)=>b.form.elements[`skill${i}`].value)}]}):[];
   if(!selected)return;
   if(new Set(selected).size!==count||selected.some(s=>!choices.includes(s)))throw Error('Choose distinct untrained skills.');
   return queue.run(actor,async()=>{
    gm(actor);if(feat.getFlag(MOD,'training')||selected.some(s=>actor.skills[s]?.rank!==0)||diplomacy!==(actor.skills.diplomacy.rank>0)||lore!==hasLore())throw Error('Training changed; reopen setup.');
    const backupId=await backup(actor,'Escort training');await feat.setFlag(MOD,'training',{status:'applying',backupId});
    const skills=[...(!diplomacy?['diplomacy']:[]),...selected];
    try{
     if(!lore)await actor.createEmbeddedDocuments('Item',[{name:'Escort Lore',type:'lore',system:{proficient:{value:1}},flags:{[MOD]:{escort:feat.id}}}]);
     await feat.update({'system.rules':[...feat.system.rules,...skills.map(skill=>({key:'ActiveEffectLike',mode:'upgrade',path:`system.skills.${skill}.rank`,value:1}))],[`flags.${MOD}.training`]:{status:'complete',backupId,skills,lore:!lore}});
     return {backupId,skills};
    }catch(e){await feat.setFlag(MOD,'training',{status:'recovery',backupId,error:e.message});throw e;}
   });
  }
 };
}
