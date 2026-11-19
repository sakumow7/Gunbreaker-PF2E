# Gunbreaker 2.0 design

2.0 builds on the 1.4 engine. Native actions, the GM coordinator, the player panel and Heart of Stone prompts are unchanged; the rules data and formulas change. Goal: an offensive defender that plays like the FFXIV job (burst windows, Continuation, gauge), sits above a featless martial and below a Fighter single-target, and clearly wins against crowds.

## Rules changes

| Area | 1.4 | 2.0 |
|---|---|---|
| No Mercy | Class feat (level 2) | Level 1 class feature. Status bonus to gunblade Strike damage 2, 3 at 14, 4 at 20 |
| Continuation follow-ups | 1 action; 2d6, 3d6 at 11, 4d6 at 17, + weapon dice count | **Free action** right after the hit, once per round. 1d6, 2d6 at 14, 3d6 at 20 (no weapon dice) |
| Burst Strike | 1d6, 2d6 at 5, 3d6 at 11, 4d6 at 17 | 1d6, 2d6 at 5, 3d6 at 14, 4d6 at 20 |
| Gnashing Fang / Savage Claw / Wicked Talon, Sonic Break | Extra dice step at 11 / 17 | Extra dice step at 14 / 20 |
| Demon Slice / Demon Slaughter | d4 dice | d8 dice |
| Fated Circle | d6 dice | d10 dice |
| Fated Brand | 2d6 | 2d6, 3d6 at 20 |
| Royal Guard | +1 AC stance | Also a 5-foot enmity aura: enemies inside take −1 circumstance to attack rolls that don't target you |
| Heart of Stone | Resistance 2 + half level; enhanced 2 + level | Resistance 2 + level; enhanced 2 + level + half level |
| Lion's Legend (19) | Start with 2 cartridges; enhanced Heart of Stone 4 + level | Also legendary light/medium/unarmored; enhanced Heart of Stone 2 + 2 × level |

Engine changes: `scripts/mechanics.mjs` (follow-up and Heart of Stone formulas), `scripts/area.mjs` (area dice), `tools/validate.mjs` (armor progression). Native actions accept 1.4 and 2.0 compendium items.

## Balance

`npm run sim` (tools/balance-sim.mjs) plays whole 4-round encounters and writes SIMULATION.md. Single-target 2.0 sits at roughly 103–125% of a featless martial, about level with 1.4 and below a Fighter at every level. Against three adjacent foes 2.0 roughly doubles 1.4. Scaling steps sit at 14 and 20: with steps at 12 and 18 (`TIER_AT=12`) levels 12–13 reached about 133% and tied a Fighter.

## Animations

Optional Sequencer + JB2A effects (free or Patreon). `scripts/fx-catalogue.mjs` is pure: roles, the database matcher (shared with Machinist, Pictomancer and Dragoon), payloads and cues. `scripts/fx.mjs` plays them and draws lasting indicators.

- Driven by documents every client already receives: native attack cards (Strike swing and impact by degree), Continuation and area damage cards, and new effects on tokens (No Mercy, Bloodfest, Royal Guard, Nebula, Camouflage, Superbolide, Heart of Stone/Corundum/Light, Aurora, barriers). No socket traffic and no writes.
- Cartridge pips above the Gunbreaker's token during an encounter (Bloodfest slots in crimson); persistent auras while No Mercy, Bloodfest or Royal Guard is up.
- Settings: world on/off, per-client level (Full, Reduced without screen shake, Off), and JSON artwork overrides by role. A `gunbreaker-pf2e.fx` hook returning false cancels a payload. `game.modules.get('gunbreaker-pf2e').api.fx.missing()` lists roles with no artwork.
