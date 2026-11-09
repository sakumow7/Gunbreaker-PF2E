# Optional riders and Reign resources

Candidate 1.4.0-beta.1. Extends the native action coordinator and assisted Heart of Stone workflow. This is not a published release or installed-candidate acceptance report.

| Feature | Trigger and choice | Committed behavior |
|---|---|---|
| Relentless Combo | Immediately after managed Solid Barrel or Demon Slaughter completes, even on a miss or successful saves | Optional five-foot Step, once per round |
| Continued Assault | After a managed Continuation follow-up, including Fated Brand | Optional Step; alternatively, while in Royal Guard, half-level temporary HP to one adjacent ally until the source's next turn starts; one shared round use |
| Bulwark Protocol | Owner selects the checkbox while accepting assisted Heart of Stone | Check original eligibility/range first, then optionally Step closer before accepting protection; the original attack target remains unchanged |
| Powder Discipline on Reign | Opt in through the existing resource checkbox | One cartridge on a native critical hit from Reign of Beasts, Noble Blood or Lion Heart; once per encounter |

## Interaction and timing

Post-action riders use one GM choice prompt only when learned, level-eligible and unused this round. The prompt offers Step, any eligible adjacent allies when Continued Assault's stance requirement is met, and Skip. It never asks the player to re-enter the attack/save result. Closing or canceling the path declines that trigger without spending the round use. It cannot be reopened from a duplicate source request. A later eligible trigger may offer the still-unused rider.

Relentless Combo occurs after the managed finisher workflow finishes; Continued Assault occurs after the managed follow-up roll/save workflow. For abilities whose damage remains on native card controls, this means after the roll workflow, not after independently applied HP. Exceptional reactions or another action occurring before the rider need GM adjudication. Unmanaged Strikes or posted rules cards do not trigger these riders.

The experimental player transport still sends actions to the GM. Post-action optional choices and path planning are currently on the GM client. Bulwark's checkbox is on the assigned owner's existing reaction prompt; the GM then plots the chosen Step. Canceling that path skips only the Step and still accepts the selected protection, as the prompt states. Automatic interception of ordinary damage controls remains outside this workflow.

## Native Step constraints

All three features share a native `step` path service. It permits a five-foot ground Step on a flat five-foot square grid with a snapped one-square source token and Speed of at least 10 feet. The planner preview is stopped, checked, then executed with `TokenDocument.move()` using the `step` movement action. It never changes x/y directly or substitutes a Stride. Standard wall/cost constraints remain enabled.

The service rejects difficult/greater difficult terrain, obstacles, occupied/crossed creature spaces, elevation/level changes, teleportation, paths beyond five feet, and stale token/wall/region snapshots. Longer Steps, terrain exceptions, larger sources and unusual geometry remain manual. Unmarked hazards and terrain require GM adjudication. Native Step reaction handling depends on Foundry/PF2e and installed modules; full live acceptance is still required.

Bulwark uses native point-to-occupied-space distance to require the planned destination to be strictly closer. It rechecks the actual result and protected ally after movement. It cannot move a protector into the original reaction's range or switch an attack to the protector. Its Step is part of the reaction, so it does not close a valid Continuation opening or consume the flourish gate.

## Recovery and concurrency

The parent execution remains reserved while an optional rider is unresolved. A separate actor `followup` journal records the trigger, choice, round/revision checkpoint, path or recipient, and status. The once-per-round use and tracker revision commit before native movement or TempHP creation. Partial movement/effect writes retain the spent use and block automatic replay.

Native movement runs outside actor queues, allowing other reaction work to resolve while movement is paused. Heart of Stone retains its separate reaction-window reservation until Bulwark completes, preventing protected damage from applying early. Source permissions, turns, tracker revisions, source/target eligibility and attack evidence are rechecked.

GM Recovery now detects interrupted optional riders, preserves a backup and reconciliation note, and unlocks without rerunning movement, TempHP or resource grants. Recovery refuses to unlock an actor while native movement is still planned, pending or paused. Stop movement and reconcile actual position first. Heart of Stone's separate recovery window still needs manual reconciliation; accepting the actor journal alone does not accept that reaction window.

## Reign resource limits

Powder Discipline now supports all three native Reign Strikes. A noncritical result leaves the encounter use unspent. A resolved critical grants once even if later secondary damage needs recovery. Reign rechecks tracker freshness after its native attack and before committing resources.

Cartridge Expertise only improves cartridge-generating finishers; the Reign steps generate none. Perfect Chamber only reduces a cartridge cost; Reign has none. Executioner's Cadence applies to Wicked Talon/Double Down, not Reign. These options therefore remain rejected for Reign even when learned.

## Evidence and remaining work

Regression coverage uses injected/mocked native APIs for trigger selection, round gates, all Reign attack degrees, cancellation, stale contexts, native Step constraints, Bulwark original-range/closer-destination checks, original-target preservation, queue release, partial writes and recovery. Native SpeedStatistic and Token.distanceTo contracts were checked against PF2e source commit `57ba5add8352fd3162a05e0007717a93618be12a` (8.7.0). The prior detached Forge checks in LIVE-QA-2026-11-08.md verify shared native model contracts; they do not establish that these new workflows have run in a live encounter.

Still required: installed-candidate path planning and interruption tests, source-turn TempHP expiry in a real encounter, GM/player consent routing, ordinary external-action observation, automatic reaction interception and interaction with third-party automation. See AUTOMATION.md.
