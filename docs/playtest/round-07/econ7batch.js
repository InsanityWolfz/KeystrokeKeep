// Parallel runner for econ7.js. node econ7batch.js out/file.jsonl "idle,typist" 8 1-5 base,c60b35pb85 [extra args]
const { spawn } = require('child_process'); const path = require('path'); const os = require('os'); const fs = require('fs');
const [outFile, profs, hours, seedsArg, vars, ...extra] = process.argv.slice(2);
const [a, b] = seedsArg.split('-').map(Number);
const jobs = [];
for (const v of vars.split(',')) for (const p of profs.split(',')) for (let s = a; s <= b; s++) jobs.push([p, s, v]);
const MAXP = Math.max(2, os.cpus().length - 2);
let i = 0, run = 0; const lines = [];
function next() {
  while (run < MAXP && i < jobs.length) {
    const [p, s, v] = jobs[i++]; run++;
    const c = spawn(process.execPath, [path.join(__dirname, 'econ7.js'), '--profile', p, '--hours', hours, '--seed', String(s), '--v', v, ...extra]);
    let o = ''; c.stdout.on('data', (d) => (o += d)); c.stderr.on('data', (d) => process.stderr.write(d));
    c.on('close', () => { run--; if (o.trim()) lines.push(o.trim()); else console.error('FAIL', p, s, v); if (i >= jobs.length && !run) { fs.writeFileSync(outFile, lines.join('\n') + '\n'); console.log('wrote', lines.length, outFile); } else next(); });
  }
}
next();
