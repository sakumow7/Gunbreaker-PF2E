# Gunbreaker Revised Class Design

Proposed version 1.4  |  Design draft 1  |  November 8, 2026

Prepared for John Atis. This document defines the next Gunbreaker rules revision for review before implementation or release. It also specifies the later Foundry automation experience: players choose tactics, targets, and reactions; the system handles resource accounting and supported mechanical outcomes.

Gunbreaker remains a martial defender built around gunblade combinations, cartridges, and protective wards. The revision improves weak choices and defensive flow while preserving standard martial accuracy and the cost of committing actions to damage.

## Design decisions in this draft

| Area | Proposed decision |
| --- | --- |
| Superbolide | Lose HP equal to level, to a minimum of 1 HP; retain twice-level resistance and daily frequency. |
| Continuation | Add the number of weapon damage dice to the four single-target follow-ups. Retain one action and one use per round. |
| Protection | Broaden Heart of Stone to damage from a successful enemy attack roll; retain resistance values. |
| Feat choices | Consolidate capacity feats; replace Twin Cartridge with Reserved Cartridge; refine three weaker feats. |
| New options | Guarded Advance, Aetheric Calibration, and Gunnhildr Escort. |
| Automation | One execution path from sheet or compact panel; automatic costs, combos, outcomes, and timed effects. |

## How to use this document

The rules below are proposed replacements and additions to the pinned v1.3.0 baseline. Unlisted abilities retain that baseline’s text and values. The change inventory identifies every intended rules change. Exact text in this draft is suitable for implementation after design review, but numerical balance remains a playtest hypothesis.

The reference baseline is sakumow7/Gunbreaker-PF2E at commit 91aaf6755ad4abbd1709ba962804409eb7fc23df. The repository and installed module remain unchanged. Approval of this design precedes a later implementation and automation phase; this document is not a release package.

## Class foundation and progression

Keep Strength or Dexterity as the key attribute, 10 + Constitution modifier HP per level, trained Athletics plus 3 + Intelligence modifier additional skills, and the existing feat and skill-increase schedules. Start trained in Perception, Reflex, Will, simple and martial weapons, unarmed attacks, light and medium armor, unarmored defense, and class DC; start expert in Fortitude.

| Level | Automatic class progression |
| --- | --- |
| 1 | Powder Gauge, Gunbreaker’s Combo, Royal Guard, Heart of Stone; all six basic combo and burst actions. |
| 3 | Expert Perception and Will; Steady Aim’s Lightning Shot cover benefit. |
| 5 | Expert simple/martial weapons and unarmed attacks; gunblade critical specialization. |
| 6 | Gnashing Fang, Savage Claw, Wicked Talon. |
| 7 | Continuation; Weapon Specialization; expert light/medium armor and unarmored defense. |
| 9 | Master Fortitude with success upgraded to critical success; Cartridge Expertise; expert class DC. |
| 11 | Expert Reflex and master Perception. |
| 12 | Fated Circle and Fated Brand. |
| 13 | Master simple/martial weapons and unarmed attacks. |
| 14 | Double Down. |
| 15 | Master light/medium armor and unarmored defense; Greater Weapon Specialization. |
| 17 | Master class DC and Will; Will success upgraded to critical success. |
| 19 | Lion’s Legend: start with 2 cartridges; enhanced Heart of Stone resistance becomes 4 + level. |

## Weapon identity

The standard gunblade remains a one-handed martial sword with d8 slashing and two-hand d12. The Light Gunblade remains a one-handed d6 finesse sword. Neither receives agile, reach, reload, or a firearm mode by default. Fundamental striking rune dice count as weapon damage dice; property runes and ability dice do not.

## Build choices

A two-handed build prioritizes weapon damage. Continuation’s added bonus depends on the number of weapon damage dice, not grip or die size. A shield build keeps the ordinary opportunity to Raise a Shield, but Royal Guard’s +1 circumstance AC does not stack with a shield’s circumstance bonus. Gunbreaker does not gain Shield Block automatically. Dexterity builds trade weapon damage for their attribute and equipment choices; no Dexterity-to-damage rule is added.

