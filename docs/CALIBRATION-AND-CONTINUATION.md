# Calibration audit and managed Continuation damage

## Single-target Continuation

Hypervelocity, Jugular Rip, Abdomen Tear and Eye Gouge now roll and apply their damage to the original eligible target through PF2e's native contextual `applyDamage`. They no longer leave a second damage-application button for the player. The action panel and owner request still use the same authoritative executor. Fated Brand retains its existing area/save workflow.

The effect uses the opening weapon-dice snapshot and the current prepared calibration: 2d6 + weapon dice, becoming 3d6 at level 11 and 4d6 at level 17. It is a separate energy effect with no attack, save, MAP, critical doubling, No Mercy bonus or property-rune dice. The ability's native origin and magical/other action traits accompany the damage context; it is not marked as area damage.

Native IWR must be enabled before the opening is consumed. The original target, source position, held gunblade, reach, visibility, enemy relationship, actor/ability identity, current turn, tracker revision and calibration are rechecked before HP application. The source and recipient are inside the existing executor queue. Current control/target selection never redirects this damage.

The execution journal records `rolling`, `rolled`, `applying`, and `complete` evidence under its `continuation-damage` rider, including the original target, formula and saved roll. The damage card suppresses ordinary damage buttons. A claim is saved before the HP operation; duplicate requests do not reroll or reapply. Changed roll evidence or uncertain HP application blocks for recovery without refund/replay. If GM authority itself is lost, the existing committed journal may remain locked because that client cannot write a recovery update; the returning GM must reconcile it.

Primary Strike damage still uses ordinary card controls. This patch does not intercept third-party damage modules or all reaction workflows. Automatic-damage modules must not independently apply these suppressed managed cards. Manual adjudication remains necessary for unsupported redirection and reactions; test those interactions before campaign use.

## Calibration scope

| Component | Fire / cold / electricity choice? | Evidence |
| --- | --- | --- |
| Burst Strike bonus dice | Yes | Exactly one action-scoped DamageDice rule for the chosen type |
| Hypervelocity, Jugular Rip, Abdomen Tear, Eye Gouge | Yes | Managed formula and native damage context; opening weapon dice snapshot |
| Fated Circle, Fated Brand, Double Down, Saturation Fire | Yes | Area formula and scoped ability traits for saves/application |
| Overpowered Round | Yes | Separate constant secondary damage, validated type and scoped ability traits |
| Physical gunblade damage and Gnashing/Reign bonus dice | No | Weapon remains unchanged; bonus rules remain slashing |
| Sonic Break persistent bleed | No | Bleed rule remains bleed |
| Property runes | No | No calibration rewrite of rune data or weapon traits |
| Lightning Shot | No | Its ranged gunblade usage remains fire; eligible runes remain intact |
| Danger Zone / Blasting Zone | No | Fire formula, shared upgrade/cooldown unchanged |
| Bow Shock initial and persistent damage | No | Both remain fire; persistent damage remains undoubled |
| Reign secondary damage | No | 2d6 / 3d6 / 4d6 fire |
| Relentless Rush initial and delayed blast | No | 8d6 and 4d6 fire; existing delayed-blast tests cover cold calibration |

A corresponding fire trait on a calibrated standalone ability is replaced on a temporary item copy; other traits and the owned source item remain unchanged. No elemental trait is invented if the original has none. Weapon traits and property runes are not rewritten by Burst Strike calibration.

Invalid tracker calibration now fails explicitly during state normalization rather than silently using fire, omitting Burst Strike bonus dice, or interpolating an unchecked damage-type string. Legal values remain fire, cold and electricity. Daily preparation authorization and cadence are unchanged; encounter start/end preserves the selected type.

## Validation boundary

The audit covers all ten allowed abilities, excluded components, legal-level formula breakpoints, all three choices, trait-copy behavior, Burst Strike predicate isolation, and invalid values. Native-adapter tests exercise all four single-target Continuations across all three damage types, exact original-target application, IWR arguments, duplicate requests, disabled IWR, movement/turn/source changes, corrupt evidence and uncertain HP writes. These tests mock Foundry's documents, dice and native IWR application; they do not establish live IWR totals.

Source compatibility was checked against the pinned PF2e 8.7 v14-dev commit recorded in AUTOMATION.md: native damage-card context construction, `Item.getOriginData`, `applyDamageFromMessage`, and contextual clones. Browser access was attempted on 2026-11-10 but the originating browser context was unavailable. Installed-candidate native HP/IWR, source-scoped traits, support-receipt hooks and real GM/player testing remain release gates. No campaign installation, migration or release was performed.
