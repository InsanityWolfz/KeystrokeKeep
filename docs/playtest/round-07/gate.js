// T1 economist, round 07: market gate runner. Runs pt7.js (tools/playtest.js + variant) over seeds, in parallel.
// node gate.js --variants v.json|NAME,NAME [--profile idle] [--min 60] [--demo] [--seeds 1-5] [--extra "--glance 300"]
const { spawn } = require('child_process'); const path = require('path'); const os = require('os');
const VARS = require('./variants');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--') && a !== '--extra') args[a.slice(2)] = true; else { args[a.slice(2)] = v; i++; } } }
const prof = args.profile || 'idle', min = args.min || 60, demo = args.demo ? ['--demo'] : [];
const [s0, s1] = (args.seeds || '1-5').split('-').map(Number);
const seeds = Array.from({ length: s1 - s0 + 1 }, (_, i) => s0 + i);
const names = (args.variants || 'base').split(',');
const extra = args.extra ? args.extra.split(' ') : [];
const jobs = [];
for (const n of names) for (const s of seeds) jobs.push({ n, s });
const res = {};
let running = 0, idx = 0;
const MAXP = Math.max(2, os.cpus().length - 1);
function next() {
  if (idx >= jobs.length) { if (!running) done(); return; }
  const j = jobs[idx++]; running++;
  const env = Object.assign({}, process.env, { KKV: JSON.stringify(VARS[j.n] || JSON.parse(j.n)) });
  const p = spawn(process.execPath, [path.join(__dirname, 'pt7.js'), '--min', String(min), '--profile', prof, '--seed', String(j.s), '--retire', 'nudge', '--omen', 'random', ...demo, ...extra], { env });
  let o = ''; p.stdout.on('data', (d) => (o += d)); p.stderr.on('data', (d) => process.stderr.write(d));
  p.on('close', () => { running--; try { (res[j.n] = res[j.n] || []).push(Object.assign({ seed: j.s }, JSON.parse(o.trim().split('\n').pop()))); } catch (e) { console.error('fail', j, o.slice(-300)); } next(); });
  next();
}
const avg = (a) => { const b = a.filter((x) => x !== null && x === x); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : NaN; };
const f1 = (x) => (x === x ? x.toFixed(1) : '-');
function done() {
  console.log(`=== ${prof} ${min} min ${demo.join(' ')} ${extra.join(' ')} seeds ${s0}-${s1} ===`);
  console.log('variant'.padEnd(26) + 'h1 retreats (N/B/E)        first  <10  maxEver  card   bestLap  renown  total');
  for (const n of names) {
    const r = (res[n] || []).sort((a, b) => a.seed - b.seed);
    const h1 = r.map((x) => x.h1);
    console.log(n.padEnd(26) + `${f1(avg(h1)).padStart(4)} [${h1.join(',')}] (${f1(avg(r.map((x) => x.h1N)))}/${f1(avg(r.map((x) => x.h1B)))}/${f1(avg(r.map((x) => x.h1E)))})`.padEnd(27) +
      `${f1(Math.min(...r.map((x) => x.first ?? 999)))}`.padStart(6) + `${r.map((x) => x.under10).reduce((a, b) => a + b, 0)}`.padStart(5) + `${f1(avg(r.map((x) => x.maxEver)))}`.padStart(9) +
      `${f1(avg(r.map((x) => x.cardMin)))}${r.some((x) => x.cardMin === null) ? '(' + r.filter((x) => x.cardMin !== null).length + '/' + r.length + ')' : ''}`.padStart(9) + `${f1(avg(r.map((x) => x.bestLap)))}`.padStart(8) + `${f1(avg(r.map((x) => x.renown)))}`.padStart(8) + `${f1(avg(r.map((x) => x.total)))}`.padStart(7));
    if (args.list) for (const x of r) console.log('    s' + x.seed + ': ' + x.list + (x.holds ? `  holds ${x.holds}` : ''));
  }
}
next();
