// Monte Carlo encounter log for the Gunbreaker. Compares the 1.4 rules with the 2.0
// rules against a featless martial and a Fighter over whole encounters.
// Usage: node tools/balance-sim.mjs [encounters=20000] [rounds=4]
// Env knobs for tuning experiments (defaults are the shipped 2.0 rules): LEVELS=1,5,10
// CONT_DICE=-1 (Continuation d6 offset)  CONT_WEAPON=1 (add weapon dice to follow-ups)
// AREA_DIE=8  BLOODFEST=3  TIER_AT=12 (2.0 scaling levels 12/18)  NM_FLAT=n  WRITE=1 (SIMULATION.md)
//
// Model: one Strength Gunbreaker with a two-handed d12 gunblade, normal martial
// proficiency, fundamental runes on the usual schedule, and two offensive actions
// per turn (the third is movement, Royal Guard or a reaction setup, as for the
// baselines). Single target is a level-equal creature with moderate AC and saves.
// The crowd scenario puts three such creatures adjacent and sums damage to all.
// This is a sanity check of rules numbers, not proof of balance.
import {writeFile} from 'node:fs/promises';
import path from 'node:path';

const N = Number(process.argv[2] ?? 20000), ROUNDS = Number(process.argv[3] ?? 4);
const LEVELS = (process.env.LEVELS ?? '1,3,5,7,9,11,12,13,15,17,18,19,20').split(',').map(Number);
const CONT_OFFSET = Number(process.env.CONT_DICE ?? -1);
const AREA_DIE = Number(process.env.AREA_DIE ?? 8);
const BLOODFEST = Number(process.env.BLOODFEST ?? 3), CONT_WEAPON = process.env.CONT_WEAPON === '1';

const AC = [15,15,17,18,20,21,23,24,26,27,29,30,32,33,35,36,38,39,41,42,44];
const SAVE = [6,7,8,9,11,12,14,15,16,18,19,21,22,23,25,26,28,29,30,32,33];
const str = L => L >= 17 ? 6 : L >= 10 ? 5 : 4;
const potency = L => L >= 16 ? 3 : L >= 10 ? 2 : L >= 2 ? 1 : 0;
const striking = L => L >= 19 ? 4 : L >= 12 ? 3 : L >= 4 ? 2 : 1;
const martialProf = L => L >= 13 ? 6 : L >= 5 ? 4 : 2;
const fighterProf = L => L >= 13 ? 8 : L >= 5 ? 6 : 4;
const classProf = L => L >= 17 ? 6 : L >= 9 ? 4 : 2;
const spec = (L, prof) => L < 7 ? 0 : (L >= 15 ? 2 : 1) * ({4: 2, 6: 3, 8: 4}[prof] ?? 0);
const classDC = L => 10 + L + classProf(L) + str(L);
const TIER_AT = Number(process.env.TIER_AT ?? 12);
const tier = (L, v2 = true) => Math.max(0, Math.floor((L - (v2 ? TIER_AT : 11) + 6) / 6)); // 1.4: +1 at 11 and 17; 2.0: +1 at 12 and 18

const d = n => 1 + Math.floor(Math.random() * n);
const roll = (n, s) => { let t = 0; for (let i = 0; i < n; i++) t += d(s); return t; };
function degree(total, dc, nat) {
  let g = total >= dc + 10 ? 3 : total >= dc ? 2 : total > dc - 10 ? 1 : 0;
  if (nat === 20) g = Math.min(3, g + 1); if (nat === 1) g = Math.max(0, g - 1);
  return g;
}
const saveDamage = (L, dmg) => { const nat = d(20); return [dmg * 2, dmg, Math.floor(dmg / 2), 0][degree(nat + SAVE[L], classDC(L), nat)]; };
function strike(L, prof, map, {bonusDice = 0, bonusDie = 6, flat = 0, onHitFlat = 0} = {}) {
  const nat = d(20), g = degree(nat + L + prof + str(L) + potency(L) - 5 * map, AC[L], nat);
  if (g < 2) return {g, dmg: 0};
  let dmg = roll(striking(L), 12) + str(L) + spec(L, prof) + flat + onHitFlat + roll(bonusDice, bonusDie);
  return {g, dmg: g === 3 ? dmg * 2 : dmg};
}

