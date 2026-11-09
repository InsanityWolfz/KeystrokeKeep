// R6 regroup check (base game): does every regroup really hold the party off the boss for 10 min?
// Logs regroups whose boss re-fight comes < 590 s later, with the camp state that explains it.
const { load, makePlayer } = require('../round-06/econ6lib');
const prof = process.argv[2] || 'typist', H = +(process.argv[3] || 8), seeds = (process.argv[4] || '1-10').split('-').map(Number);
let tot = 0, early = 0; const why = {};
for (let s = seeds[0]; s <= seeds[1]; s++) {
  const KK = load({ seed: s }); KK.world.reset();
  let rg = null;
  KK.on('regroup', ({ floor }) => { const S = KK.S; tot++; rg = { t: S.stats.playTime, floor, campFloor: S.campFloor || 0, campLevels: S.campLevels || 0, lv: KK.DATA.PARTY_ORDER.reduce((a, id) => a + (S.heroes[id] || 0), 0) }; });
  KK.on('bossSpawn', () => { const S = KK.S; if (rg && S.floor === rg.floor) { const gap = S.stats.playTime - rg.t; if (gap < 590) { early++; const k = rg.campFloor > rg.floor ? 'stale campFloor > boss floor (wall ignored)' : rg.campFloor && rg.campLevels ? 'normal-floor camp exit zeroed campUntil' : 'other'; why[k] = (why[k] || 0) + 1; if (early <= 6) console.log(`  s${s} ${(rg.t / 3600).toFixed(2)}h regroup f${rg.floor} -> refight after ${gap.toFixed(0)} s; campFloor ${rg.campFloor} campLevels ${rg.campLevels} (party lv ${rg.lv})`); } rg = null; } });
  KK.on('retired', () => { rg = null; });
  const P = makePlayer(KK, { profile: prof, retire: 'nudge', omen: 'random' });
  P.run(H * 3600);
}
console.log(`${prof} ${H}h: regroups ${tot}, boss re-fought before 10 min: ${early}`, JSON.stringify(why));
