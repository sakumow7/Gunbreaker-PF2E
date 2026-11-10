/** Weapons validate against npcAttackTraits during native preparation, including PC weapons. */
export function registerGunbreakerTraits(cfg){
 if(!cfg)return;
 for(const key of ['classTraits','featTraits','actionTraits','weaponTraits','npcAttackTraits','creatureTraits','effectTraits'])if(cfg[key])cfg[key].gunbreaker='GUNBREAKER.TraitGunbreaker';
 if(cfg.baseWeaponTypes)cfg.baseWeaponTypes.gunblade='Gunblade';
}
