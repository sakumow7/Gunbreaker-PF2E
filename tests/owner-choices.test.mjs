import test from 'node:test';
import assert from 'node:assert/strict';
import {OwnerChoiceBroker,validChoicePrompt,validChoiceResponse} from '../scripts/owner-choices.mjs';
import {installOwnerChoices} from '../scripts/owner-choices-native.mjs';
const flush=()=>new Promise(r=>setImmediate(r));
function harness(){
 const h={now:1000,scene:'scene',sent:[],timers:new Map(),serial:0,authorizations:0};
 h.actor={uuid:'Actor.hero'};h.request={id:'player:action',requesterId:'player'};h.options={title:'Continued Assault',text:'Choose your optional rider.',choices:[{id:'step',label:'Step'},{id:'ally0',label:'Protect ally'}]};
 h.broker=new OwnerChoiceBroker({authorize:async()=>{h.authorizations++;if(h.denied)throw Error('permission changed');},id:()=>`choice${++h.serial}`,gmId:()=> 'gm',sceneId:()=>h.scene,now:()=>h.now,
  timer:(fn,ms)=>{h.timers.set(fn,ms);return fn;},clearTimer:fn=>h.timers.delete(fn),send:async p=>{h.sent.push(p);await h.onSend?.(p);if(h.sendError)throw Error('network');}});
 h.ask=()=>h.broker.ask(h.actor,h.request,h.options);
 h.reply=(choiceId='step',creator='player',author=creator)=>h.broker.receive({version:1,id:h.sent.at(-1).id,choiceId},creator,author);
 return h;
}
test('a current owner choice resolves once and copies the original options',async()=>{
 const h=harness(),p=h.ask();await flush();h.options.choices[0].id='changed';await h.reply('step');assert.equal(await p,'step');assert.equal(h.broker.pending.size,0);assert.equal(h.timers.size,0);
 await h.reply('ally0');assert.equal(h.authorizations,2);
});
test('a response may arrive before create finishes, without losing acknowledgement',async()=>{
 const h=harness();h.onSend=()=>h.reply('ally0');assert.equal(await h.ask(),'ally0');
});
test('request and response identity are copied before asynchronous authorization',async()=>{
 const h=harness();let resume;h.broker.ports.authorize=()=>new Promise(r=>resume=r);
 const pending=h.ask();h.request.requesterId='intruder';h.options.choices[0].id='changed';resume();await flush();
 assert.equal(h.sent[0].ownerId,'player');assert.equal(h.sent[0].choices[0].id,'step');
 const response={version:1,id:h.sent[0].id,choiceId:'step'},receiving=h.broker.receive(response,'player','player');response.choiceId='ally0';resume();await receiving;assert.equal(await pending,'step');
});
test('unrelated creators, spoofed authors, invalid choices and oversized payloads do not settle',async()=>{
 const h=harness(),p=h.ask();await flush();
 await h.reply('step','intruder');await h.reply('step','player','gm');await h.reply('other');
 await h.broker.receive({version:1,id:h.sent[0].id,choiceId:'step',actorUuid:'Actor.other'},'player','player');
 assert.equal(h.broker.pending.size,1);await h.reply(null);assert.equal(await p,null);
});
test('one pending choice per actor; another character may ask independently',async()=>{
 const h=harness(),p=h.ask();await flush();await assert.rejects(h.ask(),/unresolved/);
 const other=h.broker.ask({uuid:'Actor.other'},h.request,h.options);await flush();assert.equal(h.sent.length,2);
 await h.reply(null);await other;await h.broker.receive({version:1,id:h.sent[0].id,choiceId:'step'},'player','player');await p;
});
test('timeout and late responses never auto-decline or revive the parent execution',async()=>{
 const h=harness(),p=h.ask(),rejected=assert.rejects(p,/did not answer/);await flush();
 for(const fn of [...h.timers.keys()])fn();await rejected;await h.reply();assert.equal(h.broker.pending.size,0);assert.equal(h.sent.length,1);
});
for(const reason of ['permission','scene','expired'])test(`changed ${reason} fails closed before returning a choice`,async()=>{
 const h=harness(),p=h.ask(),rejected=assert.rejects(p,/changed|expired/);await flush();
 if(reason==='permission')h.denied=true;if(reason==='scene')h.scene='other';if(reason==='expired')h.now=61000;
 await h.reply();await rejected;assert.equal(h.broker.pending.size,0);
});
test('uncertain delivery fails and a later response cannot resume it',async()=>{
 const h=harness();h.sendError=true;await assert.rejects(h.ask(),/uncertain/);await h.reply();assert.equal(h.timers.size,0);
});
test('broker reload ignores pre-existing response documents',async()=>{
 const h=harness();await h.broker.receive({version:1,id:'old',choiceId:'step'},'player','player');assert.equal(h.authorizations,0);
});
test('prompt schema bounds identities, options and expiry without accepting execution data',async()=>{
 const h=harness(),p=h.ask();await flush();const raw=h.sent[0];assert(validChoicePrompt(raw,h.now));
 for(const bad of [{...raw,expiresAt:h.now},{...raw,actorUuid:'Actor.x.Item.y'},{...raw,choices:[{id:'step',label:'One'},{id:'step',label:'Two'}]},{...raw,cartridges:3},{...raw,choices:Array(51).fill(raw.choices[0])}])assert(!validChoicePrompt(bad,h.now));
 assert(!validChoiceResponse({version:1,id:raw.id,choiceId:{target:'forged'}}));await h.reply(null);await p;
});
function nativeFixture(player=true){
 const h={hooks:new Map(),sent:[],dialogs:[],warnings:[],choice:'step'};
 const users=[{id:'gm',active:true,isGM:true,viewedScene:'scene'},{id:'player',active:true,isGM:false,viewedScene:'scene'},{id:'other',active:true,isGM:false,viewedScene:'scene'}];users.get=id=>users.find(u=>u.id===id);
 globalThis.game={user:users[player?1:0],users,time:{get serverTime(){return Date.now();}},settings:{get:()=>true}};
 globalThis.canvas={scene:{id:'scene'}};globalThis.Hooks={on:(n,fn)=>h.hooks.set(n,fn)};
 globalThis.foundry={utils:{randomID:()=> 'unique',escapeHTML:s=>s.replaceAll('<','&lt;')},applications:{api:{DialogV2:{wait:async cfg=>{h.dialogs.push(cfg);await h.onDialog?.();return h.choice;}}}}};
 globalThis.ui={notifications:{warn:s=>h.warnings.push(s)}};
 h.actor={uuid:'Actor.hero',isOwner:true,type:'character',testUserPermission:()=>true};globalThis.fromUuid=async()=>h.actor;
 globalThis.ChatMessage={create:async data=>{h.sent.push(data);return {};}};
 h.api=installOwnerChoices();h.prompt={version:1,id:'unique',parentId:'player:action',actorUuid:'Actor.hero',gmId:'gm',ownerId:'player',sceneId:'scene',title:'Continued Assault',text:'Choose <safely>',choices:[{id:'step',label:'Step'}],expiresAt:Date.now()+60000};
 h.deliver=(payload,creator='gm',author=creator)=>h.hooks.get('createChatMessage')({author:{id:author},getFlag:(_m,key)=>payload[key]}, {},creator);
 return h;
}
test('player sees a verified private GM prompt and sends only its choice ID',async()=>{
 const h=nativeFixture();h.deliver({riderPrompt:h.prompt});await flush();assert.equal(h.dialogs.length,1);assert(h.dialogs[0].content.includes('&lt;safely>'));
 assert.deepEqual(h.sent[0].whisper,['gm','player']);assert.deepEqual(h.sent[0].flags['gunbreaker-pf2e'].riderChoice,{version:1,id:'unique',choiceId:'step'});
 h.deliver({riderPrompt:h.prompt});await flush();assert.equal(h.dialogs.length,1);assert(!h.hooks.has('updateChatMessage'));
});
test('player-created or edited prompt flags, other owners and lost ownership do not prompt',async()=>{
 const h=nativeFixture();h.deliver({riderPrompt:h.prompt},'player');h.deliver({riderPrompt:h.prompt},'gm','player');h.deliver({riderPrompt:{...h.prompt,ownerId:'other'}});await flush();assert.equal(h.dialogs.length,0);
 h.actor.isOwner=false;h.deliver({riderPrompt:h.prompt});await flush();assert.equal(h.dialogs.length,0);
});
test('closing a prompt sends a decline; changed scene after opening sends nothing',async()=>{
 const h=nativeFixture();h.choice=null;h.deliver({riderPrompt:h.prompt});await flush();assert.equal(h.sent[0].flags['gunbreaker-pf2e'].riderChoice.choiceId,null);
 const f=nativeFixture();f.onDialog=()=>canvas.scene.id='other';f.deliver({riderPrompt:f.prompt});await flush();assert.equal(f.sent.length,0);assert.equal(f.warnings.length,1);
});
test('prompt edits after creation cannot change displayed or submitted choices',async()=>{
 const h=nativeFixture();h.deliver({riderPrompt:h.prompt});h.prompt.choices[0].id='forged';h.prompt.text='changed';await flush();
 assert(h.dialogs[0].content.includes('&lt;safely>'));assert.equal(h.sent[0].flags['gunbreaker-pf2e'].riderChoice.choiceId,'step');
});
test('missing server time cannot open or send a rider prompt',async()=>{
 const h=nativeFixture();game.time={};h.deliver({riderPrompt:h.prompt});await flush();assert.equal(h.dialogs.length,0);assert.equal(h.sent.length,0);assert.match(h.warnings[0],/server time/);
});
test('GM requests are private and reject lost ownership, disabled setting or another scene',async()=>{
 const h=nativeFixture(false),p=h.api.ask(h.actor,{id:'parent',requesterId:'player'},{title:'Rider',text:'Choose',choices:[{id:'step',label:'Step'}]});await flush();
 assert.deepEqual(h.sent[0].whisper,['gm','player']);assert.equal(h.dialogs.length,0);
 h.deliver({riderChoice:{version:1,id:'unique',choiceId:'step'}},'player');assert.equal(await p,'step');
 game.users.get('player').viewedScene='other';await assert.rejects(h.api.ask(h.actor,{id:'two',requesterId:'player'},{title:'Rider',text:'Choose',choices:[{id:'step',label:'Step'}]}),/same scene/);
 game.users.get('player').viewedScene='scene';game.settings.get=()=>false;await assert.rejects(h.api.ask(h.actor,{id:'two',requesterId:'player'},{}),/enabled/);
});