// ----- Baselines: two Strikes per turn -----
function martial(L, prof) { let t = 0; for (let r = 0; r < ROUNDS; r++) t += strike(L, prof, 0).dmg + strike(L, prof, 1).dmg; return t; }

// ----- Gunbreaker -----
function gunbreaker(L, rules, crowd = 0) {
  const v2 = rules === '2.0', P = martialProf(L);
  const has = {
    noMercy: v2 ? true : L >= 2, sonic: L >= 6, gnashing: L >= 6, continuation: L >= 7,
    bloodfest: L >= 10, doubleDown: L >= 14, reign: L >= 18, fatedCircle: L >= 12,
  };
  let cart = 1, cap = 3 + (L >= 12 ? 1 : 0) + (L >= 18 && v2 ? 1 : 0), dmg = 0;
  let combo = null, gnash = null, reign = null, noMercy = 0, breakReady = false, gnashUsed = false, nmUsed = false, bfUsed = false, ddUsed = false, bloodfest = 0;
  const nmBonus = v2 && process.env.NM_FLAT ? Number(process.env.NM_FLAT) : 2 + tier(L, v2);
  const contDice = v2 ? Math.max(0, 2 + tier(L, v2) + CONT_OFFSET) : 2 + tier(L, v2);
  const follow = () => roll(contDice, 6) + (v2 && !CONT_WEAPON ? 0 : striking(L));
  const areaDie = v2 ? AREA_DIE : 4;
  const crowdCount = Math.max(1, crowd);
  const areaHit = (dice, size) => { const base = roll(dice, size); let t = 0; for (let i = 0; i < crowdCount; i++) t += saveDamage(L, base); return t; };
  for (let r = 0; r < ROUNDS; r++) {
    let actions = 2, map = 0, gnashThisTurn = false, reignThisTurn = false;
    const flat = () => noMercy > 0 ? nmBonus : 0;
    const gain = n => { cart = Math.min(cap + (bloodfest > 0 ? 3 : 0), cart + n); };
    const doStrike = (opts = {}) => { const res = strike(L, P, Math.min(2, map), {flat: flat(), ...opts}); map++; actions--; dmg += res.dmg; return res; };
    // Continuation: 1.4 spends an action; 2.0 is a free action. Once per round either way.
    let followUsed = false;
    const continuation = res => {
      if (!has.continuation || followUsed || res.g < 2) return;
      if (v2) { dmg += follow(); followUsed = true; return; }
      if (actions > 0) { dmg += follow(); followUsed = true; actions--; }
    };
    while (actions > 0) {
      // Crowd: area combo when it beats a single Strike on the expected numbers.
      if (crowd > 1 && actions >= 2) {
        if (has.fatedCircle && cart >= 1) { cart--; actions -= 2; dmg += areaHit(Math.ceil(L / 2), v2 ? 10 : 6); continue; }
        const slaughter = combo === 'demon-slaughter';
        actions -= 2; dmg += areaHit(Math.ceil(L / 2), areaDie);
        combo = slaughter ? null : 'demon-slaughter'; if (slaughter) gain(1);
        continue;
      }
      if (has.noMercy && !nmUsed && r === 0) { nmUsed = true; noMercy = 3; gain(1); breakReady = has.sonic; actions--; continue; }
      if (has.bloodfest && !bfUsed && cart <= 1 && (!v2 || BLOODFEST > 0)) { bfUsed = true; bloodfest = 10; gain(v2 ? BLOODFEST : 3); reign = has.reign ? 'reign' : null; actions--; continue; }
      if (reign && !reignThisTurn) {
        const dice = {reign: 2, noble: 3, lion: 4}[reign];
        doStrike({bonusDice: dice}); reignThisTurn = true;
        reign = {reign: 'noble', noble: 'lion', lion: null}[reign]; continue;
      }
      if (has.gnashing && !gnashThisTurn && (gnash || (!gnashUsed && cart >= 1))) {
        const step = gnash ?? 'gnash';
        if (!gnash) { cart--; gnashUsed = true; }
        const res = doStrike({bonusDice: (step === 'talon' ? 2 : 1) + tier(L, v2)});
        gnashThisTurn = true; gnash = {gnash: 'claw', claw: 'talon', talon: null}[step];
        continuation(res); continue;
      }
      if (breakReady) { breakReady = false; const res = doStrike(); if (res.g >= 2) dmg += roll((1 + tier(L, v2)) * (res.g === 3 ? 2 : 1), 6) * 2; continue; }
      if (has.doubleDown && !ddUsed && cart >= 2 && actions >= 2) { ddUsed = true; cart -= 2; actions -= 2; dmg += saveDamage(L, roll(L >= 18 ? 12 : 10, 6)); continue; }
      // Spend when the gauge is full or a finisher would overcap it, otherwise build.
      const capNow = cap + (bloodfest > 0 ? 3 : 0);
      if (cart >= 1 && (cart >= capNow || combo === 'solid-barrel' || noMercy > 0 || bloodfest > 0 || r === ROUNDS - 1)) {
        cart--; const res = doStrike({bonusDice: (L >= 5 ? 2 : 1) + tier(L, v2)}); continuation(res); continue;
      }
      const step = combo ?? 'keen-edge';
      const res = doStrike(step === 'solid-barrel' ? {onHitFlat: striking(L)} : {});
      combo = {'keen-edge': 'brutal-shell', 'brutal-shell': 'solid-barrel', 'solid-barrel': null}[step];
      if (step === 'solid-barrel') gain(1);
    }
    noMercy--; bloodfest--;
  }
  return dmg;
}

