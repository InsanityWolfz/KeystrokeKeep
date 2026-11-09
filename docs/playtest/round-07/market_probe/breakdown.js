// R7 market: per-category breakdown of a census JSON for chosen hours (averaged).  node breakdown.js file.json 0 [6,7]
const r = require(require('path').resolve(process.argv[2]));
const hrs = process.argv.slice(3).map((x) => x.split(',').map(Number));
for (const hs of hrs) {
  const agg = {};
  for (const h of hs) for (const c in r.perHour[h] || {}) for (const k in r.perHour[h][c]) { agg[c] = agg[c] || {}; agg[c][k] = (agg[c][k] || 0) + r.perHour[h][c][k] / hs.length; }
  console.log('== hours', hs.join(','), r.args);
  for (const c of Object.keys(agg).sort()) {
    const tot = Object.values(agg[c]).reduce((a, b) => a + b, 0);
    const items = Object.entries(agg[c]).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + Math.round(v)).join(' | ');
    console.log(' ' + c.padEnd(12), String(Math.round(tot)).padStart(6), ' ', items);
  }
}
