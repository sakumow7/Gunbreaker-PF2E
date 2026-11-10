export const OUTSIDE_ACTIVITIES=new Set(['record-other-action','record-other-reaction']);
/** An explicit completed activity, with no roll, target, weapon or resource instructions. */
export function outsideActivityRequest(slug,id,expected){
 if(!OUTSIDE_ACTIVITIES.has(slug))throw Error('Unknown outside activity.');
 return {id,slug,weaponId:'none',map:0,targetIds:[],options:{},expected:{...expected}};
}