## Cartridges combos and follow ups

## Shared rules

Start a genuine combat encounter with 1 cartridge, or 2 with Lion’s Legend. Base capacity remains 3. Unspent cartridges dissipate when the encounter ends. Costs are paid when an action begins and are not refunded on a miss or when a committed action is disrupted. Canceling a selection before commitment spends nothing. Training targets and cooperative creatures cannot generate cartridges.

Maintain one combo sequence at a time. Each completed step consumes its opening and enables its next step until the end of your next turn, even if the Strike misses. Starting another sequence replaces the current sequence. Movement, defense, ordinary Strikes, and spenders that do not start a sequence preserve it. Solid Barrel and Demon Slaughter each load 1 cartridge when resolved, regardless of the attack or save result.

Cartridge Expertise remains once per encounter: a qualifying finisher loads 2 cartridges instead of 1. Bloodfest retains its action cost, frequency, temporary +3 capacity and immediate 3-cartridge gain. No Mercy retains its cartridge gain and damage bonus. None of these changes grant additional actions or bypass MAP.

## Continuation

Level 7 class feature  |  Revised shared rule

After a successful Burst Strike, Gnashing Fang, Savage Claw, or Wicked Talon, you may use its matching follow-up as your next action on the same turn against the same creature, provided it remains within your melee reach. Any intervening action, including a free action, closes the opening. Reactions do not close it. The opening ends at the end of your turn or when consumed. Only one Continuation follow-up, including Fated Brand, can be used per round.

Hypervelocity, Jugular Rip, Abdomen Tear, and Eye Gouge each cost 1 action and deal 2d6 fire damage plus the number of weapon damage dice of the gunblade used for the opening Strike. The dice become 3d6 at level 11 and 4d6 at level 17. Snapshot the weapon dice when the opening Strike resolves. The follow-up has no attack roll or save, does not increase MAP, and never doubles on a critical opening Strike. It is a separate damage effect for immunity, weakness, and resistance. No Mercy and weapon property-rune damage do not add to it.

Fated Brand retains its existing damage, fresh basic Reflex saves, eligible-target restrictions, and shared Continuation limit. It receives no weapon-dice bonus. Its opening follows the same intervening-action rule.

## Timing and frequencies

“Per round” means the numbered encounter round, not every creature’s turn. Gnashing and Reign steps retain their separate one-step-per-own-turn limits. One-minute and ten-minute frequencies use elapsed game time and do not reset when another encounter begins. Once-per-day abilities refresh through daily preparations, at most once per day; elapsed seconds alone do not refresh them.

## Defensive revisions

## Heart of Stone

Level 1 reaction  |  Gunbreaker magical

Trigger: An ally other than you within 15 feet would take damage from a successful enemy attack roll, including a critical success. Requirements: You wield a gunblade and can see the ally and attacker. The ally gains resistance to all damage from the triggering attack equal to 2 + half your level, rounded down. Before applying the resistance, you may spend 1 cartridge to increase it to 2 + your level. This includes Strikes and spell attacks. Saving-throw effects and automatic damage without a successful attack roll do not trigger it.

Protection applies to damage resolved as part of that triggering attack, not later persistent-damage ticks or separate follow-up actions. Apply the current PF2e immunity, weakness, and resistance rules once per applicable effect; never turn the resistance into an extra subtraction after native resistance. Aetheric Ward, Bulwark Protocol, Guardian’s Instinct, and Lion’s Legend continue to modify this reaction as written.

## Superbolide

Level 10 feat  |  1 action  |  Gunbreaker magical  |  Once per day

Requirements: You are conscious, have at least 2 HP, and wield a gunblade. Lose HP equal to your level, but this loss cannot reduce you below 1 HP. This loss is not damage, cannot be prevented or redirected, and does not trigger damage-based abilities. Until the start of your next turn, gain resistance to all damage equal to twice your level. This does not prevent conditions, death effects, or damage exceeding your resistance. Normal dying rules apply if damage reduces you to 0 HP.

