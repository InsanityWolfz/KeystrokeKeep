// R7 market prototype (scratch, not game code): can the idle demo's hour-1 wipes reach <=4?
// VAR=A: after a normal-floor wipe, camp until +4 levels PER HERO (not +4 total).
// VAR=B: while the onboarding grace props a hero up (3 saves on one normal floor), camp silently one floor below (no wipe).
// VAR=AB: both.  VAR=none: HEAD.   node proto_camp.js --min 60 --profile idle --seed 6 --demo --retire nudge --omen random
const Module = require('module'); const path = require('path'); const real = Module._load; const V = process.env.VAR || 'none';
const w = []; let K, firstBoss = null; let floor60 = null;
Module._load = function (req) { const m = real.apply(this, arguments); if (!/headless$/.test(req)) return m; return (o) => {
  K = m(o); const W = K.world, D = K.DATA, F = K.F;
  const lv = () => D.PARTY_ORDER.reduce((a, id) => a + (K.S.heroes[id] || 0), 0);
  const size = () => D.PARTY_ORDER.filter((id) => K.S.heroes[id] > 0).length;
  const ow = W.wipe; W.wipe = function (r) { const before = W.wipeT; ow.call(this, r); if (before <= 0 && (V === 'A' || V === 'AB') && !F.isBossFloor(K.S.floor) && r !== 'enrage') K.S.campLevels = lv() + 4 * size(); };
  let saves = 0, saveFloor = 0;
  const od = W.damageHero; W.damageHero = function (h, dmg, src) { const hp0 = h.hp; od.call(this, h, dmg, src);
    if ((V === 'B' || V === 'AB') && !h.dead && hp0 - dmg <= 0 && h.hp === 1 && !F.isBossFloor(K.S.floor)) {
      if (saveFloor !== K.S.floor) { saveFloor = K.S.floor; saves = 0; }
      if (++saves === 3 && !(K.S.campUntil > K.S.stats.playTime)) { K.S.campFloor = K.S.floor; K.S.campUntil = K.S.stats.playTime + 480; K.S.campLevels = lv() + 4 * (V === 'AB' ? size() : 1); }
    } };
  const e = K.emit; K.emit = function (ev, d) { if (ev === 'wipe') w.push(Math.round(K.simTime / 60) + 'm@f' + d.floor); if (ev === 'kill' && d.e.boss && firstBoss === null) firstBoss = +(K.simTime / 60).toFixed(1); return e.apply(this, arguments); };
  const up = W.update; W.update = function (dt) { up.call(this, dt); if (floor60 === null && K.simTime >= 3599) floor60 = K.S.maxFloorRun; };
  return K; }; };
const ol = console.log; console.log = () => {};
process.on('exit', () => ol(JSON.stringify({ V, args: process.argv.slice(2).join(' '), wipesH1: w.filter((x) => parseInt(x) < 60).length, firstBossMin: firstBoss, maxFloorAt60: floor60, demoDone: K.S.demoDone, wipes: w.join(' ') })));
require(path.join(__dirname, '..', '..', '..', '..', 'tools', 'playtest.js'));
