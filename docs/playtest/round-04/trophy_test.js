// Round 04 auditor: Depth Trophies proposal, simulated in memory (nothing in js/ changes).
// Trophy at each floor in T: first time S.maxFloorEver reaches it -> permanent dmg & gold x MULT (multiplicative), banner.
// Reports trophy times, depth at 8 h, and novelty cadence (MAJOR + new omen + trophy) per 30 min in hours 1-8.
// node docs/playtest/round-04/trophy_test.js [mult=1.08]
const { run, fmtT, buckets, gap } = require('./r4lib');
const MULT = +process.argv[2] || 1.08;
const T = process.env.TROPHIES ? process.env.TROPHIES.split(",").map(Number) : [75, 85, 95, 100, 105, 110, 115, 120, 125, 130, 140, 150];
const patch = (KK) => {
  const orig = KK.mods; let n = 0;
  KK.mods = function () { const m = orig(); if (!m._tro) { m._tro = 1; const k = Math.pow(MULT, n); m.dmg *= k; m.gold *= k; } return m; };
  KK.on('floor', () => { const nn = T.filter((f) => KK.S.maxFloorEver >= f).length; if (nn !== n) { n = nn; KK.dirty(); } });
};
const lines = [];
for (const [p, seed] of [['typist', 1], ['typist', 2], ['typist', 3], ['heavy', 1], ['light', 1], ['burst', 1], ['idle', 1], ['idle', 2]]) {
  for (const on of [false, true]) {
    const R = run({ profile: p, seed, min: 480, ach: false, patch: on ? patch : null });
    const tro = [];
    // floorsFirst only has multiples of 5 from 50: enough for T
    for (const f of T) if (R.floorsFirst[f] !== undefined) tro.push({ t: R.floorsFirst[f], f });
    const major = R.nov.filter((x) => x.kind === 'MAJOR' || x.kind === 'OMEN');
    const all = on ? [...major, ...tro] : major;
    const b = buckets(all, 1800, 3600, 8 * 3600);
    const g = gap(all, 3600, 8 * 3600);
    lines.push(`${on ? 'TROPHY x' + MULT : 'baseline  '} ${p} s${seed}: maxEver ${R.end.maxEver} retires ${R.end.retires} | ${on ? tro.map((x) => x.f + '@' + fmtT(x.t)).join(' ') : ''} | MAJOR+OMEN${on ? '+TROPHY' : ''} per 30m h1-8: ${b.join(' ')} | empty 30-min windows h2-5: ${b.slice(2, 8).filter((x) => !x).length}/6, h5-8: ${b.slice(8).filter((x) => !x).length}/6 | longest gap ${(g.g / 60).toFixed(0)}m`);
  }
}
console.log(lines.join('\n'));
require('fs').writeFileSync(require('path').join(__dirname, 'out', 'trophy_test_' + MULT + (process.env.TROPHIES ? '_every5' : '') + '.txt'), lines.join('\n') + '\n');
