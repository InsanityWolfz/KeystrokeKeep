// node aggweek.js out/week7.jsonl [cfg]
const fs = require('fs');
const rows = fs.readFileSync(require('path').join(__dirname, process.argv[2]), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const only = process.argv[3];
const avg = (a) => { const b = a.filter((x) => x !== undefined && x !== null && x === x); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : NaN; };
const f = (x, d = 1) => (x === x ? x.toFixed(d) : '-');
const n = (d, k) => (d.ev[k] || []).length;
for (const cfg of [...new Set(rows.map((r) => r.cfg))]) {
  if (only && cfg !== only) continue;
  for (const prof of ['typist', 'burst', 'idle']) {
    const R = rows.filter((r) => r.cfg === cfg && r.prof === prof); if (!R.length) continue;
    console.log(`\n== ${cfg} / ${prof} (${R.length} seeds) ==`);
    console.log('day  floor(end)  +rec  troph codex  ach  seal@runMin  newBoss newOmen legMax wsMax  retires  renown+  gapMile(max min)  offline: x-gold  onlineMin lv  peak15  ret<15');
    const D = Math.max(...R.map((r) => r.days.length));
    for (let i = 0; i < D; i++) {
      const ds = R.map((r) => r.days[i]).filter(Boolean);
      const sealed = ds.filter((d) => n(d, 'seal'));
      const o = ds.map((d) => d.offline).filter(Boolean);
      console.log(String(ds[0].day).padStart(3) + f(avg(ds.map((d) => d.floor1))).padStart(10) + f(avg(ds.map((d) => d.floor1 - d.floor0))).padStart(7) + f(avg(ds.map((d) => n(d, 'trophy')))).padStart(6) + f(avg(ds.map((d) => n(d, 'codex')))).padStart(6) + f(avg(ds.map((d) => n(d, 'ach')))).padStart(6) +
        `${sealed.length}/${ds.length}@${f(avg(sealed.map((d) => d.sealMin)), 0)}`.padStart(12) + f(avg(ds.map((d) => n(d, 'newBoss')))).padStart(8) + f(avg(ds.map((d) => n(d, 'newOmen')))).padStart(8) + f(avg(ds.map((d) => n(d, 'legacyMax')))).padStart(7) + f(avg(ds.map((d) => n(d, 'wsMax')))).padStart(6) +
        f(avg(ds.map((d) => d.retires))).padStart(9) + f(avg(ds.map((d) => d.ren1 - d.ren0)), 0).padStart(9) + `${f(avg(ds.map((d) => d.gapMile)), 0)} [${Math.max(...ds.map((d) => d.gapMile))}]`.padStart(14) +
        (o.length ? (f(avg(o.map((x) => x.ratio)), 0).padStart(14) + f(avg(o.map((x) => x.onlineMin)), 0).padStart(10) + f(avg(o.map((x) => x.levels)), 0).padStart(5) + f(avg(o.map((x) => x.peak15)), 1).padStart(8) + `${o.filter((x) => x.retiredIn15).length}/${o.length}`.padStart(7)) : ''));
    }
    // days with no milestone (trophy/codex/ach/newBoss/biome/newOmen/legacyMax/wsMax), seal excluded
    const MILE = ['trophy', 'codex', 'ach', 'newBoss', 'biome', 'newOmen', 'legacyMax', 'wsMax'];
    const dead = [];
    R.forEach((r) => r.days.forEach((d) => { const m = MILE.reduce((a, k) => a + n(d, k), 0); if (!m) dead.push(`s${r.seed}d${d.day}${n(d, 'record') ? '(rec+' + n(d, 'record') + ')' : '(no rec)'}`); }));
    console.log('days with no milestone except a Seal:', dead.length ? dead.join(' ') : 'none');
    console.log('ach by day 7:', f(avg(R.map((r) => r.final.achN))), '/', R[0].final.achTotal, ' missing (count of seeds):', Object.entries(R.flatMap((r) => r.final.missing).reduce((a, k) => ((a[k] = (a[k] || 0) + 1), a), {})).map(([k, v]) => k + ':' + v).join(' '));
  }
}
