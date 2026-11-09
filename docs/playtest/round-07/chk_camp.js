// Round 07: does a stale S.campFloor (left over from a normal-floor camp, never cleared on retire or on timeout)
// redirect a later boss "regroup" away from the boss wall? Counts regroups and what the wall actually was.
// node chk_camp.js <profile> <seed> <min>
const { run } = require('../round-06/r6lib');
const [profile = 'idle', seed = 1, min = 2400] = process.argv.slice(2);
const P = { regroups: 0, stale: 0, staleGap: [], campFloorAtRetire: 0, retires: 0, bossTriesDuringRegroup: 0, regroupActive: 0 };
const R = run({ profile, seed: +seed, min: +min, patch: (KK, hooks) => {
  KK.on('regroup', ({ floor }) => { P.regroups++; const s = KK.S; if ((s.campFloor || 0) > floor) { P.stale++; P.staleGap.push(s.campFloor - floor); } });
  KK.on('retired', () => { P.retires++; if (KK.S.campFloor) P.campFloorAtRetire++; });
  KK.on('bossSpawn', () => { const s = KK.S; if ((s.campUntil || 0) > s.stats.playTime && s.bossBlock === s.floor) P.bossTriesDuringRegroup++; });
} });
console.log(`${profile} s${seed} ${min}m: regroups ${P.regroups}, with a stale campFloor above the boss wall ${P.stale} (gaps ${P.staleGap.join(',')}) | retires ${P.retires}, campFloor still set at retire ${P.campFloorAtRetire} | boss re-fights at the wall while a regroup timer runs ${P.bossTriesDuringRegroup} | maxEver ${R.end.maxEver}`);
