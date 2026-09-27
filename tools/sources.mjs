import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
export const root=path.resolve(import.meta.dirname,'..');
export async function sources(){
  const result=[];
  for(const pack of await readdir(path.join(root,'packs/_source')))for(const file of await readdir(path.join(root,'packs/_source',pack)))if(file.endsWith('.json')){
    const doc=JSON.parse(await readFile(path.join(root,'packs/_source',pack,file),'utf8'));
    result.push({pack,file,doc,uuid:`Compendium.gunbreaker-pf2e.${pack}.${doc.type==='script'?'Macro':'Item'}.${doc._id}`});
  }
  return result;
}
export function makeCatalogue(entries){
  const sourceIds=Object.fromEntries(entries.filter(e=>e.doc.system?.slug).map(e=>[e.uuid,e.doc.system.slug]));
  const names=new Map(entries.filter(e=>e.doc.type==='feat').map(e=>[e.doc.name,e.doc.system.slug]));
  const catalogue=Object.fromEntries(entries.filter(e=>e.doc.type==='feat').map(({doc:d})=>[d.system.slug,{
    name:d.name,level:d.system.level.value,actionType:d.system.actionType.value,actions:d.system.actions.value,
    prerequisites:(d.system.prerequisites?.value??[]).map(p=>names.get(p.value)??p.value),...(d.system.frequency?{frequency:d.system.frequency}:{})
  }]));
  return {catalogue,sourceIds};
}
