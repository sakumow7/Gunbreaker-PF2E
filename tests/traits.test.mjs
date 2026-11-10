import test from 'node:test';
import assert from 'node:assert/strict';
import {registerGunbreakerTraits} from '../scripts/traits.mjs';
test('registration preserves the gunblade trait in PC weapon native attack-trait validation',()=>{
 const cfg=Object.fromEntries(['classTraits','featTraits','actionTraits','weaponTraits','npcAttackTraits','creatureTraits','effectTraits','baseWeaponTypes'].map(k=>[k,{existing:'untouched'}]));
 registerGunbreakerTraits(cfg);registerGunbreakerTraits(cfg);
 assert.equal(cfg.npcAttackTraits.gunbreaker,cfg.weaponTraits.gunbreaker);
 assert('gunbreaker' in cfg.npcAttackTraits);assert.equal(cfg.baseWeaponTypes.gunblade,'Gunblade');
 for(const value of Object.values(cfg))assert.equal(value.existing,'untouched');
});
