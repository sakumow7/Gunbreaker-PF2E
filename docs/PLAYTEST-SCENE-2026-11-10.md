# Persistent Forge playtest — 2026-11-10

After PR #18 merged, created **Gunbreaker — Verification Arena**, the **Gunbreaker — Disposable Playtest** actor folder, four linked tokens/actors (level-20 Gunbreaker, ally, two 500-HP enemies), a separate combat and the reusable **Gunbreaker — Playtest** macro. The GM views the private arena; the campaign scene remains active for players. The harness changes only the test combat’s round/turn fields; it makes no explicit world-time or world-setting update. All fixture writes are limited to marked QA actors, tokens, scene and combat; native test rolls/healing/damage create real chat evidence.

Environment: **Foundry 14.369, PF2e 8.7.0, installed Gunbreaker 1.3.0**. ABP and stamina variants were active. The macro bundles the candidate executor from the working tree, not the installed module. It records base commit `b7b74b0` and source-code checksum `73dba645758f`. The test character embeds authored features directly with class grants and ChoiceSets removed, so these results do not validate compendium import/level advancement. Support lifecycle handlers are scoped to the test combat and removed afterward; no global candidate hooks or player transport were installed.

## Integration defects fixed

1. **Prepared gunblade lost its identifying trait.** PF2e validates PC weapons against `npcAttackTraits`. Register Gunbreaker there as well as `weaponTraits`; retain other configuration keys. Live prepared gunblade validation now passes.
2. **Continuation called Array.includes on a document collection.** Use the collection's supported `some` method while retaining exact item identity validation.
3. **Dice So Nice display annotations invalidated damage fingerprints.** Native roll reconstruction gained `options.dsnRole`, `options.dsnRoleManaged` and result `indexThrow`. Canonical roll fingerprints ignore only those observed cosmetic positions and key order. Dice, results/active status, total, formula, type/flavor, outcome, persistent markers and unknown metadata remain checked. Apply the helper consistently to Continuation, area, Reign and Heart of Stone evidence.
4. **Recursive flag merges retained removed usage-map entries.** A shared tracker writer emits explicit nested deletion markers in the same flag update. Live checks verify that encounter reset removes once/round gates while preserving minute/day uses, and daily preparations remove daily-use entries. This is not an unset-then-set production write.

## Observed checks

All **23 distinct checks** have passing latest outcomes. The saved results retain every attempt, including failures. The result window displays the latest outcome for each check.

- Nine calibrated Continuation checks: fire/cold/electricity, each with ordinary damage, resistance 5 + weakness 3, and immunity. Each uses real random DamageRolls, actual native IWR and persisted NPC HP. Repeating the same execution ID produces no additional HP or chat writes. The openings are seeded fixtures; these nine checks do not claim primary-Strike integration.
- Native Keen Edge → Brutal Shell → Solid Barrel: native attacks and damage dialogs at MAP 0/1/2, combo progression, actual Brutal Shell healing and temporary HP, and cartridge generation.
- Native Burst Strike → Hypervelocity on the next source turn: Burst spends one cartridge and adds its action-predicated energy dice; the opened follow-up uses captured weapon dice and writes actual target HP once. Primary weapon damage remains on ordinary card controls and is not auto-applied by this suite.
- Fated Circle: native DC 42 saves for both adjacent enemies, one shared 10d6 roll, review, native half-damage application, one cartridge cost and no ally damage. In the final run both enemies succeeded and HP changed 500 → 485 each; an earlier 41-damage run verified half-damage rounding to 20.
- Aurora: native support confirmation creates the effect/immunity record; three real `pf2e.startTurn` events heal 200 → 210 → 220 → 230; the effect is removed after the third tick and replay does not heal again.
- Prepared gunblade identity and master Gunbreaker class DC 42.
- Persisted encounter and daily usage resets with Foundry's actual merge behavior.

## Fixture corrections and limits

The initial GM-only character defaulted to opposition; explicitly setting its alliance to party corrected enemy eligibility. Its features initially preceded its class in embedded collection order, letting class preparation overwrite the proficiency increases; recreating only the test feats after the class corrected DC 38 to DC 42. New fixtures create the class first. Updating the source array alone did not reorder the existing collection.

The first Aurora assertion ran before the asynchronous handler finished; the corrected harness waits for the matching native turn handler. A later rerun exposed skipped-turn dispatch during a direct round jump: the harness now finishes the old round and waits for native start-turn events before starting the next source round. It does not fabricate start-turn hooks. Fixture resets explicitly remove the old test tracker before reseeding; ordinary production writes use the atomic deletion-marker helper. One brief server disconnect interrupted a test reset; the page was reloaded and the disposable fixture inspected/reset before rerunning. No uncertain campaign action was replayed.

PF2e Modifiers Matter logs that it cannot identify the custom Gunbreaker DC statistic for its annotation. Native saves and damage still resolved, but compatibility with that annotation module is not verified. The broad module compatibility matrix remains open.

Still pending: candidate installation, real GM/player request/owner-choice delivery, full global-hook lifecycle and reconnect/failover acceptance, source-turn support expiry, Heart of Stone/other reaction integrations, movement/line geometry, every optional rider and level/dual-class import. This test arena is reusable evidence, not a declaration of full automation or release readiness.

Local validation: 417 tests, build, 100-source-document/package validation, balance worksheet and generated macro syntax checks pass. Private-game screenshots are not included in this repository.
