import {readFile,writeFile,mkdir,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {ClassicLevel} from 'classic-level';
import {zipSync} from 'fflate';
import {root,sources,makeCatalogue} from './sources.mjs';
const entries=await sources();
const manifest=JSON.parse(await readFile(path.join(root,'module.json'),'utf8'));
const {catalogue,sourceIds}=makeCatalogue(entries);
await writeFile(path.join(root,'scripts/catalogue.mjs'),`// Generated from packs/_source by npm run build. Do not edit.\nexport const catalogue=${JSON.stringify(catalogue,null,2)};\nexport const sourceIds=${JSON.stringify(sourceIds,null,2)};\n`);
for(const pack of manifest.packs){
  const dbPath=path.resolve(root,pack.path);
  if(!/^packs\/gunbreaker-[a-z]+$/.test(pack.path) || !dbPath.startsWith(path.join(root,'packs')+path.sep))throw Error('Unsafe pack destination');
  const docs=entries.filter(e=>e.pack===pack.name);
  if(!docs.length)throw Error(`No sources for ${pack.name}`);
  if(new Set(docs.map(e=>e.doc._id)).size!==docs.length)throw Error(`Duplicate IDs in ${pack.name}`);
  await rm(dbPath,{recursive:true,force:true});
  const db=new ClassicLevel(dbPath,{keyEncoding:'utf8',valueEncoding:'json'});
  await db.open();
  try{await db.batch(docs.map(({doc})=>({type:'put',key:`!${pack.type==='Macro'?'macros':'items'}!${doc._id}`,value:doc})));}
  finally{await db.close();}
  console.log(`${pack.name}: ${docs.length} documents`);
}
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const byUuid=new Map(entries.map(e=>[e.uuid,e.doc]));
const prose=s=>s.replace(/@UUID\[([^\]]+)\]\{([^}]+)\}/g,(_m,u,label)=>`<a href="#${byUuid.get(u)?._id??''}">${label}</a>`)
  .replace(/@Damage\[([^\]]*\][^\]]*)\]/g,(_m,f)=>`<code>${escape(f)}</code>`)
  .replace(/@Check\[[^\]]+\]/g,'basic Reflex save against your Gunbreaker class DC');
const item=({doc:d})=>`<article id="${d._id}"><h3>${escape(d.name)}${d.system.level?` — Level ${d.system.level.value}`:''}</h3><p class="meta">${d.type==='feat'?`${d.system.actions.value??d.system.actionType.value} ${d.system.actions.value?'action(s)':''} · `:''}${escape((d.system.traits?.value??[]).join(', '))}</p>${d.system.prerequisites?.value.length?`<p><strong>Prerequisites:</strong> ${d.system.prerequisites.value.map(p=>escape(p.value)).join(', ')}</p>`:''}${prose(d.system.description.value)}</article>`;
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gunbreaker — PF2e Playtest ${manifest.version}</title><style>body{max-width:960px;margin:auto;padding:2rem;color:#252b32;background:#faf7f0;font:17px/1.6 Georgia,serif}h1,h2,h3,nav,.meta{font-family:system-ui,sans-serif}h1{font-size:3rem;margin-bottom:0}h2{border-bottom:3px solid #97713f;padding-bottom:.4rem;margin-top:2.5rem}article{border-bottom:1px solid #d9cdb9;padding:1rem 0}a{color:#735018}nav{display:flex;gap:1rem;flex-wrap:wrap}.meta{font-size:.85rem;color:#555}code{overflow-wrap:anywhere}@media print{body{font-size:10pt;background:white;padding:0}nav{display:none}h3{break-after:avoid}}</style></head><body><h1>Gunbreaker</h1><p>FFXIV-inspired PF2e Remaster class · Playtest ${manifest.version}</p><nav><a href="#class">Class</a><a href="#features">Features &amp; actions</a><a href="#feats">Feats</a><a href="#gear">Gunblades</a></nav><section id="class">${prose(entries.find(e=>e.doc.type==='class').doc.system.description.value)}</section>${[['features','Features & actions','gunbreaker-class'],['feats','Class feats','gunbreaker-feats'],['gear','Gunblades','gunbreaker-equipment']].map(([anchor,title,pack])=>`<section id="${anchor}"><h2>${title}</h2>${entries.filter(e=>e.pack===pack&&e.doc.type!=='class').sort((a,b)=>(a.doc.system.level?.value??0)-(b.doc.system.level?.value??0)||a.doc.name.localeCompare(b.doc.name)).map(item).join('\n')}</section>`).join('')}<section id="effects"><h2>Effect reminders</h2>${entries.filter(e=>e.pack==='gunbreaker-effects').map(item).join('')}</section></body></html>`;
await writeFile(path.join(root,'RULES.html'),html);
const zipFiles={};
async function collect(relative){
  for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){
    if(entry.name==='_source'||entry.name==='LOCK'||entry.name==='LOG')continue;
    const rel=path.posix.join(relative,entry.name);
    if(entry.isDirectory())await collect(rel);else zipFiles[rel]=new Uint8Array(await readFile(path.join(root,rel)));
  }
}
for(const dir of ['scripts','styles','lang','packs'])await collect(dir);
for(const file of ['module.json','README.md','RULES.html','PLAYTEST.md','MIGRATION.md','SMOKE-TEST.md','CHANGELOG.md'])zipFiles[file]=new Uint8Array(await readFile(path.join(root,file)));
await mkdir(path.join(root,'dist'),{recursive:true});
await writeFile(path.join(root,'dist',`gunbreaker-pf2e-${manifest.version}.zip`),zipSync(zipFiles,{level:6}));
console.log(`Built RULES.html and dist/gunbreaker-pf2e-${manifest.version}.zip`);
