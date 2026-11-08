/** Build the same target context used by PF2e's native damage-card helper. */
export async function nativeDamageContext(actor,message,extraEffects=[]){
  const options=[...(message.flags.pf2e.context.options??[])],origin=message.actor,item=message.item;
  if(actor.alliance&&origin)options.push(`origin:${actor.alliance===origin.alliance?'ally':'enemy'}`);
  if(!options.some(o=>o.startsWith('target:')))options.push(...actor.getSelfRollOptions('target'));
  const originOptions=options.filter(o=>o.startsWith('self:')).map(o=>o.replace(/^self:/,'origin:'));
  const deferred=origin?.synthetics?.ephemeralEffects?.['damage-received']?.target??[];
  const resolvables=item?{[item.type==='spell'?'spell':'weapon']:item}:{};
  const test=[...options,...(origin?.getRollOptions(['damage-received'])??[]),...actor.getSelfRollOptions('target')];
  const effects=(await Promise.all(deferred.map(fn=>fn({test,resolvables})))).filter(Boolean).map(source=>{
    const effect=foundry.utils.deepClone(source);
    if(effect.type==='effect'){
      effect.system.context={origin:{actor:origin.uuid,token:null,item:null,spellcasting:null,rollOptions:[]},target:{actor:actor.uuid,token:null},roll:null};
      effect.system.duration={value:-1,unit:'unlimited',expiry:null,sustained:false};
    }
    return effect;
  });
  effects.push(...extraEffects);
  const clone=actor.getContextualClone(originOptions,effects);
  const itemOptions=['affliction','condition','effect'].includes(item?.type)?item.getRollOptions('item'):[];
  return {clone,rollOptions:new Set([...options.filter(o=>!/^(self|target)(:|$)/.test(o)),...itemOptions,...originOptions,...clone.getSelfRollOptions()])};
}
