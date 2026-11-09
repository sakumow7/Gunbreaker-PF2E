# Migrating to the v1.4 development candidate

Do not migrate campaign actors until the native candidate passes disposable-character tests. Updating the package alone never rewrites owned items.

1. Export affected actors and back up the world. Finish current combat. Keep an untouched character copy and the prior installed package.
2. Preview changes using `node tools/plan-migration.mjs actor-export.json migration-plan.json`. The output includes a detached backup, compatible updates, custom-field conflicts, and retired-feat decisions. It never writes to Foundry and refuses to overwrite an existing output file.
3. Twin Cartridge owners choose Reserved Cartridge or a free retrain. Reserved Cartridge has a new source ID; do not relabel an owned Twin Cartridge automatically. Overcharged Gauge owners choose a legal replacement for the original slot. Both retired entries are removed from selectable compendium feats; their baseline definitions remain in migrations/.
4. Update compatible class/features/actions and equipment on a duplicate. Preserve item location, selections, links, runes, materials, custom rules, and unrelated items. The preview only matches known compendium source IDs; it will not guess from an item's display name. Resolve every conflict before applying updates.
5. Update the gunblade's RollOption rule as well as action data. Native action DamageDice predicates require v1.4 action copies. Do not add the bonus dice manually when using native execution.
6. State v1 upgrades to v2 in memory and on the next successful write. Legacy daily timestamps stay spent until eligible daily preparations. Minute cooldowns survive encounter changes. Retired feat slugs block v1.4 action use until retraining is resolved.
7. Complete SMOKE-TEST.md on the duplicate. Keep campaign actors unchanged until the new grants, proficiency, equipment, resource ledger and effects are confirmed.

For an interrupted native action, export `flags.gunbreaker-pf2e.execution` and inspect its before-state, request and committed result. Determine whether the attack, damage, HP and effects actually occurred. Reconcile those documents with the GM before clearing the journal; never blindly replay the action or refund a rolled attack. The GM Native Actions panel now offers Recovery: it saves a private actor backup and accepts a manually reconciled outcome without replay/refund. This does not resolve Heart of Stone’s separate reaction-window journal.

The GM Migration control can preview and apply conflict-free updates on a disposable character; explicit retired-feat choices and source matching remain required. Rollback migration restores only migration-owned fields and refuses later edits to those fields. Partial operations require manual reconciliation against the backup. See docs/SUPPORT-AND-RIDERS.md.

For a full package rollback, restore the untouched actor export and prior module package together. Do not load state v2 in v1.3; the old engine correctly rejects an unknown schema. Retain backups until the campaign has completed its acceptance encounter.
