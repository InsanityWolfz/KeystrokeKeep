// Round 10 auditor: content counts from the code + Hollowed rotation by floor (new vs old bossFor)
const KK = require('../../../tools/headless')({ seed: 1 });
const D = KK.DATA, F = KK.F;
const mon = Object.entries(D.MONSTERS);
console.log('monsters (non-boss):', mon.filter(([, m]) => !m.boss).map(([k]) => k).join(' '), mon.filter(([, m]) => !m.boss).length);
console.log('bosses:', mon.filter(([, m]) => m.boss).map(([k, m]) => m.name).join(', '), mon.filter(([, m]) => m.boss).length);
console.log('biomes:', D.BIOMES.map((b) => b.name + ' f' + b.from).join(', '));
const r = {}; for (const x of D.RELICS) r[x.rar] = (r[x.rar] || 0) + 1; console.log('relics', D.RELICS.length, JSON.stringify(r));
console.log('achievements', KK.ach.LIST.length, 'demo', KK.ach.LIST.filter((a) => a.demo).length, 'counters', KK.ach.LIST.filter((a) => a.goal && a.cur).length);
console.log('trophies', D.TROPHIES.length, D.TROPHIES[0], '..', D.TROPHIES[D.TROPHIES.length - 1]);
console.log('omens', D.OMENS.length, 'forge', D.FORGE.length, 'workshop', D.WORKSHOP.length, 'legacy', D.LEGACY.length, 'codex', D.CODEX_MAX);
// Hollowed rotation: which boss appears on each floor, for daysPlayed 1..6 and retires 0..5
for (const days of [1, 3, 5, 6]) {
  KK.S.daysPlayed = days; const seen = {};
  for (let ret = 0; ret < 6; ret++) { KK.S.retires = ret; for (let f = 80; f <= 300; f += 10) { const k = F.bossFor(f); (seen[k] = seen[k] || []).push(f); } }
  const deep = {}; for (const [k, fs] of Object.entries(seen)) deep[k] = fs.filter((f) => f >= 110).length;
  console.log('days', days, 'boss appearances f80-300 over 6 retires:', Object.entries(seen).map(([k, fs]) => k + ' ' + fs.length + ' (f110+: ' + deep[k] + ', floors ' + [...new Set(fs)].slice(0, 6).join(',') + ')').join(' | '));
}
for (let f = 141; f <= 260; f += 10) console.log(f, F.biomeOf(f).name, F.biomeOf(f).id, 'boss f' + (f + 9) + ' ' + F.bossFor(f + 9));
