// Round 04 auditor: "Vigil" rule for Sanctuary (in memory): the first boss slam of every boss fight triggers a free
// Sanctuary (cooldown ignored for that one cast), on top of the live KO / <50% reactions.
// node docs/playtest/round-04/sanct_vigil.js
const { run } = require('./r4lib');
const lines = [];
for (const on of [false, true]) for (const [p, seed] of [['typist', 1], ['typist', 2], ['heavy', 1], ['idle', 1], ['idle', 2], ['burst', 1]]) {
  const patch = on ? (KK) => { let blessed = null; KK.on('bossSlam', ({ e }) => { if (blessed === e.uid) return; blessed = e.uid; const c = KK.world.heroes.find((x) => x.id === 'cleric' && !x.dead); if (c) { c.ultCd = 0; KK.world.sanctuaryReact(); } }); } : null;
  const R = run({ profile: p, seed, min: 480, ach: false, patch });
  const s = R.sanct;
  lines.push(`${on ? 'VIGIL' : 'live '} ${p} s${seed}: Sanctuary ${s.casts} (${(s.casts / 8).toFixed(1)}/h), boss fights with a cast ${s.fightsCast}/${s.fights} (${(100 * s.fightsCast / s.fights).toFixed(0)}%), revives ${s.revives}, wipes w/ Pell ${s.wipesWithPell}, maxEver ${R.end.maxEver}, renown ${R.end.renownLife}`);
}
console.log(lines.join('\n'));
require('fs').writeFileSync(require('path').join(__dirname, 'out', 'sanct_vigil.txt'), lines.join('\n') + '\n');
