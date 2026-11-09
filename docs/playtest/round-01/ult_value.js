// Round 01 auditor: how much do ultimates (the Sparks sink) contribute? typist, 45 min, no relics, no retire.
// node docs/playtest/round-01/ult_value.js
const load = require('../../../tools/headless');
function run(seed, mode) {
  const KK = load({ seed }); const S = KK.S, A = KK.actions, D = KK.DATA, F = KK.F, W = KK.world;
  if (mode === 'noult') for (const id in D.HEROES) D.HEROES[id].ult.cost = 1e9;
  if (mode === 'nofervor') for (const t of D.FERVOR_TIERS) t.mult = 1;
  KK.dirty(); W.reset();
  let t = 0, typing = false, sw = 0, acc = 0, nextG = 0, t30 = null; const dt = 1 / 30;
  const ub = { knight: 0, archer: 0, mage: 0, cleric: 0 }; KK.on('ult', ({ id }) => ub[id]++);
  while (t < 45 * 60) {
    sw -= dt; if (sw <= 0) { typing = !typing; sw = typing ? 20 + Math.random() * 40 : 15 + Math.random() * 40; }
    if (typing) { acc += dt * 4; while (acc >= 1) { acc--; KK.addActivity('key'); } }
    W.update(dt); t += dt; if (S.relicOffer) S.relicOffer = null;
    if (t30 === null && S.maxFloorRun >= 30) t30 = t;
    if (t >= nextG) { nextG = t + 60;
      for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && S.gold >= A.recruitCost(id)) A.recruit(id);
      for (let i = 0; i < 400; i++) { let did = false;
        for (const d of D.FORGE) { const c = F.upCost(d, S.forge[d.id] || 0); if ((S.forge[d.id] || 0) < d.max && c < S.gold * 0.4) { A.buyForge(d.id); did = true; } }
        let best = null, bc = Infinity; for (const id of D.PARTY_ORDER) { if (!S.heroes[id]) continue; const c = F.levelCost(id, S.heroes[id]); if (c < bc) { bc = c; best = id; } }
        if (best && bc <= S.gold) { A.levelHero(best, 1); did = true; } if (!did) break; }
      if (W.rat) W.catchRat(); }
  }
  return { floor: S.maxFloorRun, t30: (t30 || t) / 60, ub };
}
for (const mode of ['normal', 'noult', 'nofervor']) {
  const rs = [1, 2, 3, 4, 5].map((s) => run(200 + s, mode));
  const f = rs.reduce((a, r) => a + r.floor, 0) / rs.length, t = rs.reduce((a, r) => a + r.t30, 0) / rs.length;
  const ub = {}; for (const r of rs) for (const k in r.ub) ub[k] = (ub[k] || 0) + r.ub[k] / rs.length;
  console.log(`${mode.padEnd(9)} maxFloor ${f.toFixed(1)}  min-to-F30 ${t.toFixed(1)}  ults/run ${Object.entries(ub).map(([k, v]) => k + ' ' + v.toFixed(0)).join(' ')}`);
}
