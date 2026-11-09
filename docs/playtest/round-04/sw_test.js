// Round 04 auditor: Second Wind on/off (in memory: secondWind mod forced to 0) for light and burst typists, 8 h nudge.
// node docs/playtest/round-04/sw_test.js
const { run } = require('./r4lib');
const lines = [];
for (const [p, seed] of [['light', 1], ['light', 2], ['burst', 1], ['burst', 2], ['typist', 1]]) for (const off of [false, true]) {
  const patch = off ? (KK) => { const o = KK.mods; KK.mods = function () { const m = o(); m.secondWind = 0; return m; }; } : null;
  const R = run({ profile: p, seed, min: 480, ach: false, patch });
  lines.push(`${p} s${seed} SecondWind ${off ? 'OFF' : 'on '}: kindling lvl ${R.end.workshop.kindling || 0}, triggers ${R.sw.triggers}, bonus Sparks ${R.sw.bonusSparks}/${R.sw.sparksTotal}, ults ${R.end.ults}, maxEver ${R.end.maxEver}, renown ${R.end.renownLife}`);
}
console.log(lines.join('\n'));
require('fs').writeFileSync(require('path').join(__dirname, 'out', 'sw_test.txt'), lines.join('\n') + '\n');
