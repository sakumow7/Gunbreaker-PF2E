# Bloodfest and Reign native prototype

Status: implemented for local testing; no live Forge or real GM/player acceptance result. Uses the existing native panel and optional player request transport. The Reign coordinator requires exactly one active GM.

## Entry and rules

Bloodfest requires one selected, visible genuine enemy within 30 feet and a held gunblade. Native execution commits its once-per-ten-minutes frequency, raises capacity by 3 for one minute and loads 3 cartridges, respecting capacity. It also grants Ready to Reign for that duration and creates native reminder effects. Tracker state is authoritative; the reminders do not generate cartridges. Expired capacity is clamped when state is normalized; automatic combat cleanup remains separate work.

| Step | Primary Strike bonus | Secondary fire | Opening after resolution |
|---|---|---|---|
| Reign of Beasts | 2d6 slashing | 2d6 | Noble Blood |
| Noble Blood | 3d6 slashing | 3d6 | Lion Heart |
| Lion Heart | 4d6 slashing | 4d6 | None |

Reign of Beasts consumes unexpired Ready to Reign from Bloodfest. Follow-on steps require their combo opening and the Reign feat. Only one sequence step is allowed per own turn; the next opening lasts through the end of the next own turn. Misses advance the sequence, and no step grants Continuation. Starting Reign removes only module-managed Ready to Reign reminder effects; custom reminders are left alone.

Select one primary enemy and a native MAP stage. The adapter rolls the normal melee gunblade Strike with the action-specific roll option, enabling the existing PF2e DamageDice rule. Native primary damage includes ordinary weapon statistics, runes, applicable modifiers and critical damage. Primary HP application and reactions remain on PF2e's normal damage-card controls **after this workflow completes**; the executor records the exact card but does not apply primary HP itself. Do not manually apply secondary damage from a rules card.

## Secondary enemies

On a hit, the GM chooses zero, one or two other enemies that are both within the Gunbreaker's current melee reach and adjacent to the primary target. The acting creature, primary target and allies are excluded. Native token distance/reach checks constrain candidates; the GM confirms geometry, visibility edge cases and genuine enemy status. Hidden candidates and duplicate tokens sharing one actor require manual adjudication.

Each selected enemy makes a fresh native basic Reflex save against the **Gunbreaker** class DC. One shared fire damage roll uses the step's fixed formula. These components are not changed by Aetheric Calibration and do not inherit weapon damage dice, runes, specialization, No Mercy or the primary attack's critical multiplier. A secondary critical failure still doubles its own basic-save damage normally. These are selected secondary creatures, so the adapter does not tag them as an area-damage effect.

The GM reviews native save outcomes and any exceptional damage multiplier. Secondary damage then applies through the shared contextual native IWR path. Selecting more than two enemies asks again without repeating the Strike. Closing selection or canceling a save after the attack requires reconciliation; choosing zero explicitly completes the action without secondary rolls.

## Ordering and recovery

The local GM queue reserves the acting character, primary target and potential secondary actors together before the Strike. This prevents the module's own writes from conflicting; unrelated modules and direct edits are outside the queue. Potential targets are discovered before rolling, then chosen after a hit. Movement/reach changes during resolution are conservatively stopped for adjudication rather than automatically retargeted.

The GM-private action journal records the attack, primary damage card, choices, each secondary save and each HP application. The actor execution flag retains only a compact status/reference. Before invoking the native attack roller, the action is marked uncertain; an exception that follows a visible roll cannot silently free the action for replay. Explicitly canceling the attack leaves tracker state and readiness unchanged. Once the attack resolves, the readiness/opening and per-turn limit commit before damage dialogs.

A miss completes with the next opening. A hit with canceled primary damage, a changed/rerolled attack, changed primary damage evidence, a canceled save or an uncertain HP write leaves recovery locked. Neither a new request nor a reconnect can replay it. Inspect actual HP, conditions, native chat and the private journal before manually reconciling; a recovery UI is not yet implemented. Primary damage still requires its normal card application, including any appropriate reaction workflow, once the sequence workflow has finished.

## Evidence and limits

146 local tests pass, with 16 added for this stage. Tests cover Bloodfest range/frequency/resources, the full three-turn sequence, missing/expired prerequisites, MAP and action options, secondary eligibility and fixed fire formulas, misses, cancellations, duplicates, partial writes and native evidence checks. The shared mock harness was extracted without changing earlier acceptance assertions.

Native calls follow the same pinned official PF2e v14-dev commit `57ba5add8352fd3162a05e0007717a93618be12a`: Strike variants and damage/critical methods, attack callback chat messages, returned damage rolls matched to a unique new native card, native class DC, reach/token distance, CheckRoll outcomes and the save/IWR adapter already used by area actions. Source inspection and mocks do not certify live compatibility, damage arithmetic or third-party module interactions. Complete SMOKE-TEST.md on disposable characters before campaign use.

Optional feat riders, observation of external actions, automatic primary damage/reaction interception, complete combat cleanup and migration application remain outside this stage. Relentless Rush is still unfinished. No release, live installation or actor migration accompanies this code.
