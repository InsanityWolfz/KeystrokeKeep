// T1 economist, round 08: runs tools/playtest.js unchanged with extra telemetry, prints one JSON line.
// Env options (all optional, nothing in js/ is edited):
//   KKCLICK=1  -> a glance that buys something registers one 'click' activity (the real UI does: every
//                 mousedown counts, in the browser and through the Electron global hook). Quartermaster's
//                 own buys (inside world.update) never count.
//   KKV='{"caution":0}' -> in-memory variants: caution:0 disables the caution rule (lastInputAgo forced <30 inside nextFloor)
// node docs/playtest/round-08/pt8.js --min 60 --profile idle --seed 1 --demo --retire nudge --omen random
const Module = require('module'); const path = require('path'); const real = Module._load;
const V = process.env.KKV ? JSON.parse(process.env.KKV) : {};
const CLICK = +process.env.KKCLICK || 0;
const MOUSE = +process.env.KKMOUSE || 0; // a desk worker using the mouse: one global click every ~MOUSE s (Electron counts every mousedown)
const T = { wipes: [], glimpseT: null, demoT: null, peekT: null, cautious: 0, cautBack: 0, bossKills: 0, bossRepeat: 0, killed: {}, enrages: 0, regroups: 0, clicks: 0, firstRetire: null, renownAt: {}, laps: [] };
let K, inUpd = false;
Module._load = function (req) {
  const m = real.apply(this, arguments);
  if (/headless$/.test(req)) return (o) => {
    K = m(o);
    const W = K.world, A = K.actions;
    let mAcc = 0, mNext = MOUSE, mr = 12345;
    const mrand = () => { mr = (mr * 1103515245 + 12345) & 0x7fffffff; return mr / 0x7fffffff; };
    const ou = W.update; W.update = function (dt) { if (MOUSE) { mAcc += dt; if (mAcc >= mNext) { mAcc = 0; mNext = MOUSE * (0.3 + 1.4 * mrand()); K.addActivity('click'); } } inUpd = true; try { return ou.call(this, dt); } finally { inUpd = false; } };
    let lastClick = -1;
    for (const fn of ['recruit', 'levelHero', 'buyForge', 'buyWorkshop', 'buyLegacy', 'pickRelic']) {
      const of = A[fn]; A[fn] = function () { const r = of.apply(this, arguments); if (r && CLICK && !inUpd && (K.simTime || 0) - lastClick > 0.5) { lastClick = K.simTime || 0; T.clicks++; K.addActivity('click'); } return r; };
    }
    if (V.caution === 0) { const on = W.nextFloor; W.nextFloor = function () { const l = K.lastInputAgo; K.lastInputAgo = () => 0; try { return on.call(this); } finally { K.lastInputAgo = l; } }; }
    // caution variants: 'always' (ignore input), 'keys' (only keystrokes count as input), 'hybrid' (typing skips only the 60% replay;
// the 35% step-back and the 85% pre-boss check apply to everyone)
    let lastKeyT = 0; const oa = K.addActivity; K.addActivity = function (k) { if (k === 'key') lastKeyT = K.simTime || 0; return oa.apply(this, arguments); };
    if (V.caution === 'always' || V.caution === 'keys' || V.caution === 'hybrid') {
      const on = W.nextFloor; W.nextFloor = function () {
        const l = K.lastInputAgo, low = W.floorLow === undefined ? 1 : W.floorLow, f = K.S.floor;
        let ago;
        if (V.caution === 'always') ago = 999;
        else if (V.caution === 'keys') ago = (K.simTime || 0) - lastKeyT;
        else { const typing = (K.simTime || 0) - lastKeyT < 30; ago = !typing || low < 0.35 || (K.F.isBossFloor(f + 1) && low < 0.85) ? 999 : 0; }
        K.lastInputAgo = () => ago; try { return on.call(this); } finally { K.lastInputAgo = l; }
      };
    }
    const onf = W.nextFloor; W.nextFloor = function () { const f0 = K.S.floor; const r = onf.call(this); if (W.cautious) { T.cautious++; if (K.S.floor < f0) T.cautBack++; } return r; };
    const e = K.emit;
    K.emit = function (ev, d) {
      const t = K.S.stats.playTime;
      if (ev === 'wipe') T.wipes.push([+(t / 60).toFixed(1), d.floor, d.reason === 'enrage' ? 'E' : (K.F.isBossFloor(d.floor) ? 'B' : 'N')]);
      if (ev === 'glimpse' && T.glimpseT === null) T.glimpseT = t;
      if (ev === 'demoComplete') { if (d && d.peek) { if (T.peekT === null) T.peekT = t; } else if (T.demoT === null) T.demoT = t; }
      if (ev === 'kill' && d.e.boss) { T.bossKills++; const f = K.S.floor; if (T.killed[f]) T.bossRepeat++; T.killed[f] = 1; }
      if (ev === 'retired') { T.killed = {}; if (T.firstRetire === null) T.firstRetire = +(t / 60).toFixed(1); T.laps.push(+(t / 60).toFixed(1)); }
      if (ev === 'bossEnrage') T.enrages++;
      if (ev === 'regroup') T.regroups++;
      return e.apply(this, arguments);
    };
    return K;
  };
  return m;
};
const ol = console.log; let out = '';
console.log = (s) => { out += s + '\n'; };
const marks = [60, 120, 180, 240];
process.on('exit', () => {
  const S = K.S;
  const best = (out.match(/best f40: ([\d.]+) min/) || [])[1];
  const h1 = T.wipes.filter((w) => w[0] < 60);
  ol(JSON.stringify({
    v: V, click: CLICK, args: process.argv.slice(2).join(' '),
    h1: h1.length, h1N: h1.filter((w) => w[2] === 'N').length, h1B: h1.filter((w) => w[2] === 'B').length, h1E: h1.filter((w) => w[2] === 'E').length,
    first: T.wipes.length ? T.wipes[0][0] : null, under10: T.wipes.filter((w) => w[0] < 10).length, total: T.wipes.length,
    glimpse: T.glimpseT ? +(T.glimpseT / 60).toFixed(1) : null, card: T.demoT ? +(T.demoT / 60).toFixed(1) : null, peek: T.peekT ? +(T.peekT / 60).toFixed(1) : null,
    bestLap: best ? +best : null, laps: S.demoLaps || 0, maxEver: S.maxFloorEver, renown: S.renownLifetime, retires: S.retires, firstRetire: T.firstRetire, retireAt: T.laps.join(','),
    headstart: S.legacy.headstart || 0, cautious: T.cautious, cautBack: T.cautBack, clicks: T.clicks, enrages: T.enrages, regroups: T.regroups, bossKills: T.bossKills, bossRepeat: T.bossRepeat,
    list: h1.map((w) => w[0] + 'm' + w[2] + w[1]).join(' '),
    end: (out.match(/^END .*$/m) || [''])[0],
  }));
});
require(path.join(__dirname, '..', '..', '..', 'tools', 'playtest.js'));
