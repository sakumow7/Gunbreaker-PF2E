import {catalogue} from './catalogue.mjs';
const assert=(v,m)=>{if(!v)throw Error(m);};
export function followupFeat(slug){
 if(['solid-barrel','demon-slaughter'].includes(slug))return 'relentless-combo';
 if(['hypervelocity','jugular-rip','abdomen-tear','eye-gouge','fated-brand'].includes(slug))return 'continued-assault';
 return null;
}
export function followupAvailable(state,c,feat){
 return !!feat&&c.inTurn&&!!c.encounterId&&state?.encounter===c.encounterId&&c.learned.includes(feat)&&c.level>=catalogue[feat].level&&state.once?.[feat]!==c.round;
}
export function commitFollowup(state,c,feat,parentId){
 assert(followupAvailable(state,c,feat),'This optional rider is no longer available.');
 assert(state.events.at(-1)===parentId,'Another activity happened after the trigger.');
 const next=structuredClone(state);next.once[feat]=c.round;next.revision++;next.events=[...next.events,`${parentId}:${feat}`].slice(-100);next.continuation=null;return next;
}
