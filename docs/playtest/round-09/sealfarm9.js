// T1 economist, round 09: Seal of the Day abuse checks on the real sim.
// 1) stale star: a delve started under day d's star must not pay a Seal on day d+1.
// 2) clock farmer: after an honest 8 h day 1, every time a Seal lands the player moves the PC clock one day forward
//    and re-delves at once (free re-delve or retire), vs an honest player with the same seed. Same 8 h of play.
// node sealfarm9.js --profile typist --seed 1 [--mode honest|farm|stale] [--hours 8]
const { load, makePlayer } = require('../round-06/econ6lib');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = v; i++; } } }
const PROF = args.profile || 'typist', SEED = +(args.seed || 1), MODE = args.mode || 'honest', H = +(args.hours || 8);
const KK = load({ seed: SEED });
const W = KK.world, A = KK.actions;
let day = 1; KK.today = () => 'd' + day;
let sealed = false, lastSealPT = -1e9;
const GAP = +(args.gap || 0), WAIT = +(args.wait || 0) * 60;
if (GAP) { const sf = A.sealFloor; A.sealFloor = () => (KK.S.stats.playTime - lastSealPT < GAP ? Infinity : sf()); }
const log = { seals: [], sealVal: 0, retires: 0, redelves: 0, staleClaim: 0 };
KK.on('seal', ({ v }) => { sealed = true; lastSealPT = KK.S.stats.playTime; log.seals.push(+((KK.S.stats.playTime - 8 * 3600) / 60).toFixed(0)); log.sealVal += v; });
const P = makePlayer(KK, { profile: PROF, retire: 'nudge', glance: 60,
  retirePolicy: (K, PP) => {
    const s = K.S;
    if (MODE === 'farm' && PP.t > 8 * 3600 && sealed && K.S.stats.playTime - lastSealPT >= WAIT) { sealed = false; day++; if (A.canRetire()) { if (A.renownGain() <= 0) log.redelves++; return true; } }
    const stall = PP.t - PP.lastMaxT > 8 * 60;
    return A.canRetire() && (PP.nudge() || stall);
  } });
P.chooseOmen = () => { const s = KK.S; if (!s.omenOffer) return; A.pickOmen(s.omenStar || s.omenOffer[Math.floor(KK.rng() * 3)]); };
W.reset();
// day 1 honest
while (P.t < 8 * 3600) P.step(1 / 30);
const r0 = KK.S.renownLifetime, f0 = KK.S.maxFloorEver, s0 = KK.S.seals;
if (MODE === 'stale') {
  // play on day 2 until a retire hands out the day-2 star, then flip to day 3 before the Seal floor is reached
  day = 2; let flipped = false, claimedAfterFlip = 0, reachedSealFloor = false;
  let staleDelve = true, staleClaims = 0; KK.on('seal', () => { if (flipped && staleDelve) claimedAfterFlip++; if (KK.S.omenStarDay !== KK.today()) staleClaims++; });
  KK.on('retired', () => { if (flipped) staleDelve = false; if (!flipped && KK.S.omenStar) { day = 3; flipped = true; } });
  while (P.t < 8 * 3600 + 4 * 3600) { P.step(1 / 30); if (flipped && staleDelve && KK.S.floor >= A.sealFloor()) reachedSealFloor = true; }
  console.log(JSON.stringify({ prof: PROF, seed: SEED, mode: MODE, flipped, reachedSealFloor, claimedAfterFlip, staleClaims, sealsDay3: KK.S.seals - s0 }));
  process.exit(0);
}
day = 2;
while (P.t < (8 + H) * 3600) P.step(1 / 30);
const S = KK.S;
console.log(JSON.stringify({ prof: PROF, seed: SEED, mode: MODE, hours: H, renown: S.renownLifetime - r0, floor: S.maxFloorEver, dFloor: S.maxFloorEver - f0, seals: S.seals - s0, sealVal: log.sealVal, redelves: log.redelves, daysUsed: day - 1, sealMin: log.seals.slice(0, 12).join(','), achSeals: ['seals7', 'seals30'].filter((id) => S.ach[id]).join(',') }));
