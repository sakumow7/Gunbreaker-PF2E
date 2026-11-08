# Automation implementation ledger

Design: DESIGN-v1.4.md. Branch candidate: 1.4.0-beta.1. No new release published.

| Plan stage | Current evidence | Remaining gate |
|---|---|---|
| Design | Approved in conversation; pinned in this repository | Numerical playtest |
| Rules data | Revised JSON, stable compatible IDs, new feat IDs, retired-feat decisions; generated rules/packs | Live import/schema verification |
| Core execution | Pure transaction runner, native PF2e adapter, native panel, persistent recovery journal, optional player transport | Native adapter and two-client smoke tests; remaining actions |
| Reactions and permissions | Ownership checks, optional Heart of Stone owner prompts and GM-paired native damage | Automatic interception, omitted reaction cases, live two-client tests |
| Release candidate | Local build and static checks | Coverage completion, migration review, encounter tests, release approval |

## Implemented prototype coverage

- Keen Edge, Brutal Shell, Solid Barrel, Burst Strike, Gnashing Fang, Savage Claw, Wicked Talon, Sonic Break: native Strike, explicit MAP selection, native degree of success, cartridge/combo transition, native Strike damage.
- Demon Slice/Slaughter and Fated Circle/Brand: confirmed enemy area, one native damage roll, native Reflex saves using Gunbreaker DC, reviewed native IWR application, combo/cartridge completion after all saves, fresh Brand saves against original failed targets. See AREA-COMBOS.md for manual boundaries.
- Double Down: 10-foot emanation, 2-cartridge cost, one-minute frequency and calibrated 10d6/12d6 damage. Danger Zone: one selected enemy at 15 feet; Blasting Zone upgrades to 30 feet/d8s on the same ten-minute frequency. Bow Shock: native initial damage plus undoubled persistent fire on failed saves. All require GM confirmation/review and live verification.
- Saturation Fire: native v14 region placement, 30-foot line coverage and token containment, one-cartridge cost, calibrated save damage, ally exclusion, preview cleanup and recovery evidence. Prototype limited to 5-foot square grids and flat elevation; GM aims/confirms. Live region testing is pending.
- Bloodfest and Reign: native Bloodfest target validation, capacity/load/frequency and readiness; native Reign/Noble Blood/Lion Heart Strikes, one-step-per-turn combo progression, and up to two separately saved secondary enemies on a hit. Primary HP stays on native card controls; secondary HP uses the reviewed IWR workflow. See REIGN.md.
- Relentless Rush: initial 8d6 fire emanation, native one-round Resistance effect and a persistent next-turn trigger for a fresh 4d6 fire emanation when conscious and wielding a gunblade. Supports empty areas and stops uncertain/reconnected triggers for recovery. See RELENTLESS-RUSH.md; live hook/expiry testing is pending.
- Burst and Gnashing/Sonic bonus dice: passive PF2e DamageDice rules restricted to executor roll options. Ordinary Strikes never inherit those dice.
- Brutal Shell: own healing through native applyDamage and TempHP barrier with a round gate; adjacent-ally Vortex Guard choice is pending.
- Hypervelocity, Jugular Rip, Abdomen Tear, Eye Gouge: original target and weapon-dice snapshot, native DamageRoll; normal damage controls still apply it.
- Royal Guard, Camouflage, Nebula/Great Nebula, No Mercy, Superbolide: effect application; Superbolide pays its non-damage HP cost. Perfect Chamber uses committed resource state.
- State v2: scaled capacity, Reserved Cartridge gates, reaction exception for Continuation, numbered rounds, persistent daily-use ledger, duplicate event IDs, Guarded Advance flourish and combo transitions.
- Migration: deterministic read-only plan and detached actor backup. Custom fields conflict for review; retired feats require player choice. No automatic world migration.

## Required remaining scope

