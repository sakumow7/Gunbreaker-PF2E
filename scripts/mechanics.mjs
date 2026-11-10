/** Pure formula and timing helpers, shared by native execution and tests. */
export const CALIBRATED = new Set(['burst-strike','hypervelocity','jugular-rip','abdomen-tear','eye-gouge','fated-circle','fated-brand','double-down','saturation-fire','overpowered-round']);
export function calibrationType(value='fire') {
  if(!['fire','cold','electricity'].includes(value))throw Error('Invalid Aetheric Calibration; correct the tracker before executing damage.');
  return value;
}
export function damageType(slug, calibration='fire') {
  return CALIBRATED.has(slug) ? calibrationType(calibration) : 'fire';
}
export function calibratedTraits(slug,traits,calibration='fire'){
  const type=damageType(slug,calibration);
  return [...new Set(traits.map(t=>t==='fire'&&CALIBRATED.has(slug)?type:t))];
}
/** A temporary ability copy, only when its own fire trait changes. Never edit weapons or property runes. */
export function calibratedItem(item,slug,calibration='fire'){
  const traits=calibratedTraits(slug,item.system.traits.value,calibration);
  if(JSON.stringify(traits)===JSON.stringify(item.system.traits.value))return item;
  return item.clone({'system.traits.value':traits},{keepId:true});
}
export function followupFormula(level, weaponDice, type='fire') {
  if(!Number.isInteger(weaponDice)||weaponDice<1||weaponDice>4)throw Error('Opening weapon dice are unavailable.');
  if(!['fire','cold','electricity'].includes(type))throw Error('Invalid damage type.');
  return `(${level>=17?4:level>=11?3:2}d6+${weaponDice})[${type}]`;
}
export function superbolideHP(hp, level) {
  if(!Number.isFinite(hp)||hp<2)throw Error('Superbolide requires at least 2 HP.');
  return Math.max(1,hp-level);
}
export function stoneResistance(level, {enhanced=false,legend=false}={}) {
  return enhanced?(legend?4:2)+level:2+Math.floor(level/2);
}
export function strikeOutcome(degree) {
  if(![0,1,2,3].includes(degree))throw Error('The native attack has no resolved degree of success.');
  return degree===3?'critical':degree===2?'hit':'miss';
}
export function nativeWeaponDice(weapon) {
  // PF2e's prepared damage.dice already includes fundamental striking and ABP.
  const dice=weapon?.system?.damage?.dice;
  if(!Number.isInteger(dice)||dice<1||dice>4)throw Error('Cannot read prepared weapon damage dice.');
  return dice;
}
