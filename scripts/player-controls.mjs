import {catalogue} from './catalogue.mjs';
import {SUPPORTED,CORE_STRIKES,CORE_FOLLOWUPS} from './execution.mjs';
import {SAVE_ACTIONS,TARGETED_SAVES} from './area.mjs';
import {REIGN_STEPS} from './reign.mjs';
import {normalizeState,transition,capacity,COSTS} from './state.mjs';
import {validateResourceOptions} from './options.mjs';

export const RESOURCE_LABELS={expertise:'Cartridge Expertise — gain an extra cartridge',perfect:'Perfect Chamber — reduce this cost by 1',discipline:'Powder Discipline — gain a cartridge on a critical hit',cadence:'Executioner’s Cadence — gain a cartridge on a qualifying critical result'};
const followups=new Set([...CORE_FOLLOWUPS,'fated-brand']);
const powers=new Set([...REIGN_STEPS,'no-mercy','bloodfest','sonic-break','perfect-chamber']);
export function controlGroup(slug){return SAVE_ACTIONS.has(slug)?'area':powers.has(slug)?'powers':CORE_STRIKES.has(slug)||followups.has(slug)?'strikes':'support';}

/** Only offer optional spends/gains that can apply to this activity. Never select them automatically. */
export function availableResources(slug,state,c){
  const candidates={
    expertise:c.learned.includes('cartridge-expertise')&&['solid-barrel','demon-slaughter'].includes(slug)&&!state.once.expertise,
    perfect:c.learned.includes('perfect-chamber')&&(COSTS[slug]??0)>0&&state.perfectUntil>c.time&&state.perfectRound!==c.round,
    discipline:c.learned.includes('powder-discipline'),cadence:c.learned.includes('executioners-cadence')
  };
  return Object.keys(candidates).filter(key=>{
    if(!candidates[key])return false;
    try{validateResourceOptions({[key]:true},slug,c,state);return true;}catch{return false;}
  });
}

/** Read-only availability: simulate rule prerequisites, never pretend to validate range or targets. */
export function controlsModel(raw,c,{busy=false}={}){
  let state=normalizeState(raw,c);
  if(c.encounterId&&state.encounter!==c.encounterId)state=transition(state,{type:'start'},c,catalogue);
  const rows=[...SUPPORTED].filter(slug=>c.learned.includes(slug)&&catalogue[slug].level<=c.level)
    .filter(slug=>!followups.has(slug)||state.continuation?.slug===slug)
    .map(slug=>{
      const resources=availableResources(slug,state,c);
      // Targets are acquired at click time (or by the GM area workflow), not when opening the panel.
      const previewContext={...c,targetIds:followups.has(slug)?state.continuation?.targets??[]:['preview'],selfTargetIds:[]};
      const check=options=>{
        try{
          if(busy)throw Error('Resolve the pending action with the GM.');
          transition(state,{type:'use',slug,outcome:slug==='fated-circle'?'none':'miss',...options},previewContext,catalogue);
          return null;
        }catch(e){return e.message;}
      };
      let reason=check({}),needsPerfect=false;
      if(reason&&resources.includes('perfect')&&!check({perfect:true})){reason=null;needsPerfect=true;}
      const spec=catalogue[slug];
      const period=({PT1M:60,PT10M:600})[spec.frequency?.per];
      const expiries=(state.cooldowns[slug]??[]).map(t=>t+(period??0)).filter(t=>t>c.time);
      if(reason?.includes('uses remaining')&&period&&expiries.length)reason+=` Next use in ${Math.ceil(Math.min(...expiries)-c.time)} seconds of world time.`;
      const cost=spec.actionType==='free'?'Free':`${spec.actions??1} action${spec.actions===1?'':'s'}`;
      return {slug,name:spec.name,group:controlGroup(slug),cost,reason,needsPerfect,resources,continuation:followups.has(slug)};
    });
  return {state,capacity:capacity(state,c),rows,reaction:state.lastReactionTurn===c.turn?'Spent':'Not marked spent',
    combo:catalogue[state.combo?.next]?.name??'None',continuation:catalogue[state.continuation?.slug]?.name??'None'};
}

/** A new bounded request; current selection is captured before any optional-resource dialog. */
export function controlRequest(slug,{state,context,expected,weaponId,map,id}){
  const targets=CORE_FOLLOWUPS.has(slug)?[...(state.continuation?.targets??[])]:[...(context.targetIds??[])];
  return {id,slug,weaponId:CORE_FOLLOWUPS.has(slug)?state.continuation?.weaponId??weaponId:weaponId,
    map:SAVE_ACTIONS.has(slug)?0:map,targetIds:SAVE_ACTIONS.has(slug)&&!TARGETED_SAVES.has(slug)?[]:targets,expected:{...expected}};
}
