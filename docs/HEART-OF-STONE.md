# Heart of Stone assisted reaction workflow

Status: implemented for isolated testing; disabled by default. This completes a bounded part of the reactions stage. It is not a full damage-interception integration or a tested release.

## Flow

1. One active GM observes a successful native damaging Strike or spell attack with an identified attacker, item and target. The module checks nearby Gunbreakers, equipment, known v1.4 Heart of Stone, actor state, encounter, range and available resource choices.
2. A GM-authored private reaction card records the exact attack snapshot. One active owner for each eligible protector receives a prompt; an unassigned protector uses the GM. The prompt offers base, cartridge enhancement, Reserved Cartridge and legal Perfect Chamber/extra-reaction combinations. Accepting declares that sight and reaction requirements are satisfied. The first accepted protector closes this prototype's window.
3. The GM pairs a native damage card from the same attacker/item with the correct target and hit/critical outcome. The GM explicitly confirms it belongs to this attack, remains unapplied and needs no unsupported damage resolution.
4. The reaction card applies that combined roll once through PF2e's native `applyDamage`, using a contextual clone carrying the Heart of Stone Resistance rule. Native origin effects and roll options are retained. The live actor receives no ongoing resistance effect.

The same actor queue handles this module's native actions, GM tracker writes and reaction costs. Normal reaction and Guardian’s Instinct uses remain separate. Ordinary reactions outside this module still need to be recorded; there is no complete observer for other native reactions yet.

## Implemented rules

| Case | Handling |
|---|---|
| Base protection | Resistance 2 + floor(level / 2) |
| Cartridge enhancement | Spend 1; resistance 2 + level, or 4 + level with Lion’s Legend |
| Reserved Cartridge | Other ally, once per encounter, regular reaction, works at zero cartridges; no Perfect Chamber combination |
| Guardian’s Instinct | Range 30 feet; separate ally-only extra reaction beginning at the first own turn |
| Aetheric Ward | Self only against a Strike; enhanced protection with an actual cartridge spend; no reserve, extra reaction or free discount |
| Continuation | The reaction preserves its opening |
| Decline/close | No resource spend |
| Unresolved prompt | A reminder after 60 seconds; no automatic decline or damage application. GM explicitly continues without protection. |
| Damage | One native combined damage roll, one contextual resistance rule, one native IWR/application call |
| Persistent damage | Initial mixed rolls may create native persistent conditions. Later persistent ticks do not receive the temporary protection. |

## Exact binding and trust

Native damage cards do not consistently retain a unique triggering-check ID. This implementation therefore never guesses the link from the latest roll. GM pairing is an explicit adjudication step; matching attacker/item/outcome is validation, not proof that two cards describe the same attack.

The attack snapshot includes the native roll JSON and identities. Rerolled, changed or deleted attacks block acceptance/application. A current GM creation event establishes a trusted reaction window. An arbitrary flag on a player-created chat card is not sufficient. Responses use the server-delivered creator ID, assigned owner and current actor ownership. Response edits do not execute.

Reservations are persisted before resource or HP writes. Duplicate module requests cannot spend/apply twice through this workflow. A failure after commitment leaves a recovery state instead of refunding or replaying. Managed application markers cover only this workflow; they cannot establish whether a normal damage button or another module already applied damage.

## Current limits

- Ordinary PF2e damage buttons, manual HP edits and automatic damage modules do not wait for this prompt and are not intercepted. In the isolated test, hold damage and use only the reaction card for the protected application. Do not enable this in normal play alongside automatic damage application until those integrations are implemented and tested.
- This prototype accepts one protector per triggering attack window. Additional Gunbreakers reacting to the same attack must be adjudicated manually; the homebrew rules themselves are not changed to prohibit them.
- Bulwark Protocol's optional Step is not automated. These prompts execute the no-Step option. Use a manual workflow when choosing the Step, checking original range before movement.
- Shield Block combinations, damage redirection, separate/split damage packets and manual damage multipliers are unsupported. Use manual adjudication for them.
- The damage roll must already encode the correct native hit/critical degree. Some PF2e spell cards encode only success; those critical spell cases are blocked rather than manually doubled incorrectly. Successful spell attacks are otherwise eligible. The rule still includes critical spell attacks even where automation is incomplete.
- The owner declares visibility; the GM confirms it during pairing. GM token visibility alone does not prove the character can see the attacker and ally.
- Exactly one active GM, one active token and one combatant per reacting Gunbreaker are required. This is not distributed locking. Do not change GMs/settings during pending work.
- After a GM reload, prior windows are unverified and cannot resume through this UI. Reconcile the actor tracker, execution journal, damage evidence and window/application flags manually. There is no automatic replay, automatic refund or recovery UI yet. Advancing combat also blocks a still-unaccepted reaction.
- The setting is independent of player native-action routing. Turning on either setting requires GM manual tracker writes; enable player routing too if testing owner-initiated core attacks.

## Evidence and release gate

Unit tests cover trigger filtering, damage identity/outcome checks, range, resources, reaction pools, Aetheric Ward, decline/continue, duplicates, permission/staleness, recovery, and contextual-clone preparation. The native context adapter was checked against official PF2e 8.7.0 source at the commit recorded in AUTOMATION.md. Tests mock the Foundry document and damage APIs; they do not verify live IWR totals or server event identity.

Before campaign use, run the Heart of Stone section of SMOKE-TEST.md with an actual GM and player, mixed damage types, competing resistances, native critical immunity, persistent damage, and the campaign modules. Record exact versions and results. No live installation or acceptance result is claimed by this implementation.
