// Rune eligibility from official PF2e v14-dev 57ba5add8352fd3162a05e0007717a93618be12a.
// Unknown/restricted runes require adjudication instead of silently inheriting melee-only effects.
export const LIGHTNING_RUNES=new Set(["ancestralEchoing", "anchoring", "ashen", "astral", "authorized", "bane", "brilliant", "coating", "conducting", "corrosive", "deathdrinking", "decaying", "demolishing", "earthbinding", "energizing", "energyVulnerability", "fearsome", "flaming", "flickering", "frost", "ghostTouch", "giantKilling", "greaterAnchoring", "greaterAshen", "greaterAstral", "greaterBrilliant", "greaterCorrosive", "greaterDecaying", "greaterEnergyVulnerability", "greaterFearsome", "greaterFlaming", "greaterFrost", "greaterGiantKilling", "greaterHauling", "greaterImpactful", "greaterShock", "greaterStriking", "greaterThundering", "grievous", "hauling", "hopeful", "impactful", "impossible", "majorStriking", "merciful", "mythicStriking", "nightmare", "pacifying", "shock", "striking", "thundering", "underwater"]);
export function lightningWeapon(source){
  const data=structuredClone(source),s=data.system;
  if(!s.traits.value.includes('gunbreaker'))throw Error('Lightning Shot requires a gunblade.');
  const unsupported=(s.runes?.property??[]).filter(r=>!LIGHTNING_RUNES.has(r));
  if(unsupported.length)throw Error(`Lightning Shot needs rune eligibility review: ${unsupported.join(', ')}.`);
  s.traits.value=s.traits.value.filter(t=>!t.startsWith('two-hand-')&&!['finesse','propulsive','thrown'].includes(t)&&!t.startsWith('thrown-'));
  s.range=30;s.maxRange=null;s.reload={value:null};s.selectedAmmoId=null;s.damage.damageType='fire';
  s.traits.toggles={modular:{selected:null},versatile:{selected:null}};
  return data;
}
export function lightningStrike(actor,weaponId){
  const items=actor.toObject().items.map(i=>i._id===weaponId?lightningWeapon(i):i);
  const clone=actor.clone({items},{keepId:true});
  const strike=clone.system.actions.find(s=>s.item.id===weaponId&&s.item.isRanged);
  if(!strike)throw Error('Native ranged gunblade usage could not be prepared.');
  return strike;
}
