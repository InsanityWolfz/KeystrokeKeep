// T1 economist: batch-runs tools/playtest.js across configs and prints a compact table.
// Usage (from project root): node docs/playtest/round-01/econ_batch.js "--min 240" typist,idle,heavy,burst smart,greedy 1,2,3
const { execFileSync } = require('child_process');
const extra = (process.argv[2] || '--min 240').split(' ').filter(Boolean);
const profiles = (process.argv[3] || 'typist,idle,heavy,burst').split(',');
const strats = (process.argv[4] || 'smart').split(',');
const seeds = (process.argv[5] || '1').split(',');
const rows = [];
for (const p of profiles) for (const st of strats) for (const sd of seeds) {
  const out = execFileSync('node', ['tools/playtest.js', '--profile', p, '--strategy', st, '--seed', sd, ...extra], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const L = out.split('\n');
  const ret = L.filter((l) => l.startsWith('retire at')).map((l) => { const m = l.match(/retire at (\S+): run ([\d.]+) min, max floor (\d+), \+(\d+)/); return `${m[1]}/f${m[3]}/+${m[4]}`; });
  const end = (L.find((l) => l.startsWith('END')) || '').match(/maxEver (\d+) retires (\d+) renownLifetime (\d+)/) || [];
  const ferv = (L.find((l) => l.startsWith('fervor time')) || '').replace('fervor time: ', '');
  const boss10 = (L.find((l) => /Rat King down/.test(l)) || '').slice(0, 5);
  const boss20 = (L.find((l) => /Bone King down/.test(l)) || '').slice(0, 5);
  const ws = L.filter((l) => l.startsWith('workshop:')).map((l) => l.trim().split(/\s+/)).map((a) => a[0].slice(9) + '=' + a[3]).join(' ');
  const drought = (L.find((l) => l.startsWith('glances with')) || '').replace('glances with NOTHING affordable: ', 'empty ');
  rows.push({ cfg: `${p}/${st}/s${sd}`, boss10, boss20, retires: ret.join(' '), maxEver: end[1], renownLife: end[3], ferv, ws, drought });
}
for (const r of rows) console.log(JSON.stringify(r));
