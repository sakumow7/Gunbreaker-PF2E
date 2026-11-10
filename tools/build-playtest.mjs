import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
const baseRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim();
const digest=createHash('sha256');
for(const name of (await readdir(new URL('scripts/',root))).sort())if(/\.(mjs|js)$/.test(name))digest.update(name).update(await read('scripts/'+name));
const revision=baseRevision.slice(0,7)+' / code '+digest.digest('hex').slice(0,12);
const data=[];
for(const pack of ['gunbreaker-class','gunbreaker-feats','gunbreaker-equipment','gunbreaker-effects'])for(const name of await readdir(new URL(`packs/_source/${pack}/`,root))){
 if(!name.endsWith('.json'))continue;const d=JSON.parse(await read(`packs/_source/${pack}/${name}`));
 delete d.system.description;d._qaPack=pack;data.push(d);
}
// Small deterministic bundler for this repository's named-import module format.
const modules=new Map();
async function bundle(name){
 if(modules.has(name))return;modules.set(name,null);
 let source=await read('scripts/'+name);const names=[];const dependencies=[];
 source=source.replace(/export \{([^}]+)\} from '\.\/([^']+)';/g,(_m,list,dep)=>{dependencies.push(dep);names.push(...list.split(',').map(s=>s.trim()));return `const {${list}}=load(${JSON.stringify(dep)});`;});
 source=source.replace(/import \{([^}]+)\} from '\.\/([^']+)';/g,(_m,list,dep)=>{dependencies.push(dep);return `const {${list}}=load(${JSON.stringify(dep)});`;});
 source=source.replace(/export (async )?(function|class|const|let) (\w+)/g,(_m,a,k,n)=>{names.push(n);return `${a??''}${k} ${n}`;});
 source=source.replace(/export \{([^}]+)\};/g,(_m,list)=>{names.push(...list.split(',').map(s=>s.trim()));return '';});
 if(/(^|\n)\s*(import|export)\b/.test(source))throw Error('Unsupported module syntax: '+name);
 modules.set(name,`(load)=>{\n${source}\nreturn {${[...new Set(names)].join(',')}};}`);
 for(const d of dependencies)await bundle(d);
}
for(const name of ['native.mjs','queue.mjs','state.mjs','catalogue.mjs','support-native.mjs','maintenance.mjs','traits.mjs'])await bundle(name);
const gb=await read('scripts/gunbreaker.js');
const context=gb.slice(gb.indexOf('export function contextFor('),gb.indexOf('\nfunction permitted(')).replace('export ','');
const header=`// Generated playtest console. Writes only marked QA documents and native test chat.\nconst QA='gunbreaker-playtest-20261110',REV=${JSON.stringify(revision)},MOD='gunbreaker-pf2e';\nconst DATA=${JSON.stringify(data)};\nconst factories={${[...modules].map(([n,s])=>JSON.stringify(n)+':'+s).join(',\n')}};\nconst cache=new Map();function load(name){if(!cache.has(name))cache.set(name,factories[name](load));return cache.get(name);}\nconst {sourceIds,catalogue}=load('catalogue.mjs');const slug=item=>sourceIds[item.sourceId??item.flags?.core?.sourceId]??item.slug??item.system?.slug;\n${context}\n`;
await mkdir(new URL('build/',root),{recursive:true});
await writeFile(new URL('build/playtest.mjs',root),'await (async()=>{\n'+header+await read('tools/playtest-body.mjs')+'\n})();\n');
console.log(`Built playtest console from ${modules.size} modules at ${revision}`);
