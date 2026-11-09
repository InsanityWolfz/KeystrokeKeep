// How much power does typing still add once Dynamo + Idle Battery set a power floor? (typist, R6 player)
// Per hour: avg powerMult, the floor (1 + idlePow + dynamo), share of time the floor beats the Fervor tier, Dynamo level.
const { load, makePlayer } = require('../round-06/econ6lib');
const prof = process.argv[2] || 'typist', H = +(process.argv[3] || 24), seed = +(process.argv[4] || 1);
const KK = load({ seed }); KK.world.reset();
const P = makePlayer(KK, { profile: prof, retire: 'nudge', omen: 'random' });
const D = KK.DATA; const rows = {};
let acc = 0;
const step = P.step;
while (P.t < H * 3600) {
  step(1 / 30); acc += 1 / 30;
  if (acc >= 1) { acc = 0; const m = KK.mods(), t = KK.fervorTier(); let tm = D.FERVOR_TIERS[t].mult; if (t === 3) tm += m.flowBonus; const fl = 1 + m.idlePow + m.dynamo; const h = Math.floor(P.t / 3600); const r = rows[h] = rows[h] || { n: 0, pm: 0, fl: 0, bind: 0, flow: 0, dyn: 0 }; r.n++; r.pm += Math.max(tm, fl); r.fl += fl; if (fl >= tm) r.bind++; if (t === 3) r.flow++; r.dyn = KK.S.workshop.dynamo || 0; }
}
console.log(`${prof} seed ${seed}: hour | avg power | idle floor | typing premium | floor binds | FLOW time | Dynamo lv`);
for (const h of Object.keys(rows).map(Number).filter((h) => [0, 1, 2, 4, 8, 12, 16, 23, 32, 39].includes(h))) { const r = rows[h]; console.log(`  h${h}: ${(r.pm / r.n).toFixed(2)} | ${(r.fl / r.n).toFixed(2)} | x${((r.pm / r.n) / (r.fl / r.n)).toFixed(2)} | ${(r.bind / r.n * 100).toFixed(0)}% | ${(r.flow / r.n * 100).toFixed(0)}% | ${r.dyn}`); }
