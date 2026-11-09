// Aggregates econ9 jsonl: per cfg x profile, floors at checkpoints, renown, seals, Lantern, trophies, Dynamo binding.
// node agg8.js out/e40.jsonl [cfgs]
const fs = require('fs');
const [file, only] = process.argv.slice(2).filter((a) => a !== '--gap');
const rows = fs.readFileSync(require('path').join(__dirname, file), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const avg = (a) => { const b = a.filter((x) => x !== undefined && x !== null && x === x); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : NaN; };
const f = (x, d = 1) => (x === x ? x.toFixed(d) : '-');
const cfgs = only ? only.split(',') : [...new Set(rows.map((r) => r.cfg))];
const profs = [...new Set(rows.map((r) => r.prof))];
const H = Math.max(...rows.map((r) => r.h));
const cps = [1, 2, 4, 8, 16, 24, 40, 56, 80].filter((x) => x <= H);
console.log('cfg/prof'.padEnd(20) + cps.map((c) => ('f@' + c + 'h').padStart(7)).join('') + '  renown  seals stale  redelv  trophies  lan(lv@h)  dynLv bind  prem  flow  wipes regroups early repBoss caut');
for (const c of cfgs) for (const p of profs) {
  const R = rows.filter((r) => r.cfg === c && r.prof === p); if (!R.length) continue;
  const lanAt = R.map((r) => r.lanternT['1']).filter((x) => x !== undefined);
  console.log((c + '/' + p).padEnd(20) + cps.map((h) => f(avg(R.map((r) => r.cps[h] && r.cps[h].floor))).padStart(7)).join('') +
    f(avg(R.map((r) => r.renown)), 0).padStart(8) + f(avg(R.map((r) => r.seals))).padStart(7) + f(avg(R.map((r) => r.staleSeals))).padStart(6) + f(avg(R.map((r) => r.redelves))).padStart(8) +
    f(avg(R.map((r) => r.cps[H] && r.cps[H].trophies))).padStart(10) + `${f(avg(R.map((r) => r.cps[H] && r.cps[H].lan)))}(${lanAt.length ? f(avg(lanAt)) : '-'}h)`.padStart(11) +
    f(avg(R.map((r) => r.cps[H] && r.cps[H].dyn))).padStart(7) + f(avg(R.map((r) => r.dynBind)), 2).padStart(5) + f(avg(R.map((r) => r.premium)), 2).padStart(6) + f(avg(R.map((r) => r.flow)), 2).padStart(6) +
    f(avg(R.map((r) => r.wipes)), 0).padStart(7) + f(avg(R.map((r) => r.regroups)), 0).padStart(9) + f(avg(R.map((r) => r.regroupEarly))).padStart(6) + f(avg(R.map((r) => r.repeatBoss))).padStart(8) + f(avg(R.map((r) => r.caut)), 0).padStart(6));
}
if (process.argv.includes('--gap')) {
  for (const c of cfgs) { const g = cps.map((h) => { const t = avg(rows.filter((r) => r.cfg === c && r.prof === 'typist').map((r) => r.cps[h] && r.cps[h].floor)), i = avg(rows.filter((r) => r.cfg === c && r.prof === 'idle').map((r) => r.cps[h] && r.cps[h].floor)); return f(t / i, 3); }); console.log(`gap typist/idle ${c}: ${cps.map((h, k) => h + 'h ' + g[k]).join('  ')}`); }
}
