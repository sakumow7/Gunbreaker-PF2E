# Owner choices for optional riders

For player-initiated native actions, Relentless Combo, Continued Assault and Vortex Guard now ask the initiating player for the tactical choice. GM-initiated actions retain their local dialog. The existing experimental player request setting must be enabled; this change does not turn it on.

| Trigger | Owner choice | GM execution |
| --- | --- | --- |
| Solid Barrel / Demon Slaughter | Relentless Combo: Step or Skip | Validate trigger; plan and perform the Step |
| Continuation | Continued Assault: Step, eligible adjacent ally barrier in Royal Guard, or Skip | Recheck stance/ally and apply native TempHP, or plan the Step |
| Brutal Shell actually grants TempHP | Vortex Guard: eligible adjacent ally or Skip | Recheck eligibility and grant the native barrier |

The owner receives a private prompt automatically. Close or Skip declines only the rider and preserves its unspent frequency. Parent action costs and results already committed remain in place. A player response carries only the prompt ID and the offered choice ID; it cannot supply a target UUID, effect, resistance, damage or resource outcome. Candidate IDs map to the GM's original list.

Step path planning still occurs on the GM client. Other area/line-of-effect confirmations and Overpowered Round damage adjudication remain GM controls. This does not move native attack-roll dialogs to the player.

## Authority and timing

- Exactly one active GM, an active non-GM initiating owner, current ownership and the same viewed scene are required.
- Only a server-delivered creation event with matching GM creator/author can open an owner prompt. Only a matching creation event from that assigned owner can answer a current GM request. Updating an old document never executes.
- Request identity and options are captured before asynchronous authorization. Registering the pending request before chat creation handles a fast owner response. Duplicate, unrelated and unoffered responses do not resolve an action.
- The prompt expires after 60 seconds using Foundry's synchronized server clock. Prompt shape checks allow five seconds of synchronization tolerance; the GM's actual deadline is unchanged. In-game world-time changes do not extend the deadline.
- A timeout, failed delivery, owner disconnect/lost permission or changed scene fails into the parent executor's recovery journal. There is no automatic decline, refund, resend or replay. Late responses cannot resume that request.
- Requests live only in the current GM session. Reloading a client does not reconstruct or replay old choices. Pending journals must be reconciled manually after reload.
- Source state, combat, position, eligible ally and stance are rechecked by the existing rider runner before spending/applying. Vortex Guard now also checks its revision/turn checkpoint and source eligibility after the prompt.

The action request's existing 90-second acknowledgement guard can also time out during a slow action. It still blocks duplicate local submissions until a genuine GM result arrives. Do not retry an action because a notification timed out.

## Evidence and remaining acceptance

Regression coverage includes owner/author forgery, duplicate responses, fast responses before delivery finishes, bounded choice schemas, asynchronous capture, response mutation, expiration, same-scene/ownership checks, declining, reload behavior and delivery failure. Rider integration tests cover owner-selected ally mapping, decline without spending, missing routing, forged choices, combat changes and recovery without replay.

`node tools/build-owner-choice-qa.mjs` generates `build/owner-choice-qa.mjs`, a detached two-client model using native DialogV2. It uses in-memory users and chat delivery; it never writes real chat messages, actor resources, HP or settings. The intended sequence is Protect QA ally, then Skip. A passing result would establish native dialog/model compatibility only, not real network delivery.

The connected browser could not be accessed from this turn's originating context. The generated Forge QA macro was **not run**. Real GM/player delivery, private-message visibility, disconnect/reload behavior and end-to-end native effects remain release gates. No campaign installation, settings change, migration or release accompanies this patch.

Sources: [Foundry v14 User.viewedScene](https://foundryvtt.com/api/v14/classes/foundry.documents.User.html#viewedScene), [GameTime.serverTime](https://foundryvtt.com/api/v14/classes/foundry.helpers.GameTime.html#serverTime), and the existing createChatMessage identity contract documented in PLAYER-REQUESTS.md.
