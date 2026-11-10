/** Preserve mechanical evidence while ignoring the observed Dice So Nice display annotations. */
export function rollFingerprint(roll){
 const source=typeof roll?.toJSON==='function'?roll.toJSON():roll;
 function clean(value,context=''){
  if(Array.isArray(value))return value.map(v=>clean(v,context==='results'?'result':''));
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.keys(value).sort().filter(key=>!(context==='options'&&['dsnRoleManaged','dsnRole'].includes(key))&&!(context==='result'&&key==='indexThrow')).map(key=>[key,clean(value[key],key)]));
 }
 return JSON.stringify(clean(source));
}
