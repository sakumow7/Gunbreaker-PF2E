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

## Experimental player requests — two-client gate

Use one GM and one real player session on disposable actors. Keep the setting off in the campaign until all checks pass.

- Enable Experimental player action requests. Confirm the player's tracker macro opens the native panel and only the GM/requester see the request card. The GM must see the same scene.
- Select different targets on GM and player clients. Request Burst Strike as the player: the player's target is used, one native attack occurs, and exactly one cartridge is spent. Verify the normal GM roll/damage dialog flow and damage application.
- Try an unowned actor, revoked ownership while queued, a second active GM, no GM, and a GM on another scene. All must fail without an unauthorized roll or state write.
- Hold the panel open while the GM changes the tracker or advances combat. Submission must reject with no spend or opening change. Cancel the first encounter's roll and verify lazy initialization was not persisted.
- Issue simultaneous requests for the same actor and a GM manual correction. Verify serialized work, revision rejection, and no lost updates. Ordinary rules cards and edits to a request card must not execute.
- Try to supply a forged requester ID, hit result, or cost in a request. Reject it. Verify the server-reported create/update event user IDs with a second real client, not only a local hook call.
- Timeout an outstanding request, deliver its acknowledgement late, then disconnect/reconnect clients. No automatic request replay or retry; reconcile the actual native roll and actor journal first.
- Stop or replace the GM during a pending write. Treat this as an unresolved recovery case, not proof of failover safety. Keep routing disabled for regular play until the observed behavior and recovery procedure are accepted.

## Heart of Stone — assisted workflow gate

Use disposable characters and exactly one GM. Disable automatic damage application while testing; ordinary damage buttons bypass the reaction workflow.

- Enable Experimental Heart of Stone reactions. A successful enemy Strike should offer eligible owners one prompt; a miss, saving throw, nondamaging attack or persistent tick must not. Test a normal spell attack as well.
- Confirm base/enhanced scaling at 1, 7 and 19. Reserved Cartridge works at zero once on another ally and uses the regular reaction. Guardian’s Instinct has 30-foot range and grants no extra reaction before the first own turn.
- Test Aetheric Ward against self-targeted Strikes; reject spell attacks, reserves, free Perfect Chamber discounts and the extra reaction. Verify Continuation survives the reaction.
- Decline or close without spending. Leave a prompt open past the reminder: damage remains unresolved within this workflow. Only explicit GM continuation permits unprotected managed application.
- Pair the exact native damage card. Reject wrong attacker, item, target or degree. Test successful spell damage and document any critical spell representation the adapter rejects.
- With native physical/fire resistance already present, apply a mixed physical/fire attack. Inspect PF2e's native breakdown: resistance must stack according to native rules, with no additional subtraction. Check critical immunity and weaknesses. Confirm temporary protection never appears as a live actor effect.
- Apply an attack containing persistent bleed. Initial native application should create the condition; its later tick receives no Heart of Stone protection. A separate later attack also receives none.
- Double-click responses/application; try simultaneous protectors and concurrent tracker corrections. At most one managed acceptance/application occurs. Confirm manual player writes are blocked while the setting is enabled.
- Reroll/delete the attack, change ownership, advance combat before acceptance, or simulate a failed HP write. No silent refund, replay or guessed result. On GM reload, old windows require manual reconciliation.
- Test Bulwark movement, Shield Block, split packets and third-party auto-apply as explicitly unsupported paths. Do not declare full reaction automation until they have implemented integrations and passing tests.

## Core areas — GM and player gate