Rationale: the existing HP-to-1 cost can erase more protection than the ability provides. This revision keeps an emergency defensive identity and a real HP cost. It does not grant invulnerability or a special dying exception. Test use at high HP and at 2 HP separately.

## Camouflage

Level 1 feat  |  1 action  |  Once per minute

Requirements: You wield a gunblade. Until the start of your next turn, gain a +2 circumstance bonus to AC against melee attacks and resistance to physical damage equal to half your level, minimum 1. The AC bonus does not stack with Royal Guard. Only the frequency changes; the bonus and duration are retained.

## Defensive duration contract

An effect ending at the start of your second subsequent turn lasts through the next two enemy-turn intervals when activated on your turn. “Your” refers to the originating Gunbreaker, even when an ally receives the effect. Aurora instead heals at the start of the recipient’s next three turns. Heart of Corundum evaluates its HP threshold after damage and native resistance; its healing triggers once and cannot restore a dead creature.

## Feat revisions and replacement

## Reserved Cartridge

Level 8 feat  |  Passive  |  Gunbreaker  |  Once per encounter

When you use Heart of Stone to protect an ally other than yourself, you may apply its cartridge enhancement without spending a cartridge. You can do this with no cartridges remaining. It uses your normal available reaction, does not load a cartridge, and cannot enhance Aetheric Ward. Declare the use before resolving the protection. You cannot also apply Perfect Chamber’s discount to the same enhancement.

This replaces Twin Cartridge. It creates a defensive reserve without duplicating Cartridge Expertise or increasing offensive cartridge supply. Existing Twin Cartridge owners may accept this replacement or retrain that feat without cost at migration.

## Expanded Gauge

Level 12 feat  |  Passive  |  Gunbreaker

Your normal cartridge capacity increases by 1. At level 18, the increase becomes 2. This stacks with Bloodfest’s temporary +3 capacity but never increases the cartridges with which you begin an encounter. Your normal capacity is therefore 4 at levels 12–17 and 5 at levels 18–20; during Bloodfest it is 7 or 8, respectively.

Overcharged Gauge is retired as a selectable feat. Existing owners receive a free replacement feat selection of a level they could legally select in that slot. Do not silently delete an owned feat before the player has chosen its replacement.

## Overpowered Round

Level 6 feat  |  Passive  |  Gunbreaker

When Burst Strike hits, you may deal fire damage equal to the number of weapon damage dice to each other enemy within 5 feet of the primary target. This is separate secondary damage, not the splash weapon trait. It does not damage the primary target, you, or your allies; it does not double on a critical hit and does not occur on a miss. Aetheric Calibration may change this fire damage.

## Saturation Fire

Level 12 feat  |  2 actions  |  Gunbreaker magical  |  Cost 1 cartridge

Requirements: You wield a gunblade. Enemies in a 30-foot line attempt a basic Reflex save against your Gunbreaker class DC against 1d6 fire damage per 2 levels, rounded up. Allies are unaffected. This is not a Strike, does not use or increase MAP, and does not open Fated Brand. Aetheric Calibration may change its fire damage.

## Retained constraints

Danger Zone and Blasting Zone share their original cooldown. Nebula and Great Nebula share theirs. Aurora and Auroral Mastery retain recipient immunity and separate uses. No additional uses, stacking resistance, or free offensive actions are introduced by these revisions.

## New feats and weapon clarifications

## Guarded Advance

Level 4 feat  |  2 actions  |  Gunbreaker flourish

Requirements: You wield a gunblade and can enter or are already in Royal Guard. Stride up to your Speed. You may then enter Royal Guard without spending another action, ending an incompatible stance normally. Finally, use Keen Edge against an enemy within your melee reach. If no enemy is in reach, you do not make the Strike or gain a combo opening; the movement and stance still occur. The subordinate Strike uses and increases MAP normally. This activity does not increase your Speed or bypass difficult terrain or reactions.

