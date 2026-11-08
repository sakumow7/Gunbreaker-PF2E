import {REIGN_STEPS} from './reign.mjs';
import {SUPPORTED} from './execution.mjs';
import {SAVE_ACTIONS,TARGETED_SAVES} from './area.mjs';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(v);
const token=v=>typeof v==='string'&&/^Scene\.[a-zA-Z0-9_-]+\.Token\.[a-zA-Z0-9_-]+$/.test(v);
/** Copy only the bounded intent schema. Never accept costs, outcomes or user IDs. */
export function validateIntent(raw){
  assert(plain(raw),'Invalid action request.');
  const keys=['version','id','actorUuid','sceneId','gmId','slug','weaponId','map','targetIds','revision','encounterId','round','turn'];
  assert(Object.keys(raw).every(k=>keys.includes(k)),'Unexpected action request fields.');
  assert(raw.version===1&&id(raw.id)&&id(raw.gmId)&&id(raw.sceneId)&&id(raw.weaponId),'Invalid request identifiers.');
  assert(typeof raw.actorUuid==='string'&&/^(Actor\.[a-zA-Z0-9_-]+|Scene\.[a-zA-Z0-9_-]+\.Token\.[a-zA-Z0-9_-]+\.Actor\.[a-zA-Z0-9_-]+)$/.test(raw.actorUuid),'Invalid character reference.');
  assert(SUPPORTED.has(raw.slug),'This ability is not supported by native execution.');
  assert(Number.isInteger(raw.map)&&raw.map>=0&&raw.map<=2,'Invalid attack stage.');
  assert(Array.isArray(raw.targetIds)&&raw.targetIds.length<=1&&raw.targetIds.every(t=>token(t)&&t.startsWith(`Scene.${raw.sceneId}.Token.`)),'Select at most one target on the current scene.');
  assert(!(REIGN_STEPS.has(raw.slug)||raw.slug==='bloodfest')||raw.targetIds.length===1,'Select exactly one primary enemy.');
  assert(!SAVE_ACTIONS.has(raw.slug)||(raw.map===0&&raw.targetIds.length===(TARGETED_SAVES.has(raw.slug)?1:0)),'Save activities use MAP zero; select one target for Danger Zone and no targets for emanations.');
  assert(Number.isSafeInteger(raw.revision)&&raw.revision>=0,'Invalid tracker revision.');
  assert(raw.encounterId===null||id(raw.encounterId),'Invalid encounter.');
  assert(Number.isSafeInteger(raw.round)&&raw.round>=0&&Number.isSafeInteger(raw.turn)&&raw.turn>=0,'Invalid turn.');
  return structuredClone(raw);
}
export function assertFreshIntent(intent,context,state){
  assert((state?.revision??0)===intent.revision,'Tracker changed before execution. Open the action panel again.');
  assert(context.encounterId===intent.encounterId&&context.round===intent.round&&context.turn===intent.turn,'Combat advanced before execution. Open the action panel again.');
}
/** Receives identity from the server-delivered createDocument hook, never message flags. */
export class RequestRouter {
  constructor(ports){this.ports=ports;}
  async receive(raw,creatorId){
    const p=this.ports,intent=validateIntent(raw);
    if(!p.enabled()||p.localId()!==intent.gmId||p.coordinatorId()!==intent.gmId)return null;
    const user=p.user(creatorId);
    assert(user?.active,'The requesting player is no longer connected.');
    const actor=await p.actor(intent.actorUuid);
    assert(actor?.type==='character'&&p.owns(actor,user),'You must own the requested character.');
    // execute rechecks ownership, authority and freshness after acquiring the shared queue.
    return p.execute(actor,{id:`${creatorId}:${intent.id}`,slug:intent.slug,weaponId:intent.weaponId,map:intent.map,
      targetIds:intent.targetIds,requesterId:creatorId,intent});
  }
}
