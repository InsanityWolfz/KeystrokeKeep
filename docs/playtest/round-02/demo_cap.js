// Round 02 auditor: demo-scope probe. Cap at floor CAP: play to CAP, retire once, spend Renown, re-climb to CAP.
// node docs/playtest/round-02/demo_cap.js [--cap 40] [--profile typist|idle|burst] [--seeds 3]
const load = require('../../../tools/headless');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = process.argv[i + 1]; i++; } }
const CAP = +args.cap || 40, PROFILE = args.profile || 'typist', SEEDS = +args.seeds || 3;
const dt = 1 / 30;
const fmt = (s) => `${Math.floor(s / 60)}m`;
for (let seed = 1; seed <= SEEDS; seed++) {
  const KK = load({ seed }); const S = KK.S, A = KK.actions, D = KK.DATA, F = KK.F, W = KK.world, rnd = KK.rng;
  W.reset();
  let t = 0, typing = false, sw = 0, acc = 0, nextG = 0, epicSeen = false, offers = 0, cards = 0;
  KK.on('relicOffer', ({ ids }) => { offers++; cards += ids.length; if (ids.some((id) => D.RELICS.find((r) => r.id === id).rar === 'epic')) epicSeen = true; });
  const marks = [];
  const climb = (limit) => {
    const start = t;
    while (S.maxFloorRun < CAP && t - start < limit) {
      if (PROFILE !== 'idle') { sw -= dt; if (sw <= 0) { typing = !typing; sw = PROFILE === 'burst' ? (typing ? 5 + rnd() * 10 : 60 + rnd() * 120) : (typing ? 20 + rnd() * 40 : 15 + rnd() * 40); } if (typing) { acc += dt * 4; while (acc >= 1) { acc--; KK.addActivity('key'); } } }
      W.update(dt); t += dt;
      if (S.floor > CAP) S.floor = CAP; // emulate the cap
      if (t >= nextG) {
        nextG = t + 60;
        if (S.relicOffer) A.pickRelic(S.relicOffer[Math.floor(rnd() * S.relicOffer.length)]);
        for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && S.gold >= A.recruitCost(id)) A.recruit(id);
        for (let k = 0; k < 50; k++) { let did = false; for (const d of D.WORKSHOP) if (A.buyWorkshop(d.id)) did = true; if (!did) break; }
        for (let i = 0; i < 400; i++) {
          let did = false;
          for (const d of D.FORGE) { const c = F.upCost(d, S.forge[d.id] || 0); if ((S.forge[d.id] || 0) < d.max && c < S.gold * 0.4) { A.buyForge(d.id); did = true; } }
          let best = null, bc = Infinity;
          for (const id of D.PARTY_ORDER) { if (!S.heroes[id]) continue; const c = F.levelCost(id, S.heroes[id]); if (c < bc) { bc = c; best = id; } }
          if (best && bc <= S.gold) { A.levelHero(best, 1); did = true; }
          if (!did) break;
        }
        if (W.rat) W.catchRat();
      }
    }
    return t - start;
  };
  const r1 = climb(4 * 3600);
  const heroes1 = D.PARTY_ORDER.filter((id) => S.heroes[id]).length;
  const gain = A.retire(); W.reset();
  const bought = [];
  let changed = true; while (changed) { changed = false; for (const d of D.LEGACY) if (A.buyLegacy(d.id)) { changed = true; bought.push(d.id); } }
  const run1Cards = cards, run1Epic = epicSeen;
  const r2 = climb(4 * 3600);
  console.log(`${PROFILE} seed ${seed} cap ${CAP}: run1 ${fmt(r1)} (${heroes1} heroes, ${run1Cards} relic cards, epic offered: ${run1Epic}) -> retire +${gain} Renown buys [${bought.join(',')}] (left ${S.renown}) -> run2 ${fmt(r2)}  total ${fmt(t)}  Embers ${Math.floor(S.embers)} ws ${JSON.stringify(S.workshop)}`);
}
