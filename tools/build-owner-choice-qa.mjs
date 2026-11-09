import {readFile,writeFile,mkdir} from 'node:fs/promises';
let source='';
for(const name of ['owner-choices.mjs','owner-choices-native.mjs'])source+=(await readFile(new URL('../scripts/'+name,import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/\bexport /g,'')+'\n';
const factory=`(game,canvas,Hooks,ChatMessage,foundry,fromUuid,ui)=>{${source}\nreturn installOwnerChoices();}`;
const macro=`// Detached two-client model with native DialogV2. No real chat, actor, HP or setting writes.
const createClient=${factory};
const clients=[],receipts=[];
const users=[{id:'qaGM',isGM:true,active:true,viewedScene:'qaScene'},{id:'qaPlayer',isGM:false,active:true,viewedScene:'qaScene'}];users.get=id=>users.find(u=>u.id===id);
const actor={uuid:'Actor.ownerQA',isOwner:true,type:'character',testUserPermission:()=>true};
for(const user of users){
 const client={user,hooks:new Map()};clients.push(client);
 client.api=createClient({user,users,time:game.time,settings:{get:()=>true}},{scene:{id:'qaScene'}},{on:(name,fn)=>client.hooks.set(name,fn)},
  {create:async data=>{receipts.push({creator:user.id,flags:data.flags,whisper:data.whisper});const message={author:{id:data.author},getFlag:(mod,key)=>data.flags?.[mod]?.[key]};for(const c of clients)c.hooks.get('createChatMessage')?.(message,{},user.id);return message;}},
  foundry,async()=>actor,ui);
}
const responses=[];
for(const n of [1,2])responses.push(await clients[0].api.ask(actor,{id:'qaParent'+n,requesterId:'qaPlayer'},{title:'Owner choice QA '+n,text:n===1?'Choose Protect QA ally. This is an in-memory two-client model, not a real network test.':'Choose Skip to verify that declining resolves without an effect.',choices:[{id:'step',label:'Step'},{id:'ally0',label:'Protect QA ally'}]}));
const ok=responses[0]==='ally0'&&responses[1]===null&&receipts.length===4&&receipts.every(r=>r.whisper.includes('qaGM')&&r.whisper.includes('qaPlayer'));
await foundry.applications.api.DialogV2.wait({window:{title:'Owner choice QA result'},content:'<p>'+ (ok?'PASS':'Unexpected choices') + ': native prompts and detached request/response model.</p><p>Selections: '+JSON.stringify(responses)+'</p><p>No real chat messages, actors, HP or settings were written. Real GM/player delivery remains untested.</p>',buttons:[{action:'close',label:'Close'}]});
`;
await mkdir(new URL('../build/',import.meta.url),{recursive:true});
await writeFile(new URL('../build/owner-choice-qa.mjs',import.meta.url),macro);
console.log('Built build/owner-choice-qa.mjs');
