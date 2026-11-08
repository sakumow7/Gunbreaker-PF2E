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
