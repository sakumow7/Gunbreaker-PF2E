# Gunbreaker — PF2e Remaster Playtest

**1.4.0-beta.1 development candidate** implements the approved [v1.4 design](docs/DESIGN-v1.4.md). This branch is a rules revision plus an initial native-action prototype, **not a completed full-automation release**. The campaign remains on 1.3.0 until a separately reviewed install.

[Complete rules](RULES.html) · [Automation coverage](docs/AUTOMATION.md) · [Migration](MIGRATION.md) · [Live test plan](SMOKE-TEST.md)

## Rules revision

- Superbolide costs HP equal to level, leaving at least 1 HP.
- Single-target Continuation adds the opening weapon's damage-dice count; reactions preserve its next-action window.
- Heart of Stone accepts successful enemy attack rolls, including spell attacks.
- Reserved Cartridge replaces Twin Cartridge by explicit player choice. Expanded Gauge scales at 18; Overcharged Gauge is retired with free retraining.
- Camouflage refreshes once per minute. Overpowered Round and Saturation Fire exclude allies.
- New feats: Guarded Advance, Aetheric Calibration, Gunnhildr Escort.

Unlisted class progression and abilities retain the 1.3 baseline. Ordinary Strength and Dexterity martial builds remain the balance baseline. New numerical values require encounter playtesting.

## Native-action prototype

The tracker has a **Native action beta** button for the active GM coordinator. A disabled-by-default **Experimental player action requests** world setting enables the player entry path for disposable-character tests; the existing tracker macro then opens the native panel directly for players. It can execute the basic melee combo, Burst Strike, Gnashing sequence, Sonic Break, four single-target Continuations, Royal Guard, Camouflage, Nebula/Great Nebula, No Mercy, Superbolide, Perfect Chamber and Bloodfest. Select the ability, held gunblade, and native MAP stage. It reads native attack outcomes, records costs/openings, rolls native damage, and applies the listed self-effects. A canceled pre-roll selection spends nothing; a miss or canceled damage dialog does not refund the attack. Failed post-roll work blocks further native execution for GM recovery.

This prototype requires exactly one active token and combatant for the actor. It checks melee reach and target allegiance; the GM still checks terrain, visibility edge cases, action availability, and genuine threats. For Strikes and single-target follow-ups, native damage controls still apply damage. Optional feat riders are not all integrated. The manual tracker remains for uncovered actions; do not record a natively executed action again.

**Player routing is implemented as an experimental transport; live two-client verification remains pending.** It requires exactly one active GM on the same scene. The player selects an ability, held gunblade, attack stage, and target. A private request card carries that intent to the GM, who runs the normal PF2e roll/damage dialogs. This still requires GM participation; it is not the final minimal-interface experience.

The server-delivered creation-event user ID identifies the requester. The coordinator rechecks ownership, resource revision and combat turn, and shares one actor queue with manual tracker writes. Manual tracker writes from players are blocked while routing is enabled; the GM records uncovered actions. Ordinary rules cards and edited request cards never execute. Timed-out or uncertain submissions stay locally blocked until a GM acknowledgement arrives; they are not automatically retried or replayed on reconnect. See [request transport and recovery limits](docs/PLAYER-REQUESTS.md).

Support powers, Lightning Shot, optional resource/rider controls, encounter cleanup, recovery/migration controls and Escort setup are now implemented as prototypes; see [coverage and limits](docs/SUPPORT-AND-RIDERS.md) and [detached live QA](docs/LIVE-QA-2026-11-08.md).

**Automatic damage interception, complete party reaction coverage, live area validation, movement, external-action observation, and complete feat-rider coverage remain pending.** No distributed-lock, seamless GM failover, multi-client runtime safety, or live compatibility claim is made.

## Save-action prototype

Demon Slice, Demon Slaughter, Fated Circle, Fated Brand, Double Down, Danger Zone, Bow Shock and Saturation Fire run from the same native panel. The GM confirms eligible enemies and geometry, resolves native Reflex saves against the Gunbreaker DC, and reviews damage before one native application per target. Double Down uses a 10-foot emanation; the other emanations use 5 feet. Danger Zone uses one selected enemy within 15 feet, automatically upgrading to Blasting Zone at 30 feet when learned. The upgrade shares Danger Zone's frequency. Each activity rolls damage once. Demon Slaughter loads its cartridge after every save resolves, including when all enemies succeed; Fated Brand makes fresh saves against original failed-save targets still in range.

