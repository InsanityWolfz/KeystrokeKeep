// Parallel runner: node batch9.js <script> out/file.jsonl "typist,idle,burst" 1-6 "label=--args;label2=--args"
const { spawn } = require('child_process'); const path = require('path'); const os = require('os'); const fs = require('fs');
const [script, outFile, profs, seedsArg, cfgArg] = process.argv.slice(2);
const [a, b] = seedsArg.split('-').map(Number);
const cfgs = (cfgArg || 'base=').split(';').map((c) => { const k = c.indexOf('='); return [c.slice(0, k), c.slice(k + 1).trim()]; });
const jobs = [];
for (const [lab, ex] of cfgs) for (const p of profs.split(',')) for (let s = a; s <= b; s++) jobs.push([p, s, lab, ex ? ex.split(/\s+/) : []]);
const MAXP = Math.max(2, os.cpus().length - 4);
let i = 0, run = 0; const lines = [];
function next() {
  while (run < MAXP && i < jobs.length) {
    const [p, s, lab, ex] = jobs[i++]; run++;
    const c = spawn(process.execPath, [path.join(__dirname, script), '--profile', p, '--seed', String(s), ...ex]);
    let o = ''; c.stdout.on('data', (d) => (o += d)); c.stderr.on('data', (d) => process.stderr.write(d));
    c.on('close', () => {
      run--;
      try { const j = JSON.parse(o.trim().split('\n').pop()); j.cfg = lab; lines.push(JSON.stringify(j)); } catch (e) { console.error('FAIL', p, s, lab, o.slice(-200)); }
      if (i >= jobs.length && !run) { fs.writeFileSync(path.join(__dirname, outFile), lines.join('\n') + '\n'); console.log('wrote', lines.length, outFile); } else next();
    });
  }
}
next();
