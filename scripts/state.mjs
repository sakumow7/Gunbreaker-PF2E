/** Pure tracker transitions. No chat hooks, document writes, or implicit attack resolution. */
export const VERSION = 1;
export const CHAINS = Object.freeze({
  'keen-edge': {next:'brutal-shell'},
  'brutal-shell': {requires:'brutal-shell',next:'solid-barrel'},
  'solid-barrel': {requires:'solid-barrel',gain:1},
  'demon-slice': {next:'demon-slaughter'},
  'demon-slaughter': {requires:'demon-slaughter',gain:1},
  'gnashing-fang': {next:'savage-claw',family:'gnashing'},
  'savage-claw': {requires:'savage-claw',next:'wicked-talon',family:'gnashing'},
  'wicked-talon': {requires:'wicked-talon',family:'gnashing'},
  'reign-of-beasts': {next:'noble-blood',family:'reign'},
  'noble-blood': {requires:'noble-blood',next:'lion-heart',family:'reign'},
  'lion-heart': {requires:'lion-heart',family:'reign'}
});
export const FOLLOWUPS = Object.freeze({
  'burst-strike':'hypervelocity', 'gnashing-fang':'jugular-rip',
  'savage-claw':'abdomen-tear', 'wicked-talon':'eye-gouge', 'fated-circle':'fated-brand'
});
export const COSTS = Object.freeze({'burst-strike':1,'gnashing-fang':1,'fated-circle':1,'double-down':2,'saturation-fire':1});
const STRIKES = new Set(['keen-edge','brutal-shell','solid-barrel','burst-strike','gnashing-fang','savage-claw','wicked-talon','sonic-break','reign-of-beasts','noble-blood','lion-heart','lightning-shot']);
const FOLLOWUP_SET = new Set(Object.values(FOLLOWUPS));
const EXPLORATION_ACTIONS = new Set(['aurora','camouflage','nebula','heart-of-corundum','heart-of-light','superbolide','gunmetal-soul']);
export function initialState() {
  return {version:VERSION,revision:0,encounter:null,cartridges:0,combo:null,continuation:null,
    cooldowns:{},once:{},lastGnashingTurn:null,lastReignTurn:null,lastFollowRound:null,
    lastCadenceRound:null,bloodfestUntil:0,breakUntil:0,breakTurn:null,reignUntil:0,perfectUntil:0,perfectRound:null};
}
function assert(condition,message) {if(!condition) throw Error(message);}
export function capacity(state, context) {
  const learned = new Set(context.learned);
  return 3 + Number(learned.has('expanded-gauge')) + Number(learned.has('overcharged-gauge'))
    + (state.bloodfestUntil > context.time ? 3 : 0);
}
export function normalizeState(raw,context) {
  const s = {...initialState(),...structuredClone(raw ?? {})};
  assert(s.version === VERSION,'Unsupported tracker version; migrate this character before recording actions.');
  assert(Number.isFinite(context.time),'World time is unavailable.');
  if(s.encounter !== context.encounterId) {
    s.cartridges=0;s.bloodfestUntil=0;s.breakUntil=0;s.breakTurn=null;s.reignUntil=0;s.perfectUntil=0;
  }
  s.cartridges = Math.min(capacity(s,context),Math.max(0,Math.trunc(Number(s.cartridges)||0)));
  if(s.encounter !== context.encounterId || (s.combo && (context.turn > s.combo.untilTurn || (context.turn === s.combo.untilTurn && !context.inTurn)))) s.combo=null;
  if(s.encounter !== context.encounterId || !context.inTurn || s.continuation?.turn !== context.turn) s.continuation=null;
  if(s.breakUntil <= context.time || (s.breakTurn !== null && context.turn >= s.breakTurn)) {s.breakUntil=0;s.breakTurn=null;}
  return s;
}
export function transition(raw,op,context,catalogue={}) {
  const s=normalizeState(raw,context), n=structuredClone(s), learned=new Set(context.learned);
  n.revision++;
  const requireFeature=slug=>assert(learned.has(slug),`This character has not learned ${slug}.`);
  const useFrequency=(slug,spec)=>{
    if(!spec?.frequency) return;
    const seconds=({round:6,PT1M:60,PT10M:600,day:86400})[spec.frequency.per];
    assert(seconds,`Unsupported frequency for ${slug}.`);
    const uses=(n.cooldowns[slug]??[]).filter(t=>t+seconds>context.time);
    const limit=slug==='aurora' && learned.has('auroral-mastery') ? 2 : spec.frequency.max;
    assert(uses.length<limit,`${spec.name??slug} has no uses remaining for its frequency.`);
    n.cooldowns[slug]=[...uses,context.time];
  };
  if(op.type==='daily') {
    assert(!context.encounterId,'End combat before recording daily preparations.');
    return {...initialState(),revision:n.revision};
  }
  if(op.type==='start') {
    assert(context.encounterId,'Start Foundry combat before initializing the gauge.');
    assert(s.encounter!==context.encounterId,'This encounter is already initialized; it cannot be reset to gain cartridges.');
    return {...initialState(),revision:n.revision,encounter:context.encounterId,
      cartridges:learned.has('lions-legend')?2:1,cooldowns:n.cooldowns};
  }
  if(op.type==='end') {
    assert(!context.encounterId || context.encounterId!==s.encounter,'End Foundry combat before clearing the encounter.');
    return {...initialState(),revision:n.revision,cooldowns:n.cooldowns};
  }
  if(op.type==='adjust') {
    assert(context.encounterId && s.encounter===context.encounterId,'Initialize the encounter before correcting its gauge.');
    assert(Number.isInteger(op.delta) && Math.abs(op.delta)<=8,'Adjustment must be an integer from -8 to 8.');
    assert(s.cartridges+op.delta>=0,'Not enough cartridges.');
    n.cartridges=Math.min(capacity(n,context),s.cartridges+op.delta);return n;
  }
  if(op.type==='other') {n.continuation=null;return n;}
  assert(op.type==='use','Unknown tracker operation.');
  const slug=op.slug,spec=catalogue[slug];
  assert(spec,'Unknown action.');requireFeature(slug);
  const exploring=!context.encounterId && EXPLORATION_ACTIONS.has(slug);
  assert(exploring || (context.encounterId && s.encounter===context.encounterId),'Initialize this encounter in the tracker first.');
  assert(context.level >= spec.level,'This action is above your character level.');
  assert(context.wielding,'You must wield a gunblade.');
  for(const prereq of spec.prerequisites ?? [])requireFeature(prereq);
  if(!exploring && !['reaction','free','passive'].includes(spec.actionType))assert(context.inTurn,'Use this action on your own turn.');
  // Decisions remain pending until the user explicitly records an outcome.
  if(STRIKES.has(slug)) assert(['miss','hit','critical'].includes(op.outcome),'Record the Strike outcome first.');
  const hit=['hit','critical'].includes(op.outcome);
  if(STRIKES.has(slug) || FOLLOWUP_SET.has(slug)) assert(context.targetIds?.length,'Select the action target before recording it.');
  const chain=CHAINS[slug];
  if(chain?.requires)assert(s.combo?.next===chain.requires,'The required combo opening is missing or expired.');
  if(chain?.family==='gnashing')assert(s.lastGnashingTurn!==context.turn,'Only one Gnashing sequence step per turn.');
  if(chain?.family==='reign')assert(s.lastReignTurn!==context.turn,'Only one Reign sequence step per turn.');
  if(FOLLOWUP_SET.has(slug)) {
    requireFeature('continuation');
    assert(s.continuation?.slug===slug,'No valid hit-confirmed Continuation opening.');
    assert(s.lastFollowRound!==context.round,'Only one Continuation follow-up per round.');
    assert(context.inTurn && s.continuation.turn===context.turn,'The follow-up must be on the same turn.');
    assert(context.targetIds.every(id=>s.continuation.targets.includes(id)),'Continuation must affect the original eligible target(s).');
  }
  if(slug==='sonic-break') assert(s.breakUntil>context.time,'Ready to Break is missing or expired.');
  if(slug==='reign-of-beasts') assert(s.reignUntil>context.time,'Ready to Reign is missing or expired.');
  if(['demon-slice','demon-slaughter','bloodfest','fated-circle','double-down','saturation-fire'].includes(slug))assert(context.targetIds?.length,'Select at least one valid target.');
  if(slug==='fated-circle') {
    assert(['none','failed'].includes(op.outcome),'Record whether any enemy failed its save.');
    if(op.outcome==='failed')assert(op.failedTargetIds?.length && op.failedTargetIds.every(id=>context.targetIds.includes(id)),'Select the enemies that failed their saves.');
  }
  let cost=COSTS[slug]??0;
  if(slug==='heart-of-stone') {
    assert(context.targetIds?.length===1,'Select one protected creature.');
    if(context.selfTargetIds?.includes(context.targetIds[0]))assert(op.self,'Select the Aetheric Ward self-protection option.');
    if(op.self) {requireFeature('aetheric-ward');assert(op.enhance,'Aetheric Ward requires the cartridge enhancement.');}
    cost=op.enhance?1:0;
  }
  if(op.perfect) {
    assert(cost>0 && s.perfectUntil>context.time && s.perfectRound!==context.round,'Perfect Chamber cannot reduce this cost.');
    cost--;n.perfectRound=context.round;
  }
  assert(n.cartridges>=cost,'Not enough cartridges; nothing was spent or consumed.');
  // Upgrades share the original action's cooldown. Passive upgrade entries are not usable actions.
  assert(!['blasting-zone','great-nebula','aetheric-ward','auroral-mastery'].includes(slug),'Use the original action with this passive upgrade.');
  if(!FOLLOWUP_SET.has(slug)) useFrequency(slug,spec);
  n.cartridges-=cost;
  // Every intervening action, including a reaction/free action, closes the next-action window.
  n.continuation=null;
  if(FOLLOWUP_SET.has(slug)){n.continuation=null;n.lastFollowRound=context.round;}
  if(chain) {
    n.combo=chain.next?{next:chain.next,untilTurn:context.turn+1}:null;
    if(chain.family==='gnashing')n.lastGnashingTurn=context.turn;
    if(chain.family==='reign')n.lastReignTurn=context.turn;
    let gain=chain.gain??0;
    assert(!(op.expertise && op.twin),'A finisher cannot combine Cartridge Expertise and Twin Cartridge.');
    if(op.expertise){requireFeature('cartridge-expertise');assert(gain && !s.once.expertise,'Cartridge Expertise is unavailable.');n.once.expertise=true;gain=2;}
    if(op.twin){requireFeature('twin-cartridge');assert(gain,'Twin Cartridge requires a finisher.');useFrequency('twin-cartridge',catalogue['twin-cartridge']);gain=2;}
    n.cartridges+=gain;
  } else assert(!op.expertise && !op.twin,'Only a combo finisher can enhance cartridge generation.');
  if(op.discipline) {
    requireFeature('powder-discipline');assert(STRIKES.has(slug) && op.outcome==='critical' && !s.once.discipline,'Powder Discipline requires a critical hit and an unused encounter use.');
    assert(!op.cadence,'Do not combine Powder Discipline and Executioner’s Cadence.');n.once.discipline=true;n.cartridges++;
  }
  if(op.cadence) {
    requireFeature('executioners-cadence');assert(s.lastCadenceRound!==context.round,'Executioner’s Cadence was already used this round.');
    assert((slug==='wicked-talon' && op.outcome==='critical') || (slug==='double-down' && op.outcome==='critical-failure'),'Cadence requires Wicked Talon to critically hit or a Double Down target to critically fail.');
    n.lastCadenceRound=context.round;n.cartridges++;
  }
  if(FOLLOWUPS[slug] && learned.has('continuation') && (hit || (slug==='fated-circle' && op.outcome==='failed'))) {
    if(STRIKES.has(slug)) assert(context.targetIds.length===1,'Select exactly the primary Strike target.');
    n.continuation={slug:FOLLOWUPS[slug],turn:context.turn,targets:slug==='fated-circle'?[...op.failedTargetIds]:[context.targetIds[0]]};
  }
  if(slug==='no-mercy'){n.cartridges++;n.breakUntil=context.time+18;n.breakTurn=context.turn+3;}
  if(slug==='sonic-break'){n.breakUntil=0;n.breakTurn=null;}
  if(slug==='bloodfest'){n.bloodfestUntil=context.time+60;n.cartridges+=3;n.reignUntil=context.time+60;}
  if(slug==='reign-of-beasts')n.reignUntil=0;
  if(slug==='perfect-chamber')n.perfectUntil=context.time+60;
  if(slug==='twin-cartridge')throw Error('Select Twin Cartridge while recording the finisher, not as a separate action.');
  n.cartridges=Math.min(capacity(n,context),n.cartridges);
  return n;
}