It counts as one flourish. It cannot be combined with Trajectory on the same turn. When already in Royal Guard, it still allows Stride and Keen Edge but grants no extra benefit. Its subordinate movement and Strike do not each consume another action.

## Aetheric Calibration

Level 4 feat  |  Passive  |  Gunbreaker magical

During daily preparations, choose fire, cold, or electricity; fire is the default. Until your next daily preparations, replace the fire damage of Burst Strike, Hypervelocity, Jugular Rip, Abdomen Tear, Eye Gouge, Fated Circle, Fated Brand, Double Down, Saturation Fire, and Overpowered Round with the chosen type. This changes only those listed damage components. It does not change physical weapon damage, persistent bleed, property runes, Lightning Shot, Danger Zone, Bow Shock, Reign secondary damage, or Relentless Rush. Replace any corresponding fire trait on a modified effect with the chosen damage trait. Other traits and all costs are unchanged.

This is one daily choice, not a damage-type picker on each attack. It adds resistance coverage without defaulting to force damage or converting every ability.

## Gunnhildr Escort

Level 2 feat  |  Passive  |  Gunbreaker

You become trained in Diplomacy and Escort Lore. If already trained in either, choose another skill in which to become trained for each duplicate. You gain a +1 circumstance bonus to Gather Information checks about route hazards, local security, or threats to a person or group you are escorting. The GM determines whether the inquiry qualifies. This benefit does not apply to initiative, combat checks, or unrelated information gathering.

## Lightning Shot clarification

You may use Lightning Shot while wielding a standard gunblade in one or two hands. Its weapon dice always use the one-handed base die, including fundamental striking dice. It uses Dexterity to attack, adds specialization, and adds no Strength damage. Apply only property runes whose own requirements permit that ranged attack; a discharge does not override a melee-only requirement. Lightning Shot does not grant a second weapon, transfer runes, require ammunition, or open Continuation. Keep its range and existing feat level.

## Change inventory and balance targets

This draft is a revision specification rather than a replacement printing of every unchanged feat. The pinned baseline supplies all rules not explicitly replaced here. In particular, core Strike bonuses, area dice, No Mercy, Sonic Break, Bloodfest, Reign of Beasts, and the original defensive scaling remain intact.

| Change group | Implementation scope |
| --- | --- |
| Core | Continuation shared timing; four single-target follow-up formulas; daily-refresh interpretation. |
| Defenses | Heart of Stone trigger and damage scope; Superbolide cost; Camouflage frequency. |
| Feat options | Twin Cartridge → Reserved Cartridge; Expanded Gauge scaling; retire Overcharged Gauge; revise Overpowered Round and Saturation Fire. |
| Additions | Guarded Advance 4; Aetheric Calibration 4; Gunnhildr Escort 2. |
| Clarifications | Lightning Shot grip/runes; allied duration ownership; shield stacking; exact cancellation/commit timing. |

## Damage hypothesis

At level 7, using a +1 striking two-handed gunblade, Strength +4 and expert specialization, a second Strike is +11 and deals 2d12+6. Against AC 24 it has 35% ordinary success and 5% critical success, for 8.55 expected damage. Current Continuation averages 7; proposed Continuation averages 9. Against AC 26 the same second Strike averages 6.65. These are choices after a qualifying opening hit, not whole-turn damage estimates.

At levels 7–10 the proposed follow-up averages 9 with striking; at 11 it averages 12.5; at 12–16 it averages 13.5 with greater striking; at 17–18 it averages 17; at 19–20 it averages 18 with major striking. These values exclude resistance and weakness. Gear availability must be an explicit input, not inferred from level during play.

## Playtest comparisons

Use four-round encounters at levels 1, 5, 7, 11, 15, and 19: one boss at party level +2, three equal-level enemies, and mixed ranged/melee enemies. Include consecutive encounters without a ten-minute rest. Compare equivalent-gear Champion and Fighter builds with representative feats, not only two ordinary Strikes.

