import assert from 'node:assert/strict';
import {readFile,mkdir,cp} from 'node:fs/promises';
import path from 'node:path';
import {ClassicLevel} from 'classic-level';
import {unzipSync,strFromU8} from 'fflate';
import {root,sources,makeCatalogue} from './sources.mjs';
import {catalogue,sourceIds} from '../scripts/catalogue.mjs';
const entries=await sources(),uuids=new Map(entries.map(e=>[e.uuid,e.doc]));
const manifest=JSON.parse(await readFile(path.join(root,'module.json'),'utf8'));
assert.deepEqual({catalogue,sourceIds},makeCatalogue(entries),'Generated tracker catalogue is stale');
for(const {doc,uuid} of entries){
 assert.match(doc._id,/^[A-Za-z0-9]{16}$/);
 for(const m of JSON.stringify(doc).matchAll(/Compendium\.gunbreaker-pf2e\.[\w-]+\.(?:Item|Macro)\.[A-Za-z0-9]+/g))assert(uuids.has(m[0]),`${uuid}: broken link ${m[0]}`);
 for(const r of doc.system?.rules??[]) {
  assert(r.key!=='MartialProficiency',`${doc.name}: obsolete invalid proficiency rule`);
  if(r.key==='GrantItem')assert(uuids.has(r.uuid));
 }
 assert(!doc.flags?.['gunbreaker-pf2e']?.cartridge,'Obsolete chat mutation flags');
 if(doc.type==='feat'){
  assert(doc.system.level.value>=1&&doc.system.level.value<=20);
  for(const prereq of catalogue[doc.system.slug].prerequisites)assert(catalogue[prereq],`Unknown prerequisite ${prereq}`);
 }
}
const cls=entries.find(e=>e.doc.type==='class').doc;
function granted(level){
 const ids=new Set();
 function add(uuid,trail=[]){
  assert(!trail.includes(uuid),'Grant cycle');if(ids.has(uuid))return;ids.add(uuid);
  const d=uuids.get(uuid);assert(d,uuid);
  for(const r of d.system?.rules??[])if(r.key==='GrantItem'){
   const threshold=r.predicate?.find(p=>p.gte)?.gte[1]??1;
   if(level>=threshold)add(r.uuid,[...trail,uuid]);
  }
 }
 for(const grant of Object.values(cls.system.items))if(grant.level<=level)add(grant.uuid);
 return [...ids].map(u=>uuids.get(u));
}
for(let level=1;level<=20;level++){
 const items=granted(level),slugs=new Set(items.map(d=>d.system.slug));
 for(const slug of ['keen-edge','brutal-shell','solid-barrel','burst-strike','demon-slice','demon-slaughter','heart-of-stone'])assert(slugs.has(slug));
 for(const [slug,unlock] of [['gnashing-fang',6],['continuation',7],['hypervelocity',7],['fated-circle',12],['double-down',14]])assert.equal(slugs.has(slug),level>=unlock,`${slug} at ${level}`);
 const ranks={...cls.system.attacks,...cls.system.defenses,...cls.system.savingThrows,perception:cls.system.perception,gunbreaker:1};
 for(const d of items)for(const [key,value] of Object.entries(d.system.subfeatures?.proficiencies??{}))ranks[key]=Math.max(ranks[key]??0,value.rank);
 assert.equal(ranks.martial,level>=13?3:level>=5?2:1);
 assert.equal(ranks.medium,level>=15?3:level>=7?2:1);
 assert.equal(ranks.fortitude,level>=9?3:2);assert.equal(ranks.will,level>=17?3:level>=3?2:1);
 assert.equal(ranks.perception,level>=11?3:level>=3?2:1);assert.equal(ranks.gunbreaker,level>=17?3:level>=9?2:1);
}
const validationRoot=path.join(root,'build',`validate-${Date.now()}`);
await mkdir(validationRoot,{recursive:true});
for(const pack of manifest.packs){
 // LevelDB may compact when opened. Validate a copy, never mutate a published pack.
 const copy=path.join(validationRoot,pack.name);await cp(path.join(root,pack.path),copy,{recursive:true});
 const db=new ClassicLevel(copy,{keyEncoding:'utf8',valueEncoding:'json',createIfMissing:false});
 await db.open();try{
  const actual=await db.iterator().all(),expected=entries.filter(e=>e.pack===pack.name);
  assert.equal(actual.length,expected.length);
  for(const {doc} of expected)assert.deepEqual(await db.get(`!${pack.type==='Macro'?'macros':'items'}!${doc._id}`),doc,`${pack.name}/${doc.name} compiled copy differs`);
 }finally{await db.close();}
}
const zip=unzipSync(await readFile(path.join(root,`dist/gunbreaker-pf2e-${manifest.version}.zip`)));
assert.equal(JSON.parse(strFromU8(zip['module.json'])).version,manifest.version);
for(const file of ['scripts/gunbreaker.js','scripts/state.mjs','scripts/catalogue.mjs','RULES.html','MIGRATION.md'])assert(zip[file],`ZIP missing ${file}`);
for(const pack of manifest.packs)assert(zip[`${pack.path}/CURRENT`],`ZIP missing ${pack.path}`);
const html=await readFile(path.join(root,'RULES.html'),'utf8');
assert(!html.includes('@UUID['));assert(!html.includes('href="#"'));
for(const m of html.matchAll(/href="#([^"]+)"/g))assert(html.includes(`id="${m[1]}"`),`Missing rules anchor ${m[1]}`);
console.log(`Validated ${entries.length} source documents, level 1–20 grants/proficiencies, all internal links, compiled packs, tracker catalogue, rules links, and installation ZIP.`);
