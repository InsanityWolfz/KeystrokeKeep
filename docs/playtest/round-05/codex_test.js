// Round 05 auditor: week-2 candidates measured on unmodified 40 h runs (no game file touched).
//  - Hollow Codex: mastery ranks per Hollowed boss (6 Hollowed + The Hollow) at kill thresholds; when do ranks land?
//  - Speedrunner replacement: per-delve run time to first reach floors 60/80/100 after a retire.
// node docs/playtest/round-05/codex_test.js [min] > out/codex_test.txt
const { run, fmtT, gap } = require('./r5lib');
const MIN = +process.argv[2] || 2400;
const TH = [3, 10, 20, 40];
const configs = [{ profile: 'typist', seed: 1 }, { profile: 'typist', seed: 2 }, { profile: 'light', seed: 1 }, { profile: 'idle', seed: 1 }];
const L = [];
for (const c of configs) {
  const reach = []; // { r: retires, floor, rt }
  const R = run(Object.assign({ min: MIN, retire: 'nudge', omen: 'random', patch: (KK) => { KK.on('floor', ({ floor }) => { if ([60, 80, 100, 120].includes(floor) && KK.S.retires >= 1) reach.push({ r: KK.S.retires, floor, rt: KK.S.runTime || 0 }); }); } }, c));
  const end = R.end.t, H = 3600;
  const kills = {};
  for (const f of R.boss) if (f.how === 'kill' && (f.hollowed || f.key === 'hollow')) (kills[(f.hollowed ? 'H-' : '') + f.key] = kills[(f.hollowed ? 'H-' : '') + f.key] || []).push(f.t0 + f.dur);
  const ranks = [];
  for (const [k, ts] of Object.entries(kills)) TH.forEach((th, i) => { if (ts.length >= th) ranks.push({ t: ts[th - 1], k, rank: i + 1 }); });
  ranks.sort((a, b) => a.t - b.t);
  const base = R.nov.filter((n) => n.kind !== 'minor');
  const after = (list, h) => list.filter((n) => n.t >= h * H).length;
  const gBase = gap(base, 8 * H, end), gCod = gap([...base, ...ranks], 8 * H, end);
  L.push(`=== ${c.profile} s${c.seed} ${MIN}m: maxEver ${R.end.maxEver}`);
  L.push(`  Hollowed kills by key: ${Object.entries(kills).map(([k, ts]) => k + ' ' + ts.length).join(', ')}`);
  L.push(`  Codex rank-ups (thresholds ${TH.join('/')}): total ${ranks.length} of ${7 * TH.length}; after 8h ${after(ranks, 8)}, after 16h ${after(ranks, 16)}; per 8h block: ${[0, 8, 16, 24, 32].map((h) => ranks.filter((x) => x.t >= h * H && x.t < (h + 8) * H).length).join(' / ')}`);
  L.push(`  rank-up times: ${ranks.map((x) => fmtT(x.t) + ' ' + x.k + '#' + x.rank).join(', ')}`);
  L.push(`  longest beat gap after 8h: current ${(gBase.g / 60).toFixed(0)}m -> with Codex ${(gCod.g / 60).toFixed(0)}m; beats after 8h current ${after(base, 8)} -> ${after(base, 8) + after(ranks, 8)}`);
  for (const fl of [60, 80, 100, 120]) {
    const xs = reach.filter((x) => x.floor === fl);
    if (!xs.length) { L.push(`  run time to f${fl}: never`); continue; }
    const by = xs.map((x) => `r${x.r}:${(x.rt / 60).toFixed(0)}m`);
    L.push(`  run time to f${fl} (first delve that does it at ${by[0]}): min ${(Math.min(...xs.map((x) => x.rt)) / 60).toFixed(1)}m; first <20m at ${(() => { const y = xs.find((x) => x.rt < 1200); return y ? 'retire #' + y.r : 'never'; })()}, first <30m at ${(() => { const y = xs.find((x) => x.rt < 1800); return y ? 'retire #' + y.r : 'never'; })()}; all: ${by.slice(0, 30).join(' ')}`);
  }
  L.push(`  retire times: ${R.retires.map((r) => '#' + (R.retires.indexOf(r) + 1) + '@' + fmtT(r.t)).join(' ')}`);
}
console.log(L.join('\n'));
