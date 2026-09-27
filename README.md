# Gunbreaker — PF2e Remaster Playtest

Version **1.3.0** adapts FFXIV Gunbreaker into a martial defender with cartridge-powered sword combos, close-range bursts, and party protection. [Read the complete rules](RULES.html), [design and playtest notes](PLAYTEST.md), and [changes](CHANGELOG.md).

Targets **Foundry 13+ / PF2e 7+**. Live compatibility is pending the [smoke test](SMOKE-TEST.md); this release makes no verified-version claim. This is for the PF2e system, not Starfinder 2e.

## The class

Strength or Dexterity; 10 HP per level; light/medium armor; d8/two-hand d12 Gunblade or d6 finesse Light Gunblade. You begin each encounter with one cartridge. All six basic combo/burst actions are available at level 1. A missed Strike still advances the combo and a completed finisher still loads a cartridge.

Heart of Stone protects an ally as a reaction, with an optional cartridge for stronger resistance. Royal Guard grants +1 circumstance AC without reducing damage. Weapon proficiency reaches expert at 5 and master at 13; armor reaches expert at 7 and master at 15. Gnashing Fang arrives at 6, hit-confirmed Continuation at 7, Fated Circle at 12, and Double Down at 14. Reign of Beasts is an optional level-18 feat requiring Bloodfest.

Five compendia contain the class/features/actions, selectable feats, weapons, effects, and tracker macro. Existing item IDs are preserved. **Updating from 1.2.x? Follow [MIGRATION.md](MIGRATION.md)** before using old characters.

## Install

Build the package below, then upload `dist/gunbreaker-pf2e-1.3.0.zip` through Forge's Summon Import Wizard or extract it to your Foundry `Data/modules/gunbreaker-pf2e/` folder. The ZIP has `module.json` at its root. Enable the module and reload. The manifest's release URLs are for a future published v1.3.0 release; this branch does not publish release assets automatically.

Add Gunbreaker from the class compendium, equip a gunblade, and select feats normally. Import **Gunbreaker Tracker** from **Gunbreaker — Tracker** into your hotbar. At the start of Foundry combat, select your token and initialize the encounter once.

## Tracker and automation boundaries

The tracker stores cartridges, combo/readiness windows, timed uses, and selected optional resource features. It checks learned actions and levels, costs, combo prerequisites, hit-confirmed follow-ups and targets, and shared per-round limits. Each recorded transition commits to a single actor flag. It rejects stale revisions on a client; use one operator per character.

1. Select targets, check costs and prerequisites, and resolve the action's rolls normally.
2. Open the tracker, select the action and outcome, and record it once. A missed spender still pays its cost. For Fated Circle, identify only the failed-save targets.
3. Apply damage, healing, temporary HP, and linked effects manually. Use **Record other action** when moving, Striking normally, or taking any other action between an opening Strike and Continuation; that closes the follow-up but preserves the combo.

Posting a rules card never changes the gauge or applies effects. The tracker does not roll attacks, spend sheet actions or reactions, inspect target defenses, check range/reach/HP, or decide whether a target is a genuine threat. It does not automatically apply allied effects or resolve damage. These are table decisions, not claimed automation.

Cooldowns use Foundry world time and persist across encounters. Aurora and defensive abilities without an encounter requirement can also be recorded during exploration; they generate no cartridges. Round/turn gates use the active combat. Initialize an encounter once; use Clear ended encounter after combat. Confirm Daily preparations only after completing them. Gauge correction buttons are for GM-agreed bookkeeping corrections, not extra cartridge generation.

The former native Attributes-tab gauge is replaced by this tracker. Current state is available via:

```js
const api = game.modules.get("gunbreaker-pf2e").api;
await api.tracker();
// With an actor you own:
api.getState(actor);
await api.adjustCartridges(actor, +1); // manual correction only
```

## Build and validate

Requires Node.js 22+ and npm. JSON in `packs/_source/` is the canonical authored content. No old baseline generator should be run over it.

```sh
npm ci
npm run build
npm test
npm run check
npm run balance
```

Build regenerates the browser tracker catalogue, all five LevelDB packs, standalone `RULES.html`, and a local installation ZIP. `node pack_leveldb.mjs` is a compatibility alias for the same build. Commit authored JSON and regenerated packs/catalogue/rules together. Build dependencies are pinned in the lockfile. The historical 1.2 generators were retired because rerunning them overwrote newer rules.

Tests cover the pure tracker and a mocked Foundry adapter; validation checks internal links/grants, source-to-pack parity, package contents, and progression. [BALANCE.md](BALANCE.md) contains the generated damage worksheet. These checks do not establish encounter balance or live Foundry compatibility; see the playtest and smoke-test documents for remaining validation.
