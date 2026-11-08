# Core area automation prototype

Status: implemented for local testing in 1.4.0-beta.1. No live Forge result or release is recorded. Uses the existing native panel and optional, disabled-by-default player request transport. Exactly one active GM is required.

## Covered rules

| Ability | Actions | Damage | Resolution |
|---|---:|---|---|
| Demon Slice | 2 | ceil(level / 2)d4 slashing | Opens Demon Slaughter after all saves |
| Demon Slaughter | 2 | ceil(level / 2)d4 slashing | Requires opening; loads 1 cartridge after all saves, capped at capacity |
| Fated Circle | 2 | ceil(level / 2)d6 fire | Spends 1 cartridge; opens Brand for failed/critically failed targets |
| Fated Brand | 1 | 2d6 fire, 3d6 at level 17 | Fresh saves; original eligible targets still in range; consumes opening and shared round allowance |

All four affect enemies in a 5-foot emanation and use basic Reflex saves against the native **Gunbreaker** class DC, including on dual-class characters. Aetheric Calibration substitutes cold/electricity for the two fire formulas. Damage is rolled once per activity. These formulas add no weapon dice, runes, Strength, specialization or No Mercy. The GM still tracks action availability; the executor does not deduct a universal action budget.

## Interaction and authority

1. Player or GM selects the ability and held gunblade in the existing native panel. Player area requests carry no target list and MAP zero.
2. The GM sees nearby enemy candidates and confirms geometry, line of effect and the affected list. The adapter requires one acting token/combatant, a current v1.4 ability, a native Gunbreaker DC and native PF2e IWR enabled. Hidden enemy candidates and duplicate tokens sharing an actor require manual adjudication.
3. The module reserves the source and every affected actor together in its local GM queue, then checks revision, combat turn, DC, positions, allegiance and range again. Canceling before this commit changes nothing.
4. Commit costs and invalidate the old opening; create one native damage roll. Resolve each target's native Reflex check and retain its actual degree and chat evidence. Native save dialogs remain on the GM client.
5. After every save resolves, finish combo/cartridge state. Demon Slaughter generates its cartridge even if every target succeeds or critically succeeds. Fated Circle retains only failed-save target UUIDs. Canceling the later review cannot undo these completed rules.
6. The GM reviews damage multipliers and confirms no outstanding reaction, reroll, redirection or external damage application. Basic defaults are 2×/1×/0.5×/0×. Damage-only exceptions such as Improved Evasion can be adjusted here without changing the saved degree or Brand eligibility.
7. Apply each reviewed result once through a native contextual actor clone and native IWR; emit a summary. A critical failure doubles save damage but is not a critical attack for immunity/resistance semantics.

## Recovery and concurrency

The GM-private chat journal stores snapshots, one damage roll, each save's evidence, reviewed multipliers and per-target application status. The actor execution flag stores only action ID, slug, status, journal reference and revision. Before each HP application the journal marks that target `applying`; after success it marks `complete`. An uncertain operation stays blocked for reconciliation. Do not infer that an `applying` entry means HP was unchanged.

Canceling a save after commitment, closing damage review, changed save evidence, a moved target or failed write requires GM recovery. No automatic refund, retry or replay occurs. A reconnected GM cannot resume an old journal automatically. Inspect native chat, actual HP/conditions and tracker state before manually reconciling it; recovery UI is still pending. Keep the private journal until reconciliation is complete.

The queue reserves all involved actor UUIDs synchronously before waiting. Overlapping module area actions and module tracker corrections therefore serialize on this GM client without acquiring locks in conflicting order. Direct actor edits, other modules, other clients and server reconnects are outside that queue. This is not a distributed lock or a guarantee against external damage duplication.

## Remaining limits

- GM confirmation supplies area geometry, visibility edge cases, line of effect, genuine enemy classification, exceptional save-damage rules and unresolved reactions. Hidden enemies are unsupported by this prototype.
- No automatic interception of third-party damage controls. The base area roll suppresses its damage buttons, but external modules must still be tested and configured to avoid duplicate application.
- Native degree adjustments are read from the actual check. Rerolls after recording stop resolution; there is no automatic reroll reconciliation.
- Optional riders including Cartridge Expertise, Fated Resolve and Perfect Chamber discounts are not offered by this area workflow. Use the GM manual path for those combinations; do not run this activity and then record the whole activity again.
- Double Down, Danger/Blasting Zone, Bow Shock, Saturation Fire, Reign secondary targets and Relentless Rush are not included. External action observation, combat cleanup, full sheet UI and migration application remain separate work.

## Evidence

Local tests cover formulas, resource timing, target eligibility, fresh saves, limits, canceled/stale requests, shared rolls, partial application recovery, duplicate events, private journal markers and overlapping actor queues. The mocked native adapter test verifies Gunbreaker DC, critical-failure scaling and continuation after the first target dies. These tests do not prove real schema/API behavior or live numeric IWR.

Source inspection used official foundryvtt/pf2e v14-dev commit `57ba5add8352fd3162a05e0007717a93618be12a` (package 8.7.0): character class statistics; Statistic check parameters and callbacks; native CheckRoll degrees; DamageRoll.alter; damage-card context construction; contextual clones; native applyDamage and IWR. Critical-hit-only handling is intentionally distinct from doubled save damage. Complete the area acceptance cases in SMOKE-TEST.md with real GM/player clients before campaign use.
