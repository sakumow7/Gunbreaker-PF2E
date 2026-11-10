# Recording completed outside activities

After resolving an activity outside the Gunbreaker panel, choose **Record outside activity**, then **Used another action** or **Used my regular reaction**. Players need the existing experimental player-request setting enabled. The GM can use the same controls directly. This replaces asking the GM to open the manual tracker for these two common bookkeeping operations.

| Record | Tracker result | Use boundary |
| --- | --- | --- |
| Another action | Closes unused Continuation; keeps combo, cartridges and cooldowns | Your own turn, after resolving the outside action |
| Regular reaction | Marks the regular reaction spent; preserves a current same-turn Continuation | After resolving that reaction; cannot spend the regular pool twice |
| Cancel | No request or state change | Any time before submission |

Neither record rolls dice, moves tokens, applies damage/effects, nor spends Foundry action counters. Do not record subordinate checks, an activity already handled by the Gunbreaker executor/manual tracker, or an extra reaction granted by another feature. Guardian's Instinct and other extra reaction pools are not recorded here. Ask the GM to adjudicate those cases. Out-of-turn Continuation already expires under the existing rules.

No weapon or target is required. Current target selection and attack stage cannot leak into the record. The control retains the panel-opening revision and encounter/round/turn checkpoint through its choice dialog. If state changes while it is open, refresh and reconcile the completed activity before submitting a new record.

## Authority and receipt

The existing private bounded request transport supplies creator identity and routes the request to the active GM. The new runner uses the same actor queue as native execution and manual tracker writes. It checks ownership, Gunbreaker class, an initialized encounter, a single combatant/token, player/GM scene, current revision/turn, retired-feat migration, and pending native/rider recovery. Recording does not require wielding a gunblade: an outside activity may have put it away.

The request accepts only one of two fixed recording slugs, `weaponId: none`, MAP zero, empty targets and no resource options. The state transition and receipt commit in **one tracker flag write**. The ID is recorded in the existing bounded `tracker.events` history, and the latest receipt is `tracker.lastOutsideActivity` with ID, kind and encounter/round/turn. The previous native execution journal is preserved. Older tracker states receive the optional receipt field's null default; no item migration is needed.

The same request ID is a no-op once recorded, even if the turn has changed or a new opening exists. A new ID with a stale revision fails. IDs are not permanent history: `events` retains the latest 100 entries, consistent with the existing executor; stale checkpoint checks still apply after eviction. Transport timeouts retain the local pending guard and never automatically retry. On uncertain delivery, inspect the tracker receipt/event ID as well as the execution journal before clearing any client guard or issuing another record. An uncertain write must not be treated as proof that nothing happened.

## Why execution is explicit

At pinned PF2e 8.7 v14-dev commit `57ba5add8352fd3162a05e0007717a93618be12a`, `SingleCheckActionVariant.use` supplies an action glyph and action roll options, while `CheckPF2e.roll` constructs the saved check context. A generic attack/skill check and its action slug do not establish whether the table used an independent action, a subordinate check or a reaction. This change does not classify those rolls heuristically. Ordinary chat cards, rerolls and token dragging do not trigger these records. Automatic external-action observation remains unfinished.

## Validation boundary

Tests exercise the actual native-runner dispatch and request router, atomic receipts, duplicate and concurrent requests, stale state/turn, queue-time changes, lost write acknowledgements, regular versus extra reaction pools, class/scene/ownership/migration/busy guards, empty target transport, panel cancellation, disabled states and retained dialog checkpoints. The detached panel QA macro simulates both new choices without world actor writes.

All 403 tests passed, along with build, package/document validation, balance checks and detached panel-macro syntax validation. These are mocked document/transport checks. A fresh browser check on 2026-11-10 reached Forge's private-game page but required sign-in; no authenticated world was available. Installed DialogV2 rendering and real owner/GM delivery remain live acceptance gates. No campaign installation, release or version bump accompanies this change.
