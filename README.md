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

The tracker has a **Native action beta** button for the active GM coordinator. It can execute the basic melee combo, Burst Strike, Gnashing sequence, Sonic Break, four single-target Continuations, Royal Guard, Camouflage, Nebula/Great Nebula, No Mercy, Superbolide, and Perfect Chamber. Select the ability, held gunblade, and native MAP stage. It reads native attack outcomes, records costs/openings, rolls native damage, and applies the listed self-effects. A canceled pre-roll selection spends nothing; a miss or canceled damage dialog does not refund the attack. Failed post-roll work blocks further native execution for GM recovery.

This prototype requires exactly one active token and combatant for the actor. It checks melee reach and target allegiance; the GM still checks terrain, visibility edge cases, action availability, and genuine threats. Native damage controls still apply damage. Optional feat riders are not all integrated. The manual tracker remains for uncovered actions; do not record a natively executed action again.

**Player routing, triggered party reactions, area saves, movement, external-action observation, and complete feat-rider coverage are pending.** Keep one GM operator per character during prototype testing. No multi-client safety or live compatibility claim is made.

## Build and review

```sh
npm ci
npm run build
npm test
npm run check
npm run balance
```

Build generates the catalogue, all five LevelDB packs, RULES.html, migration source snapshots, and `dist/gunbreaker-pf2e-1.4.0-beta.1.zip`. The ZIP has module.json at its root. It is a local candidate; no release assets are published by building it.

Target environment: **Foundry 14 build 369 / PF2e 8.7.0**. Those versions and installed Gunbreaker 1.3.0 were observed in Forge. This candidate itself has not been installed or tested there. Tests use pure transitions and mocked native ports; they cannot certify the real Foundry adapter. Follow SMOKE-TEST.md on disposable characters before replacing campaign copies.
