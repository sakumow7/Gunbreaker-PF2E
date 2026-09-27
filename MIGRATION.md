# Migrating from 1.2.x

The module ID and every existing item ID/pack location are preserved. Compendium links remain stable. Updating the package does not rewrite copies already imported onto actors or into world directories.

1. Back up the world and duplicate each affected character. Finish the current encounter before migrating.
2. Install 1.3.0 and reload. This revision targets Foundry 13+ and PF2e 7+; the older Foundry 11/12 compatibility claim is retired. No live version is marked verified by this revision.
3. On the duplicate, note existing class feats, runes, current HP, skill choices, and other customizations. Remove the old Gunbreaker class and its granted class features/actions, plus old Gunbreaker effects. Be careful not to remove ancestry/background/archetype items.
4. Add the new Gunbreaker class at the character's existing level. Check the automatic grants against the class progression in RULES.html. Replace old Gunbreaker feat copies with the matching updated compendium entries; retain the same choices where still legal. If a prerequisite or level changed, choose a legal replacement with the GM.
5. Update gunblades using the new equipment definitions while preserving purchased runes and material upgrades. Strength builds use the standard gunblade; Dexterity builds can choose the d6 finesse Light Gunblade. Remove the obsolete versatile-fire trait.
6. Remove any remaining old Powder Gauge SpecialResource rule and legacy combo/readiness effects. The new tracker uses `flags.gunbreaker-pf2e.tracker`; the obsolete Attributes-tab cartridge resource is no longer authoritative. Nothing silently resets or rewrites the old actor.
7. Import **Gunbreaker Tracker** from **Gunbreaker — Tracker** into the hotbar. At the next real combat, initialize the encounter once. Start with one cartridge, or two with Lion's Legend. Do not carry ammunition totals across encounters.
8. Test on the duplicate using SMOKE-TEST.md. Keep the original until the replacement's proficiency, grants, and equipment match.

Notable retraining cases: Trajectory moves to level 2; Aetheric Ward, Blasting Zone, and Great Nebula become passive upgrades; Heart of Stone is granted; Reign of Beasts requires Bloodfest and is no longer automatically granted by Lion's Legend. Follow-ups require level-7 Continuation even though their parent Gnashing actions arrive at level 6.

The legacy `api.adjustCartridges(actor, delta)` remains available, but writes the tracker and returns its new state. It is a manual correction, not an attack or combo resolver. Native action-frequency displays and tracker cooldowns are separate; the tracker is authoritative for the actions it records.
