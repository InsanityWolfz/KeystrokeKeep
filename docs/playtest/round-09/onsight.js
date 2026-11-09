// Round 09 auditor: "old saves past a goal unlock on sight" — for every counter achievement, build a save already
// past the goal (without the unlock), call KK.ach.progress(def) the way the Legacy panel does, and see if it unlocks.
const load = require('../round-08/r8load');
const KK = load({ seed: 1 }); const S = KK.S, D = KK.DATA;
const past = {
  blitz: () => { S.achP.blitzBest = 9; }, hollowed6: () => { S.achP.hollowed = ['ratking', 'boneking', 'broodmother', 'warlord', 'embergolem', 'magmalord']; },
  f100: () => { S.maxFloorEver = 120; }, codex28: () => { S.codexKills = 230; KK.dirty(); }, seals7: () => { S.seals = 8; }, seals30: () => { S.seals = 31; },
  f150: () => { S.maxFloorEver = 151; }, f125: () => { S.maxFloorEver = 130; }, retire10: () => { S.achP.bigRetires = 11; },
  omen10: () => { S.achP.omens = D.OMENS.map((o) => o.id); }, deep90: () => { S.achP.deepBest = 95; },
  legacy_all: () => { for (const d of D.LEGACY) if (d.max < 999) S.legacy[d.id] = d.max; KK.dirty(); }, crucible10: () => { S.workshop.crucible = 10; },
  lv100: () => { S.heroes.knight = 120; }, chests100: () => { S.stats.chests = 130; }, rats25: () => { S.stats.rats = 30; },
  keys10k: () => { S.stats.keys = 2e4; }, keys100k: () => { S.stats.keys = 2e5; }, flow1h: () => { S.stats.flowTime = 4000; }, flow10h: () => { S.stats.flowTime = 40000; }, ults1k: () => { S.stats.ults = 1200; },
};
for (const d of KK.ach.LIST.filter((x) => x.goal && x.cur)) {
  KK.S = KK.newState(); const s = KK.S; KK.dirty();
  // eslint-disable-next-line no-global-assign
  Object.assign(S, s); S.ach = {}; S.achP = {}; S.legacy = {}; S.workshop = {}; S.heroes = { knight: 1, archer: 0, mage: 0, cleric: 0 }; S.stats = Object.assign({}, s.stats); S.maxFloorEver = 1; S.seals = 0; S.codexKills = 0; KK.S = S; KK.dirty();
  (past[d.id] || (() => {}))();
  const cur = d.cur(S, S.achP); const p = KK.ach.progress(d);
  console.log(`${d.id.padEnd(11)} goal ${String(d.goal).padStart(6)} cur ${String(Math.round(cur)).padStart(6)} -> progress ${p ? p.txt : 'null'}; unlocked on sight: ${S.ach[d.id] ? 'YES' : 'NO'}`);
}
