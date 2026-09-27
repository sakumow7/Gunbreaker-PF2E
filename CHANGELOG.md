# Changelog

## 1.3.0 — Gunbreaker balance playtest

- Complete single-target and area combo routes plus Burst Strike at level 1. Begin encounters with one cartridge. Misses advance combos; finishers generate a cartridge after resolution.
- Add Heart of Stone at level 1; cartridges enhance ally protection. Royal Guard keeps its AC bonus without cutting damage.
- Reduce bonus damage, give area attacks explicit saves and two-action costs, and limit Gnashing/Reign sequences to one step per turn. Continuation requires a hit, the same target, the next action, and one use per round.
- Replace invalid weapon-proficiency rules with native proficiency subfeatures. Expert/master weapons at 5/13, armor at 7/15, master Fortitude at 9, expert/master Perception at 3/11, expert/master Will at 3/17, expert Reflex at 11, expert/master DC at 9/17. Correct greater specialization to 4/6/8.
- Add a d6 finesse Light Gunblade. Remove free versatile fire from normal gunblades.
- Rewrite all selectable feats: stronger Trajectory and No Mercy, explicit defensive resistance, defined Superbolide and Gunmetal Soul, shared cooldowns for upgrades, separate Noble Blood and Lion Heart actions, and Auroral Mastery.
- Replace chat-post mutations with an explicit tracker. Validate costs, combo windows, hit outcomes, targets, shared Continuation limits, learned actions, levels, and cooldowns. Store the entire transition in one actor flag update.
- Preserve existing item IDs and pack locations, repair links, rebuild LevelDB packs, add a tracker macro and complete standalone rules.
- Replace destructive historical generators with one reproducible build from canonical JSON. Add regression tests, package validation, and a damage comparison worksheet.

This is a playtest revision. Automated checks do not substitute for a live Foundry smoke test or encounter playtesting. See MIGRATION.md before updating existing actors.
