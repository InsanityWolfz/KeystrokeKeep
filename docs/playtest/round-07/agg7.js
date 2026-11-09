// Aggregate econ7 JSONL: node agg7.js out/e8_base.jsonl [hours-checkpoint]
const fs = require('fs');
const L = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map(JSON.parse);
const avg = (a) => { const b = a.filter((x) => x !== null && x !== undefined && x === x); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : NaN; };
const f1 = (x, d = 1) => (x === x ? x.toFixed(d) : '-');
const groups = {};
for (const r of L) (groups[r.v + '|' + r.prof] = groups[r.v + '|' + r.prof] || []).push(r);
const vs = [...new Set(L.map((r) => r.v))], ps = [...new Set(L.map((r) => r.prof))];
const H = L[0].h;
const cpH = Object.keys(L[0].cps).map(Number).sort((a, b) => a - b);
console.log(`=== ${H} h, seeds ${[...new Set(L.map((r) => r.seed))].join(',')} ===`);
console.log('variant|profile'.padEnd(24) + cpH.map((h) => ('f@' + h + 'h').padStart(8)).join('') + '  renown  wipes  enr  maxStreak(min)  regroups gapMin  codex  x1w rep  h0wipes  h0enr  blitz  speed60');
for (const v of vs) for (const p of ps) {
  const g = groups[v + '|' + p]; if (!g) continue;
  const c = (h, k) => avg(g.map((r) => r.cps[h] && r.cps[h][k]));
  console.log((v + '|' + p).padEnd(24) + cpH.map((h) => f1(c(h, 'floor')).padStart(8)).join('') +
    f1(avg(g.map((r) => r.renown)), 0).padStart(8) + f1(avg(g.map((r) => r.wipes)), 0).padStart(7) + f1(avg(g.map((r) => r.enrages))).padStart(5) +
    `${Math.max(...g.map((r) => r.maxStreak))}(${f1(Math.max(...g.map((r) => r.maxStreakMin)), 0)})`.padStart(16) +
    f1(avg(g.map((r) => r.regroups))).padStart(10) + f1(Math.min(...g.map((r) => r.regroupGapMin ?? 1e9)), 0).padStart(7) +
    f1(avg(g.map((r) => r.codexT.length))).padStart(7) + f1(avg(g.map((r) => r.x1wipes))).padStart(5) + f1(avg(g.map((r) => r.repeatBoss))).padStart(4) +
    f1(avg(g.map((r) => r.wipesByH[0] || 0))).padStart(9) + f1(avg(g.map((r) => r.enrByH[0] || 0))).padStart(7) +
    `${f1(avg(g.map((r) => r.ach.blitz ?? null)), 0)}(${g.filter((r) => r.ach.blitz !== undefined).length})`.padStart(8) + `${f1(avg(g.map((r) => r.ach.speed60 ?? null)), 0)}(${g.filter((r) => r.ach.speed60 !== undefined).length})`.padStart(9));
}
// typist/idle gap per variant at each checkpoint
for (const v of vs) {
  const t = groups[v + '|typist'], i = groups[v + '|idle'];
  if (!t || !i) continue;
  console.log(`gap typist/idle ${v}: ` + cpH.map((h) => `${h}h ${f1(avg(t.map((r) => r.cps[h].floor)) / avg(i.map((r) => r.cps[h].floor)), 3)}x`).join('  ') + `  | per-seed 8h: ${t.map((r, k) => f1(r.cps[Math.min(8, H)].floor / (i[k] ? i[k].cps[Math.min(8, H)].floor : NaN), 2)).join(',')}`);
}
if (process.argv[3] === 'codex') for (const v of vs) for (const p of ps) { const g = groups[v + '|' + p]; if (!g) continue; for (const r of g) { const ts = r.codexT; const gaps = ts.map((x, k) => x - (k ? ts[k - 1] : 0)); console.log(`codex ${v}|${p} s${r.seed}: ranks ${ts.length} at ${ts.map((x) => x.toFixed(1)).join(' ')} | longest gap ${f1(Math.max(0, ...gaps.slice(1)))} h (first at ${f1(ts[0])} h)`); } }
if (process.argv[3] === 'sig') for (const v of vs) for (const p of ps) { const g = groups[v + '|' + p]; if (!g) continue; const keys = [...new Set(g.flatMap((r) => Object.keys(r.sig)))]; console.log(`sig ${v}|${p}: ` + keys.map((k) => `${k} ${f1(avg(g.map((r) => r.sig[k] || 0)), 0)}`).join(', ') + ` | dynamo lv ${f1(avg(g.map((r) => r.dynamo)))}`); }
