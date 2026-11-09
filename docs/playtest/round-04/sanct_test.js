// Round 04 auditor: Sanctuary reaction threshold experiment (in memory). The live rule reacts to a KO or to a boss slam
// that leaves anyone below 50%. This adds a second listener that reacts below X (cooldown 25 s unchanged).
// node docs/playtest/round-04/sanct_test.js
const { run } = require('./r4lib');
const lines = [];
for (const thr of [0.5, 0.75, 0.85]) for (const [p, seed] of [['typist', 1], ['typist', 2], ['heavy', 1], ['idle', 1], ['burst', 1]]) {
  const patch = thr === 0.5 ? null : (KK) => KK.on('bossSlam', () => { const W = KK.world; if (W.heroes.some((h) => !h.dead && h.hp / h.maxHp < thr)) W.sanctuaryReact(); });
  const R = run({ profile: p, seed, min: 480, ach: false, patch });
  const s = R.sanct;
  lines.push(`thr ${thr} ${p} s${seed}: Sanctuary ${s.casts} (${(s.casts / 8).toFixed(1)}/h), boss fights with a cast ${s.fightsCast}/${s.fights} (${(100 * s.fightsCast / s.fights).toFixed(0)}%), revives ${s.revives}, wipes w/ Pell ${s.wipesWithPell}, maxEver ${R.end.maxEver}`);
}
console.log(lines.join('\n'));
require('fs').writeFileSync(require('path').join(__dirname, 'out', 'sanct_test.txt'), lines.join('\n') + '\n');
