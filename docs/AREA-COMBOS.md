# Save-action automation prototype

Status: implemented for local testing in 1.4.0-beta.1. No live Forge result or release is recorded. Uses the existing native panel and optional, disabled-by-default player request transport. Exactly one active GM is required.

## Covered rules

| Ability | Actions | Damage | Resolution |
|---|---:|---|---|
| Demon Slice | 2 | ceil(level / 2)d4 slashing | Opens Demon Slaughter after all saves |
| Demon Slaughter | 2 | ceil(level / 2)d4 slashing | Requires opening; loads 1 cartridge after all saves, capped at capacity |
| Fated Circle | 2 | ceil(level / 2)d6 fire | Spends 1 cartridge; opens Brand for failed/critically failed targets |
| Fated Brand | 1 | 2d6 fire, 3d6 at level 17 | Fresh saves; original eligible targets still in range; consumes opening and shared round allowance |
| Double Down | 2 | 10d6 fire, 12d6 at level 18 | 10-foot emanation; 2 cartridges; once per minute |
| Danger Zone | 1 | ceil(level / 2)d6 fire | One enemy within 15 feet; once per 10 minutes |
| Blasting Zone upgrade | — | Danger Zone uses d8s | Range becomes 30 feet; same action and cooldown |
| Saturation Fire | 2 | ceil(level / 2)d6 fire | 30-foot line; 1 cartridge; never opens Fated Brand |
| Bow Shock | 2 | ceil(level / 2)d4 fire | 5-foot emanation; once per 10 minutes; failed saves also take persistent fire |

The four original combo abilities affect enemies in a 5-foot emanation. All covered save abilities use basic Reflex saves against the native **Gunbreaker** class DC, including on dual-class characters. Aetheric Calibration substitutes cold/electricity for Fated Circle, Fated Brand, Double Down and Saturation Fire. Danger/Blasting Zone and Bow Shock remain fire. Danger Zone never receives the area-damage predicate; the emanations and Saturation Fire do. Magical action traits are retained for native IWR predicates. Initial damage is rolled once per activity. These formulas add no weapon dice, runes, Strength, specialization or No Mercy. The GM still tracks action availability; the executor does not deduct a universal action budget.

## Interaction and authority

1. Player or GM selects the ability and held gunblade in the existing native panel. Player emanation and line requests carry no target list and MAP zero. Danger Zone carries exactly one selected enemy, also with MAP zero; the GM's own selection cannot replace it. Blasting Zone upgrades Danger Zone automatically when learned and current, rather than offering a second activation.
2. The GM sees nearby enemy candidates and confirms geometry, line of effect and the affected list. The adapter requires one acting token/combatant, a current v1.4 ability, a native Gunbreaker DC and native PF2e IWR enabled. Hidden enemy candidates and duplicate tokens sharing an actor require manual adjudication.
3. The module reserves the source and every affected actor together in its local GM queue, then checks revision, combat turn, DC, positions, allegiance and range again. Canceling before this commit changes nothing.
4. Commit cartridge costs and frequency usage and invalidate the old opening; create one native damage roll. Resolve each target's native Reflex check and retain its actual degree and chat evidence. Native save dialogs remain on the GM client.
5. After every save resolves, finish combo/cartridge state. Demon Slaughter generates its cartridge even if every target succeeds or critically succeeds. Fated Circle retains only failed-save target UUIDs. Canceling the later review cannot undo these completed rules.
6. The GM reviews damage multipliers and confirms no outstanding reaction, reroll, redirection or external damage application. Basic defaults are 2×/1×/0.5×/0×. Damage-only exceptions such as Improved Evasion can be adjusted here without changing the saved degree or Brand eligibility.
7. Apply each reviewed result once through a native contextual actor clone and native IWR; include any eligible Bow Shock persistent instance in that same application; emit a summary. A critical failure doubles save damage but is not a critical attack for immunity/resistance semantics.

## Saturation Fire line placement

Saturation Fire uses Foundry v14's native region placement. The GM places the line origin on a grid corner along the acting token's edge, then aims and confirms it. The shape is exactly 30 feet long and one 5-foot grid space wide. Native PF2e region coverage and `TokenDocument.testInsideRegion` select covered enemies, including tokens whose occupied spaces overlap the line; allies and the acting creature are excluded. The workflow does not substitute radial token distance or the player's current target selection for native line containment.

The GM still confirms genuine enemies, legal origin, special line-of-effect cases and damage exceptions. This prototype requires an active 5-foot square grid, the acting token's viewed level, a visible origin and the same elevation for intersected enemies. Other grids, vertical lines and hidden candidates need manual adjudication. The request cannot supply a region ID, coordinates or target list. Only the GM coordinator places the region, and concurrent aiming sessions are rejected before costs.

