# Movement and Suppressing Fire prototype

Candidate: 1.4.0-beta.1. This extends the native action panel; it is not a release or a claim of complete class automation.

## Player workflow

Select Trajectory's ally/enemy (or an optional preferred enemy for Guarded Advance), choose the ability in Native Actions, and submit. The GM confirms visibility/terrain/reaction handling and plots the native movement path. Guarded Advance includes one Royal Guard checkbox and uses the selected MAP for its subordinate Keen Edge. Multiple eligible enemies require a target choice only when the preferred target is unavailable. Damage remains on PF2e's native controls.

Suppressing Fire uses one selected enemy within 30 feet. The GM confirms that the target can see the source, line of effect is clear, and no untracked earlier Demoralize immunity applies. PF2e then rolls Intimidation against Will DC with visual, concentrate, emotion, fear and mental traits. Auditory and the built-in language penalty are absent. The shared system Demoralize action is never changed.

## Implemented behavior

| Ability | Automated | Boundary |
|---|---|---|
| Trajectory | Twice land Speed, ordinary difficult terrain discount, greater terrain/native mitigation, chosen-creature adjacency, obstacle/creature blocking, flourish/frequency state | Flat five-foot square grids, snapped one-square source token; GM confirms perception and unmarked terrain |
| Guarded Advance | Land-Speed path, optional stance replacement, native Keen Edge/MAP/damage, Brutal Shell opening even on a miss | No opening when no enemy is in reach; canceled required Strike after moving needs recovery |
| Suppressing Fire | Native skill check, correct frightened minimum, native fear/mental/condition immunity checks, source-specific ten-minute immunity after every resolved attempt | Earlier/untracked attempts and other modules' Demoralize controls still need adjudication |

Planning does not spend the activity. The native planned preview is stopped before validation; the accepted waypoints are executed through `TokenDocument.move()`, which reports completion. `startMovement()` only reports whether movement started and is deliberately not treated as completion. No direct x/y updates, teleportation, wall bypass, global terrain rules or extra action charges are used. Foundry's own movement history can still display ordinary terrain cost for Trajectory; the activity journal records its validated discounted cost.

Paths are measured again immediately before movement. Scene token positions, walls, regions and Speed must match the planning snapshot. Same-elevation creatures block Trajectory; Guarded Advance permits passing allies but cannot end in an occupied space. Standard native wall constraints remain enabled. Unsupported elevations, movement modes, footprint changes, oversized source tokens, complex scene geometry and unmarked hazards require manual play.

The tracker commits before physical movement. A stopped/partial move keeps the spent flourish and closes Continuation, then enters recovery. The journal records the path, cost, destination, target and any native Strike result. Native movement runs outside the actor queue so a paused move does not monopolize the actors needed by reactions. Completion reacquires the queue and rechecks the journal and tracker. A recovery must reconcile actual position and action use; it never teleports back, refunds, or repeats a Strike automatically.

## Demoralize immunity

The GM observes resolved native `action:demoralize` skill-check messages and records ten-minute immunity on the target, keyed by source actor. Ordinary rules cards, rerolls, unowned source messages and managed Suppressing Fire checks do not trigger this observer. Attempts while already immune do not extend the timer. Immunity expiration uses world time.

Suppressing Fire honors that ledger and writes its own immunity before applying frightened. Critical success sets a minimum of frightened 2; success sets a minimum of frightened 1; failure and critical failure only record immunity. Existing stronger frightened is preserved. A partial condition write leaves a recovery journal and cannot be retried automatically.

This ledger does not disable PF2e's ordinary Demoralize UI or third-party macros. It cannot reconstruct attempts before installation or checks lacking a native target. Rerolls require GM reconciliation; they never automatically reapply conditions.

## Verification and outstanding acceptance

Node regression tests exercise the native adapter contracts with mocks: path limits, ordinary/greater terrain, creature/obstacle rejection, adjacency, cancellation, stale scenes, missed/absent subordinate Strikes, permission/turn changes, no replay, all four Demoralize outcomes, immunity, and frightened non-stacking. Those tests do not certify live canvas behavior.

Official references: [Foundry v14 Token planning](https://foundryvtt.com/api/v14/classes/foundry.canvas.placeables.Token.html#planMovement), [TokenDocument movement](https://foundryvtt.com/api/v14/classes/foundry.documents.TokenDocument.html#move), and PF2e source commit `57ba5add8352fd3162a05e0007717a93618be12a` (`SingleCheckAction`, Demoralize, TerrainDataPF2e, Actor.increaseCondition).

Still required: installed-candidate path plotting/cancellation with walls and terrain regions; paused movement/reactions; real native skill-roll and condition writes; GM/player routing; interactions with Toolbelt, Workbench and HUD; live acceptance of the optional Relentless Combo/Continued Assault/Bulwark Step riders now implemented in OPTIONAL-RIDERS.md; automatic damage interception; and the remainder of AUTOMATION.md. Do not mark the class fully automated based on this prototype.
