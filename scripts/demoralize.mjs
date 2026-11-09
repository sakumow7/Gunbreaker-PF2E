const MOD='gunbreaker-pf2e';
export const DEMORALIZE_TRAITS=['visual','concentrate','emotion','fear','mental'];
/** Build a separate native action; never mutate the shared system action or global language penalties. */
export function suppressingAction(base){
 if(!base||base.slug!=='demoralize'||typeof base.use!=='function')throw Error('Native Demoralize action is unavailable.');
 return new base.constructor({cost:1,name:'Suppressing Fire',description:base.description,img:base.img,slug:'demoralize',section:'skill',statistic:'intimidation',difficultyClass:'will',traits:[...DEMORALIZE_TRAITS],modifiers:[],notes:base.notes,rollOptions:['gunbreaker:action:suppressing-fire']});
}
export function demoralizeEvidence(message){
 const c=message?.flags?.pf2e?.context;
 if(!message.isCheckRoll||c?.type!=='skill-check'||!c.options?.includes('action:demoralize')||!c.target?.actor||!message.actor?.uuid||![0,1,2,3].includes(message.rolls?.[0]?.degreeOfSuccess))return null;
 if(c.isReroll)return null;
 return {id:message.id,source:message.actor.uuid,target:c.target.actor,managed:c.options.includes('gunbreaker:action:suppressing-fire')};
}
export function immunityActive(entries,source,time){return (entries??[]).some(e=>e.source===source&&e.until>time);}
export function immunityEntry(source,time,id){return {source,until:time+600,event:id};}
export function frightenedValue(degree){if(![0,1,2,3].includes(degree))throw Error('Demoralize has no resolved native outcome.');return Math.max(0,degree-1);}
export async function setFrightenedAtLeast(actor,value){
 const current=actor.getCondition('frightened')?.value??0;
 if(value<=current)return;
 // PF2e's value parameter is an addend. A maximum plus a current-value check preserves stronger frightened.
 const condition=await actor.increaseCondition('frightened',{value,max:value});
 if(!condition)throw Error('Native frightened condition was not created.');
}
export function installDemoralizeObserver(queue){
 Hooks.on('createChatMessage',(message,_options,creator)=>{
  const evidence=demoralizeEvidence(message);if(!evidence||evidence.managed||!game.user.isGM||game.users.filter(u=>u.active&&u.isGM).length!==1)return;
  const time=game.time.worldTime;
  void (async()=>{
   const user=game.users.get(creator),target=await fromUuid(evidence.target);
   if(!user||message.author?.id!==creator||!message.actor.testUserPermission(user,'OWNER')||!target?.isOwner)return;
   await queue.run(target,async()=>{
    if(!game.user.isGM||game.users.filter(u=>u.active&&u.isGM).length!==1)return;
    const old=(target.getFlag(MOD,'demoralizeImmunity')??[]).filter(e=>e.until>time);
    // An attempt against an already immune creature does not extend its immunity.
    if(immunityActive(old,evidence.source,time))return;
    await target.setFlag(MOD,'demoralizeImmunity',[...old,immunityEntry(evidence.source,time,evidence.id)]);
   });
  })().catch(e=>ui.notifications.warn(`Gunbreaker Demoralize immunity: ${e.message}`));
 });
}
