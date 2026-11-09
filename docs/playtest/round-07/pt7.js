// T1 economist, round 07: runs tools/playtest.js unchanged, with an optional in-memory variant (KKV='{"caution":0.4}')
// and extra telemetry, then prints one JSON line. Same method as round-06/market_probe/wipe_floors.js (the market gate).
// node docs/playtest/round-07/pt7.js --min 60 --profile idle --seed 1 --demo --retire nudge --omen random
const Module = require('module'); const path = require('path'); const real = Module._load;
const { apply } = require('./r7patch');
const V = process.env.KKV ? JSON.parse(process.env.KKV) : null;
const T = { bossKills: 0, bossRepeat: 0, killed: {}, maxRelics: 0, relicsAtRetire: [], repeatFloors: {}, wipes: [], demoT: null, enrages: 0, regroups: 0, sig: {}, codex: [], ach: {}, holds: 0 };
let K;
Module._load = function (req) {
  const m = real.apply(this, arguments);
  if (/headless$/.test(req)) return (o) => {
    K = m(o); apply(K, V);
    const e = K.emit;
    K.emit = function (ev, d) {
      const t = K.S.stats.playTime;
      if (ev === 'wipe') T.wipes.push([+(t / 60).toFixed(1), d.floor, d.reason === 'enrage' ? 'E' : (K.F.isBossFloor(d.floor) ? 'B' : 'N')]);
      if (ev === 'demoComplete') T.demoT = t;
      if (ev === 'kill' && d.e.boss) { T.bossKills++; const f = K.S.floor; if (T.killed[f]) { T.bossRepeat++; T.repeatFloors[f % 10 === 0 ? f : 'x'] = (T.repeatFloors[f] || 0) + 1; } T.killed[f] = 1; }
      if (ev === 'retired') { T.relicsAtRetire.push(K.S.relics.length); T.killed = {}; }
      if (ev === 'relicPicked') T.maxRelics = Math.max(T.maxRelics, K.S.relics.length + 1);
      if (ev === 'bossEnrage') T.enrages++;
      if (ev === 'regroup') T.regroups++;
      if (ev === 'codex') T.codex.push(+(t / 3600).toFixed(2));
      if (ev === 'achievement' && !(d.id in T.ach)) T.ach[d.id] = +(t / 60).toFixed(1);
      if (['royalSummons', 'webShot', 'webbed', 'webTorn', 'magmaShell', 'shellCrack', 'lavaRain', 'warCharge', 'reassemble'].includes(ev)) T.sig[ev] = (T.sig[ev] || 0) + 1;
      return e.apply(this, arguments);
    };
    return K;
  };
  return m;
};
const ol = console.log; let out = '';
console.log = (s) => { out += s + '\n'; };
process.on('exit', () => {
  const S = K.S;
  const endLine = (out.match(/^END .*$/m) || [''])[0];
  const best = (out.match(/best f40: ([\d.]+) min/) || [])[1];
  const h1 = T.wipes.filter((w) => w[0] < 60);
  ol(JSON.stringify({
    v: V, args: process.argv.slice(2).join(' '),
    h1: h1.length, h1N: h1.filter((w) => w[2] === 'N').length, h1B: h1.filter((w) => w[2] === 'B').length, h1E: h1.filter((w) => w[2] === 'E').length,
    first: T.wipes.length ? T.wipes[0][0] : null, under10: T.wipes.filter((w) => w[0] < 10).length,
    total: T.wipes.length, enrages: T.enrages, regroups: T.regroups, cardMin: T.demoT ? +(T.demoT / 60).toFixed(1) : null, bestLap: best ? +best : null,
    maxEver: S.maxFloorEver, renown: S.renownLifetime, retires: S.retires, laps: S.demoLaps || 0, holds: K.cautionHolds || 0,
    bossKills: T.bossKills, bossRepeat: T.bossRepeat, maxRelics: T.maxRelics, relicsAtRetire: T.relicsAtRetire.join(','), relicsNow: S.relics.length, sig: T.sig, codex: T.codex, ach: T.ach,
    list: h1.map((w) => w[0] + 'm' + w[2] + w[1]).join(' '), end: endLine,
  }));
});
require(path.join(__dirname, '..', '..', '..', 'tools', 'playtest.js'));