1. Verify the experimental player request transport in a real GM/player session. Bounded intents, workflow-creator identity, ownership/revision/turn checks, a shared GM queue, no-replay behavior, and acknowledgement guards are implemented. The setting remains off by default; exactly one active GM and the same scene are required. One local queue is not distributed locking. GM disconnect/failover, world reload and delayed writes require adjudication, not automatic replay. The finished player sheet interface and player-side roll choices remain pending. See PLAYER-REQUESTS.md.
2. Finish Heart of Stone integration beyond the assisted workflow in HEART-OF-STONE.md. Exact attack snapshots, consolidated owner choices, reaction pools, resource gates, explicit GM damage pairing, scoped native IWR, decline/continue and recovery locks are implemented. Automatic interception of ordinary damage buttons/modules, Bulwark movement, Shield Block combinations, split damage, unsupported critical spell representations, reroll reconciliation and live GM/player tests remain pending.
3. Complete and live-test area workflows. Demon Slice/Slaughter and Fated Circle/Brand are implemented as GM-confirmed prototypes, including fresh Brand saves and original failed-save eligibility. Double Down, Danger/Blasting Zone and Bow Shock now use the same prototype, including committed frequencies and Bow Shock persistent conditions. Saturation Fire uses native line-region placement and coverage on flat 5-foot square grids. Reign secondary targets now use the native sequence prototype described in REIGN.md. Relentless Rush now uses a persistent turn-start coordinator described in RELENTLESS-RUSH.md; its hook/expiry behavior still needs real-client testing. Broader geometry/elevation support, hidden-target handling and exceptional save-damage rules remain manual.
4. Aurora recipient-turn ticks and immunity; Corundum post-damage one-shot healing; Heart of Light and Gunmetal Soul recipient effects and source-turn expiry. Do not infer damage from every HP update.
5. Lightning Shot native ranged usage; Guarded Advance and Trajectory movement with legal paths; Suppressing Fire native Demoralize variant and immunity.
6. Consolidated optional riders: Cartridge Expertise, Powder Discipline, Executioner's Cadence, Vortex Guard, Relentless Combo, Continued Assault, Fated Resolve, Overpowered Round and Perfect Chamber discounts. The manual tracker can record resource options; the native panel does not yet prompt for them.
7. Complete calibration across every damage component (the daily choice UI is present); Gunnhildr Escort's once-only training/duplicate-skill choices. Its qualifying-inquiry circumstance bonus already has a native roll option and modifier.
8. Observe real external actions to close Continuation. Merely posting a rules card must never mutate state. Raw token movement is ambiguous; use supported movement controls. Observe other reactions without closing the opening.
9. Automatic combat initialization/end cleanup, stance end conditions, source- and recipient-turn expiry tests. Current native execution lazily initializes its actor's first encounter action; the tracker remains explicit for manual actions.
10. GM recovery UI and migration application after preview; preserve actor customizations and provide rollback. A recovery journal is evidence for reconciliation, not permission to replay effects.

## Evidence boundaries

Native calls were checked against official foundryvtt/pf2e source, v14-dev commit `57ba5add8352fd3162a05e0007717a93618be12a` (package version 8.7.0): character Strike variants/damage callbacks, CheckRoll.degreeOfSuccess, creature reach, Actor.applyDamage, DamageDice, RollOption, and encounter roll options. Save powers additionally use DamageInstance/InstancePool composition and native persistent-condition creation; Danger Zone deliberately excludes the area-damage predicate. This is source compatibility evidence, not a live runtime test.

Relevant campaign modules observed: PF2e Toolbelt, Workbench, HUD, Automated Animations and socketlib are active. Integrations must be tested before being relied on. No optional module is currently a new required dependency.

Document transport references: [Foundry v14 createDocument hook](https://foundryvtt.com/api/v14/functions/hookEvents.createDocument.html) and [ChatMessage API](https://foundryvtt.com/api/v14/classes/foundry.documents.ChatMessage.html). These describe workflow creator IDs and document updates. Local transport tests mock that contract; they do not verify the live server behavior.

Heart of Stone adapter source checks additionally covered PF2e native damage-card context construction (`src/module/chat-message/helpers.ts`), `extractEphemeralEffects`, `Actor.getContextualClone`, `Actor.applyDamage`, Resistance rules and Check reroll updates at the pinned PF2e commit above. Mocked tests do not certify runtime compatibility or numeric IWR results in a live world.

Saturation Fire source checks used PF2e `placeRegionFromItem`, `shapeDataFromEffectArea`, `RegionLayerPF2e.placeRegion`, `RegionDocumentPF2e.getCoverage`/`clearCoverage`, and `TokenDocumentPF2e.testInsideRegion` at the same pinned commit. Placement and containment tests mock these APIs; they are not live geometry certification.
