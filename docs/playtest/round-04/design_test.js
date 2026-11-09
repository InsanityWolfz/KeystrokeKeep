// Round 04 auditor: in-memory design experiments (nothing in js/ is touched).
//  A. Sanctuary: per-boss-fight minimum party HP (how low does a fight with Pell ever get?)
//  B. Depth Trophies: permanent x1.10 dmg & gold at floors 75/90/100/110/120/130/140/150 -> reach times + floor at 8 h
//  C. Demo -> full import: play the demo N minutes (re-delving), carry the save into the full game, time the full-game firsts
// node docs/playtest/round-04/design_test.js A|B|C
const { run, fmtT } = require('./r4lib');
const which = process.argv[2] || 'ABC';
const out = [];
const log = (s) => { out.push(s); console.log(s); };

if (which.includes('A')) {
  for (const [p, seed] of [['typist', 1], ['typist', 2], ['heavy', 1], ['idle', 1], ['burst', 1]]) {
    const R = run({ profile: p, seed, min: 480, ach: false });
    const m = R.sanct.minHps || [];
    const frac = (x) => `${(100 * m.filter((v) => v < x).length / Math.max(1, m.length)).toFixed(0)}%`;
    log(`A ${p} s${seed}: boss fights with Pell ${m.length}; min party HP <0.9 in ${frac(0.9)}, <0.8 ${frac(0.8)}, <0.7 ${frac(0.7)}, <0.5 ${frac(0.5)}, KO ${frac(0.001)}; Sanctuary casts ${R.sanct.casts}, revives ${R.sanct.revives}; per hour ${(R.sanct.casts / 8).toFixed(1)}`);
  }
}

const TROPHIES = [75, 90, 100, 110, 120, 130, 140, 150];
function trophyPatch(mult) {
  return (KK) => {
    const orig = KK.mods;
    let n = 0;
    KK.mods = function () { const m = orig(); if (!m._tro) { m._tro = 1; const k = Math.pow(mult, n); m.dmg *= k; m.gold *= k; m.trophyMult = k; } return m; };
    KK.on('floor', () => { const nn = TROPHIES.filter((f) => KK.S.maxFloorEver >= f).length; if (nn !== n) { n = nn; KK.dirty(); } });
  };
}
if (which.includes('B')) {
  for (const mult of [1, 1.1, 1.25]) {
    for (const [p, seed] of [['typist', 1], ['typist', 2], ['typist', 3], ['heavy', 1], ['light', 1], ['idle', 1], ['idle', 2], ['burst', 1]]) {
      const R = run({ profile: p, seed, min: 480, ach: false, patch: mult > 1 ? trophyPatch(mult) : null });
      const reach = TROPHIES.map((f) => `${f}@${R.floorsFirst[f] !== undefined ? fmtT(R.floorsFirst[f]) : '—'}`).join(' ');
      const inWin = TROPHIES.filter((f) => R.floorsFirst[f] !== undefined && R.floorsFirst[f] >= 3600 && R.floorsFirst[f] < 8 * 3600).length;
      log(`B x${mult} ${p} s${seed}: maxEver ${R.end.maxEver}, retires ${R.end.retires}, renown ${R.end.renownLife} | ${reach} | trophies in h1-8: ${inWin}`);
    }
  }
}

if (which.includes('C')) {
  for (const [p, demoMin] of [['typist', 0], ['typist', 40], ['typist', 90], ['typist', 180], ['idle', 0], ['idle', 120], ['idle', 180]]) {
    let carried = null, dState = null;
    if (demoMin) { const D = run({ profile: p, seed: 7, min: demoMin, demo: true, ach: false }); dState = JSON.parse(JSON.stringify(D.KK.S)); carried = dState; }
    const R = run({
      profile: p, seed: 3, min: 300, ach: false,
      patch: carried ? (KK) => { const fresh = KK.newState(); for (const k in fresh) { if (carried[k] === undefined) continue; if (fresh[k] && typeof fresh[k] === 'object' && !Array.isArray(fresh[k])) fresh[k] = Object.assign(fresh[k], carried[k]); else fresh[k] = carried[k]; } KK.S = fresh; KK.dirty(); } : null,
    });
    const f = (lbl) => { const n = R.nov.find((x) => x.label.startsWith(lbl)); return n ? fmtT(n.t) : '—'; };
    log(`C ${p} demo ${demoMin}m (import: lifetime ${dState ? dState.renownLifetime : 0}, retires ${dState ? dState.retires : 0}): Magma ${f('biome Magma')} | Void ${f('biome The Hollow Void')} | The Hollow ${f('boss The Hollow (')} | first omen ${R.omenPicks.length ? fmtT(R.omenPicks[0].t) : '—'} | f100 ${R.floorsFirst[100] !== undefined ? fmtT(R.floorsFirst[100]) : '—'} | last MAJOR ${fmtT(R.nov.filter((n) => n.kind === 'MAJOR').pop().t)} | 5h: maxEver ${R.end.maxEver}, renown ${R.end.renownLife}`);
  }
}
require('fs').writeFileSync(require('path').join(__dirname, 'out', 'design_' + which + '.txt'), out.join('\n') + '\n');
