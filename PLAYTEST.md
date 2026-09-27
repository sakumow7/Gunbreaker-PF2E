# Gunbreaker 1.3 playtest

## Design target

A mobile martial defender who alternates sword combos, cartridge bursts, and party protection. Weapon accuracy follows a normal martial rather than Fighter. Medium armor reaches expert at 7 and master at 15; Royal Guard adds +1 circumstance AC while wielding a gunblade. It does not stack with a shield's circumstance AC bonus. Damage bonuses are smaller than 1.2 because defensive tools now function reliably.

FFXIV identity retained: Keen Edge → Brutal Shell → Solid Barrel; Demon Slice → Demon Slaughter; cartridge spenders; Gnashing Fang → Savage Claw → Wicked Talon; hit-confirmed Continuation; No Mercy/Sonic Break; Bloodfest/Reign of Beasts → Noble Blood → Lion Heart; Aurora, Camouflage, Nebula, Heart of Stone/Corundum/Light, Superbolide, and Gunmetal Soul. This is an adaptation, not a numerical translation of potency or recast times. Current FFXIV and older iterations differ; reducing HP to 1 for Superbolide intentionally retains the earlier iconic version while replacing immunity with resistance.

References consulted:

- [Official FFXIV Gunbreaker job guide](https://na.finalfantasyxiv.com/jobguide/gunbreaker/)
- [PF2e Champion](https://2e.aonprd.com/Classes.aspx?ID=58)
- [PF2e Fighter](https://2e.aonprd.com/Classes.aspx?ID=35)
- [PF2e Double Slice](https://2e.aonprd.com/Feats.aspx?ID=4769)
- [Foundry PF2e native class-feature schema examples](https://github.com/foundryvtt/pf2e/tree/master/packs/classfeatures)

## Resource and action budget

- One opening cartridge means an immediate burst competes with enhanced Heart of Stone.
- Single-target generation costs three Strikes over one or more turns. Area generation costs four actions across turns and does much less damage to one creature.
- Combo progression does not depend on accuracy. Healing and Continuation still require hits; stronger enemies do not shut down the resource engine.
- Gnashing Fang costs one cartridge and has a one-minute frequency. Its three steps span at least three turns. Each Continuation consumes another action and requires the preceding hit, leaving movement and protection as real decisions.
- Bloodfest costs an action and is once per 10 minutes. Capacity grows before the cartridges are added; excess cartridges are discarded when it expires.
- No Mercy costs an action, grants a cartridge, and lasts three rounds. Its damage bonus applies only to gunblade Strikes.
- Base Heart of Stone prevents 2 + half-level damage through resistance; a cartridge raises this to 2 + level. No automatic counterattack is included. Aetheric Ward competes for the same reaction.
- Cooldowns survive encounter initialization. One-minute, ten-minute, and daily frequencies do not mean unlimited uses in every encounter. Daily preparations explicitly refresh uses.

## Numbers to compare

Run `npm run balance` for an exact d20 expectation worksheet at levels 1, 5, 7, 11, 15, and 19 against listed ACs and those ACs +2. The comparison uses a two-handed d12 weapon, normal fundamental runes, standard ability increases, and two offensive actions per turn. It includes critical outcomes and MAP. It excludes property runes, buffs, feats, off-guard, resistances, reactions, and healing. The Gunbreaker row at level 7+ averages a three-turn Gnashing sequence with Continuation on a hit and an ordinary second Strike on a miss. That is a burst window, not sustainable whole-encounter damage. The lower-level row is Burst Strike plus an ordinary Strike and consumes a cartridge.

The table compares damage against simple two-Strike baselines, not optimized full classes. It is a sanity check, not proof of balance. In particular it does not price the cartridge diverted away from protection, setup turns, or the possibility of losing a combo to control effects.

## Encounter tests still required

At levels 1, 5, 7, 11, 15, and 19, try four-round encounters against a boss two levels higher, three equal-level enemies, and a mixed ranged/melee group. Include two encounters without a ten-minute rest.

Record total damage, damage prevented on allies, healing, movement actions, cartridges gained/spent/wasted, uses of Royal Guard, unfinished combos, and turns with no useful cartridge choice. Compare a Champion and Fighter in the same encounters with equivalent gear.

Test both gunblades and shield use. Force movement, loss of reach, frightened, stunned, and immobilized should disrupt positioning without arbitrarily deleting stored combo steps. Test very low HP Superbolide, multiple damage types against resistance, two allies requesting protection in a round, and Bloodfest expiration while above normal capacity.

Tune these independently: burst dice, resource supply, protective resistance, and armor progression. Do not compensate for a save progression bug by raising damage. If Gnashing dominates, reduce its later-step bonus or follow-up damage before restoring hit-gated cartridge generation. If defense dominates, first review stacking and extra reaction usage.
