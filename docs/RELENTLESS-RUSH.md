# Relentless Rush native prototype

Status: local implementation, not live Forge acceptance. Uses the existing native panel/player request transport and exactly one active GM. No release, world install or actor migration accompanies this change.

## Initial action

The level-18 feat uses its existing two-action cost and once-per-ten-minutes frequency. The GM confirms enemies in a 5-foot emanation, including geometry and line of effect. The executor rolls one fixed **8d6 fire** pool and fresh native basic Reflex saves against the Gunbreaker class DC, reviews outcomes, then applies damage through the existing native IWR path. Calibration, weapon dice and MAP do not change this damage.

A confirmed empty emanation is legal: the action still spends its frequency and grants protection. No damage or save is rolled when no enemies are affected. This exception applies to Rush, not the existing non-Rush area workflows.

After successful initial resolution, a native effect grants all-damage resistance equal to floor(level/2) until the start of the next turn. Its duration is one round with `turn-start` expiry. A persistent actor flag records the source token/combatant, encounter, next round, initiative order and unique delayed execution ID. The native effect governs resistance; the pending flag does not implement a second numerical reduction.

## Next turn

The module listens for the official `pf2e.startTurn` hook. At the matching combatant's next turn, the GM coordinator claims the trigger once and removes any remaining module-owned resistance. It checks whether the Gunbreaker is conscious, alive and holding any gunblade. If not, the blast is skipped permanently. Stunned or paralyzed alone does not suppress this automatic effect.

When eligible, the coordinator discovers enemies around the **current position**, then asks the GM to confirm this new 5-foot emanation. These may differ from the initial targets. The shared damage pool is **4d6 fire**, with new basic Reflex saves and native IWR application. No weapon Strike, MAP, second action, cartridge or frequency use is charged, and the blast does not consume an unrelated next-action opening. An empty delayed area completes without a prompt or roll.

Players cannot request a delayed phase or supply outcomes. The normal request identifies only the initial action. The delayed entry is internal to the GM coordinator.

## Interruption and recovery

Both blasts retain private GM save/damage journals and per-target application progress. Actor reservations prevent this module's own competing writes. As elsewhere in this prototype, ordinary HP controls, other modules and external updates are not distributed-locked.

Canceling initial confirmation spends nothing. Canceling later saves or damage review keeps committed costs and requires recovery. If initial resolution fails before protection is created, the GM must reconcile the initial action and its missing benefits; the code does not silently retry them. Uncertain effect creation records an `arming` state and the action journal stays locked.

Once the delayed trigger is claimed, closing its confirmation or encountering uncertain damage cannot replay it. Missed rounds, changed initiative order, a different source token, advanced combat, unresolved initial execution, or loss of eligibility during resolution stop for GM reconciliation. Keep the GM on the source scene and resolve the trigger before taking further actions or advancing combat.

On reload, future armed triggers remain scheduled. Already-due, interrupted or orphaned triggers become recovery records; they never fire retroactively. Encounter deletion marks unresolved triggers for recovery and removes only their module-owned protection. Native expiry is still responsible for ordinary resistance timing, including when no coordinator is available. Ending/restarting combat does not refresh the original ten-minute cooldown.

There is no recovery UI yet. Inspect HP, effects, chat, `flags.gunbreaker-pf2e.rush`, and the private execution journal before manual correction. Deleting a pending marker is not a safe retry operation.

## Evidence and limits

164 local tests pass, including 18 added in this stage. Coverage includes changing targets, empty areas, independent saves, fixed fire damage, native Resistance data, duplicate hooks, conditional suppression, cancellations, partial HP writes, source/turn changes, permission boundaries and reconnect handling. Tests use mocks and do not certify actual IWR arithmetic or hook delivery between real clients.

Source contracts were inspected in official PF2e v14-dev commit `57ba5add8352fd3162a05e0007717a93618be12a`: `EncounterPF2e._onStartTurn`, `CombatantPF2e.onStartTurn` and its `pf2e.startTurn` hook after turn-start actor/effect updates, plus the native saves/damage contracts used by the existing area adapter. Live Foundry 14 build 369 / PF2e 8.7.0 tests must verify GM and player turn advancement, effect expiry, reload timing and campaign modules before relying on this prototype.

Geometry/visibility edge cases, exceptional save multipliers and reactions still need GM review. Full party protection, movement, optional riders, external-action observation, recovery UI and migration application remain separate work.
