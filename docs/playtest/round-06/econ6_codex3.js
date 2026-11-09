// R6: Codex alternatives replayed on the recorded Hollowed-kill timelines (40 h dumps). Shipped: per boss 3/10/20/40 (x7).
// Note: replays kill times from the shipped runs, so it ignores the (small) feedback of a different Codex on depth.
const fs = require('fs');
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const designs = {
  shipped: null,
  'every10': (k) => 10 * k,
  'every8': (k) => 8 * k,
  'pow': (k) => Math.round(2 * Math.pow(k, 1.45)),
};
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  console.log('== ' + f);
  for (const [name, T] of Object.entries(designs)) {
    const per = d.map((p) => {
      let rt;
      if (!T) rt = p.codexT.map((c) => c.t / 3600);
      else { const kt = p.bf.filter((b) => b.hollow && b.out === 'won').map((b) => (b.start + b.wall) / 3600).sort((a, b) => a - b); rt = []; for (let k = 1; k <= 28; k++) if (kt.length >= T(k)) rt.push(kt[T(k) - 1]); }
      const at = (h) => rt.filter((t) => t <= h).length;
      let prev = rt[0] || 40, gap = 0; for (const t of rt.slice(1).concat([40])) { gap = Math.max(gap, t - prev); prev = t; }
      return { r8: at(8), r16: at(16), r24: at(24), r40: at(40), first: rt[0], gap };
    });
    console.log(`  ${name.padEnd(8)} ranks @8h ${avg(per.map((x) => x.r8)).toFixed(1)} @16h ${avg(per.map((x) => x.r16)).toFixed(1)} @24h ${avg(per.map((x) => x.r24)).toFixed(1)} @40h ${avg(per.map((x) => x.r40)).toFixed(1)} | first ${avg(per.map((x) => x.first || 40)).toFixed(1)}h | longest gap between ranks ${avg(per.map((x) => x.gap)).toFixed(1)}h`);
  }
}
