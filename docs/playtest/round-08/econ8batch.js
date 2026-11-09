// Parallel runner for econ8.js.
// node econ8batch.js out/file.jsonl "idle,typist" 8 1-5 "base=;w2off=--week2 off;mouse=--mouse 20"
const { spawn } = require('child_process'); const path = require('path'); const os = require('os'); const fs = require('fs');
const [outFile, profs, hours, seedsArg, cfgArg] = process.argv.slice(2);
const [a, b] = seedsArg.split('-').map(Number);
const cfgs = (cfgArg || 'base=').split(';').map((c) => { const k = c.indexOf('='); return [c.slice(0, k), c.slice(k + 1).trim()]; });
const jobs = [];
for (const [lab, ex] of cfgs) for (const p of profs.split(',')) for (let s = a; s <= b; s++) jobs.push([p, s, lab, ex ? ex.split(/\s+/) : []]);
const MAXP = Math.max(2, os.cpus().length - 2);
let i = 0, run = 0; const lines = [];
function next() {
  while (run < MAXP && i < jobs.length) {
    const [p, s, lab, ex] = jobs[i++]; run++;
    const c = spawn(process.execPath, [path.join(__dirname, 'econ8.js'), '--profile', p, '--hours', hours, '--seed', String(s), ...ex]);
    let o = ''; c.stdout.on('data', (d) => (o += d)); c.stderr.on('data', (d) => process.stderr.write(d));
    c.on('close', () => {
      run--;
      if (o.trim()) { const j = JSON.parse(o.trim()); j.cfg = lab; lines.push(JSON.stringify(j)); } else console.error('FAIL', p, s, lab);
      if (i >= jobs.length && !run) { fs.writeFileSync(path.join(__dirname, outFile), lines.join('\n') + '\n'); console.log('wrote', lines.length, outFile); } else next();
    });
  }
}
next();
