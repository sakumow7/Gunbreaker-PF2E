if(!game.user.isGM)throw Error('The playtest console requires a GM.');
load('traits.mjs').registerGunbreakerTraits(CONFIG.PF2E);
const flag=d=>d?.flags?.[MOD]?.playtest===QA;
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const clone=foundry.utils.deepClone;
const {createNativeRunner,nativePanel}=load('native.mjs'),{ActorQueue}=load('queue.mjs'),{initialState,transition}=load('state.mjs');
const queue=new ActorQueue();
let scene=game.scenes.find(flag);
const mode=await foundry.applications.api.DialogV2.wait({window:{title:'Gunbreaker playtest console'},content:`<p>Candidate ${REV}. Installed module ${game.modules.get(MOD)?.version}. Creates and changes only marked test actors, their scene/combat, and native test roll messages.</p><p>Fixtures embed current abilities directly, without compendium grant processing. This is executor verification, not an installation or character-import test.</p>`,rejectClose:false,buttons:[{action:'setup',label:scene?'View playtest scene':'Create playtest scene'},...(scene?[{action:'damage',label:'Run persisted damage checks'},{action:'core',label:'Run native combo checks'},{action:'area',label:'Run native area check'},{action:'support',label:'Run support and turn checks'},{action:'persistence',label:'Run tracker persistence checks'},{action:'panel',label:'Open candidate action panel'},{action:'report',label:'Show results'}]:[]),{action:'close',label:'Close',callback:()=>false}]});
if(!mode)return;
const marker={ [MOD]:{playtest:QA,revision:REV} };
if(mode==='setup'){
 if(!scene){
  const folder=await Folder.create({name:'Gunbreaker — Disposable Playtest',type:'Actor',flags:marker});
  const clean=d=>{const x=clone(d);delete x._qaPack;delete x.folder;delete x.ownership;x.flags={};if(x.system.items)x.system.items={};x.system.rules=(x.system.rules??[]).filter(r=>!['GrantItem','ChoiceSet'].includes(r.key));return x;};
  const feats=new Set(['aurora','heart-of-corundum','heart-of-light','gunmetal-soul','aetheric-calibration','expanded-gauge','double-down','bow-shock','saturation-fire','relentless-rush']);
  const items=DATA.filter(d=>d._qaPack==='gunbreaker-class'||d._qaPack==='gunbreaker-feats'&&feats.has(d.system.slug)).map(clean).sort((a,b)=>(a.type==='class'?0:1)-(b.type==='class'?0:1));
  const blade=clean(DATA.find(d=>d.system.slug==='gunblade'));blade.system.equipped={carryType:'held',handsHeld:2};blade.system.runes={potency:3,striking:3,property:[]};items.push(blade);
  const hero=await Actor.create({name:'QA • Gunbreaker 20',type:'character',folder:folder.id,img:'icons/weapons/swords/greatsword-crossguard-steel.webp',system:{details:{alliance:'party',level:{value:20},keyability:{value:'str'}},build:{attributes:{manual:true}},abilities:{str:{mod:6},dex:{mod:3},con:{mod:4},int:{mod:0},wis:{mod:2},cha:{mod:1}}},items,flags:{[MOD]:{playtest:QA,role:'hero'}},prototypeToken:{actorLink:true,disposition:1,sight:{enabled:false},displayName:50,displayBars:50}});
  await hero.update({'system.attributes.hp.value':hero.system.attributes.hp.max});
  const actors=[hero];
  for(const [role,name,alliance] of [['ally','QA • Ally','party'],['enemy','QA • Target A','opposition'],['enemy2','QA • Target B','opposition']])actors.push(await Actor.create({name,type:'npc',folder:folder.id,img:'icons/svg/mystery-man.svg',flags:{[MOD]:{playtest:QA,role}},system:{details:{level:{value:20},alliance},attributes:{hp:{value:500,max:500},ac:{value:30},speed:{value:25}},saves:{fortitude:{value:25},reflex:{value:25},will:{value:25}},traits:{value:['human','humanoid'],size:{value:'med'}}},prototypeToken:{actorLink:true,disposition:alliance==='party'?1:-1,sight:{enabled:false},displayName:50,displayBars:50}}));
  scene=await Scene.create({name:'Gunbreaker — Verification Arena',width:2000,height:1400,padding:0.1,backgroundColor:'#253047',grid:{type:1,size:100,distance:5,units:'ft',color:'#7283a0',alpha:0.35},tokenVision:false,globalLight:true,navigation:true,active:false,flags:{[MOD]:{playtest:QA,revision:REV,actorIds:actors.map(a=>a.id),results:[]}}});
  const positions=[[500,500],[500,600],[600,500],[600,600]];
  const tokens=[];for(let i=0;i<actors.length;i++)tokens.push((await actors[i].getTokenDocument({x:positions[i][0],y:positions[i][1],actorLink:true})).toObject());
  await scene.createEmbeddedDocuments('Token',tokens);
  await scene.createEmbeddedDocuments('Drawing',[{x:250,y:150,shape:{type:'r',width:1200,height:120},text:'GUNBREAKER  •  VERIFICATION ARENA\nDisposable actors • 5-foot squares • candidate executor',fontSize:30,textColor:'#ffffff',fillType:0,strokeWidth:0}]);
 }
 await scene.view();
 await foundry.applications.api.DialogV2.wait({window:{title:'Playtest scene ready'},content:'<p>The private test arena and four disposable actors are ready. Run this macro again to start encounter checks.</p>',buttons:[{action:'close',label:'Close'}]});return;
}
assert(scene&&canvas.scene?.id===scene.id,'View the marked playtest scene first.');
const actors=scene.flags[MOD].actorIds.map(id=>game.actors.get(id));assert(actors.length===4&&actors.every(flag),'Test actor identity changed.');
const [hero,ally,enemy,enemy2]=actors;
if(hero._source.items[0]?.type!=='class')await hero.update({items:hero.toObject().items.sort((a,b)=>(a.type==='class'?0:1)-(b.type==='class'?0:1))});
if(hero.system.details.alliance!=='party')await hero.update({'system.details.alliance':'party'});
for(const a of actors)a.reset();
// Earlier fixtures embedded features before the class. Recreate only this disposable actor's known feats after its class.
if(hero.system.proficiencies.classDCs.gunbreaker?.rank!==3){
 const feats=hero.itemTypes.feat;assert(feats.every(f=>DATA.some(d=>d._id===f.id)),'Unknown feat on fixture; repair it manually.');
 const sources=feats.map(f=>f.toObject());await hero.deleteEmbeddedDocuments('Item',feats.map(f=>f.id));await hero.createEmbeddedDocuments('Item',sources,{keepId:true});hero.reset();
}
const tokenFor=a=>{const t=canvas.tokens.placeables.filter(t=>t.actor?.id===a.id);assert(t.length===1,'Need one token per test actor.');return t[0];};
assert(canvas.tokens.placeables.every(t=>actors.includes(t.actor)),'Remove unrelated tokens from the test scene before running checks.');
const runner=createNativeRunner(contextFor,queue);
const results=clone(scene.flags[MOD].results??[]),esc=foundry.utils.escapeHTML;
async function record(name,fn){try{const detail=await fn();results.push({name,pass:true,detail:detail??'',at:new Date().toISOString(),revision:REV});}catch(e){results.push({name,pass:false,detail:e.message,stack:e.stack,at:new Date().toISOString(),revision:REV});}await scene.setFlag(MOD,'results',results);return results.at(-1).pass;}
async function report(){await foundry.applications.api.DialogV2.wait({window:{title:'Gunbreaker playtest results'},position:{width:760},content:`<p>Candidate ${REV} / installed ${game.modules.get(MOD)?.version} / Foundry ${game.version} / PF2e ${game.system.version}</p><p>Real disposable actors, tokens and HP writes. Latest result per check; all ${results.length} attempts retained on scene. No campaign actor changes.</p><ul>${[...new Map(results.map(r=>[r.name,r])).values()].map(r=>`<li><b>${r.pass?'PASS':'FAIL'}</b> — ${esc(r.name)}: ${esc(String(r.detail))}</li>`).join('')}</ul>`,buttons:[{action:'close',label:'Close'}]});}
if(mode==='report'){await report();return;}
let combat=game.combats.find(c=>flag(c)&&c.scene?.id===scene.id);
if(!combat){combat=await Combat.create({scene:scene.id,active:false,flags:marker});await combat.createEmbeddedDocuments('Combatant',actors.map((a,i)=>({actorId:a.id,tokenId:tokenFor(a).id,initiative:40-i*5})));}
await combat.activate();
if(!combat.started)await combat.update({round:1,turn:0});
assert(game.combat.id===combat.id&&flag(combat),'Wrong combat selected.');
await combat.update({turn:combat.turns.findIndex(c=>c.actorId===hero.id)});
const weapon=()=>{const w=hero.itemTypes.weapon.find(w=>w.system.traits.value.includes('gunbreaker'));assert(w,'No prepared QA gunblade trait.');return w;};
async function reset(){
 assert(flag(hero)&&canvas.scene.id===scene.id&&game.combat.id===combat.id,'QA scope changed.');
 await hero.unsetFlag(MOD,'tracker');
 await hero.setFlag(MOD,'tracker',{...transition(initialState(),{type:'start'},contextFor(hero),catalogue),cartridges:3});
 await hero.unsetFlag(MOD,'execution');await hero.unsetFlag(MOD,'followup');
}
const req=(slug,target=enemy)=>({id:foundry.utils.randomID(),slug,weaponId:weapon().id,map:0,targetIds:target?[tokenFor(target).document.uuid]:[],options:{}});
if(mode==='panel'){await nativePanel(hero,runner,contextFor);return;}
if(mode==='damage'){
 for(const type of ['fire','cold','electricity'])for(const kind of ['plain','resistance-weakness','immune'])await record(`${type} Continuation — ${kind}`,async()=>{
  await reset();const ids=enemy.itemTypes.effect.filter(i=>i.flags?.[MOD]?.qaResistance).map(i=>i.id);if(ids.length)await enemy.deleteEmbeddedDocuments('Item',ids);
  await enemy.update({'system.attributes.hp.value':500,'system.attributes.hp.temp':0});
  const rules=kind==='immune'?[{key:'Immunity',type}]:kind==='resistance-weakness'?[{key:'Resistance',type,value:5},{key:'Weakness',type,value:3}]:[];
  if(rules.length)await enemy.createEmbeddedDocuments('Item',[{name:'QA IWR fixture',type:'effect',system:{duration:{value:-1,unit:'unlimited',expiry:null},rules},flags:{[MOD]:{qaResistance:true}}}]);
  const s=hero.getFlag(MOD,'tracker');s.calibration=type;s.continuation={slug:'hypervelocity',targets:[tokenFor(enemy).document.uuid],weaponId:weapon().id,weaponDice:4,turn:contextFor(hero).turn};await hero.setFlag(MOD,'tracker',s);
  const request=req('hypervelocity');await runner.execute(hero,request);
  const journal=hero.getFlag(MOD,'execution'),entry=journal.riders.find(r=>r.kind==='continuation-damage'),roll=game.messages.get(entry.messageId).rolls[0],total=roll.total;
  const expected=kind==='immune'?0:kind==='resistance-weakness'?Math.max(0,total-5+3):total;
  assert(journal.status==='complete'&&entry.status==='complete','Execution did not complete.');assert(enemy.system.attributes.hp.value===500-expected,`HP ${enemy.system.attributes.hp.value}, expected ${500-expected}.`);
  const before=enemy.system.attributes.hp.value,count=game.messages.size;await runner.execute(hero,request);assert(enemy.system.attributes.hp.value===before&&game.messages.size===count,'Duplicate execution wrote damage/messages.');
  return `roll ${total}; HP 500 → ${before}; replay unchanged`;
 });
 const ids=enemy.itemTypes.effect.filter(i=>i.flags?.[MOD]?.qaResistance).map(i=>i.id);if(ids.length)await enemy.deleteEmbeddedDocuments('Item',ids);
}
if(mode==='core'){
 await reset();await hero.update({'system.attributes.hp.value':hero.system.attributes.hp.max-40});
 for(const [index,slug] of ['keen-edge','brutal-shell','solid-barrel','burst-strike'].entries())await record(`Native ${slug}`,async()=>{if(index===3)await combat.update({round:combat.round+1,turn:0});const before=hero.getFlag(MOD,'tracker').cartridges;const request=req(slug);request.map=index<3?index:0;const result=await runner.execute(hero,request);assert(result.status==='complete','Native action canceled or incomplete.');return `MAP ${request.map}; cartridges ${before} → ${hero.getFlag(MOD,'tracker').cartridges}; HP ${hero.system.attributes.hp.value}; temp ${hero.system.attributes.hp.temp??0}`;});
 if(hero.getFlag(MOD,'tracker').continuation)await record('Native Burst → Hypervelocity',async()=>{const before=enemy.system.attributes.hp.value;await runner.execute(hero,req('hypervelocity'));assert(enemy.system.attributes.hp.value<before,'No follow-up HP change.');return `target HP ${before} → ${enemy.system.attributes.hp.value}`;});
}
if(mode==='area'){
 await reset();for(const a of [enemy,enemy2])await a.update({'system.attributes.hp.value':500});const allyHP=ally.system.attributes.hp.value;
 await record('Native Fated Circle — two enemies, ally excluded',async()=>{const result=await runner.execute(hero,req('fated-circle',null));assert(result.status==='complete','Area workflow incomplete.');assert(hero.getFlag(MOD,'tracker').cartridges===2,'Wrong cartridge cost.');assert(ally.system.attributes.hp.value===allyHP,'Ally was damaged.');return `enemy HP ${enemy.system.attributes.hp.value}/${enemy2.system.attributes.hp.value}; ally unchanged; 1 cartridge spent`;});
}
if(mode==='support'){
 await reset();
 // Finish the old round before starting a new one. A direct round jump may dispatch skipped turns asynchronously.
 async function moveTurn(change){
  const expected=combat.turns[change.turn];let timer,hook;
  const reached=new Promise((resolve,reject)=>{hook=Hooks.on('pf2e.startTurn',(cb,c)=>{if(c.id===combat.id&&cb.id===expected.id)resolve();});timer=setTimeout(()=>reject(Error('Native turn progression did not settle.')),15000);});
  try{await combat.update(change);await reached;}finally{clearTimeout(timer);Hooks.off('pf2e.startTurn',hook);}
 }
 async function nextSourceRound(){await moveTurn({turn:combat.turns.length-1});await moveTurn({round:combat.round+1,turn:0});}
 await nextSourceRound();
 const old=ally.itemTypes.effect.filter(i=>i.flags?.[MOD]?.support?.kind==='aurora').map(i=>i.id);if(old.length)await ally.deleteEmbeddedDocuments('Item',old);
 await ally.unsetFlag(MOD,'auroraImmunity');await ally.update({'system.attributes.hp.value':200});
 const applied=await record('Native Aurora applied to ally',async()=>{await runner.execute(hero,req('aurora',ally));assert(ally.items.some(i=>i.flags?.[MOD]?.support?.kind==='aurora'),'Missing Aurora.');return 'Real support effect and source immunity saved';});
 if(!applied){await report();return;}
 const lifecycle=load('support-native.mjs').createSupportLifecycle(queue);let settle;
 const hook=Hooks.on('pf2e.startTurn',(cb,c)=>{if(c.id===combat.id&&cb.actor?.id===ally.id){const done=settle;void lifecycle.tick(ally,{id:`${c.id}:${c.round}:${cb.id}`,encounterId:c.id,combatantId:cb.id,round:c.round}).then(()=>done?.resolve(),e=>done?.reject(e));}});
 try{for(let i=0;i<3;i++)await record(`Aurora native recipient turn ${i+1}`,async()=>{
  const before=ally.system.attributes.hp.value;if(i)await nextSourceRound();
  let timer;const ticked=new Promise((resolve,reject)=>{settle={resolve,reject};timer=setTimeout(()=>reject(Error('Native recipient-turn hook did not complete.')),10000);});
  try{await combat.update({turn:combat.turns.findIndex(c=>c.actorId===ally.id)});await ticked;}finally{clearTimeout(timer);settle=null;}
  assert(ally.system.attributes.hp.value===before+10,'Expected one 10-HP tick.');return `${before} → ${ally.system.attributes.hp.value}`;
 });}finally{Hooks.off('pf2e.startTurn',hook);}
 await record('Aurora completes after three ticks and rejects replay',async()=>{
  assert(!ally.items.some(i=>i.flags?.[MOD]?.support?.kind==='aurora'),'Aurora did not end after three ticks.');const before=ally.system.attributes.hp.value;
  await lifecycle.tick(ally,{id:`${combat.id}:${combat.round}:${ally.combatant.id}`,encounterId:combat.id,combatantId:ally.combatant.id,round:combat.round});assert(ally.system.attributes.hp.value===before,'Healing repeated.');return 'Effect removed; repeated turn changes no HP';
 });
}

