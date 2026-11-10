import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {SUPPORTED,CORE_STRIKES,CORE_FOLLOWUPS} from '../scripts/execution.mjs';
import {SAVE_ACTIONS,TARGETED_SAVES} from '../scripts/area.mjs';
import {REIGN_STEPS} from '../scripts/reign.mjs';
const sets={SUPPORTED,CORE_STRIKES,CORE_FOLLOWUPS,SAVE_ACTIONS,TARGETED_SAVES,REIGN_STEPS};
let code='// Detached Gunbreaker panel QA. No actor, combat, HP or setting writes.\n';
for(const [key,value] of Object.entries(sets))code+=`const ${key}=new Set(${JSON.stringify([...value])});\n`;
for(const file of ['catalogue.mjs','mechanics.mjs','state.mjs','options.mjs','outside-controls.mjs','player-controls.mjs','player-panel.mjs']){
 const src=await readFile(new URL('../scripts/'+file,import.meta.url),'utf8');
 code+=src.replace(/^import .*;\n/gm,'').replace(/\bexport /g,'')+'\n';
}
const css=await readFile(new URL('../styles/gunbreaker.css',import.meta.url),'utf8');
code+=`\nconst style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.append(style);\n`;
code+=`
const qaContext={time:1000,level:20,learned:Object.keys(catalogue).filter(s=>!['twin-cartridge','overcharged-gauge'].includes(s)),encounterId:'qa',round:1,turn:1,inTurn:true,wielding:true,targetIds:['Scene.qa.Token.selected']};
let qaState={...initialState(),encounter:'qa',revision:2,cartridges:1};
const qaActor={uuid:'Actor.panelQA',name:'Isolated panel preview',isOwner:true,type:'character',getFlag:(_mod,key)=>key==='tracker'?qaState:null,itemTypes:{weapon:[{id:'qaBlade',name:'QA gunblade',type:'weapon',system:{traits:{value:['gunbreaker']},equipped:{carryType:'held',handsHeld:1}}}]}};
const receipts=[];
try{
 await nativePanel(qaActor,{execute:async(_actor,req)=>{
  if(req.expected.revision!==qaState.revision)throw Error('Stale QA request');
  receipts.push(req.slug);
  const op=OUTSIDE_ACTIVITIES.has(req.slug)?{type:'other',reaction:req.slug==='record-other-reaction',id:req.id}:{type:'use',slug:req.slug,id:req.id,outcome:'hit',...req.options};
  qaState=transition(qaState,op,{...qaContext,targetIds:req.targetIds,weaponId:req.weaponId,weaponDice:2},catalogue);
  ui.notifications.info('QA simulated '+req.slug+'; no actor writes.');
  return {status:'complete'};
 }},()=>qaContext);
 await foundry.applications.api.DialogV2.wait({window:{title:'Gunbreaker panel QA result'},content:'<p>Detached UI only. Simulated actions: '+receipts.map(esc).join(', ')+'</p><p>World actors, HP, combat and settings were unchanged.</p>',buttons:[{action:'close',label:'Close'}]});
}finally{style.remove();}
`;
await mkdir(new URL('../build/',import.meta.url),{recursive:true});
await writeFile(new URL('../build/panel-qa.mjs',import.meta.url),code);
console.log('Built build/panel-qa.mjs (detached UI macro).');
