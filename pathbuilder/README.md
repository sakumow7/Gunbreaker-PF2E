# Gunbreaker for Pathbuilder 2e

Rules version: **1.4.0-beta.1**. Pathbuilder conversion revision: **r2**.

The pack was authored through Pathbuilder 2e Web's Custom Pack editor on
November 10, 2026 (Feylines 112.0). Its final native export should be named
**Gunbreaker PF2e 1.4.0-beta.1 Pathbuilder r2**. Earlier draft/r1 exports do not
contain the complete class feature list and must not be distributed.

## Contents

- One Gunbreaker class with 36 automatic features/actions, levels 1–20.
- All 37 selectable Gunbreaker feats, with action costs, traits and prerequisites.
- Gunblade (d8 slashing, two-hand d12) and Light Gunblade (d6 slashing, finesse).
- Reign of Beasts includes the full Noble Blood and Lion Heart rules in its
  description; those actions are not granted to characters without that feat.

The class grants Athletics, 3 + Intelligence additional skills, 10 HP per level,
Strength/Dexterity key attribute choice, standard feat/skill progression, and
automatic weapon, armor, save, Perception, class DC and specialization advances.
Use Pathbuilder's normal rune controls for magical gunblade upgrades.

## Install and share

1. In Pathbuilder 2e, open **Menu → Custom Pack → Import Custom Pack**.
2. Select the native exported JSON file, and enable the imported Gunbreaker content.
3. Select Gunbreaker from the class picker. Add a weapon from **Add Weapon → Custom**.
4. Share the unchanged native export with players. The `editor-content.json` file
   in this directory is a maintenance manifest, **not an importable pack**.

Pathbuilder features needed for custom content must be available on the player's
account/platform. No Android import verification has been performed.

## Table-facing rules and limitations

Pathbuilder is a character builder, not the Foundry combat engine. Track cartridges,
openings, cooldowns, reactions, healing, conditional AC/resistance and damage
manually. Apply save success upgrades and gunblade critical specialization when
their triggers occur. None of those conditional effects is added as a permanent
bonus. Gunnhildr Escort's two training choices (including Escort Lore or duplicate
replacements) require character setup. Noble Blood and Lion Heart are included
within the Reign of Beasts feat text rather than as separate granted action cards.

## Verification

A fresh character loaded all 36 automatic features after a full browser reload.
The test character used unchanged STR +3, DEX +1, CON +1, WIS +0, no armor and a
mundane one-handed Gunblade. These intentionally unoptimized values isolate the
class progression. Human ancestry contributed 8 HP.

| Level | AC | HP | Fort | Reflex | Will | Perception | Class DC | Gunblade attack | Damage |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 14 | 19 | +6 | +4 | +3 | +3 | 16 | — | — |
| 5 | 18 | 63 | +10 | +8 | +9 | +9 | 20 | +12 | 1d8+3 |
| 7 | 22 | 85 | +12 | +10 | +11 | +11 | 22 | +14 | 1d8+5 |
| 9 | 24 | 107 | +16 | +12 | +13 | +13 | 26 | +16 | 1d8+5 |
| 11 | 26 | 129 | +18 | +16 | +15 | +17 | 28 | +18 | 1d8+5 |
| 13 | 28 | 151 | +20 | +18 | +17 | +19 | 30 | +22 | 1d8+6 |
| 15 | 32 | 173 | +22 | +20 | +19 | +21 | 32 | +24 | 1d8+9 |
| 17 | 34 | 195 | +24 | +22 | +23 | +23 | 36 | +26 | 1d8+9 |
| 20 | 37 | 228 | +27 | +25 | +26 | +26 | 39 | +29 | 1d8+9 |

Sonic Break was marked ineligible before No Mercy was selected; after selecting
No Mercy at level 2, Sonic Break became eligible and was selected at level 6.

## Maintenance

Run `python tools/build-pathbuilder-content.py` to regenerate the source-derived
editor text. After editing a class's features in Pathbuilder, also update its
parent Source/version field before accepting. Feature-only edits did not persist
in the tested editor session. Reopen the editor and reload the app to confirm.

The native export has not yet been retrieved into this repository or round-trip
imported in a clean environment. Do not mistake the maintenance manifest for the
distribution file. The pack contains homebrew rules and no bundled FFXIV artwork.
