// Paste into a GM Script Macro. Repairs only two known invalid Gunbreaker image paths.
await (async()=>{
 if(!game.user.isGM)throw Error('A GM must repair compendium icons.');
 const fixes={
  'icons/skills/ranged/cannon-barrel-fire-yellow.webp':'icons/skills/ranged/cannon-barrel-firing-yellow.webp',
  'icons/equipment/shield/heater-steel-worn-grey.webp':'icons/equipment/shield/heater-steel-worn.webp'
 };
 const owned=d=>String(d.sourceId??d.flags?.core?.sourceId??'').startsWith('Compendium.gunbreaker-pf2e.')||String(d.system?.publication?.title??'').startsWith('Gunbreaker PF2e Homebrew');
 const changes=docs=>docs.map(d=>{
  const update={_id:d.id};if(fixes[d.img])update.img=fixes[d.img];
  if(d.type==='class')for(const [id,grant] of Object.entries(d.system.items??{}))if(String(grant.uuid??'').startsWith('Compendium.gunbreaker-pf2e.')&&fixes[grant.img])update[`system.items.${id}.img`]=fixes[grant.img];
  return update;
 }).filter(u=>Object.keys(u).length>1);
 const packs=[];
 for(const pack of game.packs.filter(p=>p.collection.startsWith('gunbreaker-pf2e.')&&['Item','Macro'].includes(p.documentName))){
  const updates=changes(await pack.getDocuments());if(updates.length)packs.push({pack,updates});
 }
 const actors=[];
 for(const actor of game.actors){const updates=changes(actor.items.filter(owned));if(updates.length)actors.push({actor,updates});}
 const items=changes(game.items.filter(owned));
 const macros=changes(game.macros.filter(d=>owned(d)||d.name==='Gunbreaker Tracker'));
 const counts={compendium:packs.reduce((n,p)=>n+p.updates.length,0),actorItems:actors.reduce((n,a)=>n+a.updates.length,0),worldItems:items.length,macros:macros.length};
 const total=Object.values(counts).reduce((a,b)=>a+b,0);
 if(!total){ui.notifications.info('Gunbreaker icons already repaired.');return;}
 const yes=await foundry.applications.api.DialogV2.confirm({window:{title:'Repair Gunbreaker icons'},content:`<p>Replace only the two invalid image filenames in ${counts.compendium} compendium entries, ${counts.actorItems} actor items, ${counts.worldItems} world items and ${counts.macros} world macros. Custom images and rules are unchanged. Pack lock settings are restored afterward.</p>`,rejectClose:false});
 if(!yes)return;
 for(const {pack,updates} of packs){
  const locked=pack.locked;
  try{if(locked)await pack.configure({locked:false});await (pack.documentName==='Macro'?Macro:Item).updateDocuments(updates,{pack:pack.collection});}
  finally{if(locked)await pack.configure({locked:true});}
 }
 for(const {actor,updates} of actors)await actor.updateEmbeddedDocuments('Item',updates);
 if(items.length)await Item.updateDocuments(items);
 if(macros.length)await Macro.updateDocuments(macros);
 await foundry.applications.api.DialogV2.wait({window:{title:'Gunbreaker icons repaired'},content:`<p>Updated icons in ${total} documents: ${counts.compendium} compendium entries, ${counts.actorItems} actor items, ${counts.worldItems} world items and ${counts.macros} world macros.</p><p>Reopen compendia/sheets to refresh cached previews. Reinstalling an older package may restore its old compendium paths; this macro can be rerun.</p>`,buttons:[{action:'close',label:'Close'}]});
})();