Cartridge/feature checks occur before placement. Canceling placement or the later target confirmation spends nothing. Successful completion removes the module-created preview; pre-commit validation failure also removes it. If native deletion fails, a notification requests manual removal without replaying the action. Only a region created in this session with the matching action/actor marker is eligible for cleanup.

The private journal retains the region UUID, shape, covered/blocked-space snapshot and candidate list. Native wall coverage is refreshed and compared before resolution steps. Changes to the shape, walls, grid, viewed level, source/target position or enemy membership stop the action. A post-commit interruption preserves its cartridge spend and keeps the region for GM reconciliation; reloading never resumes it automatically. Deleted or edited evidence must be reconciled manually. Region placement is a temporary scene document, not a live actor migration.

## Bow Shock persistent damage

A failure or critical failure adds 1d4 persistent fire, increasing to 2d4 at level 12. The adapter creates a deferred native persistent damage instance separately from the shared initial roll, then combines it with each failed target's scaled initial instances. It never multiplies the persistent instance, never treats the save as a critical attack, and never applies a persistent tick immediately. The native applyDamage path creates the condition and applies its usual immunity handling.

The review defaults persistent damage on for failed saves and off for successful saves. A GM may uncheck it for an exceptional rule; it cannot be added to a successful save. Adjusting the initial-damage multiplier does not change persistent eligibility. Even if initial damage is set to zero, an eligible persistent condition can still be applied alone. Subsequent end-of-turn damage and recovery checks use PF2e's existing condition controls; this module introduces no fixed duration, duplicate tick hook or automatic recovery roll.

## Recovery and concurrency

The GM-private chat journal stores snapshots, one damage roll, each save's evidence, reviewed multipliers and per-target application status. The actor execution flag stores only action ID, slug, status, journal reference and revision. Before each HP application the journal marks that target `applying`; after success it marks `complete`. An uncertain operation stays blocked for reconciliation. Do not infer that an `applying` entry means HP was unchanged.

Canceling a save after commitment, closing damage review, changed save evidence, a moved target or failed write requires GM recovery. No automatic refund, retry or replay occurs. Frequencies remain spent after a canceled save; removing an upgrade cannot provide a second Danger Zone use. A reconnected GM cannot resume an old journal automatically. Inspect native chat, actual HP/conditions and tracker state before manually reconciling it; recovery UI is still pending. Keep the private journal until reconciliation is complete.

The queue reserves all involved actor UUIDs synchronously before waiting. Overlapping module area actions and module tracker corrections therefore serialize on this GM client without acquiring locks in conflicting order. Direct actor edits, other modules, other clients and server reconnects are outside that queue. This is not a distributed lock or a guarantee against external damage duplication.

## Remaining limits

- GM confirmation supplies area geometry, visibility edge cases, line of effect, genuine enemy classification, exceptional save-damage rules and unresolved reactions. Hidden enemies are unsupported by this prototype.
- No automatic interception of third-party damage controls. The base area roll suppresses its damage buttons, but external modules must still be tested and configured to avoid duplicate application.
- Native degree adjustments are read from the actual check. Rerolls after recording stop resolution; there is no automatic reroll reconciliation.
- Optional riders including Cartridge Expertise, Fated Resolve, Executioner's Cadence and Perfect Chamber discounts are not offered by this area workflow. Use the GM manual path for those combinations; do not run this activity and then record the whole activity again.
- Reign secondary targets now share these native save/damage ports through the separate sequence coordinator in REIGN.md. Relentless Rush uses these ports through its own turn-start coordinator in RELENTLESS-RUSH.md, including legal empty emanations. External action observation, combat cleanup, full sheet UI and migration application remain separate work.

## Evidence

Local tests cover formulas, resource timing, target eligibility, fresh saves, limits, canceled/stale requests, shared rolls, partial application recovery, duplicate events, private journal markers and overlapping actor queues. Mocked native adapter tests verify Gunbreaker DC, distinct ranges, player-selected Danger Zone targeting, upgrades, frequency timing, critical-failure scaling, deferred persistent composition, and continuation after the first target dies. Saturation Fire added 11 tests for placement, containment, cancellation, membership changes and recovery coverage. The shared suite now has 164 passing local tests after the Relentless Rush stage. These tests do not prove real schema/API behavior or live numeric IWR.

Source inspection used official foundryvtt/pf2e v14-dev commit `57ba5add8352fd3162a05e0007717a93618be12a` (package 8.7.0): character class statistics; Statistic check parameters and callbacks; native CheckRoll degrees; DamageRoll.alter and DamageRoll.fromTerms with InstancePool.fromRolls; damage-card context construction; contextual clones; native applyDamage, persistent-condition creation and IWR. Critical-hit-only handling is intentionally distinct from doubled save damage. Line placement additionally follows native region shape creation, placement, refreshed grid coverage and token containment at that same commit. Complete the area acceptance cases in SMOKE-TEST.md with real GM/player clients before campaign use.