- From both entry paths, run Demon Slice/Slaughter and Fated Circle/Brand with allies, enemies, large tokens, elevation and walls nearby. Confirm the GM can exclude blocked creatures and no ally is included. Hidden enemies must stop automated execution for manual adjudication. Repeated tokens sharing an actor must also stop it.
- On a dual-class character, give the other class a different DC. Verify every save uses the Gunbreaker DC, with native save modifiers and degree adjustments. No MAP, Strength, weapon runes, specialization or No Mercy damage should enter these formulas.
- At levels 1, 12, 17 and 20, verify scaling and fire/cold/electricity calibration where available. Every target receives a multiplier of one shared roll. Verify native resistance, weakness, immunity and half-damage rounding. Critical-failure save damage must not trigger critical-hit-only immunity or resistance.
- Resolve all four save degrees. Test Evasion's native degree adjustment and Improved Evasion's damage exception; use GM review when needed. Damage review must not rewrite failed-save eligibility.
- Have every enemy critically succeed against Demon Slaughter: one cartridge still loads, bounded by capacity, after all saves. Closing damage review leaves that reward and the recovery block intact.
- Fated Circle spends one cartridge before saves and records only failed/critically failed targets. Move an eligible enemy out of range before Brand, include a new nearby enemy, and confirm only original eligible enemies remaining in range are offered. Brand rolls fresh saves and consumes the same once-per-round Continuation allowance as single-target follow-ups.
- Cancel before area confirmation: no state write. Cancel a save afterward: no refund or silent completion; preserve the private journal and block another action. Delete/reroll a recorded save before damage and verify reconciliation is required.
- Kill the first enemy through area damage and verify remaining enemies still resolve once. Interrupt after one application: the journal records which target completed and which was uncertain; reconnect must not replay either.
- Double-click, overlap two area actions with reversed actor order, and attempt a GM tracker correction while a target is reserved. Module writes must serialize without deadlock. Test unrelated module auto-damage separately; it is outside this queue and must not apply the same damage twice.
- Inspect as a player: detailed save/application journals remain GM-private; actor execution flags contain only status/reference metadata. Verify actual Foundry chat privacy and native roll/dialog behavior with two clients.

## Additional save powers — pending live acceptance

- Double Down: check enemies at 5, 10 and 15 feet; only those in the confirmed 10-foot emanation are eligible. Verify 10d6 at level 14 and 12d6 at 18, one shared initial roll, 2 cartridges spent and one-minute frequency. Test fire/cold/electricity calibration and native weakness/resistance.
- Danger Zone: select different enemies on GM/player clients. Only the player's selected enemy may save, with range 15 feet and d6s. Verify no area-damage-specific save bonus, weakness or resistance applies merely because this uses the shared save executor.
- Learn Blasting Zone at 14: Danger Zone becomes 30-foot range/d8s, still fire with Calibration, still one action. Its cooldown remains Danger Zone's once per 10 minutes, including if the upgrade is removed/readded. Reject an outdated or below-level upgrade. No separate Blasting Zone activation should appear.
- Bow Shock: test all four native save degrees. Initial damage follows basic-save scaling; only failures and critical failures receive a native persistent condition. Check 1d4 below level 12 and 2d4 at/above 12. Critical failure must not double the persistent formula or flag it as a critical hit. Calibration must not change either fire component.
- Verify Bow Shock against fire immunity and existing persistent fire of both lower and higher amounts; native condition stacking, immunities and later recovery must behave normally. Check that no persistent damage occurs immediately and normal end-of-turn rolls/recovery checks remain available without a fixed duration or duplicate module tick.
- Adjust a failed save's initial damage to zero in GM review: an eligible persistent condition may still apply alone. Suppress persistent damage only for a relevant rule; successful saves must never gain it through this review.
- Cancel before confirmation: no cartridge/frequency spend. Cancel a save after confirming each power: its cost and cooldown remain committed and recovery blocks retry. Verify exact 60-second/600-second frequency boundaries after reconciliation.
- Advance combat after the first application or hide/move a target after its save. Resolution must stop with a private recovery record rather than damaging later targets on a stale turn. Native HP and condition creation are separate writes internally; an uncertain application must never be replayed automatically.

## Saturation Fire — native line acceptance pending

- In the disposable v14/PF2e setup, use a 5-foot square grid and one GM. Request Saturation Fire as the player with arbitrary selected tokens and a nonzero panel MAP: the request must contain no targets/region and use MAP zero. The GM places and aims the native 30-foot line.
- Verify native two-click origin/aim placement, cancel/back behavior and that the final origin must be a grid corner on the acting token's edge. Test Medium and Large actors, cardinal and diagonal lines, wall-blocked squares and a Large enemy only partly covered. Compare selected enemies with native highlighted covered spaces.
- Put allies and the acting creature in the covered spaces: neither may be included. Check that another nearby enemy outside the native line is not selected merely because it is within 30 feet radially. Retain GM review for exceptional geometry.
- Cancel placement, cancel target confirmation, or finish with no eligible enemies: no cartridge, opening or actor journal change; any created preview is removed. No-cartridge/unknown-feat requests should reject before placement. A second simultaneous aiming session must not replace the first.
- Confirm with valid enemies: spend exactly one cartridge before saves, roll ceil(level/2)d6 once, resolve native basic Reflex saves against Gunbreaker DC, and apply native IWR once per target. Calibration changes fire to cold/electricity; no MAP, weapon bonuses or Fated Brand opening.
- Modify a wall or line shape, move the source/target, change levels or bring a new enemy into the confirmed line before commitment: reject without spending and clean the preview. Repeat after saves: preserve spend, stop remaining damage and retain region/private journal for recovery.
- Kill the first target during application and ensure later original targets still resolve once. Reload with a pending journal: do not resume, recreate or replay the action. Reconcile HP, native chat and the retained region before clearing the lock manually.
- Test gridless/hex/10-foot-grid scenes, a hidden source and intersected enemies at different elevations. These should stop for manual adjudication. A modified ownership marker must prevent cleanup from deleting someone else's region.
- Verify completed previews clear, interrupted previews remain, and a deletion failure produces a cleanup warning without repeating damage. Test real region permissions and interactions with campaign modules; local mocks do not establish live compatibility.

