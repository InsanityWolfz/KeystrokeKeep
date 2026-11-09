// T1 economist, round 08: Quartermaster v2 check. Idle demo hour, Quartermaster owned from the start.
// Player A ("hands-off"): only picks relics / catches rats each glance and lets Quartermaster spend all gold.
// Player B ("manual"): the playtest.js smart spender, no Quartermaster. Same seeds.
// node qm8.js [minutes] [seeds] [glance]
const load = require('../../../tools/headless');
const MIN = +(process.argv[2] || 60), [s0, s1] = (process.argv[3] || '1-10').split('-').map(Number), GL = +(process.argv[4] || 60);
function one(seed, mode) {
  const KK = load({ seed, demo: true });
  const W = KK.world, A = KK.actions, S = () => KK.S, D = KK.DATA, F = KK.F;
  if (mode === 'qm') KK.S.legacy.quartermaster = 1;
  const QV = mode.startsWith('qv') ? { frac: +mode.split('_')[1], forge: +(mode.split('_')[2] || 0) } : null;
  if (QV) {
    // replica of world.js autoBuy (Quartermaster v2) with a different frugal fraction and an optional Forge rule
    KK.S.legacy.quartermaster = 1; KK.S.settings.autoLevel = false; let acc = 0; const ou = W.update;
    W.update = function (dt) {
      ou.call(this, dt); acc += dt; if (acc <= 0.5) return; acc = 0; const s = KK.S;
      for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) A.recruit(id);
      if (D.PARTY_ORDER.some((id) => A.canRecruit(id) && s.gold < A.recruitCost(id) && s.gold + s.incomeRate * 120 >= A.recruitCost(id))) return;
      if (QV.forge) for (const d of D.FORGE.slice(0, 3)) { let k = 0; while (k++ < 5 && (s.forge[d.id] || 0) < d.max && F.upCost(d, s.forge[d.id] || 0) <= s.gold * QV.forge) A.buyForge(d.id); }
      for (let i = 0; i < 60; i++) {
        let best = null, bestC = Infinity;
        for (const id of D.PARTY_ORDER) { if (!s.heroes[id]) continue; const c = F.levelCost(id, s.heroes[id]); if (c < bestC) { bestC = c; best = id; } }
        if (!best || bestC > s.gold * QV.frac) break;
        A.levelHero(best, 1);
      }
    };
  }
  KK.dirty(); W.reset();
  const r = { wipes: 0, h1: 0, rec: {}, goldIdle: 0, n: 0, maxF: 0, f40: null, stuckSave: 0 };
  KK.on('wipe', () => { r.wipes++; if (S().stats.playTime < 3600) r.h1++; });
  KK.on('recruit', ({ id }) => { r.rec[id] = +(S().stats.playTime / 60).toFixed(1); });
  KK.on('glimpse', () => { r.f40 = +(S().stats.playTime / 60).toFixed(1); });
  let g = 0;
  while (S().stats.playTime < MIN * 60) {
    W.update(1 / 30); g += 1 / 30;
    const s = S();
    if (g >= GL) {
      g = 0;
      while (s.relicOffer) A.pickRelic(s.relicOffer[0]);
      if (W.rat) W.catchRat();
      if (mode === 'manual') {
        for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) A.recruit(id);
        for (let i = 0; i < 400; i++) {
          let did = false;
          for (const d of D.FORGE) { const c = F.upCost(d, s.forge[d.id] || 0); if ((s.forge[d.id] || 0) < d.max && c < s.gold * 0.4) { A.buyForge(d.id); did = true; } }
          let best = null, bc = Infinity; for (const id of D.PARTY_ORDER) { if (!s.heroes[id]) continue; const c = F.levelCost(id, s.heroes[id]); if (c < bc) { bc = c; best = id; } }
          if (best && bc <= s.gold) { A.levelHero(best, 1); did = true; }
          if (!did) break;
        }
      }
    }
    if (Math.round(s.stats.playTime * 30) % 30 === 0) {
      // unspent gold measured against the cheapest level (how many cheapest levels could the gold buy?)
      let bc = Infinity; for (const id of D.PARTY_ORDER) if (s.heroes[id]) bc = Math.min(bc, F.levelCost(id, s.heroes[id]));
      r.n++; r.goldIdle += s.gold / bc;
      if (D.PARTY_ORDER.some((id) => A.canRecruit(id) && s.gold < A.recruitCost(id) && s.gold + s.incomeRate * 120 >= A.recruitCost(id))) r.stuckSave++;
    }
    r.maxF = Math.max(r.maxF, s.maxFloorRun);
  }
  r.goldIdle = +(r.goldIdle / r.n).toFixed(1); r.stuckSave = +(r.stuckSave / 60).toFixed(1);
  r.lv = D.PARTY_ORDER.map((id) => id[0] + S().heroes[id]).join(' ');
  return r;
}
const MODES = (process.argv[5] || 'qm,manual').split(',');
const rows = Object.fromEntries(MODES.map((m) => [m, []]));
for (let s = s0; s <= s1; s++) for (const m of MODES) rows[m].push(one(s, m));
const avg = (a) => (a.filter((x) => x != null).reduce((x, y) => x + y, 0) / Math.max(1, a.filter((x) => x != null).length)).toFixed(1);
for (const m of MODES) {
  const R = rows[m];
  console.log(`${m.padEnd(7)} h1 retreats ${avg(R.map((r) => r.h1))} [${R.map((r) => r.h1).join(',')}]  maxFloor ${avg(R.map((r) => r.maxF))}  archer ${avg(R.map((r) => r.rec.archer))}m mage ${avg(R.map((r) => r.rec.mage))}m cleric ${avg(R.map((r) => r.rec.cleric))}m (${R.filter((r) => r.rec.cleric).length}/${R.length})  f40 ${avg(R.map((r) => r.f40))} (${R.filter((r) => r.f40).length}/${R.length})  unspent gold (x cheapest level) ${avg(R.map((r) => r.goldIdle))}  saving-for-recruit min ${avg(R.map((r) => r.stuckSave))}  lv@end ${R[0].lv}`);
}
