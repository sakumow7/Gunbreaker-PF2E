# Live Foundry smoke test (pending)

Automated validation covers source data, grant graphs, tracker transitions, package contents, and compiled pack parity. It does not run a licensed Foundry server. Complete this checklist on the actual Foundry/PF2e versions used by the campaign before marking compatibility verified.

- Import the local ZIP with module.json at its root. Enable the module, reload, and open all five compendia. Confirm the Gunbreaker trait and gunblade label resolve.
- Add the class to a fresh character at level 1: Keen Edge, Brutal Shell, Solid Barrel, Burst Strike, Demon Slice, Demon Slaughter, Heart of Stone, Royal Guard, and Release Royal Guard must appear.
- Raise levels through 3, 5, 6, 7, 9, 11, 12, 13, 14, 15, 17, and 19. Check exact proficiency ranks, action grants, and specialization against RULES.html. Confirm no duplicate actions and no advanced weapon mastery.
- Test Strength with a standard gunblade and Dexterity with a Light Gunblade. Confirm the latter has finesse, not two-hand d12. Check one-/two-handed damage and rune scaling.
- Start combat, select the Gunbreaker, and initialize the tracker once. A second initialization must fail. Post Keen Edge and Burst Strike to chat: neither should mutate anything.
- Select a real enemy, roll Keen Edge, and record a miss. Brutal Shell should become available. Record a move using Other Action: the combo survives. Complete the sequence on the following turn; Solid Barrel loads a cartridge even on a miss.
- Try Solid Barrel without its opening, an unlearned spender, and a spender with zero cartridges. Each must leave the whole state unchanged.
- At level 7, record a missed Burst Strike: no Hypervelocity. Record a hit: Hypervelocity opens only for that target. An intervening action closes it. A second Continuation in the same round must fail.
- Confirm Gnashing Fang, Savage Claw, and Wicked Talon cannot be recorded on the same turn. Check delayed combo expiry after the end of the next Gunbreaker turn, including when another combatant is acting.
- Resolve Fated Circle with mixed saves; mark only failed/critically failed enemies. Fated Brand must reject another target and requires new saves for damage.
- Test Heart of Stone with and without a cartridge; self-protection requires Aetheric Ward and the enhancement. Apply resistance manually. Guardians' Instinct grants only one extra ally-protection reaction, not an unrestricted reaction.
- Apply Royal Guard, Camouflage, Nebula, Great Nebula, No Mercy, and Superbolide effects manually. Check duration, AC stacking, damage selector, and resistance. Check native inline damage and class-DC save links in chat.
- Bloodfest increases capacity before loading; after 60 world-time seconds, refresh the tracker and confirm it clamps excess cartridges. End combat and initialize another: cooldowns must persist, and capacity returns to normal.
- Test two tracker windows and rapid clicks: stale revisions must reject duplicate commits on the same client. Designate one operator per actor; cross-client writes are not a distributed transaction.
- End combat, clear the tracker, and perform actual daily preparations before confirming that button. Reopening, moving to another encounter, or reposting a card must not refresh daily uses.
- Confirm targets, sheet actions/reactions, HP prerequisites, range/reach, temporary HP, healing, persistent damage, durations on allied targets, and genuine-threat restrictions with the GM. These are intentionally manual.
