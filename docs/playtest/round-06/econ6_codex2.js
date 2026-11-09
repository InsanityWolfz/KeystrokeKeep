// R6: total Hollowed kills over time (40 h dumps) and a smooth single-track Codex proposal.
const fs = require('fs');
const marks = [2, 4, 6, 8, 12, 16, 20, 24, 32, 40];
const prop = (k) => Math.round(2 * Math.pow(k, 1.45)); // proposal: Codex rank k at this many total Hollowed kills
console.log('proposal thresholds: ' + Array.from({ length: 28 }, (_, i) => prop(i + 1)).join(' '));
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const rows = d.map((p) => { const kt = p.bf.filter((b) => b.hollow && b.out === 'won').map((b) => (b.start + b.wall) / 3600).sort((a, b) => a - b); return kt; });
  console.log('== ' + f + '\n  total Hollowed kills at ' + marks.map((h) => `${h}h:${(rows.reduce((a, kt) => a + kt.filter((t) => t <= h).length, 0) / rows.length).toFixed(0)}`).join(' '));
  rows.forEach((kt, i) => {
    const rt = []; for (let k = 1; k <= 28; k++) { const n = prop(k); if (kt.length >= n) rt.push(kt[n - 1]); }
    const gaps = []; let prev = rt[0] || 0; for (const t of rt.slice(1)) { gaps.push(t - prev); prev = t; }
    console.log(`  seed${i + 1} proposal: ${rt.length} ranks by 40h; first ${rt[0] ? rt[0].toFixed(1) : '-'}h; 7th ${rt[6] ? rt[6].toFixed(1) : '-'}h; 14th ${rt[13] ? rt[13].toFixed(1) : '-'}h; 21st ${rt[20] ? rt[20].toFixed(1) : '-'}h; max gap after rank 1 ${Math.max(...gaps, 40 - prev).toFixed(1)}h`);
  });
}
