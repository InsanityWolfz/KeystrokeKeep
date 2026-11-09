// R6 market: how often does the always-on strip interrupt you? Wraps tools/playtest.js (real sim, scripted
// player) and counts the R5 alert events per hour of play: War Charge (wind-up 'deny' sound + 'slam' thump),
// void slam warnings/slams, boss enrage retreats, wipes. Also boss-fight lengths.
// node docs/playtest/round-06/market_probe/alert_rate.js --min 480 --profile idle --seed 6 --retire nudge --omen random
const Module = require('module');
const path = require('path');
const real = Module._load;
const counts = {}; const perHour = {}; let K = null; const fights = []; const open = new Map();
Module._load = function (req, parent, isMain) {
  const m = real.apply(this, arguments);
  if (/headless$/.test(req)) {
    return function (opts) {
      K = m(opts);
      const emit = K.emit;
      K.emit = function (ev, d) {
        if (['chargeWarn', 'warCharge', 'voidWarn', 'voidSlam', 'bossEnrage', 'wipe', 'bossSpawn', 'reassemble', 'bossSlam'].includes(ev)) {
          const h = Math.floor((K.S.stats.playTime || 0) / 3600);
          counts[ev] = (counts[ev] || 0) + 1;
          (perHour[h] = perHour[h] || {})[ev] = (perHour[h][ev] || 0) + 1;
        }
        if (ev === 'bossSpawn' && d && d.e) open.set(d.e, K.S.stats.playTime);
        if ((ev === 'kill' && d && d.e && d.e.boss) || ev === 'bossEnrage') {
          const e = d && d.e; if (e && open.has(e)) { fights.push({ secs: Math.round(K.S.stats.playTime - open.get(e)), key: e.key, end: ev === 'kill' ? 'kill' : 'enrage' }); open.delete(e); }
        }
        return emit.apply(this, arguments);
      };
      return K;
    };
  }
  return m;
};
const origLog = console.log; let quiet = true; console.log = (...a) => { if (!quiet) origLog(...a); };
process.on('exit', () => {
  quiet = false;
  const hours = Math.max(1, Math.ceil((K && K.S.stats.playTime || 0) / 3600));
  const rate = {}; for (const k in counts) rate[k] = +(counts[k] / hours).toFixed(1);
  const sorted = fights.map((f) => f.secs).sort((a, b) => a - b);
  const q = (p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : null;
  origLog(JSON.stringify({ args: process.argv.slice(2).join(' '), hours, counts, perHourAvg: rate, perHour, bossFights: fights.length, fightSecsP50: q(0.5), fightSecsP90: q(0.9), enrages: fights.filter((f) => f.end === 'enrage').length, enrageBy: fights.filter((f) => f.end === 'enrage').reduce((o, f) => { o[f.key] = (o[f.key] || 0) + 1; return o; }, {}) }));
});
require(path.join(__dirname, '..', '..', '..', '..', 'tools', 'playtest.js'));
