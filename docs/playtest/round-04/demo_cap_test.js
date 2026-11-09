// Round 04 auditor: demo Renown cap experiment. Plays the demo with re-delves, optionally capping demo lifetime Renown,
// then imports the save into the full game and times the full-game firsts.
// node docs/playtest/round-04/demo_cap_test.js
const { run, fmtT } = require('./r4lib');
const lines = [];
for (const cap of [0, 60]) for (const [p, demoMin] of [['typist', 180], ['idle', 180]]) {
  const patch = cap ? (KK) => { const og = KK.actions.renownGain; KK.actions.renownGain = () => { const g = og(); return KK.S.demoDone && KK.S.renownLifetime >= cap ? 0 : Math.min(g, Math.max(0, cap - KK.S.renownLifetime) || g); }; } : null;
  const D = run({ profile: p, seed: 7, min: demoMin, demo: true, ach: false, patch });
  const carried = JSON.parse(JSON.stringify(D.KK.S));
  const R = run({ profile: p, seed: 3, min: 300, ach: false, patch: (KK) => { const fresh = KK.newState(); for (const k in fresh) { if (carried[k] === undefined) continue; if (fresh[k] && typeof fresh[k] === 'object' && !Array.isArray(fresh[k])) fresh[k] = Object.assign(fresh[k], carried[k]); else fresh[k] = carried[k]; } KK.S = fresh; KK.dirty(); } });
  const f = (lbl) => { const n = R.nov.find((x) => x.label.startsWith(lbl)); return n ? fmtT(n.t) : '—'; };
  lines.push(`cap ${cap || 'none'} ${p} demo ${demoMin}m -> lifetime ${carried.renownLifetime}, re-delves ${D.demo.redelves}: full game Void ${f('biome The Hollow Void')} | The Hollow ${f('boss The Hollow (')} | f100 ${R.floorsFirst[100] !== undefined ? fmtT(R.floorsFirst[100]) : '—'} | last MAJOR ${fmtT(R.nov.filter((n) => n.kind === 'MAJOR').pop().t)}`);
}
console.log(lines.join('\n'));
require('fs').writeFileSync(require('path').join(__dirname, 'out', 'demo_cap_test.txt'), lines.join('\n') + '\n');
