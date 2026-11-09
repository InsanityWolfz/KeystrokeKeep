// Round 07: a normal-floor wipe on floor X1 (right after a boss floor) camps the party "one floor below" = the boss floor,
// so the boss it already beat is fought (and killed) again and again: extra relic offers, Embers, Codex kills, Blitz.
// node chk_bossloop.js <profile> <seed> <min> [demo]
const { run } = require('../round-06/r6lib');
const [profile = 'idle', seed = 1, min = 480, demo] = process.argv.slice(2);
const P = { bossKills: 0, repeat: 0, repeatHollowed: 0, repeatOffers: 0, loops: 0, maxRun: 0, campOnBoss: 0, blitzAt: null };
let lastKillFloor = -1, run1 = 0;
const R = run({ profile, seed: +seed, min: +min, demo: !!demo, patch: (KK, hooks) => {
  KK.on('kill', ({ e }) => {
    if (!e.boss) return;
    P.bossKills++;
    const f = KK.S.floor;
    if (f === lastKillFloor && !(KK.DEMO_CAP && f === 40)) { P.repeat++; run1++; if (e.hollowed || e.key === 'hollow') P.repeatHollowed++; P.repeatOffers++; if (run1 === 1) P.loops++; P.maxRun = Math.max(P.maxRun, run1 + 1); }
    else run1 = 0;
    lastKillFloor = f;
  });
  KK.on('retired', () => { lastKillFloor = -1; run1 = 0; });
  KK.on('wipe', ({ floor }) => { if (!KK.F.isBossFloor(floor) && KK.F.isBossFloor(floor - 1)) P.campOnBoss++; });
  KK.on('achievement', ({ id }) => { if (id === 'blitz') P.blitzAt = hooks.time(); });
} });
console.log(`${profile} s${seed} ${min}m${demo ? ' DEMO' : ''}: boss kills ${P.bossKills}, repeat kills of the boss just beaten (same floor, same delve) ${P.repeat} (Hollowed ${P.repeatHollowed}) in ${P.loops} loops, longest loop ${P.maxRun} kills | wipes on the floor right after a boss floor ${P.campOnBoss} | blitz at ${P.blitzAt === null ? 'never' : (P.blitzAt / 3600).toFixed(2) + 'h'} | maxEver ${R.end.maxEver} codex kills ${R.KK.S.codexKills || 0}`);
