// T1 R4: what does an idle party do at its wall? (stalemate vs wipes) - read-only probe
const load = require('../../../tools/headless');
const KK = load({ seed: 1 }); KK.world.reset();
const S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F;
let t = 0, lastMax = 1, lastMaxT = 0, glance = 0;
const spend = () => {
  const s = S(); while (s.relicOffer) A.pickRelic(s.relicOffer[0]);
  if (KK.world.rat) KK.world.catchRat();
  for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) A.recruit(id);
  let ch = true; while (ch) { ch = false; for (const d of D.LEGACY) if (A.buyLegacy(d.id)) ch = true; }
  for (let k = 0; k < 50; k++) { let did = false; for (const d of D.WORKSHOP) if (A.buyWorkshop(d.id)) did = true; if (!did) break; }
  for (let i = 0; i < 400; i++) { let did = false; for (const d of D.FORGE) { const c = F.upCost(d, s.forge[d.id] || 0); if ((s.forge[d.id] || 0) < d.max && c < s.gold * 0.4) { A.buyForge(d.id); did = true; } }
    let best = null, bc = Infinity; for (const id of D.PARTY_ORDER) { if (!s.heroes[id]) continue; const c = F.levelCost(id, s.heroes[id]); if (c < bc) { bc = c; best = id; } }
    if (best && bc <= s.gold) { A.levelHero(best, 1); did = true; } if (!did) break; }
};
let wipesAtStall = [], log = [];
KK.on('wipe', ({ floor }) => log.push(floor));
while (t < 6 * 3600) {
  KK.world.update(1 / 30); t += 1 / 30;
  const s = S();
  if (s.maxFloorRun > lastMax) { lastMax = s.maxFloorRun; lastMaxT = t; }
  if (t >= glance) { glance = t + 60; spend();
    if (t - lastMaxT > 8 * 60 && A.canRetire()) {
      const b = KK.world.boss || KK.world.enemies.find((e) => e.boss);
      console.log(`${(t / 3600).toFixed(2)}h stall at f${s.floor} (max ${s.maxFloorRun}) wipes this run ${log.length} [${[...new Set(log)].join(',')}] boss ${b ? (b.def.name + ' hp ' + (b.hp / b.maxHp * 100).toFixed(0) + '%') : 'none'} party hp ${KK.world.heroes.map((h) => h.id[0] + Math.round(h.hp / h.maxHp * 100)).join(' ')}`);
      A.retire(); KK.world.reset(); spend(); lastMax = S().maxFloorRun; lastMaxT = t; log = [];
    } }
}