Saturation Fire adds native placement for a 30-foot line. The GM places the origin on a grid corner along the acting token’s edge, aims it, then confirms enemies found through PF2e’s covered-space checks. It spends one cartridge and uses calibrated damage. This prototype requires a flat scene with 5-foot square spaces; unsupported elevations/grids need manual adjudication. Preview lines clear after completion/cancellation and stay for interrupted-action recovery.

Emanations and Saturation Fire need no player target selection; Danger Zone preserves the player's one selected target. These save abilities do not use MAP. Geometry, exceptional save-damage rules and outstanding reactions remain GM decisions. Hidden enemies require manual adjudication. Bow Shock includes native persistent fire on failed saves, without doubling it or applying an immediate tick. Its later ticks and recovery use PF2e's normal persistent-damage controls. Cartridge costs and frequencies commit before saves; interruption records a private GM journal and blocks replay. Optional feat riders and live area validation are pending. See [area coverage and recovery](docs/AREA-COMBOS.md).

## Reign sequence prototype

Bloodfest now validates one selected enemy within 30 feet, commits its frequency and cartridge expansion, and grants Ready to Reign. Reign of Beasts, Noble Blood and Lion Heart use native melee Strikes with the existing bonus-dice rules, preserve normal MAP, and enforce their openings and one-step-per-turn limit. Misses advance the sequence.

On a hit, the GM chooses up to two other eligible enemies for native Reflex saves and reviewed secondary fire damage. Primary critical hits do not double secondary damage, and Calibration does not change it. Primary HP application remains on the normal damage-card controls after this workflow completes. Exact attack/damage evidence and a private journal block uncertain repeats. See [Reign coverage and recovery](docs/REIGN.md); live testing remains pending.

## Relentless Rush prototype

Relentless Rush now resolves its initial 8d6 fire emanation and grants native all-damage resistance until the next turn. At that turn start, the GM coordinator checks consciousness and a held gunblade, discovers current enemies, and resolves a fresh 4d6 fire emanation without another action or frequency. Empty areas are legal; interrupted or already-due triggers never replay automatically. The GM still confirms areas and reviews damage. See [Rush timing and recovery](docs/RELENTLESS-RUSH.md); real-client acceptance remains pending.

## Heart of Stone prototype

A separate, disabled-by-default **Experimental Heart of Stone reactions** setting detects successful native damaging Strikes and spell attacks. Eligible owners receive a consolidated protection prompt; the GM handles unassigned characters. It validates base/enhanced protection, Reserved Cartridge, the regular/Guardian’s Instinct reaction pools, Aetheric Ward restrictions and Lion’s Legend scaling. Declining spends nothing. An unresolved prompt requires an explicit GM continue decision.

The GM must pair the exact native damage card and apply it through the reaction card. The adapter supplies a temporary Resistance rule to a contextual target clone for one native damage application. It leaves no general resistance effect on the ally and does not subtract protection after PF2e IWR.

**This is an assisted reaction workflow, not automatic interception of every damage application.** Ordinary damage buttons and other modules bypass it. Bulwark movement, Shield Block combinations, split damage packets, some critical spell damage representations, automatic visibility adjudication and recovery UI remain manual. Exactly one GM is required, and old windows after a GM reload cannot resume without manual reconciliation. See [full coverage and test boundaries](docs/HEART-OF-STONE.md). No live GM/player test has been completed.

## Build and review

```sh
npm ci
npm run build
npm test
npm run check
npm run balance
```

Build generates the catalogue, all five LevelDB packs, RULES.html, migration source snapshots, and `dist/gunbreaker-pf2e-1.4.0-beta.1.zip`. The ZIP has module.json at its root. It is a local candidate; no release assets are published by building it.

Target environment: **Foundry 14 build 369 / PF2e 8.7.0**. Those versions and installed Gunbreaker 1.3.0 were observed in Forge. This candidate itself has not been installed or tested there. Tests use pure transitions, mocked document lifecycle events and mocked native ports; they cannot certify the real Foundry adapter. Follow SMOKE-TEST.md on disposable characters before replacing campaign copies.
