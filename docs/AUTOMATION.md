# Automation implementation ledger

Design: DESIGN-v1.4.md. Branch candidate: 1.4.0-beta.1. No new release published.

| Plan stage | Current evidence | Remaining gate |
|---|---|---|
| Design | Approved in conversation; pinned in this repository | Numerical playtest |
| Rules data | Revised JSON, stable compatible IDs, new feat IDs, retired-feat decisions; generated rules/packs | Live import/schema verification |
| Core execution | Pure transaction runner, native PF2e adapter, GM prototype panel, persistent recovery journal | Native adapter smoke test; player routing; remaining actions |
| Reactions and permissions | Trigger/cost specifications and resource gates | Full attack-bound reaction window, GM authority requests, two-client tests |
| Release candidate | Local build and static checks | Coverage completion, migration review, encounter tests, release approval |

## Implemented prototype coverage

- Keen Edge, Brutal Shell, Solid Barrel, Burst Strike, Gnashing Fang, Savage Claw, Wicked Talon, Sonic Break: native Strike, explicit MAP selection, native degree of success, cartridge/combo transition, native Strike damage.
- Burst and Gnashing/Sonic bonus dice: passive PF2e DamageDice rules restricted to executor roll options. Ordinary Strikes never inherit those dice.
- Brutal Shell: own healing through native applyDamage and TempHP barrier with a round gate; adjacent-ally Vortex Guard choice is pending.
- Hypervelocity, Jugular Rip, Abdomen Tear, Eye Gouge: original target and weapon-dice snapshot, native DamageRoll; normal damage controls still apply it.
- Royal Guard, Camouflage, Nebula/Great Nebula, No Mercy, Superbolide: effect application; Superbolide pays its non-damage HP cost. Perfect Chamber uses committed resource state.
- State v2: scaled capacity, Reserved Cartridge gates, reaction exception for Continuation, numbered rounds, persistent daily-use ledger, duplicate event IDs, Guarded Advance flourish and combo transitions.
- Migration: deterministic read-only plan and detached actor backup. Custom fields conflict for review; retired feats require player choice. No automatic world migration.

## Required remaining scope

1. Route authenticated owner requests to one GM authority; coordinate manual and native writes across clients. One local queue is not distributed locking. The prototype is deliberately GM-only and not a player-facing finished interface.
2. Bind Heart of Stone to a native successful attack before damage, consolidate base/enhanced/reserve decisions, reconcile the regular and Guardian's Instinct reaction pools, apply native IWR once, and handle declined/timed-out prompts. Include spell attacks, delayed damage, rerolls and Bulwark Protocol.
3. Area selection, saves, outcomes and damage for Demon Slice/Slaughter, Fated Circle/Brand, Double Down, Danger/Blasting Zone, Bow Shock, Saturation Fire, Reign secondary targets and Relentless Rush. Fated Brand must use fresh saves and original failed-save eligibility.
4. Aurora recipient-turn ticks and immunity; Corundum post-damage one-shot healing; Heart of Light and Gunmetal Soul recipient effects and source-turn expiry. Do not infer damage from every HP update.
5. Lightning Shot native ranged usage; Guarded Advance and Trajectory movement with legal paths; Suppressing Fire native Demoralize variant and immunity.
6. Consolidated optional riders: Cartridge Expertise, Powder Discipline, Executioner's Cadence, Vortex Guard, Relentless Combo, Continued Assault, Fated Resolve, Overpowered Round and Perfect Chamber discounts. The manual tracker can record resource options; the native panel does not yet prompt for them.
7. Complete calibration across every damage component (the daily choice UI is present); Gunnhildr Escort's once-only training/duplicate-skill choices. Its qualifying-inquiry circumstance bonus already has a native roll option and modifier.
8. Observe real external actions to close Continuation. Merely posting a rules card must never mutate state. Raw token movement is ambiguous; use supported movement controls. Observe other reactions without closing the opening.
9. Automatic combat initialization/end cleanup, stance end conditions, source- and recipient-turn expiry tests. Current native execution lazily initializes its actor's first encounter action; the tracker remains explicit for manual actions.
10. GM recovery UI and migration application after preview; preserve actor customizations and provide rollback. A recovery journal is evidence for reconciliation, not permission to replay effects.

## Evidence boundaries

Native calls were checked against official foundryvtt/pf2e source, v14-dev commit `57ba5add8352fd3162a05e0007717a93618be12a` (package version 8.7.0): character Strike variants/damage callbacks, CheckRoll.degreeOfSuccess, creature reach, Actor.applyDamage, DamageDice, RollOption, and encounter roll options. This is source compatibility evidence, not a live runtime test.

Relevant campaign modules observed: PF2e Toolbelt, Workbench, HUD, Automated Animations and socketlib are active. Integrations must be tested before being relied on. No optional module is currently a new required dependency.
