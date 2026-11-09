# Support, ranged attacks, resource riders and maintenance

Development candidate only. Exactly one active GM is required. This expands the v1.4 automation prototype; it is not full automation certification. The campaign remains on 1.3.0. See LIVE-QA-2026-11-08.md for the limited live evidence.

## Actions

| Ability | Implemented behavior | Boundaries |
|---|---|---|
| Lightning Shot | Detached native ranged gunblade usage, Dexterity attack, base one-handed die, fire damage, 30-foot increment; maximum 120 feet checked before execution and damage. Equipped weapon is unchanged. | A conservative list of eligible property runes is allowed. Unknown or restricted runes stop for adjudication. Primary HP uses native damage-card controls. |
| Aurora | One self/ally recipient within 30 feet, living eligibility, source-specific ten-minute immunity and frequency, highest active Aurora healing once per recipient turn for three ticks. | No native FastHealing rule is added: it generates another healing card and can double-apply with optional modules. Dead creatures are never healed. Missed ticks, reconnects, ambiguous combatants and conflicting native fast healing require Recovery. Outside combat, advance world time in six-second intervals; large time jumps do not retrospectively apply healing. |
| Heart of Corundum | Half-source-level all-damage Resistance, expires at the start of the source's second subsequent turn; one 2d8 + source-level heal after an authenticated native damage receipt leaves the recipient at/below half HP. | HP edits, Superbolide costs, healing, undone damage and shield-only changes do not count. Already-wounded recipients qualify. A dead creature does not. Multiple overlapping Corundum healing effects stop for adjudication. |
| Heart of Light | Snapshot of self/allies within 15 feet, +1 status saves against spells, custom spell-only Resistance equal to half source level; source-turn expiry. | Spell damage predicates deliberately exclude impulses and generic magical abilities. Leaving the radius does not remove protection. GM confirms line of effect. |
| Gunmetal Soul | Snapshot of self/allies within 30 feet, full-source-level native all-damage Resistance until the source's next turn; daily use committed before effects. | Native IWR handles non-stacking. GM confirms recipients/line of effect. |

Recipient position, allegiance, life, visibility and ownership are rechecked before committing support. Partial group application leaves a private recipient journal. One actor appearing through multiple affected tokens is refused. Automatic healing claims its persistent state before HP writes; failed or uncertain writes cannot replay after reconnecting.

## Optional features

The native panel shows an expandable resource section only for learned features. Requests carry bounded booleans; clients cannot supply outcomes, cartridge amounts or damage. Invalid or already-spent choices fail before rolling.

- Cartridge Expertise rewards a resolved Solid Barrel or Demon Slaughter finisher, including a miss/successful enemy save.
- Powder Discipline loads only on the actual native critical hit; Executioner's Cadence loads only on a qualifying Wicked Talon critical hit or Double Down critical failure. They cannot be selected together.
- Perfect Chamber discounts the committed cartridge cost, including a zero-cartridge Burst Strike, and spends its once-per-round gate even if the attack misses.
- Vortex Guard offers one adjacent ally after Brutal Shell actually grants new temporary HP, once per round. A stronger existing barrier does not trigger another grant. Its native TempHP effect expires at the source's next turn end.
- Fated Resolve grants native TempHP once per round on Fated Circle/Double Down, with the gate committed before the effect write and expiry at the source's next turn start.
- Overpowered Round offers secondary damage after Burst Strike hits. It excludes the primary target, source and allies, uses captured weapon-dice count and calibration, never doubles for the critical hit, and applies native IWR once per other enemy. Each application is journaled before HP. Hidden/duplicate/stale targets stop for adjudication.

Relentless Combo, Continued Assault and Bulwark Protocol movement are not implemented here. Reign resource riders still require their own integration. Primary Strike and ordinary Continuation HP remain on native card controls; this PR does not intercept every damage button/module.

## Lifecycle

On the viewed scene, owned Gunbreakers with one active token/combatant initialize the encounter once, preserving minute/daily cooldowns. Ending the encounter clears its gauge/openings. Pending execution and retired feats block this automatic state change. Module-created Royal Guard ends when combat, consciousness or wielding requirements end; recovering consciousness or picking up the weapon does not restore the stance automatically.

Managed expired effects are deleted according to native duration/initiative calculations. This matters for TempHP: the native rule removes its barrier on deletion only if it still owns that barrier. Uncertain support healing is retained for recovery. Aurora carries remaining ticks across a normal combat end; reconnects do not guess missed healing. Hook delivery, source-turn boundaries, time jumps and optional-module interactions still need disposable-character live encounter tests.

## GM maintenance

The Native Actions panel has Recovery, Migration, Rollback migration and Escort setup controls.

- **Recovery:** inspect native chat, HP, effects and private execution evidence; manually reconcile any uncertain cost/outcome, then provide a note and accept the current outcome. A private complete actor backup is saved first. The control closes interrupted action/healing/Rush follow-ups without replaying damage or refunding resources. It does not calculate a repair for you. Heart of Stone's separate reaction-window journal is not covered by this control.
- **Migration:** preview source-matched updates, explicitly select Reserved Cartridge for a retired feat if desired, and stop for unresolved retraining/custom-field conflicts. Apply only after confirmation, with a private actor backup. Updating the package never migrates actors by itself.
- **Rollback migration:** a completed migration can restore only the fields it changed. Unrelated HP/resources/display-name changes are preserved; later edits to migrated fields block automatic rollback. A second backup precedes rollback. Partial migrations/rollbacks require manual reconciliation against the saved complete actor snapshot.
- **Escort setup:** once-only Diplomacy/Escort Lore training, distinct untrained replacement skills for duplicates, native rank-upgrade rules and a backup. It preserves custom rules. An interrupted setup remains locked for review, and retraining/removing the feat's separately created Lore is manual.

Backups are GM-whispered chat documents. Deleting those chat records removes in-world rollback evidence; retain normal actor exports/world backups for long-term recovery.
