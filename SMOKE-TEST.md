# v1.4 native candidate smoke test — pending live execution

Observed environment: Foundry 14 build 369, PF2e 8.7.0, Gunbreaker 1.3.0. The candidate has not been installed. Local tests and source inspection do not substitute for these checks.

## Rules and import

- Import the candidate into an isolated test setup; open all five compendia and inspect rule validation warnings.
- Advance a fresh character through levels 1–20; verify class grants and proficiency progression, without duplicate actions.
- Confirm the four new feat entries and retired Twin Cartridge/Overcharged Gauge handling. Verify exact text against docs/DESIGN-v1.4.md.
- Test normal/Light Gunblade with one/two hands, striking runes and ABP; verify weapon-dice counts and Royal Guard eligibility.

## Native core prototype

- Use one GM coordinator and one active token/combatant per character. Select a real enemy, choose MAP, and execute Keen Edge. A miss still enables Brutal Shell. Complete Solid Barrel on a miss and check that one cartridge loads.
- Cancel an attack dialog: no costs or combo changes. Cancel a damage dialog after a hit: costs remain spent. Verify damage is not applied twice by Workbench or another automation module.
- Burst Strike has its extra damage only on the named activity. Verify critical doubling and property runes with PF2e native damage. An ordinary Strike must not acquire Burst or Gnashing dice.
- At 7/11/17, verify each Continuation's dice plus captured weapon-dice count. No critical doubling, No Mercy, property damage or new attack roll. Reach and original-target checks must block invalid use without an uncommitted spend.
- Brutal Shell restores actual missing HP, grants nonstacking temporary HP once per round, and expires at the end of the next turn. Record Vortex Guard manually until integrated.
- Apply self-effects using native execution. Check Camouflage/Royal Guard/shield circumstance stacking, Nebula/Great Nebula, No Mercy expiry, Superbolide at 2 HP and high HP. Its HP cost must not trigger Corundum or other damage-based abilities.
- Double-click and reopen: one native roll and one spend. Simulate a post-roll write failure: a recovery journal must block a new action. Reconnect and verify it remains blocked.

## State and migration

- Reserved Cartridge at zero works once for another ally; rejects self, duplicate use and Perfect Chamber stacking. Regular and restricted reaction uses remain separate.
- Expanded Gauge gives 4 at 12–17 and 5 at 18–20; Bloodfest adds 3 and expiry clamps it. Combat restart does not reset timed/daily cooldowns.
- Advance world time beyond 24 hours: a daily power stays spent until daily preparations. Same-day preparations cannot refresh it. Confirm the campaign's day-boundary convention before using the beta ledger.
- Preview a character with both retired feats and custom rules. No actor mutation occurs. Keep all player choices unresolved until chosen; retain backup and rollback.

## Full automation release gate

Every remaining item in docs/AUTOMATION.md must have both implementation evidence and a GM/player live test, including party reactions, external actions, areas, movement, allied expiry, all riders and migrations. Test with relevant campaign modules enabled and disabled. Do not mark compatibility verified or describe the class as fully automated before that gate passes.
