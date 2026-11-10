import {OwnerChoiceBroker,validChoicePrompt} from './owner-choices.mjs';
const MOD='gunbreaker-pf2e';
const esc=v=>foundry.utils.escapeHTML(String(v));
const clock=()=>{const time=game.time?.serverTime;if(!Number.isFinite(time))throw Error('Foundry server time is unavailable.');return time;};
const singleGM=()=>game.users.filter(u=>u.active&&u.isGM).length===1;

export function installOwnerChoices(){
 const seen=new Map();
 const authorize=async(actor,userId)=>{
  if(!game.user.isGM||!game.user.active||!singleGM()||!game.settings.get(MOD,'playerRequests'))throw Error('Player rider choices require the active GM and player requests enabled.');
  const user=game.users.get(userId);
  if(!user?.active||user.isGM||!actor?.isOwner||actor.type!=='character'||!actor.testUserPermission(user,'OWNER'))throw Error('Rider owner permission or connection changed.');
  if(user.viewedScene!==canvas.scene?.id)throw Error('The rider owner and GM must view the same scene.');
 };
 const broker=new OwnerChoiceBroker({authorize,id:()=>foundry.utils.randomID(),gmId:()=>game.user.id,sceneId:()=>canvas.scene?.id,now:clock,
  timer:(fn,ms)=>setTimeout(fn,ms),clearTimer:id=>clearTimeout(id),
  send:prompt=>ChatMessage.create({author:game.user.id,whisper:[prompt.gmId,prompt.ownerId],content:`<p>${esc(prompt.title)} — awaiting the acting player’s choice.</p>`,flags:{[MOD]:{riderPrompt:prompt}}})});

 async function showPrompt(raw,creatorId,authorId){
  const now=clock();
  if(!validChoicePrompt(raw,now))return;
  const p=structuredClone(raw),gm=game.users.get(creatorId);
  if(!gm?.active||!gm.isGM||creatorId!==authorId||p.gmId!==creatorId||p.ownerId!==game.user.id||game.user.isGM||!singleGM()||!game.settings.get(MOD,'playerRequests')||canvas.scene?.id!==p.sceneId)return;
  for(const [key,expiry] of seen)if(expiry<=now)seen.delete(key);
  if(seen.has(p.id))return;
  seen.set(p.id,p.expiresAt);
  const actor=await fromUuid(p.actorUuid);
  if(!actor?.isOwner||actor.type!=='character')return;
  // DialogV2 substitutes the button action for nullish callback values; false is an explicit decline.
  const choice=await foundry.applications.api.DialogV2.wait({window:{title:p.title},rejectClose:false,
   content:`<p>${esc(p.text)}</p><p>Choose within 60 seconds. Closing or Skip declines this rider only; the parent ability has already resolved.</p>`,
   buttons:[...p.choices.map(c=>({action:c.id,label:esc(c.label),callback:()=>c.id})),{action:'skip-rider',label:'Skip',callback:()=>false}]});
  if(clock()>=p.expiresAt||!actor.isOwner||canvas.scene?.id!==p.sceneId||!game.settings.get(MOD,'playerRequests')||!game.users.get(p.gmId)?.active||!singleGM()){
   ui.notifications.warn('The rider choice is no longer current. Ask the GM to reconcile the action.');return;
  }
  const choiceId=choice===false||choice===undefined?null:choice;
  if(choiceId!==null&&!p.choices.some(c=>c.id===choiceId))return;
  await ChatMessage.create({author:game.user.id,whisper:[p.gmId,p.ownerId],content:`<p>${esc(p.title)} — player choice submitted.</p>`,
   flags:{[MOD]:{riderChoice:{version:1,id:p.id,choiceId}}}});
 }
 Hooks.on('createChatMessage',(message,_options,creatorId)=>{
  // Capture flags and identity before any async work. Only creation events are actionable.
  const prompt=message.getFlag(MOD,'riderPrompt'),response=message.getFlag(MOD,'riderChoice'),authorId=message.author?.id;
  if(prompt&&!game.user.isGM)void showPrompt(structuredClone(prompt),creatorId,authorId).catch(e=>ui.notifications.warn(`Gunbreaker rider: ${e.message}`));
  if(response&&game.user.isGM)void broker.receive(structuredClone(response),creatorId,authorId).catch(e=>ui.notifications.warn(`Gunbreaker rider: ${e.message}`));
 });
 return {ask:(actor,request,options)=>broker.ask(actor,request,options)};
}
