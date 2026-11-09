// T1 economist, round 08: edge cases of the demo Glimpse (sealed floor 41) and slain boss floors, on the real sim.
// node chk_glimpse.js [retire|wipe|slain] [seed]
const load = require('../../../tools/headless');
const mode = process.argv[2] || 'retire', seed = +(process.argv[3] || 1);
const KK = load({ seed, demo: mode !== 'slain' });
const W = KK.world, A = KK.actions, S = () => KK.S, D = KK.DATA, F = KK.F;
W.reset();
const log = (m) => console.log(`${(S().stats.playTime / 60).toFixed(1)}m  f${S().floor}  ${m}`);
let wipes = 0, bossSpawns = {};
KK.on('wipe', (d) => { wipes++; if (wipes < 6 || wipes % 50 === 0) log(`WIPE #${wipes} on f${d.floor} glimpse=${S().glimpse}`); });
KK.on('glimpse', () => log('GLIMPSE opened'));
KK.on('demoComplete', () => log('demoComplete (card) demoDone=' + S().demoDone));
KK.on('bossSpawn', () => { bossSpawns[S().floor] = (bossSpawns[S().floor] || 0) + 1; });
KK.on('retired', ({ gain }) => log(`retired gain ${gain} glimpse=${S().glimpse} renown=${S().renown}`));
let typ = 0;
function spend() {
  const s = S();
  while (s.relicOffer) A.pickRelic(s.relicOffer[0]);
  for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) A.recruit(id);
  for (let i = 0; i < 400; i++) { let best = null, bc = Infinity; for (const id of D.PARTY_ORDER) { if (!s.heroes[id]) continue; const c = F.levelCost(id, s.heroes[id]); if (c < bc) { bc = c; best = id; } } if (best && bc <= s.gold) A.levelHero(best, 1); else break; }
  for (const d of D.FORGE) while (F.upCost(d, s.forge[d.id] || 0) < s.gold * 0.3 && (s.forge[d.id] || 0) < d.max) A.buyForge(d.id);
}
function run(sec, stop) {
  const end = S().stats.playTime + sec;
  let g = 0;
  while (S().stats.playTime < end) {
    typ += 1 / 30; if (typ > 0.25) { typ = 0; KK.addActivity('key'); }
    W.update(1 / 30); g += 1 / 30;
    if (g > 30) { g = 0; spend(); }
    if (stop && stop()) return true;
  }
  return false;
}
if (mode === 'retire' || mode === 'wipe') {
  run(3 * 3600, () => S().glimpse);
  log(`on the sealed floor: maxFloorRun ${S().maxFloorRun}, canRetire ${A.canRetire()}, renownGain ${A.renownGain()}`);
  if (mode === 'retire') {
    A.retire(); W.reset();
    log(`after retire: glimpse=${S().glimpse} floor ${S().floor}`);
    run(20 * 60);
    log(`20 min later: glimpse=${S().glimpse} maxFloorRun ${S().maxFloorRun} wipes ${wipes} gold ${Math.round(S().gold)} enemyHp ${W.enemies.filter((e) => !e.dead).map((e) => e.key + ':' + Math.round(e.hp)).join(',')}`);
  } else {
    for (const h of W.heroes) W.damageHero(h, 1e12);
    run(5);
    log(`after the forced wipe on the sealed floor: glimpse=${S().glimpse} floor ${S().floor} sealedX ${W.sealedX}`);
    run(5 * 60);
    log(`5 min later: glimpse=${S().glimpse} demoDone=${S().demoDone} floor ${S().floor} maxFloorRun ${S().maxFloorRun}`);
  }
} else {
  // full game: kill the f10 boss, then force a wipe on f11 -> recover to f10 -> is the boss back?
  run(3600, () => S().floor === 11 && S().stats.bossKills >= 1);
  log(`on f11 after the first boss (bossSpawns ${JSON.stringify(bossSpawns)})`);
  for (const h of W.heroes) W.damageHero(h, 1e12);
  run(90, () => S().floor === 11);
  log(`after wipe+recover: bossSpawns on f10 = ${bossSpawns[10]}, boss kills ${S().stats.bossKills}, relic offers pending ${S().relicOffer ? 1 : 0}`);
}
