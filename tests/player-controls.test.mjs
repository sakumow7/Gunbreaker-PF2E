import {test} from 'node:test';
import assert from 'node:assert/strict';
import {controlsModel,availableResources,controlRequest} from '../scripts/player-controls.mjs';
import {nativePanel,panelContent,installPanelButton} from '../scripts/player-panel.mjs';
import {initialState} from '../scripts/state.mjs';
import {catalogue} from '../scripts/catalogue.mjs';
const context=()=>({time:1000,level:20,learned:Object.keys(catalogue),encounterId:'combat',round:1,turn:1,inTurn:true,wielding:true,targetIds:['Scene.scene.Token.selected']});
function fixture(){const c=context();c.learned=c.learned.filter(s=>!['twin-cartridge','overcharged-gauge'].includes(s));return {c,s:{...initialState(),encounter:'combat',revision:2,cartridges:1}};}
test('availability is read-only and gates combo, resources, cooldown, turn and busy state',()=>{
 const {c,s}=fixture(),copy=structuredClone(s);s.cooldowns['no-mercy']=[1000];copy.cooldowns['no-mercy']=[1000];
 let rows=controlsModel(s,c).rows;const row=slug=>rows.find(r=>r.slug===slug);
 assert.equal(row('keen-edge').reason,null);assert.match(row('brutal-shell').reason,/combo/);assert.match(row('double-down').reason,/cartridges/);assert.match(row('no-mercy').reason,/uses remaining/);assert.match(row('no-mercy').reason,/600 seconds/);
 assert.deepEqual(s,copy);assert(!row('hypervelocity'));
 rows=controlsModel(s,{...c,inTurn:false}).rows;assert.match(row('keen-edge').reason,/own turn/);
 rows=controlsModel(s,c,{busy:true}).rows;assert(rows.every(r=>r.reason?.includes('pending')));
});
test('only learned level-appropriate activities appear; prerequisites and migration remain enforced',()=>{
 const {c,s}=fixture();c.level=1;c.learned=['keen-edge','double-down','brutal-shell'];
 const rows=controlsModel(s,c).rows;assert.deepEqual(rows.map(r=>r.slug),['keen-edge','brutal-shell']);
 c.learned.push('twin-cartridge');assert(controlsModel(s,c).rows.every(r=>r.reason.includes('migration')));
});
test('a discount can make an activity available but it remains an explicit choice',()=>{
 const {c,s}=fixture();s.perfectUntil=1060;
 const dd=controlsModel(s,c).rows.find(r=>r.slug==='double-down');assert.equal(dd.reason,null);assert.equal(dd.needsPerfect,true);assert(dd.resources.includes('perfect'));
 s.perfectRound=1;assert.match(controlsModel(s,c).rows.find(r=>r.slug==='double-down').reason,/cartridges/);
});
test('resource choices are relevant, learned and respect usage gates',()=>{
 const {c,s}=fixture();assert.deepEqual(availableResources('royal-guard',s,c),[]);
 assert.deepEqual(availableResources('reign-of-beasts',s,c),['discipline']);
 assert.deepEqual(availableResources('solid-barrel',s,c),['expertise','discipline']);
 s.once.expertise=true;s.once.discipline=true;assert.deepEqual(availableResources('solid-barrel',s,c),[]);
 s.lastCadenceRound=1;assert.deepEqual(availableResources('double-down',s,c),[]);
});
test('Continuation shows only the actual opening and captures its original target and weapon',()=>{
 const {c,s}=fixture();s.continuation={slug:'hypervelocity',turn:1,targets:['Scene.scene.Token.original'],weaponId:'originalWeapon',weaponDice:2};
 const model=controlsModel(s,c),row=model.rows.find(r=>r.continuation);assert.equal(row.slug,'hypervelocity');assert.equal(row.reason,null);
 assert.equal(model.rows.filter(r=>r.continuation).length,1);
 const req=controlRequest(row.slug,{state:s,context:c,expected:{revision:2},weaponId:'newWeapon',map:1,id:'id'});
 assert.deepEqual(req.targetIds,['Scene.scene.Token.original']);assert.equal(req.weaponId,'originalWeapon');
 s.continuation.targets.push('other');assert.equal(req.targetIds.length,1);
 assert.equal(controlsModel(s,{...c,turn:2}).continuation,'None');
});
test('save requests clear irrelevant targets/MAP and targeted saves preserve selection',()=>{
 const {s,c}=fixture(),args={state:s,context:c,expected:{revision:2},weaponId:'blade',map:2,id:'id'};
 assert.deepEqual(controlRequest('double-down',args).targetIds,[]);assert.equal(controlRequest('double-down',args).map,0);
 assert.deepEqual(controlRequest('danger-zone',args).targetIds,c.targetIds);
});
function panelFixture(wait){
 const {s,c}=fixture();c.level=1;c.learned=['keen-edge','brutal-shell','solid-barrel'];
 const actor={uuid:'Actor.test',name:'Test',type:'character',isOwner:true,getFlag:(_m,k)=>k==='tracker'?s:null,itemTypes:{weapon:[{id:'blade',name:'Blade',type:'weapon',system:{traits:{value:['gunbreaker']},equipped:{carryType:'held',handsHeld:1}}}]}};
 globalThis.game={user:{isGM:true},settings:{get:()=>false}};
 globalThis.foundry={utils:{escapeHTML:s=>String(s).replaceAll('<','&lt;'),randomID:()=> 'click'},applications:{api:{DialogV2:{wait}}}};
 const errors=[];globalThis.ui={notifications:{error:e=>errors.push(e),info:e=>errors.push(e),warn:e=>errors.push(e)}};
 return {actor,s,c,errors};
}
test('panel captures current target at click but retains opening revision through execution',async()=>{
 let n=0,request;const f=panelFixture(async config=>{
  if(n++)return null;
  f.s.revision=3;f.c.targetIds=['Scene.scene.Token.changed'];
  const button=config.buttons.find(b=>b.action==='keen-edge');
  assert.equal(button.disabled,false);assert(config.buttons.find(b=>b.action==='brutal-shell').disabled);
  return button.callback(null,{form:{elements:{weapon:{value:'blade'},map:{value:'1'}}}});
 });
 await nativePanel(f.actor,{execute:async(_a,r)=>{request=r;}},()=>f.c);
 assert.equal(request.expected.revision,2);assert.deepEqual(request.targetIds,['Scene.scene.Token.changed']);assert.equal(request.map,1);assert.deepEqual(request.options,{});
});
test('cancel and reopening never execute; an already open panel is not duplicated',async()=>{
 let close,count=0;const f=panelFixture(()=>{count++;return new Promise(resolve=>close=resolve);});
 const runner={execute:()=>assert.fail('must not execute')};
 const pending=nativePanel(f.actor,runner,()=>f.c);await nativePanel(f.actor,runner,()=>f.c);assert.equal(count,1);
 close(null);await pending;
 foundry.applications.api.DialogV2.wait=async()=>null;await nativePanel(f.actor,runner,()=>f.c);
});
test('canceling optional resources sends no request and fresh panel replaces stale snapshot',async()=>{
 let calls=0;const f=panelFixture(async config=>{
  calls++;
  if(calls===1)return config.buttons.find(b=>b.action==='keen-edge').callback(null,{form:{elements:{weapon:{value:'blade'},map:{value:'0'}}}});
  if(calls===2){assert.match(config.content,/Powder Discipline/);assert(!config.content.includes('checked'));return null;}
  return null;
 });f.c.learned.push('powder-discipline');
 await nativePanel(f.actor,{execute:()=>assert.fail('canceled resource choice')},()=>f.c);assert.equal(calls,3);
});
test('unavailable reasons are visible and actor text is escaped',()=>{
 const f=panelFixture(async()=>null);f.actor.name='<img src=x>';
 const html=panelContent(f.actor,controlsModel(f.s,f.c),f.actor.itemTypes.weapon,'strikes');
 assert(html.includes('&lt;img'));assert(!html.includes('<img'));assert(html.includes('required combo opening'));
});
test('sheet entry only appears for owned Gunbreakers with authorized player routing',()=>{
 let hook;globalThis.Hooks={on:(name,fn)=>{assert.equal(name,'getActorSheetHeaderButtons');hook=fn;}};
 const f=panelFixture(async()=>null);f.actor.items=[{type:'class',slug:'gunbreaker'}];installPanelButton(async()=>{});
 const buttons=[];hook({actor:f.actor},buttons);hook({actor:f.actor},buttons);assert.equal(buttons.length,1);
 game.user.isGM=false;const playerButtons=[];hook({actor:f.actor},playerButtons);assert.equal(playerButtons.length,0);
 game.settings.get=()=>true;hook({actor:f.actor},playerButtons);assert.equal(playerButtons.length,1);
 f.actor.isOwner=false;const denied=[];hook({actor:f.actor},denied);assert.equal(denied.length,0);
});
