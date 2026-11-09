const results=[];
const check=async(name,fn)=>{try{results.push({name,pass:!!(await fn())});}catch(e){results.push({name,pass:false,error:e.message});}};
const ActorClass=CONFIG.Actor.documentClass;
const effect=(rules)=>({_id:'qaEffect12345678',name:'QA effect',type:'effect',system:{rules,duration:{value:-1,unit:'unlimited',expiry:null,sustained:false}}});
const npc=(rules,hp={})=>new ActorClass({name:'Gunbreaker detached QA',type:'npc',system:{details:{level:{value:18}},attributes:{hp:{value:100,max:100,...hp}}},items:[effect(rules)]});
await check('Native all-damage Resistance rule',()=>npc([{key:'Resistance',type:'all-damage',value:9}]).system.attributes.resistances.some(r=>r.type==='all-damage'&&r.value===9));
await check('Spell-only resistance excludes impulses',()=>{const a=npc([{key:'Resistance',type:'custom',label:'Spell damage',value:9,definition:['damage',{or:['item:type:spell','item:from-spell']}]}]);const r=a.system.attributes.resistances.find(r=>r.type==='custom');return r?.test(new Set(['damage','item:type:spell']))&&!r.test(new Set(['damage','origin:action:trait:impulse']));});
await check('Native DamageRoll preserves split types',async()=>{const D=CONFIG.Dice.rolls.find(c=>c.name==='DamageRoll');const r=await new D('{2[fire],3[cold]}').evaluate();return r.total===5&&r.instances.length===2;});
await check('Save doubling is not an attack critical',async()=>{const D=CONFIG.Dice.rolls.find(c=>c.name==='DamageRoll');const r=await new D('3[fire]').evaluate();const doubled=D.fromJSON(JSON.stringify(r.toJSON())).alter(2,0);doubled.options.degreeOfSuccess=null;return doubled.total===6&&doubled.options.degreeOfSuccess===null;});
await check('Lightning Shot: ranged d8 fire, Dex attack, unchanged equipment',async()=>{
 const a=new ActorClass({_id:foundry.utils.randomID(),name:'Detached gunbreaker',type:'character',system:{details:{level:{value:18}},build:{attributes:{manual:true}},abilities:{str:{mod:5},dex:{mod:2}}},items:[qaWeapon,qaClass]});
 const before=JSON.stringify(a.toObject()),strike=lightningStrike(a,qaWeapon._id),formula=await strike.damage({getFormula:true});
 results.push({name:'Lightning formula: '+formula,pass:typeof formula==='string'&&!formula.includes('d12')});
 const dex=strike.modifiers.find(m=>m.type==='ability'&&m.enabled);
 return dex?.ability==='dex'&&strike.item.isRanged&&strike.item.system.damage.die==='d8'&&strike.item.system.damage.damageType==='fire'&&strike.item.range.increment===30&&JSON.stringify(a.toObject())===before;
});
await check('Four authored support effects prepare without rule failures',()=>{
 const source={uuid:`Actor.${foundry.utils.randomID()}`,combatant:null},c={time:game.time.worldTime,level:18,round:0,encounterId:null,sourceToken:null,combatTurn:-1,recipientIndex:-1};
 return [...SUPPORT_ACTIONS].every(slug=>{const data=supportEffect(slug,source,c,{},'qa'),a=new ActorClass({name:'Detached support',type:'npc',system:{details:{level:{value:18}}},items:[{_id:foundry.utils.randomID(),...data}]});return a.items.size===1&&a.items.contents.every(i=>i.rules.every(r=>!r.ignored))&&(slug==='aurora'||a.system.attributes.resistances.length===1);});
});
await check('Native TempHP grants 9 and does not stack over 11',()=>{
 return [0,11].every(temp=>{const a=npc([{key:'TempHP',value:9}],{temp}),r=a.rules.find(r=>r.key==='TempHP'),updates={};r.broadcast=()=>{};r.onCreate(updates);return temp===0?foundry.utils.getProperty(updates,'system.attributes.hp.temp')===9:Object.keys(updates).length===0;});
});
await check('Deleting TempHP source clears only its own barrier',()=>{
 return ['qaEffect12345678','otherEffect12345'].every(tempSource=>{const a=npc([{key:'TempHP',value:9}],{temp:9,tempSource}),r=a.rules.find(r=>r.key==='TempHP'),updates={};r.onDelete(updates);return tempSource==='qaEffect12345678'?foundry.utils.getProperty(updates,'system.attributes.hp.temp')===0:Object.keys(updates).length===0;});
});
await check('Suppressing Fire creates an isolated native visual Demoralize',()=>{
 const base=game.pf2e.actions.get('demoralize'),before=JSON.stringify({traits:base.traits,modifiers:base.modifiers});
 const action=suppressingAction(base);
 return action.slug==='demoralize'&&action.traits.includes('visual')&&!action.traits.includes('auditory')&&action.modifiers.length===0&&action.rollOptions.includes('action:demoralize')&&action.rollOptions.includes('gunbreaker:action:suppressing-fire')&&JSON.stringify({traits:base.traits,modifiers:base.modifiers})===before;
});
await check('Native fear, mental, emotion and visual immunity recognize Suppressing Fire',()=>{
 const source={name:'Suppressing Fire',type:'effect',system:{traits:{value:DEMORALIZE_TRAITS},duration:{value:-1,unit:'unlimited',expiry:null},rules:[]}};
 return ['fear-effects','mental','emotion','visual'].every(type=>npc([{key:'Immunity',type}]).isImmuneTo(source));
});
await check('Foundry movement planning, completion and terrain APIs are present',()=>{
 return typeof CONFIG.Token.objectClass.prototype.planMovement==='function'&&typeof CONFIG.Token.documentClass.prototype.move==='function'&&typeof CONFIG.Token.documentClass.prototype.stopMovement==='function'&&typeof CONFIG.Token.movement.TerrainData.getMovementCostFunction==='function';
});
await check('Native path measurement uses ordinary and greater terrain costs',()=>{
 const token=new CONFIG.Token.documentClass({name:'Detached movement QA',x:0,y:0,width:1,height:1,elevation:0},{parent:canvas.scene});
 const cost=CONFIG.Token.movement.TerrainData.getMovementCostFunction(token);
 const path=[{x:0,y:0,elevation:0,width:1,height:1,action:'walk',terrain:{difficulty:2}},{x:canvas.grid.size,y:0,elevation:0,width:1,height:1,action:'walk',terrain:{difficulty:2}}];
 const measured=token.measureMovementPath(path,{cost});
 return measured.distance===5&&measured.cost===10&&cost({}, {},5,{terrain:{difficulty:3}})===15;
});
const esc=s=>foundry.utils.escapeHTML(String(s));
await foundry.applications.api.DialogV2.wait({window:{title:'Gunbreaker isolated QA results'},position:{width:680},content:`<p>Foundry ${esc(game.version)} / PF2e ${esc(game.system.version)} / installed Gunbreaker ${esc(game.modules.get('gunbreaker-pf2e')?.version)}</p><p>Detached native models only. No actors, scene, combat or HP records changed.</p><ul>${results.map(r=>`<li>${r.pass?'PASS':'FAIL'} — ${esc(r.name)}${r.error?`: ${esc(r.error)}`:''}</li>`).join('')}</ul>`,buttons:[{action:'close',label:'Close'}]});
