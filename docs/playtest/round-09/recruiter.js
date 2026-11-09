// Round 09 auditor: what does Recruiter (8 Renown, recruits -75%) buy? Time from a fresh delve to the full party,
// with and without it, at several Legacy states. Read-only on js/.
const load = require('../round-08/r8load');
const dt = 1 / 30;
function trial(seed, legacy, recruiter, typing) {
  const KK = load({ seed }); const S = KK.S, A = KK.actions, D = KK.DATA, F = KK.F;
  S.legacy = Object.assign({}, legacy, recruiter ? { recruiter: 1 } : {}); S.retires = 2; S.renownLifetime = 100; S.stats.bossKills = 5; S.stats.playTime = 3600;
  KK.dirty(); const m = KK.mods(); S.heroes = { knight: 1 + m.startLvl, archer: 0, mage: 0, cleric: 0 }; S.floor = m.startFloor; S.maxFloorRun = m.startFloor; KK.dirty(); KK.world.reset();
  let t = 0, k = 0, glance = 0; const got = {};
  while (t < 1800) {
    if (typing) { k += dt * 4; while (k >= 1) { k--; KK.addActivity('key'); } }
    KK.__tick(dt); t += dt;
    if ((glance -= dt) <= 0) { glance = 20; for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && S.gold >= A.recruitCost(id)) { A.recruit(id); got[id] = t; } for (let i = 0; i < 300; i++) { let best = null, bc = Infinity; for (const id of D.PARTY_ORDER) { if (!S.heroes[id]) continue; const c = F.levelCost(id, S.heroes[id]); if (c < bc) { bc = c; best = id; } } if (best && bc <= S.gold * 0.5) A.levelHero(best, 1); else break; } }
    if (got.cleric) break;
  }
  return { mage: got.mage, cleric: got.cleric, floor: S.floor };
}
const states = { 'HS0 VR0': {}, 'HS1 VR1': { headstart: 1, veterans: 1 }, 'HS2 VR3': { headstart: 2, veterans: 3 }, 'HS4 VR5': { headstart: 4, veterans: 5 } };
for (const [name, lg] of Object.entries(states)) for (const typing of [true, false]) {
  const r = [1, 2, 3].map((s) => [trial(s, lg, false, typing), trial(s, lg, true, typing)]);
  const f = (x) => (x === undefined ? 'never' : (x / 60).toFixed(1) + 'm');
  console.log(`${name} ${typing ? 'typist' : 'idle  '} | full party without: ${r.map((x) => f(x[0].cleric)).join(' ')} | with Recruiter: ${r.map((x) => f(x[1].cleric)).join(' ')} | mage without/with: ${r.map((x) => f(x[0].mage) + '/' + f(x[1].mage)).join(' ')}`);
}