Record damage, ally damage prevented, healing that restored actual missing HP, temporary HP actually absorbed, actions spent moving or defending, and cartridges gained, wasted, or spent. Test Strength two-handed, Strength with shield, and Dexterity builds separately. Repeat selected cases with Guardian dedication and with dual class; optional campaign systems must not set the baseline balance target.

Review a change if it removes meaningful decisions or repeatedly dominates comparable builds. Diagnose offense and protection separately; do not combine one point of healing and one point of damage into an unqualified balance score. If Continuation dominates, tune its added weapon-dice bonus before restoring hit-gated resource generation.

## Minimal player interface design

The target experience is target → choose ability → resolve. The same execution controller must serve actor-sheet actions, hotbar shortcuts, and a compact optional Gunbreaker panel. The existing tracker becomes a status display and GM correction tool; ordinary play must not require “record hit,” “add cartridge,” or “apply effect” bookkeeping.

| Player decision | Automatic response |
| --- | --- |
| Select Keen Edge or the available combo step | Validate equipment and target; use native Strike/MAP; advance combo on a resolved hit or miss. |
| Select a spender | Reserve the cartridge, roll natively, commit cost once; show the legal follow-up on a hit. |
| Select Continuation | Use the stored target and weapon-dice snapshot; roll only damage; consume the opening once. |
| Accept Heart of Stone | Offer base, enhanced, or eligible reserve choice in one prompt; spend one reaction and apply protection before damage. |
| Select an area ability | Place one area when needed; resolve native saves; apply the specified degree-of-success outcomes. |
| Make daily preparations | Choose calibration once; refresh legal daily resources and persistent settings. |

## Panel behavior

Show cartridges/capacity, current combo step, remaining follow-up, available reaction, and meaningful cooldowns. Keep always-available basic actions accessible. Disable unavailable actions with a short reason; do not overwhelm the panel with every high-level action. Offer one Continuation control with the appropriate ability name, while retaining named sheet entries for rules reference.

Infer a single legal target where the rules allow it. Ask when multiple choices matter. Never automatically spend a reaction, choose the protected ally, switch damage type, or replace an attack with the presumed highest-damage option. The player retains control over tactics and resource tradeoffs.

## Prompts and chat

Use one consolidated prompt for a triggered reaction, including any cartridge or Reserved Cartridge option. The actor owner should receive the prompt; the GM can adjudicate or act for an unassigned actor. A decline or closed prompt spends nothing. If the response times out, hold the unresolved damage with an explicit GM continue control rather than silently choosing an outcome.

Create one concise result card for a resolved activity, with native rolls and necessary damage controls. Add only relevant follow-up or recovery buttons. Keep ordinary roll dialogs consistent with the user’s PF2e preferences. HP changes to targets the player does not own go through GM authority; they should not require broadening ownership.

## Automation architecture and correctness

## Rules and state

Use PF2e rule elements for proficiency, typed modifiers, damage dice, resistance, temporary HP, and valid effects. Use module code for transactions, combo windows, cross-client coordination, target selection, reactions, and unusual timing. Every changed feature needs a documented native rule-element or workflow implementation; a rules chat card alone is not automation.

Persist actor resource state with a schema version, revision, encounter identity, source actor/token, origin ability, cooldown, and event identifiers. Represent both timing types explicitly: owner-turn expiry for combo/protection and world-time expiry for minute cooldowns. Aurora needs recipient-turn ticks. End-of-encounter cleanup must not reset cooldowns or daily uses.

## One authoritative action transaction

Validate prerequisites and permissions, reserve actions/resources, execute native checks, and commit after the action is actually taken. A canceled pre-roll selection releases the reservation. A rolled miss or a spent action disrupted by a rule retains its costs. A later damage-dialog cancellation must not refund the attack. Guarded Advance must charge two actions total, even though it contains movement and a Strike.

Use a single active GM coordinator or a supported equivalent for shared mutations. Authenticate requests through the actual Foundry user, recheck ownership, and serialize competing changes. Duplicate clicks, repeated chat events, reconnects, and delayed messages must be idempotent. A local revision check alone cannot certify cross-client consistency.

## Reactions and damage

