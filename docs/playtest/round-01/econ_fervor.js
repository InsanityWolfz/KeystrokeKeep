// T1 economist round 01: does a bursty (office) typist feel rewarded? Tests Fervor decay variants by
// overriding KK.tickFervor in memory (game files untouched). Run from project root:
//   node docs/playtest/round-01/econ_fervor.js
const load = require('../../../tools/headless');
const variants = [
  ['current (grace 1.5 s, decay 3.5/s)', null],
  ['grace 4 s, decay 2.0/s', { grace: 4, decay: 2.0 }],
  ['grace 6 s, decay 1.5/s', { grace: 6, decay: 1.5 }],
];
for (const prof of ['burst', 'typist', 'idle']) for (const [name, v] of variants) {
  const res = [], tiers = [0, 0, 0, 0];
  for (const seed of [1, 2, 3]) {
    const KK = load({ seed }); KK.world.reset();
    if (v) KK.tickFervor = function (dt) {
      const S = KK.S, m = KK.mods();
      if (KK.lastInputAgo() > v.grace && S.fervor > 0) S.fervor = Math.max(0, S.fervor - v.decay * m.fervDecay * dt);
    };
    let t = 0, typing = false, sw = 0, acc = 0, ng = 0; const marks = {};
    while (t < 60 * 60) {
      if (prof !== 'idle') {
        sw -= 1 / 30;
        if (sw <= 0) { typing = !typing; sw = prof === 'burst' ? (typing ? 5 + KK.U.rand() * 10 : 60 + KK.U.rand() * 120) : (typing ? 20 + KK.U.rand() * 40 : 15 + KK.U.rand() * 40); }
        if (typing) { acc += 4 / 30; while (acc >= 1) { acc--; KK.addActivity('key'); } }
      }
      KK.world.update(1 / 30); t += 1 / 30; tiers[KK.fervorTier()] += 1 / 30;
      if (t >= ng) {
        ng += 60; const S = KK.S, A = KK.actions, D = KK.DATA, F = KK.F;
        if (S.relicOffer) A.pickRelic(S.relicOffer[0]); if (KK.world.rat) KK.world.catchRat();
        for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && S.gold >= A.recruitCost(id)) A.recruit(id);
        for (let i = 0; i < 400; i++) {
          let did = false;
          for (const d of D.FORGE) { const c = F.upCost(d, S.forge[d.id] || 0); if ((S.forge[d.id] || 0) < d.max && c < S.gold * 0.4) { A.buyForge(d.id); did = true; } }
          let best = null, bc = Infinity; for (const id of D.PARTY_ORDER) { if (!S.heroes[id]) continue; const c = F.levelCost(id, S.heroes[id]); if (c < bc) { bc = c; best = id; } }
          if (best && bc <= S.gold) { A.levelHero(best, 1); did = true; } if (!did) break;
        }
      }
      for (const f of [10, 20, 30, 40]) if (!marks[f] && KK.S.maxFloorRun >= f) marks[f] = (t / 60).toFixed(0);
    }
    res.push(`max ${KK.S.maxFloorRun} f10/20/30/40@${[10, 20, 30, 40].map((f) => marks[f] || '-').join('/')}m`);
  }
  const tot = tiers.reduce((a, b) => a + b);
  console.log(`${prof.padEnd(6)} ${name.padEnd(36)} ${res.join(' | ')}  tiers I/F/Z/FLOW ${tiers.map((x) => Math.round(100 * x / tot) + '%').join('/')}`);
}
