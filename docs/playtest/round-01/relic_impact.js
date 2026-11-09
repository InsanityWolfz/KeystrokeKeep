// Round 01 auditor: how much does each relic actually matter?
// node docs/playtest/round-01/relic_impact.js [--min 45] [--seeds 4] [--profile typist|idle]
// For every relic: start a fresh save holding ONLY that relic (all boss offers are declined), play the smart
// player for --min minutes with no retire, and compare floor reached / time-to-floor-30 / gold against no relic.
const load = require('../../../tools/headless');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = process.argv[i + 1]; i++; } }
const MIN = +args.min || 45, SEEDS = +args.seeds || 4, PROFILE = args.profile || 'typist';

function run(relic, seed) {
  const KK = load({ seed });
  const S = KK.S, A = KK.actions, D = KK.DATA, F = KK.F, W = KK.world;
  if (relic) S.relics = [relic];
  KK.dirty(); W.reset();
  let t = 0, typing = false, sw = 0, acc = 0, nextG = 0, t30 = null, ults = 0, hot = 0;
  KK.on('ult', () => ults++); KK.on('hotkey', () => hot++);
  const dt = 1 / 30;
  while (t < MIN * 60) {
    if (PROFILE !== 'idle') {
      sw -= dt; if (sw <= 0) { typing = !typing; sw = typing ? 20 + Math.random() * 40 : 15 + Math.random() * 40; }
      if (typing) { acc += dt * 4; while (acc >= 1) { acc--; KK.addActivity('key'); } }
    }
    W.update(dt); t += dt;
    if (S.relicOffer) S.relicOffer = null; // decline: isolate the forced relic
    if (t30 === null && S.maxFloorRun >= 30) t30 = t;
    if (t >= nextG) {
      nextG = t + 60;
      for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && S.gold >= A.recruitCost(id)) A.recruit(id);
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
  return { floor: S.maxFloorRun, t30: t30 === null ? MIN * 60 : t30, gold: S.stats.goldEarned, ults, wipes: S.stats.wipes, hot };
}

const KK0 = load({});
const ids = [null, ...KK0.DATA.RELICS.map((r) => r.id)];
const rows = [];
for (const id of ids) {
  const rs = []; for (let s = 1; s <= SEEDS; s++) rs.push(run(id, 100 + s));
  const avg = (k) => rs.reduce((a, r) => a + r[k], 0) / rs.length;
  rows.push({ id: id || '(none)', rar: id ? KK0.DATA.RELICS.find((r) => r.id === id).rar : '', floor: avg('floor'), t30: avg('t30') / 60, gold: avg('gold'), ults: avg('ults'), wipes: avg('wipes'), hot: avg('hot') });
}
const base = rows[0];
console.log(`=== RELIC IMPACT profile=${PROFILE} ${MIN} min, ${SEEDS} seeds, only the forced relic held`);
console.log('relic        rarity  maxFloor  dFloor  min-to-F30  dT30%   goldEarned  dGold%  ults  wipes');
for (const r of rows.sort((a, b) => b.floor - a.floor || a.t30 - b.t30)) {
  console.log(`${r.id.padEnd(12)} ${r.rar.padEnd(7)} ${r.floor.toFixed(1).padStart(7)} ${(r.floor - base.floor >= 0 ? '+' : '') + (r.floor - base.floor).toFixed(1).padStart(5)}  ${r.t30.toFixed(1).padStart(9)}  ${((r.t30 / base.t30 - 1) * 100).toFixed(0).padStart(5)}%  ${KK0.U.fmt(r.gold).padStart(9)}  ${((r.gold / base.gold - 1) * 100).toFixed(0).padStart(5)}%  ${r.ults.toFixed(0).padStart(4)}  ${r.wipes.toFixed(1)}${r.hot ? '  hotkeyProcs ' + r.hot.toFixed(0) : ''}`);
}
