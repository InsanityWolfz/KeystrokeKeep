const load = require('../../../tools/headless');
// T1 economist round 01 - run from project root: node docs/playtest/round-01/econ_ults.js
// quick check: how much do ultimates matter? (typist model from econ_scenarios, inline)
for (const mode of ['ults on', 'ults off', 'no typing at all']) {
  const res = [];
  for (const seed of [1, 2, 3]) {
    const KK = load({ seed }); KK.world.reset();
    if (mode === 'ults off') KK.world.castUlt = function (h) { h.ultCd = 999; };
    let t = 0, typing = false, sw = 0, acc = 0, ng = 0; const marks = {};
    while (t < 60 * 60) {
      if (mode !== 'no typing at all') { sw -= 1 / 30; if (sw <= 0) { typing = !typing; sw = typing ? 20 + KK.U.rand() * 40 : 15 + KK.U.rand() * 40; } if (typing) { acc += 4 / 30; while (acc >= 1) { acc--; KK.addActivity('key'); } } }
      KK.world.update(1 / 30); t += 1 / 30;
      if (t >= ng) { ng += 60; const S = KK.S, A = KK.actions, D = KK.DATA, F = KK.F;
        if (S.relicOffer) A.pickRelic(S.relicOffer[0]); if (KK.world.rat) KK.world.catchRat();
        for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && S.gold >= A.recruitCost(id)) A.recruit(id);
        for (let i = 0; i < 400; i++) { let did = false; for (const d of D.FORGE) { const c = F.upCost(d, S.forge[d.id] || 0); if ((S.forge[d.id] || 0) < d.max && c < S.gold * 0.4) { A.buyForge(d.id); did = true; } }
          let best = null, bc = Infinity; for (const id of D.PARTY_ORDER) { if (!S.heroes[id]) continue; const c = F.levelCost(id, S.heroes[id]); if (c < bc) { bc = c; best = id; } } if (best && bc <= S.gold) { A.levelHero(best, 1); did = true; } if (!did) break; } }
      for (const f of [20, 30, 40, 50]) if (!marks[f] && KK.S.maxFloorRun >= f) marks[f] = (t / 60).toFixed(0);
    }
    res.push(`max ${KK.S.maxFloorRun} (f20/30/40/50 @ ${[20, 30, 40, 50].map((f) => marks[f] || '-').join('/')}m)`);
  }
  console.log(mode.padEnd(18), res.join(' | '));
}
