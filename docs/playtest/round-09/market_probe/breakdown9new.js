// R8: per-name breakdown, averaged over seeds 1 and 6.  node breakdown8.js <build> <profile> <hours e.g. 0 or 6,7> [cats]
const [b, p, hs, catsArg] = process.argv.slice(2);
const hours = hs.split(',').map(Number);
const cats = (catsArg || 'alert,banner,toast,modal,loudSound,sound,flashFaint,popup,secs').split(',');
const acc = {}; let n = 0;
for (const s of [1, 6]) { const r = require(`./out/c9_new${b}_${p}_${s}.json`); for (const h of hours) { const ph = r.perHour[h]; if (!ph) continue; n++; for (const c of cats) for (const [k, v] of Object.entries(ph[c] || {})) { acc[c] = acc[c] || {}; acc[c][k] = (acc[c][k] || 0) + v; } } }
for (const c of cats) { const e = Object.entries(acc[c] || {}).sort((x, y) => y[1] - x[1]); const tot = e.reduce((a, x) => a + x[1], 0) / n; console.log(`== ${c} total ${Math.round(tot)}/h: ` + e.slice(0, 30).map(([k, v]) => `${k} ${Math.round(v / n)}`).join(' | ')); }