Resolve Heart of Stone after the successful attack is known and before its damage is applied. Bind the protection to that attack’s event and target, including delayed damage buttons. Do not leave a general resistance effect that affects unrelated attacks. Allow only one reaction per trigger unless an explicit rule permits otherwise. Guardian’s Instinct tracks its restricted extra reaction separately.

Consume Heart of Corundum’s healing once after finalized damage, including nested updates. Brutal Shell uses actual degree of success and its once-per-round gate. Native temporary HP rules must prevent stacking. Separate damage types and effects correctly; Calibration alters only its named damage components.

## Recovery and adjudication

Keep an event history for GM undo and corrections. Rerolls must reconcile affected openings and riders; if subsequent actions prevent a safe rollback, stop and request GM reconciliation rather than duplicating effects. Detect unsupported geometry, conditional immunities, or stale targets and explain the specific unresolved decision.

Track ordinary native Strikes, casts, and actions where reliable execution events exist. Do not infer an action from merely opening a sheet item or posting a card. Raw token movement cannot always identify Stride versus Step versus forced movement; use a movement control or integrate a supported movement system. Multiple tokens sharing one actor need explicit combatant-specific state or a clear unsupported-case block.

## Acceptance plan and implementation sequence

| Stage | Completion evidence |
| --- | --- |
| 1 Design review | Approve exact revised text and feat replacement choices. No release or actor migration at this stage. |
| 2 Rules implementation | Update authored JSON and rules reference together; preserve existing IDs where meaning remains compatible; regenerate packs and catalogue. |
| 3 Core automation | Native actions, cartridge transactions, combo/follow-up tracking, effects, and expiry pass isolated and integration checks. |
| 4 Reactions and permissions | Actual GM and player clients verify reaction prompts, target writes, concurrent requests, cancellation, and disconnect recovery. |
| 5 Release candidate | Disposable-character encounter tests pass; migration preview and rollback are reviewed; compatibility is reported only for tested versions. |

## Required acceptance scenarios

A missed Keen Edge opens Brutal Shell; a missed Solid Barrel still loads once. Movement preserves the combo but consumes an unused Continuation opening. A reaction preserves that opening. A second follow-up in the same round is rejected. A target leaving reach blocks the follow-up without consuming an uncommitted action.

An empty Gunbreaker can use Reserved Cartridge on an ally once, but never on itself. Enhanced Heart of Stone affects only its triggering attack. Superbolide at 2 HP leaves 1 HP; at higher HP it loses exactly level HP unless the floor applies. No damage-triggered healing fires from its HP cost. Camouflage and shield bonuses never add to Royal Guard.

Bloodfest expiry clamps capacity. Expanded Gauge scales at level 18. Calibration changes every named component and none of the excluded ones. A duplicate request spends once. A reroll, closed dialog, stale target, and reconnect produce a defined recoverable state. Ending and restarting combat cannot restore daily or timed uses.

## Migration and delivery

Back up affected actors and preview changed items. Preserve user choices, item links, and unrelated custom rules. Offer the Twin Cartridge replacement and free retraining of retired Overcharged Gauge; do not silently choose a new feat. Clear obsolete combo reminder effects only after transferring valid state or obtaining a GM correction. Keep a rollback package and an actor restore path.

Target initial live verification at the campaign’s Foundry 14 build 369 and PF2e 8.7.0, then report the exact tested versions and module combinations. The v1.3.0 repository’s pending smoke test is not evidence that this proposed revision or future automation already works.

## Sources and evidence

Baseline: Gunbreaker-PF2E v1.3.0 at the commit identified on page 1. Reviewed: RULES.html, packs/_source, scripts/state.mjs, scripts/gunbreaker.js, BALANCE.md, PLAYTEST.md, and SMOKE-TEST.md. Repository: https://github.com/sakumow7/Gunbreaker-PF2E

Resistance reference: https://paizo.com/blog/spring-errata-2026 and https://paizo.com/pathfinder/faq. Proposed rules are homebrew; numerical changes require playtesting.
