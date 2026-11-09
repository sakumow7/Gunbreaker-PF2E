export const SUPPORT_ACTIONS=new Set(['aurora','heart-of-corundum','heart-of-light','gunmetal-soul']);
export const SUPPORT_TARGETED=new Set(['aurora','heart-of-corundum']);
const MOD='gunbreaker-pf2e';
export function supportEffect(slug,source,context,target,execution){
  const level=context.level,value=Math.max(1,Math.floor(level/2)),aurora=slug==='aurora';
  if(!SUPPORT_ACTIONS.has(slug))throw Error('Unknown support action.');
  const rounds=slug==='gunmetal-soul'?1:2;
  const rules=slug==='heart-of-light'?[{key:'FlatModifier',selector:'saving-throw',type:'status',value:1,predicate:['item:type:spell']},
    {key:'Resistance',type:'custom',label:'Heart of Light (spell damage)',value,definition:['damage',{or:['item:type:spell','item:from-spell']}]}]:aurora?[]:[{key:'Resistance',type:'all-damage',value:slug==='gunmetal-soul'?level:value}];
  return {name:{aurora:'Aurora','heart-of-corundum':'Heart of Corundum','heart-of-light':'Heart of Light','gunmetal-soul':'Gunmetal Soul'}[slug],type:'effect',img:'icons/magic/defensive/shield-barrier-glowing-blue.webp',
    system:{slug:`gunbreaker-${slug}`,level:{value:level},duration:{value:aurora?-1:rounds,unit:aurora?'unlimited':'rounds',expiry:aurora?null:'turn-start',sustained:false},
      start:{value:context.time,initiative:source.combatant?.initiative??null},
      context:{origin:{actor:source.uuid,token:context.sourceToken,item:null,rollOptions:[]},target:null,roll:null},rules},
    flags:{[MOD]:{execution,support:{version:1,kind:slug,id:execution,source:source.uuid,level,value,created:context.time,
      encounterId:context.encounterId??null,sourceCombatant:source.combatant?.id??null,expiresRound:context.encounterId?context.round+rounds:null,
      recipientCombatant:target.combatant?.id??null,nextRound:target.combatant?context.round+(context.combatTurn>=context.recipientIndex?1:0):null,
      nextTime:context.time+6,ticks:0,status:'active',healing:'armed',events:[]}}}};
}
export function damageReceipt(message){
  const f=message?.flags?.pf2e,d=f?.appliedDamage;
  if(f?.context?.type!=='damage-taken'||!d||d.isHealing||d.isReverted||!d.uuid||!Array.isArray(d.updates))return null;
  const lost=d.updates.filter(u=>['system.attributes.hp.value','system.attributes.hp.temp','system.attributes.hp.sp.value'].includes(u.path)&&Number.isFinite(u.value)&&u.value>0).reduce((n,u)=>n+u.value,0);
  return lost>0?{id:message.id,actorUuid:d.uuid,lost}:null;
}
export function supportActive(effect,time){
  const s=effect.flags?.[MOD]?.support;
  return !!s&&s.status==='active'&&!effect.system?.expired&&(!effect.remainingDuration||!effect.remainingDuration.expired)
    &&(s.kind==='aurora'||time<s.created+(s.kind==='gunmetal-soul'?6:12)||effect.remainingDuration?.expired===false);
}
