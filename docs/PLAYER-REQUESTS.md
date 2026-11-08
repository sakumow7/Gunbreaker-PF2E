# Experimental player action requests

Status: implemented for testing, disabled by default. No live two-client result has been recorded. This is the next routing stage of the v1.4 plan, not completion of full automation.

## Entry and authority

Enable **Experimental player action requests** in the module's world settings only in the disposable test setup. Exactly one GM must be connected and viewing the player's scene. The existing tracker macro opens the native panel for a player: ability, held gunblade and attack stage, using the selected enemy. A private request/result card is visible to the requester and the nominated GM. The GM still handles PF2e's native attack and damage dialogs; damage application uses the normal controls. Player-side modifiers, sheet buttons and action-budget tracking are not implemented.

Only abilities already covered by the native core executor can be requested. Optional feat riders are rejected on the player request path until their choices are integrated. Follow-ups use the stored original target, not a newly selected target. Owned action data must be updated to the v1.4 compendium.

## Request contract

| Field or event | Meaning |
|---|---|
| Creation hook `userId` | Foundry-reported workflow creator; used to look up ownership |
| Intent | Version, nonce, actor UUID, scene, nominated GM, ability, weapon, MAP stage, selected target |
| Snapshot | Tracker revision, encounter ID, round, actor-turn index captured when the panel opens |
| Coordinator validation | Schema, active user, ownership, current revision/turn, held weapon, known action, prerequisites, reach and enemy relationship |
| Result update | Accepted on the requesting client only when the update event identifies the nominated GM |

No requester identity, hit outcome, cost, damage amount, actor state or arbitrary function is accepted in the intent. The creation hook copies the intent before awaiting documents. Posting an ordinary rules card or editing an existing request never starts execution. Startup does not scan or replay old request cards. Hidden-token checks do not replace GM adjudication of player line of sight and terrain.

The module's GM manual writes and native executor share one per-actor queue. While routing or experimental Heart of Stone is enabled, players must ask the GM to record uncovered actions, daily preparations and corrections through the manual tracker. When routing is disabled, the earlier one-operator manual workflow remains available.

## Failure and recovery boundaries

- A changed revision or combat turn rejects the request before reservation or rolling. Opening the panel again captures a new snapshot.
- A canceled attack does not spend resources. A miss or canceled damage dialog cannot refund a rolled attack.
- A timeout or uncertain submission error does not prove that execution failed. The player client keeps that actor blocked until a genuine GM result arrives; no automatic retry occurs.
- A GM must inspect the actor's `gunbreaker-pf2e` tracker and execution flags and native chat evidence before deciding what happened. A pending/recovery journal blocks the next action. There is no recovery UI or automatic journal clearing yet.
- If the request never reached the GM, confirm no roll, state change or pending journal exists before reloading the player client and submitting anew. Reload alone is not proof that retrying is safe.
- Exactly one active GM is required. This restriction and the shared local queue are not a server-side distributed lock. Do not switch GMs, reload the coordinator, or change this setting during a pending action. If that happens, stop and reconcile the journal; do not replay requests.
- Direct actor edits, unrelated modules and custom macros are outside the module queue. Foundry actor owners retain their normal document permissions. This is an authorization boundary for the module executor, not a restriction on every possible actor edit.

## Evidence and acceptance

Local tests cover schema rejection, identity, ownership, coordinator selection, intent copies, stale state/turns, queue serialization, permission loss, ordinary/edited cards, acknowledgement identity, uncertain submission and timeout handling. Those tests use mocked Foundry events. The real transport, roll dialogs, server creator IDs and module interactions require the two-client tests in SMOKE-TEST.md before this setting is used in the campaign.
