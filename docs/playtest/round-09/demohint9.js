// T1 economist, round 09: demo "Stuck? Retire" hint follower. A player who retires whenever the HUD hint shows
// (ui.js slowUpdate: boss-blocked or 5-min stall, and renownGain >= hintMin), vs a player who ignores it.
// node demohint9.js --profile idle --seed 1 --hint 25|10|off [--glance 60] [--min 180]
const { load, makePlayer } = require('../round-06/econ6lib');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = v; i++; } } }
const PROF = args.profile || 'idle', SEED = +(args.seed || 1), HINT = args.hint || '25', MIN = +(args.min || 180);
const KK = load({ seed: SEED, demo: true });
const W = KK.world, A = KK.actions;
let lastMax = 0, lastMaxT = 0, lastBK = 0;
const r = { glimpse: null, early: [], laps: 0 };
KK.on('glimpse', () => { if (r.glimpse === null) r.glimpse = +(KK.S.stats.playTime / 60).toFixed(1); });
const P = makePlayer(KK, { profile: PROF, glance: +(args.glance || 60), retirePolicy: (K, PP) => {
  const S = K.S;
  if (S.maxFloorRun !== lastMax || W.boss || S.stats.bossKills !== lastBK) { lastMax = S.maxFloorRun; lastBK = S.stats.bossKills; lastMaxT = S.stats.playTime; }
  if (S.demoDone) return A.canRetire() && (PP.nudge() || (S.runCapCleared && A.renownGain() > 0));
  if (HINT === 'off' || !A.canRetire()) return false;
  const g = A.renownGain(), hintMin = +HINT;
  const stalled = S.stats.playTime - lastMaxT > 300 && g >= 10;
  const blocked = !!(S.bossBlock && S.floor < S.bossBlock) || stalled;
  if (args.no40 && (S.bossBlock === 40 || S.maxFloorRun >= 38)) return false;
  if (blocked && g >= hintMin) { r.early.push(`${(S.stats.playTime / 60).toFixed(0)}m f${S.maxFloorRun} +${g}`); return true; }
  return false;
} });
// the UI timer is updated every second; approximate by evaluating each step via a wrapper
const st = P.step; P.step = (dt) => { st(dt); const S = KK.S; if (S.maxFloorRun !== lastMax || W.boss || S.stats.bossKills !== lastBK) { lastMax = S.maxFloorRun; lastBK = S.stats.bossKills; lastMaxT = S.stats.playTime; } };
W.reset();
while (P.t < MIN * 60) P.step(1 / 30);
console.log(JSON.stringify({ prof: PROF, seed: SEED, hint: HINT, glimpse: r.glimpse, early: r.early.join('; '), nEarly: r.early.length, renown: KK.S.renownLifetime, laps: KK.S.demoLaps || 0 }));
