# Gunbreaker Class (PF2e)

A maximally faithful adaptation of the **Final Fantasy XIV Gunbreaker** job as a
full **Pathfinder 2e** class for Foundry VTT. Built to be installed once and
reused across every PF2e campaign you run.

> **System:** Pathfinder Second Edition (`pf2e`, 5.13.0 or later). **Foundry:**
> v11–v13 (LevelDB packs; verified against v12). This module does **not** work in the
> Starfinder 2e (`sf2e`) system — that would require a separately authored set
> of `sf2e` items.

## What's inside

Four compendia under the **Gunbreaker (FFXIV)** folder:

| Pack | Contents |
| --- | --- |
| Gunbreaker — Class | The class item, 17 auto-granted class features across levels 1–19, and the 3 basic combo actions |
| Gunbreaker — Feats & Actions | 35 selectable class feats at levels 1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20 |
| Gunbreaker — Gunblades & Gear | Base gunblade weapon + two magical variants |
| Gunbreaker — Effects | Combo-readiness and buff effects that drive the routes |

### Class progression (auto-granted features)

Like every PF2e class, the Gunbreaker has a fixed feature progression that
attaches automatically when you take the class:

| Level | Features |
| --- | --- |
| 1 | Powder Gauge, Gunbreaker's Combo, Royal Guard, Gunbreaker feat |
| 2 | Gunbreaker feat, skill feat |
| 3 | Steady Aim, general feat, skill increase |
| 4 | Gunbreaker feat, skill feat |
| 5 | Gunblade Weapon Mastery (expert weapons), ancestry feat, skill increase |
| 6 | Gunbreaker feat, skill feat |
| 7 | Continuation, Weapon Specialization, general feat, skill increase |
| 8 | Gunbreaker feat, skill feat |
| 9 | Aetheric Fortitude (expert Fort), Cartridge Expertise, ancestry feat, skill increase |
| 10 | Gunbreaker feat, skill feat |
| 11 | Gunbreaker Expertise (expert class DC), Armor Expertise, general feat, skill increase |
| 12 | Gunbreaker feat, skill feat |
| 13 | Gunblade Legend (master weapons), Battle-Tested (expert Reflex), ancestry feat, skill increase |
| 14 | Gunbreaker feat, skill feat |
| 15 | Greater Weapon Specialization, Armor Mastery, general feat, skill increase |
| 16 | Gunbreaker feat, skill feat |
| 17 | Gunbreaker Mastery (master class DC, expert Will), ancestry feat, skill increase |
| 18 | Gunbreaker feat, skill feat |
| 19 | Lion's Legend (legendary weapons), general feat, skill increase |
| 20 | Gunbreaker feat, skill feat |

Class feats are *chosen* from the Feats pack at each Gunbreaker feat slot, just
like Fighter or Barbarian feats — every slot level has at least two options, and
each feat carries a level prerequisite so the sheet only offers level-appropriate
picks.

## Faithful mechanics

- **Powder Gauge / Cartridges** — a `cartridges` resource (0–3, raised to 6 by
  Bloodfest) added automatically to any character carrying the class. Combo
  finishers (Solid Barrel, Demon Slaughter) load cartridges; Burst Strike,
  Gnashing Fang, Fated Circle, and Double Down spend them.
- **Combo routes** — Keen Edge → Brutal Shell → Solid Barrel (single target)
  and Demon Slice → Demon Slaughter (AoE). Each step grants a "combo ready"
  effect that gates the next and adds bonus damage.
- **Continuation** — Gnashing Fang/Savage Claw/Wicked Talon, Burst Strike, and
  Fated Circle each open a one-action follow-up gunshot.
- **Potency → PF2e** — FFXIV potency values are noted in each description for
  reference, but damage is expressed as PF2e weapon dice + level-scaled bonuses
  so it's balanced at the table.

## Install on Forge / Foundry

1. Zip this folder (or use the provided zip) so that `module.json` sits at the
   archive root.
2. **Forge:** Bazaar → *Import Wizard* / *Upload Module* → upload the zip.
   **Self-hosted:** drop the unzipped `gunbreaker-pf2e` folder into your
   `Data/modules/` directory, or use *Install Module → Manifest URL* if you
   host `module.json` somewhere reachable.
3. Launch a **PF2e** world, enable **Gunbreaker Class (PF2e)** under *Manage
   Modules*.

## Use

1. Open a character, drag **Gunbreaker** from the *Gunbreaker — Class* pack onto
   the sheet. Its class features attach automatically.
2. Drag a **Gunblade** from the equipment pack and equip it.
3. Add actions from the *Feats & Actions* pack as the character gains levels.
4. The **cartridge resource** appears on the Attributes tab. Adjust by hand, or
   from a macro:
   ```js
   game.modules.get("gunbreaker-pf2e").api.adjustCartridges(actor, +1);
   ```

## Automation (what clicking does)

When you post an action to chat from the character sheet, the description
contains clickable buttons and the module reacts automatically:

- **Damage** — combat actions embed an inline `@Damage` roll. Click it to roll
  the action's bonus dice with the right damage type (e.g. Solid Barrel `2d8`,
  Wicked Talon `4d8`). Level-scaling blasts use `(ceil(@actor.level/2))dN`, so
  Danger Zone / Blasting Zone / Fated Circle scale with you automatically.
- **Saves** — AoE actions embed a basic `@Check` against your class DC. Click it
  to post a save button players/targets can roll.
- **Effects** — posting an action applies its effects to you **automatically**:
  combo steps grant their "ready" window (Keen Edge → *Combo: Keen Edge Ready*,
  etc.) and consume the window they used up; No Mercy, Camouflage, Nebula, and
  Bloodfest apply their buffs; Royal Guard enters the stance and Release Royal
  Guard removes it. Re-using an action refreshes its effect instead of stacking
  a duplicate copy.
- **Cartridges** — actions that build or spend cartridges (Solid Barrel +1,
  Demon Slaughter +1, Bloodfest +3, Burst Strike −1, Gnashing Fang −1, Fated
  Circle −1, Double Down −2) adjust the Powder Gauge **automatically** when
  posted to chat and report the new total. If you don't have enough cartridges
  for a spender, you'll get a warning but the action still resolves (GM can
  override).

**What is *not* automated** (PF2e limitation, not a bug):

- Combo gating isn't enforced — nothing stops you clicking Solid Barrel without
  Brutal Shell first. The combo-ready effects are reminders, not locks.
- On-hit riders (Brutal Shell's heal/barrier, "on a hit deal +Xd6") can't be
  conditional on the attack landing; apply the heal manually when you hit.
- AoE damage isn't auto-applied to each token — roll once, then the GM applies
  to targets, the same as every PF2e area effect.

## Rebuilding the packs (for editing)

Source JSON lives in `packs/_source/` and is the canonical source — edit those
files directly, then repack:

```bash
npm install classic-level
node pack_leveldb.mjs         # repack LevelDB folders
```

> `build_sources.py` reproduces the v1.2.1 baseline and predates the v1.2.2
> fixes; re-running it will overwrite them. Kept for reference only.

## Notes & balance

This is homebrew. Potency numbers from FFXIV don't map linearly to PF2e, so the
bonus dice are deliberately conservative; tune the `+NdN` values in
`build_sources.py` to taste. Defensive cooldowns are written as activities with
minute/10-minute frequencies to approximate FFXIV recast timers. The "enmity"
fantasy is modeled through flat-footed/taunt riders rather than a hard threat
system, since PF2e has no aggro mechanic.
