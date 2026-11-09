// T1 economist, round 09: parallel runner for pt9.js over seeds and configs; prints a table and saves raw JSON.
// node gate8.js --name tag --seeds 1-10 --cfg "label|ENV=1,ENV2=x|--min 60 --profile idle --demo --glance 60" [--cfg ...]
const { spawn } = require('child_process'); const path = require('path'); const os = require('os'); const fs = require('fs');
const cfgs = []; let name = 'gate', seeds = [1, 2, 3, 4, 5];
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i], v = process.argv[++i];
  if (a === '--cfg') { const [label, env, args] = v.split('|'); cfgs.push({ label, env: Object.fromEntries((env || '').split(',').filter(Boolean).map((p) => { const k = p.indexOf('='); return [p.slice(0, k), p.slice(k + 1)]; })), args: args.trim().split(/\s+/) }); }
  else if (a === '--seeds') { const [x, y] = v.split('-').map(Number); seeds = Array.from({ length: y - x + 1 }, (_, j) => x + j); }
  else if (a === '--name') name = v;
}
const jobs = []; for (const c of cfgs) for (const s of seeds) jobs.push({ c, s });
const res = {}; let run = 0, idx = 0; const MAXP = Math.max(2, os.cpus().length - 2);
function next() {
  while (run < MAXP && idx < jobs.length) {
    const j = jobs[idx++]; run++;
    const p = spawn(process.execPath, [path.join(__dirname, 'pt9.js'), '--seed', String(j.s), ...j.c.args], { env: Object.assign({}, process.env, j.c.env) });
    let o = ''; p.stdout.on('data', (d) => (o += d)); p.stderr.on('data', (d) => process.stderr.write(d));
    p.on('close', () => { run--; try { (res[j.c.label] = res[j.c.label] || []).push(Object.assign({ seed: j.s }, JSON.parse(o.trim().split('\n').pop()))); } catch (e) { console.error('fail', j.c.label, j.s, o.slice(-300)); } if (idx >= jobs.length && !run) done(); else next(); });
  }
}
const avg = (a) => { const b = a.filter((x) => x !== null && x === x && x !== undefined); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : NaN; };
const f1 = (x) => (x === x ? x.toFixed(1) : '-');
function done() {
  const L = [`=== ${name} seeds ${seeds[0]}-${seeds[seeds.length - 1]} ===`, 'config'.padEnd(30) + 'h1 retreats [per seed] (N/B/E)'.padEnd(44) + 'first  <10  glimpse   card    lap  maxEv renown 1stRet caut  total'];
  for (const c of cfgs) {
    const r = (res[c.label] || []).sort((a, b) => a.seed - b.seed);
    const h1 = r.map((x) => x.h1), n = (k) => r.filter((x) => x[k] !== null).length;
    L.push(c.label.padEnd(30) + `${f1(avg(h1))} [${h1.join(',')}] (${f1(avg(r.map((x) => x.h1N)))}/${f1(avg(r.map((x) => x.h1B)))}/${f1(avg(r.map((x) => x.h1E)))})`.padEnd(44) +
      f1(Math.min(...r.map((x) => x.first ?? 999))).padStart(5) + String(r.reduce((a, x) => a + x.under10, 0)).padStart(5) +
      (f1(avg(r.map((x) => x.glimpse))) + (n('glimpse') < r.length ? `(${n('glimpse')})` : '')).padStart(9) + (f1(avg(r.map((x) => x.card))) + (n('card') < r.length ? `(${n('card')})` : '')).padStart(9) +
      f1(avg(r.map((x) => x.bestLap))).padStart(6) + f1(avg(r.map((x) => x.maxEver))).padStart(7) + f1(avg(r.map((x) => x.renown))).padStart(7) + f1(avg(r.map((x) => x.firstRetire))).padStart(7) + f1(avg(r.map((x) => x.cautious))).padStart(6) + f1(avg(r.map((x) => x.total))).padStart(7));
  }
  const txt = L.join('\n'); console.log(txt);
  fs.writeFileSync(path.join(__dirname, 'out', name + '.txt'), txt + '\n');
  fs.writeFileSync(path.join(__dirname, 'out', name + '.json'), JSON.stringify(res));
}
next();