## Bloodfest and Reign — pending live acceptance

- Request Bloodfest with one genuine enemy at 30 feet, then at 31 feet, hidden, allied and on another scene. Only the valid enemy should allow frequency/resource changes. Confirm +3 capacity/+3 cartridges and Ready to Reign for one minute, with native reminder effects. At expiry normalize capacity and discard excess; encounter changes must not refresh the ten-minute frequency.
- Import the current Reign feat and granted actions. Start from Bloodfest, then use Reign, Noble Blood and Lion Heart on consecutive own turns. Verify native action-specific 2d6/3d6/4d6 slashing additions, correct selected MAP and normal weapon runes/criticals. A normal Strike must never acquire those bonus dice.
- Miss each primary Strike: the next opening still appears, but no primary damage/secondary saves roll. Cancel an attack: readiness/opening/state remain unchanged. Same-turn second steps, expired openings and missing Reign feat must reject before rolling.
- On a hit, offer only other enemies within melee reach and adjacent to the primary target. Test reach weapons, large tokens, allies, hidden creatures, elevations and blocked geometry. GM confirms edge cases. Choose zero, one and two; more than two must ask again without repeating the Strike.
- Test a primary critical hit against a normal hit: secondary formulas remain 2d6/3d6/4d6 fire. Each secondary's own save determines its basic multiplier; Calibration, No Mercy and weapon dice/runes must not enter those formulas. Check native IWR and special save exceptions.
- Finish the secondary workflow, then apply the primary damage once through its native card and resolve its appropriate reactions. Verify third-party modules do not auto-apply primary damage out of order or duplicate secondary damage. Managed secondary damage does not intercept ordinary primary damage buttons.
- Reroll/delete the attack, cancel primary damage, close secondary selection, move a target or advance combat during resolution. The journal must preserve actual evidence and block a new action without refunding a resolved Strike. Choosing zero secondaries explicitly is a valid completion; closing the prompt is not.
- Interrupt after one secondary HP application, reconnect, then retry: no replay, duplicated damage or additional readiness use. Inspect completed versus uncertain entries and reconcile manually. Confirm only module-managed Ready to Reign reminders are removed when starting the sequence.

## Relentless Rush acceptance (pending live execution)

- At level 18, confirm a 5-foot enemy emanation: one 8d6 fire pool, native basic Reflex saves, reviewed IWR, ten-minute frequency and resistance 9. At level 19 resistance remains 9. Calibration does not change either blast.
- Confirm an empty initial area: frequency is spent, resistance/trigger are created, no damage is rolled. Close the initial prompt instead: spend nothing.
- Move before the next turn and change nearby enemies. On both GM-advanced and player-advanced turns, verify exactly one GM workflow, resistance expiry before the blast, and fresh current targets with one 4d6 fire pool/new saves.
- Verify no second action, cartridge, MAP, frequency or next-action opening is spent. Repeated turn hooks and backward/forward navigation must not repeat damage.
- Become unconscious, die or stop holding a gunblade before the trigger: no blast and protection ends. Stunned/paralyzed alone allows the automatic blast; changing to another held gunblade also allows it.
- Empty delayed area completes without damage. Closing the triggered area confirmation, canceling a save or interrupting HP application leaves recovery and cannot repeat prior writes.
- Reconnect before the due round preserves a future trigger; reconnect during/after the due turn requires reconciliation, with no retroactive blast. End/delete combat before resolution and check managed protection cleanup without frequency reset.
- Change initiative order, source token, scene, or combat while a dialog is open; verify recovery rather than damage on stale targets. Test one active GM, two GM clients, and a player without HP ownership.
- Check PF2e Toolbelt, Workbench, HUD and reaction automation on disposable actors; verify no duplicate damage, unexpected expiry or unresolved reaction conflict.