function mean(fn) { let t = 0; for (let i = 0; i < N; i++) t += fn(); return t / N / ROUNDS; }
const rows = [];
for (const L of LEVELS) {
  const base = mean(() => martial(L, martialProf(L))), fighter = mean(() => martial(L, fighterProf(L)));
  const v14 = mean(() => gunbreaker(L, '1.4')), v20 = mean(() => gunbreaker(L, '2.0'));
  const crowdBase = base, c14 = mean(() => gunbreaker(L, '1.4', 3)), c20 = mean(() => gunbreaker(L, '2.0', 3));
  rows.push({L, base, fighter, v14, v20, c14, c20, crowdBase});
}
const pct = (a, b) => `${Math.round(a / b * 100)}%`;
const table = rows.map(r => `| ${r.L} | ${r.base.toFixed(1)} | ${r.fighter.toFixed(1)} (${pct(r.fighter, r.base)}) | ${r.v14.toFixed(1)} (${pct(r.v14, r.base)}) | ${r.v20.toFixed(1)} (${pct(r.v20, r.base)}) | ${r.c14.toFixed(1)} | ${r.c20.toFixed(1)} |`).join('\n');
const text = `# Encounter simulation\n\nGenerated by \`node tools/balance-sim.mjs ${N} ${ROUNDS}\`. Average damage per round over ${ROUNDS}-round encounters, ${N} encounters per cell. Two offensive actions per turn for every column; the third action (movement, Royal Guard, Raise a Shield) is the same for all. Level-equal creature with moderate AC and saves; Strength 4 → 5 at 10 → 6 at 17; two-handed d12 gunblade; fundamental runes on the usual schedule; no property runes, off-guard or buffs from allies.\n\nThe Gunbreaker plays a greedy order: No Mercy on turn 1, Bloodfest when low, Reign and Gnashing steps (one per turn), Sonic Break, Double Down, Burst Strike when the gauge is full, No Mercy or Bloodfest is up, or the fight is ending, otherwise the basic combo. Crowd columns put three creatures adjacent and sum damage to all of them; the Gunbreaker then uses its area combo and Fated Circle.\n\n| Level | Martial (2 Strikes) | Fighter | Gunbreaker 1.4 | Gunbreaker 2.0 | Crowd 1.4 (3 foes) | Crowd 2.0 (3 foes) |\n|---|---|---|---|---|---|---|\n${table}\n\nPercentages are against the featless martial. The 2.0 target is an offensive defender: above a featless martial and below a Fighter single-target, with a clear edge against crowds. Results vary by about ±1 point between runs.\n`;
console.log(text);
if (process.env.WRITE === '1') await writeFile(path.join(import.meta.dirname, '..', 'SIMULATION.md'), text);