if(mode==='persistence'){
 const {writeTracker}=load('tracker-storage.mjs');
 await record('Prepared Gunbreaker weapon and master class DC',async()=>{assert(weapon().system.traits.value.includes('gunbreaker'),'Weapon trait was stripped.');assert(hero.system.proficiencies.classDCs.gunbreaker.rank===3,'Class DC is not master.');return `gunblade retained; DC ${hero.getStatistic('gunbreaker').dc.value}`;});
 await record('Real flag merge clears old encounter gates in one write',async()=>{
  await reset();await hero.setFlag(MOD,'tracker',{encounter:'qa-previous',once:{discipline:true,expertise:true},cooldowns:{hypervelocity:[1],aurora:[game.time.worldTime]},dailyUses:{superbolide:1}});
  const before=hero.getFlag(MOD,'tracker'),next=transition(before,{type:'start'},contextFor(hero),catalogue);await writeTracker(hero,next);
  const stored=hero.getFlag(MOD,'tracker');assert(Object.keys(stored.once).length===0&&!('hypervelocity' in stored.cooldowns),'Old encounter gates remained.');assert(stored.dailyUses.superbolide===1&&stored.cooldowns.aurora.length===1,'Longer uses were incorrectly refreshed.');return 'Encounter gates cleared; minute/day usage preserved';
 });
 await record('Real flag merge clears daily uses at new preparations',async()=>{
  const before=hero.getFlag(MOD,'tracker'),c={...contextFor(hero),encounterId:null,round:0,turn:0,inTurn:false,day:Math.floor(game.time.worldTime/86400)+1};
  const next=transition(before,{type:'daily'},c,catalogue);await writeTracker(hero,next);assert(Object.keys(hero.getFlag(MOD,'tracker').dailyUses).length===0,'Daily uses survived reset.');return 'Daily map cleared on test actor; shared world time unchanged';
 });
 await reset();
}

await report();
