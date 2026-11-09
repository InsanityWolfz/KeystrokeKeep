// R6: Codex cadence from the 40 h dumps (out/d40_<prof>_<variant>.json): rank-up gaps and per-boss Hollowed kills.
const fs = require('fs');
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  console.log('== ' + f);
  d.forEach((p, i) => {
    const ts = p.codexT.map((c) => c.t / 3600);
    const gaps = []; let prev = 0; for (const t of ts) { gaps.push([prev, t - prev]); prev = t; } gaps.push([prev, 40 - prev]);
    const big = gaps.filter((g) => g[1] >= 3).map((g) => `${g[0].toFixed(1)}h+${g[1].toFixed(1)}h`);
    const kills = {}; const at = { 8: {}, 16: {}, 24: {}, 40: {} };
    for (const b of p.bf) if (b.hollow && b.out === 'won') { const k = b.floor === 70 || b.floor === 100 ? 'hollow' : b.key; kills[k] = (kills[k] || 0) + 1; }
    console.log(`  seed${i + 1}: ranks ${ts.length}; rank times ${ts.map((t) => t.toFixed(1)).join(' ')}; droughts >=3h: ${big.join(', ') || 'none'}; Hollowed kills by boss (40h): ${JSON.stringify(kills)}`);
  });
}
