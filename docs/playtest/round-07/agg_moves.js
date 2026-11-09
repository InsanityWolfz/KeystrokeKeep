// Round 07: aggregate the MOVE lines of several r7probe outputs (glob prefix) into one table.
const fs = require('fs'); const pre = process.argv[2]; const dir = __dirname + '/out/';
const rows = {};
for (const f of fs.readdirSync(dir).filter((x) => x.startsWith(pre))) for (const l of fs.readFileSync(dir + f, 'utf8').split('\n')) {
  const m = l.match(/^MOVE (\S+)\s+fights (\d+) kills (\d+) wipes (\d+) \| (\w+) seen (\d+)% \(a 2nd one or after the 2.6 s boss banner: (\d+)%\) med\/fight (\S+) \| med kill (\S+) s \| first hero hit @(\S+) s/);
  if (!m) continue; const r = rows[m[1]] = rows[m[1]] || { n: 0, k: 0, w: 0, seen: 0, ab: 0, kill: [], per: [], fh: [] , ev: m[5]};
  const n = +m[2]; r.n += n; r.k += +m[3]; r.w += +m[4]; r.seen += Math.round(n * m[6] / 100); r.ab += Math.round(n * m[7] / 100); if (m[9] !== '-') r.kill.push(+m[9]); r.per.push(m[8]); r.fh.push(+m[10]);
}
const rng = (a) => a.length ? Math.min(...a).toFixed(1) + '-' + Math.max(...a).toFixed(1) : '-';
for (const [k, r] of Object.entries(rows).sort()) console.log(`${k.padEnd(14)} ${r.ev.padEnd(12)} fights ${String(r.n).padStart(3)} kills ${String(r.k).padStart(3)} wipes ${String(r.w).padStart(3)} | seen ${(100 * r.seen / r.n).toFixed(0).padStart(3)}% | 2nd/after banner ${(100 * r.ab / r.n).toFixed(0).padStart(3)}% | med per fight ${r.per.join('/')} | med kill s ${rng(r.kill)} | 1st hit ${rng(r.fh)}`);
