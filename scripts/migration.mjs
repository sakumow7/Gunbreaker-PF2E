/** Read-only migration planning. Applying the plan remains an explicit GM action. */
const MOD='gunbreaker-pf2e';
export const RETIRED=Object.freeze({
  'ae787e7b74d7659f':'reserved-cartridge',
  'dc733707043788dc':null
});
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function sourceId(item){return item._stats?.compendiumSource??item.flags?.core?.sourceId??null;}
export function planMigration(actor,baseline,revised,{acceptReserved=[]}={}){
  const oldBySource=new Map(baseline.map(e=>[e.uuid,e.doc]));
  const nextBySource=new Map(revised.map(e=>[e.uuid,e.doc]));
  const replacement=revised.find(e=>e.doc.system?.slug==='reserved-cartridge');
  const updates=[],decisions=[],conflicts=[];
  for(const item of actor.items??[]){
    const id=sourceId(item),old=oldBySource.get(id);if(!old)continue;
    if(Object.hasOwn(RETIRED,old._id)){
      if(RETIRED[old._id] && acceptReserved.includes(item._id)){
        if(!replacement)throw Error('Reserved Cartridge source is missing.');
        const system=structuredClone(replacement.doc.system);
        if(item.system?.location!==undefined)system.location=item.system.location;
        updates.push({_id:item._id,name:replacement.doc.name,system,'_stats.compendiumSource':replacement.uuid,'flags.core.sourceId':replacement.uuid});
      }else decisions.push({itemId:item._id,name:item.name,choices:RETIRED[old._id]?['Accept Reserved Cartridge','Free retraining']:['Choose a legal replacement feat']});
      continue;
    }
    const next=nextBySource.get(id);if(!next)continue;
    const update={_id:item._id};
    for(const key of ['description','rules','frequency','actionType','actions','level','publication']){
      if(equal(old.system?.[key],next.system?.[key]))continue;
      if(!equal(item.system?.[key],old.system?.[key])){
        // Never overwrite player-edited prose, choices, or custom rule elements automatically.
        conflicts.push({itemId:item._id,name:item.name,field:`system.${key}`});continue;
      }
      if(next.system?.[key]!==undefined)update[`system.${key}`]=structuredClone(next.system[key]);
      else update[`system.-=${key}`]=null;
    }
    if(Object.keys(update).length>1)updates.push(update);
  }
  return {version:'1.4.0-beta.1',actorId:actor._id,updates,decisions,conflicts,ready:!decisions.length&&!conflicts.length};
}
export function actorBackup(actor){
  const copy=structuredClone(actor);
  if(copy.flags?.[MOD])delete copy.flags[MOD].backups;
  return {format:1,created:new Date().toISOString(),actor:copy};
}

const readPath=(value,path)=>path.split('.').reduce((v,k)=>v?.[k],value);
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
function restorePath(update,path,before,after){
  if(equal(before,after))return;
  if(plain(before)&&plain(after)){
    for(const key of new Set([...Object.keys(before),...Object.keys(after)]))restorePath(update,`${path}.${key}`,before[key],after[key]);
  }else if(before===undefined){const parts=path.split('.');parts[parts.length-1]=`-=${parts.at(-1)}`;update[parts.join('.')]=null;}
  else update[path]=structuredClone(before);
}
/** Roll back only migration-owned fields. Refuse later edits to those fields; retain HP and unrelated customizations. */
export function rollbackMigration(current,before,after,changes){
  const updates=[],conflicts=[];
  for(const change of changes){
    const old=before.items.find(i=>i._id===change._id),migrated=after.items.find(i=>i._id===change._id),live=current.items.find(i=>i._id===change._id);
    if(!old||!migrated||!live){conflicts.push({itemId:change._id,field:'missing item'});continue;}
    const update={_id:change._id};
    for(const key of Object.keys(change).filter(k=>k!=='_id')){
      const path=key.replace(/(^|\.)-=/g,'$1');
      if(!equal(readPath(live,path),readPath(migrated,path))){conflicts.push({itemId:change._id,field:path});continue;}
      restorePath(update,path,readPath(old,path),readPath(migrated,path));
    }
    if(Object.keys(update).length>1)updates.push(update);
  }
  return {updates,conflicts,ready:conflicts.length===0};
}
