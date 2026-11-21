const MOD='gunbreaker-pf2e';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
/** Foundry merges flags recursively; explicit deletion keys replace removed map entries in one write. */
export function trackerPatch(previous,next){
 if(!object(next))return structuredClone(next);
 const patch=Object.fromEntries(Object.entries(next).map(([key,value])=>[key,trackerPatch(object(previous)?previous[key]:undefined,value)]));
 if(object(previous))for(const key of Object.keys(previous))if(!Object.hasOwn(next,key))patch[`-=${key}`]=null;
 return patch;
}
export function writeTracker(actor,state){
 return actor.setFlag(MOD,'tracker',trackerPatch(actor.getFlag(MOD,'tracker'),state));
}
/** Replace a journal-style flag in one write; a plain setFlag would merge stale keys such as riders from the previous action. */
export function writeMarker(actor,key,value){
 return actor.setFlag(MOD,key,trackerPatch(actor.getFlag(MOD,key),value));
}
