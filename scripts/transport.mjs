import {RequestRouter,validateIntent} from './requests.mjs';
import {activeGM} from './native.mjs';
import {SAVE_ACTIONS,TARGETED_SAVES} from './area.mjs';
const MOD='gunbreaker-pf2e';
/** Document lifecycle transport. No raw socket RPC or caller-supplied identity. */
export function installRequests(runner,contextFor){
  const pending=new Map();
  const router=new RequestRouter({enabled:()=>game.settings.get(MOD,'playerRequests'),
    localId:()=>game.user.id,coordinatorId:()=>activeGM()?.id,user:id=>game.users.get(id),
    actor:uuid=>fromUuid(uuid),owns:(actor,user)=>actor.testUserPermission(user,'OWNER'),
    execute:(actor,request)=>runner.execute(actor,request)});
  Hooks.on('createChatMessage',(message,_options,creatorId)=>{
    const raw=message.getFlag(MOD,'request');
    if(!raw||!game.user.isGM)return;
    // Capture before the first await. Edits to a request card cannot alter queued work.
    const intent=structuredClone(raw);
    if(intent.gmId!==game.user.id||activeGM()?.id!==game.user.id||!game.settings.get(MOD,'playerRequests'))return;
    void (async()=>{
      let response;
      try{
        if(message.author?.id!==creatorId)throw Error('Request author does not match its creator.');
        const result=await router.receive(intent,creatorId);
        if(!result)return;
        response={id:intent.id,status:result.status,duplicate:!!result.duplicate};
      }catch(e){response={id:intent.id,status:'error',error:String(e.message??e).slice(0,300)};}
      try{
        await message.update({[`flags.${MOD}.response`]:response,
          content:`<p>Gunbreaker action: ${foundry.utils.escapeHTML(response.status)}${response.error?` — ${foundry.utils.escapeHTML(response.error)}`:''}.</p>`});
      }catch{ui.notifications.warn('Gunbreaker result could not be delivered. Check the actor execution journal before retrying.');}
    })();
  });
  Hooks.on('updateChatMessage',(message,changes,_options,updaterId)=>{
    if(!changes.flags?.[MOD]?.response)return;
    const response=message.getFlag(MOD,'response'),entry=pending.get(response?.id);
    // A player editing their own request cannot forge a GM acknowledgement.
    if(!entry||updaterId!==entry.gmId||message.getFlag(MOD,'request')?.id!==response.id)return;
    clearTimeout(entry.timer);pending.delete(response.id);
    if(response.status==='error')entry.reject(Error(response.error));else entry.resolve(response);
    if(entry.timedOut)ui.notifications.info(`Gunbreaker delayed result: ${response.status}. Inspect the actor before another action.`);
  });
  return {async execute(actor,request){
    if(game.user.isGM&&activeGM()?.id===game.user.id)return runner.execute(actor,request);
    if(!game.settings.get(MOD,'playerRequests'))throw Error('Experimental player requests are disabled.');
    if(request.options&&Object.keys(request.options).length)throw Error('Optional feat riders are not yet supported by player requests.');
    const gm=activeGM();if(!gm)throw Error('An active GM coordinator is required.');
    if(game.users.filter(u=>u.active&&u.isGM).length!==1)throw Error('Experimental player routing requires exactly one active GM.');
    if(!actor?.isOwner||actor.type!=='character')throw Error('Select an owned character.');
    if([...pending.values()].some(p=>p.actorUuid===actor.uuid))throw Error('This character has an unresolved request. Wait for its GM result before acting again.');
    const c=contextFor(actor),expected=request.expected??{revision:actor.getFlag(MOD,'tracker')?.revision??0,encounterId:c.encounterId,round:c.round,turn:c.turn};
    const intent=validateIntent({version:1,id:request.id??foundry.utils.randomID(),actorUuid:actor.uuid,sceneId:canvas.scene?.id,
      gmId:gm.id,slug:request.slug,weaponId:request.weaponId,map:SAVE_ACTIONS.has(request.slug)?0:request.map??0,targetIds:SAVE_ACTIONS.has(request.slug)&&!TARGETED_SAVES.has(request.slug)?[]:request.targetIds??c.targetIds,...expected});
    if(pending.has(intent.id))throw Error('This request identifier is already pending.');
    // Register before create: the GM may answer before create's promise resolves.
    return new Promise((resolve,reject)=>{
      const entry={actorUuid:actor.uuid,gmId:gm.id,resolve,reject,timedOut:false};pending.set(intent.id,entry);
      entry.timer=setTimeout(()=>{
        entry.timedOut=true;
        reject(Error('No GM result yet. The request may have executed; do not repeat it. Have the GM inspect the execution journal.'));
        // Retain the local pending guard until a genuine GM acknowledgement arrives.
      },90000);
      ChatMessage.create({author:game.user.id,whisper:[...new Set([gm.id,game.user.id])],
        content:'<p>Gunbreaker action requested. Awaiting the GM result.</p>',flags:{[MOD]:{request:intent}}})
        .catch(()=>{
          clearTimeout(entry.timer);entry.timedOut=true;
          reject(Error('Request delivery is uncertain. It may have executed; have the GM inspect the execution journal before retrying.'));
        });
    });
  }};
}
