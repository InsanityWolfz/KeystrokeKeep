// R7 market: hour-1 wipes/KOs (onboarding grace check) + raw slam-thump triggers before the 8 s limiter.
// node docs/playtest/round-07/market_probe/wipes_thumps.js --min 60 --profile idle --seed 6 --demo --retire nudge --omen random
const Module = require('module'); const path = require('path'); const real = Module._load; const w = []; const ko = []; const thump = {}; let K;
Module._load = function (req) { const m = real.apply(this, arguments); if (/headless$/.test(req)) return (o) => { K = m(o); const e = K.emit; K.emit = function (ev, d) {
  const min = Math.round(K.simTime / 60), h = Math.floor(K.simTime / 3600);
  if (ev === 'wipe') w.push(min + 'm@f' + d.floor + (d.reason ? '(' + d.reason + ')' : ''));
  if (ev === 'heroDown') ko.push(min);
  if (ev === 'bossSlam' || ev === 'warCharge' || (ev === 'voidSlam' && ((d.e.slams || 0) + 1) <= 3)) { const t = (thump[h] = thump[h] || { n: 0, times: [] }); t.n++; t.times.push(K.simTime); }
  return e.apply(this, arguments); }; return K; }; return m; };
const ol = console.log; console.log = () => {};
process.on('exit', () => {
  // replay the 8 s limiter on the raw trigger times
  const lim = {}; for (const h in thump) { let last = -1e9, n = 0; for (const t of thump[h].times) if (t - last >= 8) { n++; last = t; } lim[h] = [thump[h].n, n]; }
  ol(JSON.stringify({ args: process.argv.slice(2).join(' '), wipesHour1: w.filter((x) => parseInt(x) < 60).length, firstKOmin: ko.length ? ko[0] : null, koHour1: ko.filter((m) => m < 60).length, wipes: w.join(' '), thumpRawVsLimitedPerHour: lim }));
});
require(path.join(__dirname, '..', '..', '..', '..', 'tools', 'playtest.js'));
