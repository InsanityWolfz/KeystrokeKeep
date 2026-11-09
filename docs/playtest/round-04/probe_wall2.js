// T1 R4: trace an idle boss wall (boss HP + party HP over time) - read-only probe
const load = require('../../../tools/headless');
const KK = load({ seed: 1 }); KK.world.reset();
const S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F, W = KK.world;
let t = 0, lastMax = 1, lastMaxT = 0, glance = 0, trace = 0;
const spend = () => {
  const s = S(); while (s.relicOffer) A.pickRelic(s.relicOffer[0]);
  if (W.rat) W.catchRat();
  for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) A.recruit(id);
  let ch = true; while (ch) { ch = false; for (const d of D.LEGACY) if (A.buyLegacy(d.id)) ch = true; }
  for (let k = 0; k < 50; k++) { let did = false; for (const d of D.WORKSHOP) if (A.buyWorkshop(d.id)) did = true; if (!did) break; }
  for (let i = 0; i < 400; i++) { let did = false; for (const d of D.FORGE) { const c = F.upCost(d, s.forge[d.id] || 0); if ((s.forge[d.id] || 0) < d.max && c < s.gold * 0.4) { A.buyForge(d.id); did = true; } }
    let best = null, bc = Infinity; for (const id of D.PARTY_ORDER) { if (!s.heroes[id]) continue; const c = F.levelCost(id, s.heroes[id]); if (c < bc) { bc = c; best = id; } }
    if (best && bc <= s.gold) { A.levelHero(best, 1); did = true; } if (!did) break; }
};
let stalls = 0;
while (t < 4 * 3600 && stalls < 3) {
  W.update(1 / 30); t += 1 / 30;
  const s = S();
  if (s.maxFloorRun > lastMax) { lastMax = s.maxFloorRun; lastMaxT = t; }
  if (s.retires >= 1 && t - lastMaxT > 60 && t >= trace) {
    trace = t + 30;
    const b = W.enemies.find((e) => e.boss && !e.dead);
    console.log(`${(t / 60).toFixed(1)}m f${s.floor}/${s.maxFloorRun} stalled ${((t - lastMaxT) / 60).toFixed(1)}m boss ${b ? (b.hp / b.maxHp * 100).toFixed(0) + '% active ' + b.active : '-'} enemies ${W.enemies.filter((e) => !e.dead).length} party ${W.heroes.map((h) => h.id[0] + Math.round(h.hp / h.maxHp * 100) + (h.dead ? 'X' : '')).join(' ')} trans ${W.trans.toFixed(1)} wipeT ${W.wipeT.toFixed(1)} gold ${s.gold.toExponential(1)}`);
  }
  if (t >= glance) { glance = t + 60; spend();
    if (t - lastMaxT > 8 * 60 && A.canRetire()) { stalls++; console.log('--- retire'); A.retire(); W.reset(); spend(); lastMax = S().maxFloorRun; lastMaxT = t; } }
}
