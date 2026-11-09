// T1 economist, round 07: one seeded run of the R6 smart-spend player (round-06/econ6lib.js) on the real sim,
// with an optional r7patch variant. Prints one JSON line. Use econ7batch.js to run many in parallel.
// node econ7.js --profile idle --hours 8 --seed 1 [--v base] [--omen random]
const { load, makePlayer } = require('../round-06/econ6lib');
const { apply } = require('./r7patch');
const VARS = require('./variants');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = v; i++; } } }
const PROF = args.profile || 'typist', H = +(args.hours || 8), SEED = +(args.seed || 1), VN = args.v || 'base';
const KK = load({ seed: SEED, demo: !!args.demo });
apply(KK, VARS[VN] || JSON.parse(VN));
KK.world.reset();
const T = { regroups: [], wipesByH: {}, enrByH: {}, sig: {}, bossByH: {}, holds: 0, x1wipes: 0, repeatBoss: 0 };
let killed = {};
const h = () => Math.floor(KK.S.stats.playTime / 3600);
KK.on('regroup', ({ floor }) => T.regroups.push({ t: KK.S.stats.playTime, floor }));
KK.on('wipe', (d) => { const k = h(); if (d.reason === 'enrage') T.enrByH[k] = (T.enrByH[k] || 0) + 1; else T.wipesByH[k] = (T.wipesByH[k] || 0) + 1; if (d.floor % 10 === 1 && d.reason !== 'enrage') T.x1wipes++; });
KK.on('kill', ({ e }) => { if (e.boss) { const k = h(); T.bossByH[k] = (T.bossByH[k] || 0) + 1; if (killed[KK.S.floor]) T.repeatBoss++; killed[KK.S.floor] = 1; } });
KK.on('retired', () => { killed = {}; });
for (const ev of ['royalSummons', 'webShot', 'webbed', 'webTorn', 'magmaShell', 'shellCrack', 'lavaRain', 'warCharge', 'reassemble', 'bossEnrage']) KK.on(ev, () => { T.sig[ev] = (T.sig[ev] || 0) + 1; });
// regroup check: after a regroup, when is the boss fought again?
const regroupGap = [];
let lastRegroup = null;
KK.on('regroup', ({ floor }) => { lastRegroup = { t: KK.S.stats.playTime, floor }; });
KK.on('bossSpawn', () => { if (lastRegroup && KK.S.floor === lastRegroup.floor) { regroupGap.push(KK.S.stats.playTime - lastRegroup.t); lastRegroup = null; } });
KK.on('retired', () => { lastRegroup = null; });
const o = { profile: PROF, retire: 'nudge', omen: args.omen || 'random' };
if (args.omen === 'none') o.forceOmen = 'none';
const P = makePlayer(KK, o);
const cps = [1, 2, 4, 8, 16, 24, 40].filter((x) => x <= H).map((x) => x * 3600);
P.run(H * 3600, cps);
P.flushStreak();
const S = KK.S;
const fights = P.bf;
const st = P.streaks;
const out = {
  prof: PROF, h: H, seed: SEED, v: VN,
  cps: Object.fromEntries(Object.entries(P.cps).map(([k, c]) => [k / 3600, { floor: c.floor, renown: c.renown, codex: c.codex, wipes: c.wipes, enrages: c.enrages, retires: c.retires, dyn: c.ws.dynamo || 0, oc: c.ws.overcharge || 0 }])),
  floor: S.maxFloorEver, renown: S.renownLifetime, retires: S.retires, wipes: S.stats.wipes, enrages: P.enrages,
  maxStreak: st.length ? Math.max(...st.map((s) => s.n)) : 0, maxStreakMin: st.length ? Math.max(0, ...st.map((s) => (s.dt || 0) / 60)) : 0, streaks: st.length,
  codexT: P.codexT.map((c) => +(c.t / 3600).toFixed(2)), codexKills: S.codexKills || 0,
  ach: Object.fromEntries(Object.entries(P.ach).map(([k, v]) => [k, +(v / 60).toFixed(1)])),
  regroups: T.regroups.length, regroupGapMed: regroupGap.length ? regroupGap.sort((a, b) => a - b)[Math.floor(regroupGap.length / 2)] : null, regroupGapMin: regroupGap.length ? Math.min(...regroupGap) : null,
  wipesByH: T.wipesByH, enrByH: T.enrByH, bossByH: T.bossByH, sig: T.sig, x1wipes: T.x1wipes, repeatBoss: T.repeatBoss,
  fightsWon: fights.filter((f) => f.out === 'won').length, fightsLost: fights.filter((f) => f.out !== 'won').length,
  longFights: fights.filter((f) => f.out === 'won' && f.wall > 181).length, maxWinWall: Math.max(0, ...fights.filter((f) => f.out === 'won').map((f) => f.wall)),
  keys: S.stats.keys, ults: S.stats.ults, dynamo: S.workshop.dynamo || 0, embers: P.embersEarned,
  blockedMin: P.blockHollowT / 60,
};
console.log(JSON.stringify(out));
