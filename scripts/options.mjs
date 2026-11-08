export function resourceOptions(raw={}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['expertise','perfect','discipline','cadence'].includes(k))||Object.values(raw).some(v=>typeof v!=='boolean'))throw Error('Invalid resource choices.');
  if(raw.discipline&&raw.cadence)throw Error('Choose Powder Discipline or Executioner’s Cadence, not both.');
  return {...raw};
}
export function resolvedOptions(raw,slug,outcome){
  const options=resourceOptions(raw);
  if(outcome!=='critical')delete options.discipline;
  if(!(slug==='wicked-talon'&&outcome==='critical')&&!(slug==='double-down'&&outcome==='critical-failure'))delete options.cadence;
  return options;
}
export function validateResourceOptions(raw,slug,context,state){
 const options=resourceOptions(raw),learned=new Set(context.learned);
 for(const [key,feat] of [['expertise','cartridge-expertise'],['perfect','perfect-chamber'],['discipline','powder-discipline'],['cadence','executioners-cadence']])if(options[key]&&!learned.has(feat))throw Error(`This character has not learned ${feat}.`);
 if(options.discipline&&(state.once.discipline||!['keen-edge','brutal-shell','solid-barrel','burst-strike','gnashing-fang','savage-claw','wicked-talon','sonic-break','lightning-shot'].includes(slug)))throw Error('Powder Discipline is unavailable for this action.');
 if(options.cadence&&(!['wicked-talon','double-down'].includes(slug)||state.lastCadenceRound===context.round))throw Error('Executioner’s Cadence is unavailable for this action.');
 return options;
}
