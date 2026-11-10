# Compact player controls

The Gunbreaker button in an owned Gunbreaker character sheet opens the native action panel. The existing `api.nativeActions(actor)` shortcut and player tracker entry use the same panel. Players need experimental player requests enabled; the setting remains off by default. The existing GM authority, same-scene requirement, bounded transport, journal and recovery protections remain in force.

## Ordinary play

1. Select a target and open **Gunbreaker** on the character sheet.
2. Choose Strikes, Powers, Area abilities, or Protection & movement. Only learned, level-appropriate supported activities appear. The current Continuation appears first in every group; unrelated follow-ups are hidden.
3. Choose the attack stage for each Strike. MAP is still explicit; the panel does not count other attacks or spent actions. Select a gunblade only when more than one is held.
4. Click an ability. If it has eligible optional resources, choose those in one small prompt; nothing is selected automatically. Cancel spends nothing. Perfect Chamber can make an otherwise unaffordable action available, marked with an asterisk, but still requires explicit selection.
5. Resolve the existing native/GM workflow. The four single-target Continuation follow-ups now apply their original-target damage automatically through native IWR; do not apply their damage cards again. Primary Strikes retain ordinary damage controls. The panel reopens with updated resources and combo state.

Cartridges/capacity, next combo, current Continuation and the **recorded** reaction state are visible. Unavailable activities are disabled with a reason; all reasons are also readable in an expandable list. Active minute cooldowns include the seconds remaining in world time. This is a snapshot, not a countdown. Refresh after external changes.

Continuation uses the original target and weapon snapshot for the four single-target follow-ups. Fated Brand retains its existing original failed-target area workflow. Ordinary activities capture the current target selection at click time, before any resource prompt. Area saves clear irrelevant selection/MAP. The panel retains its opening revision and combat checkpoint through every prompt; a stale request is rejected by the executor, not silently refreshed and spent.

GM recovery, migration, rollback and Escort setup are behind **GM tools**. **Record outside activity** lets the acting player record another completed action or regular reaction through the same GM queue. It needs no weapon or target, closes Continuation for another action, and marks the regular reaction spent without closing a current opening. Cancel changes nothing. Do not record subordinate checks, extra reactions, or activities already handled by the panel. See OUTSIDE-ACTIVITIES.md. The legacy tracker remains available for GM corrections.

## Boundaries

- Availability previews simulate the existing pure rules transition without actor writes. They do not certify range, terrain, valid recipients, line of effect, action budget, or pending transport delivery. Execution performs the actual checks.
- The reaction label says **Not marked spent**, not that every other reaction has been observed. Ordinary actions/reactions and token dragging are not comprehensively observed. Use the outside-activity control after an uncovered action or regular reaction; ask the GM to reconcile ambiguous cases and extra reaction pools.
- A PF2e roll's attack/skill type alone does not establish whether it was an independent action, a subordinate check or a reaction. Posting a rules card is not execution evidence. This change adds no speculative external-action observer.
- Native rolls still use the coordinator workflow. Player-side roll dialogs, live acceptance of the owner-side rider prompts in OWNER-RIDER-CHOICES.md, primary damage interception, third-party module compatibility and real two-client acceptance remain unfinished.
- No new release, campaign module installation, migration or actor-sheet item replacement accompanies this change.

## Validation

Regression tests cover pure availability, missing combo openings, cooldowns, affordability, explicit discounts, resource eligibility, learned levels/migration gates, cancellation, duplicate panels, original Continuation targets, click-time ordinary targets, stale revision snapshots, save targeting, escaping and sheet-entry permissions.

`node tools/build-panel-qa.mjs` creates a detached Script Macro in `build/panel-qa.mjs`. It exercises the production panel against an in-memory character and a simulated runner. No actors, HP, combat or settings are written. Do not confuse this with native executor or transport acceptance. The generated macro includes GM tools because it runs as a GM; those controls are not part of this detached test and must not be used.

On 2026-11-09 the detached panel was exercised in the connected Forge client: disabled combo/resource buttons rendered correctly; Burst Strike changed the in-memory gauge from 1 to 0 and exposed Hypervelocity; Hypervelocity consumed that opening and disappeared. Native DialogV2 rendering and its optional-resource form worked. A visual review prompted splitting area abilities from other powers and improving accessible button names. The final grouping and names were subsequently rechecked in the same client. No native actor execution or GM/player transport is certified by this UI check.

API references: [Foundry v14 DialogV2](https://foundryvtt.com/api/v14/classes/foundry.applications.api.DialogV2.html) and [DialogV2Button](https://foundryvtt.com/api/v14/interfaces/foundry.DialogV2Button.html). PF2e's pinned 8.7 v14-dev `ActorSheetPF2e` extends the v1 ActorSheet, so the entry uses `getActorSheetHeaderButtons`. The header hook has regression coverage; installed character-sheet acceptance remains pending.
