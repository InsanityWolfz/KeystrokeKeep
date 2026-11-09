// Round 03 auditor: does the ult turn "spin" to the Archer? Compares the live rule with a patched rule (in memory only:
// a non-Cleric hero keeps the turn while nothing is in its range, it only passes on cooldown). Game files are not edited.
// node docs/playtest/round-03/turn_fix_probe.js [--profile typist|idle] [--min 60] [--seeds 3] [--demoPost]
const fs = require('fs'), path = require('path'), vm = require('vm');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = v; i++; } } }
const PROFILE = args.profile || 'typist', MIN = +args.min || 60, SEEDS = +args.seeds || 3;
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function load(seed, patched) {
  const ctx = { console, Math: Object.create(Math), Date, JSON, Object, Array, Set, Map, String, Number, Infinity, NaN, isFinite, parseInt, parseFloat };
  ctx.Math.random = mulberry32(seed); ctx.globalThis = ctx; vm.createContext(ctx);
  for (const f of ['util', 'data', 'state', 'world']) {
    let src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'js', f + '.js'), 'utf8');
    if (f === 'world' && patched) {
      const from = 'if (!want || h.ultCd > 0) W.passUlt();';
      if (!src.includes(from)) throw new Error('patch anchor missing');
      src = src.replace(from, "if (h.ultCd > 0 || (!want && h.id === 'cleric')) W.passUlt();");
    }
    vm.runInContext(src, ctx, { filename: f + '.js' });
  }
  ctx.KK.rng = ctx.Math.random; return ctx.KK;
}
function run(seed, patched) {
  const KK = load(seed, patched); const S = KK.S, A = KK.actions, D = KK.DATA, F = KK.F, W = KK.world, rnd = KK.rng;
  W.reset();
  const dt = 1 / 30; let t = 0, typing = false, sw = 0, acc = 0, nextG = 0, t30 = null;
  const ub = { knight: 0, archer: 0, mage: 0, cleric: 0 }; KK.on('ult', ({ id }) => ub[id]++);
  while (t < MIN * 60) {
    if (PROFILE !== 'idle') { sw -= dt; if (sw <= 0) { typing = !typing; sw = typing ? 20 + rnd() * 40 : 15 + rnd() * 40; } if (typing) { acc += dt * 4; while (acc >= 1) { acc--; KK.addActivity('key'); } } }
    W.update(dt); t += dt; if (t30 === null && S.maxFloorRun >= 30) t30 = t;
    if (t >= nextG) {
      nextG = t + 60;
      if (S.relicOffer) { S.relicOffer = null; S.relicQueue = []; }
      for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && S.gold >= A.recruitCost(id)) A.recruit(id);
      for (let k = 0; k < 50; k++) { let did = false; for (const d of D.WORKSHOP) if (A.buyWorkshop(d.id)) did = true; if (!did) break; }
      for (let i = 0; i < 400; i++) {
        let did = false;
        for (const d of D.FORGE) { const c = F.upCost(d, S.forge[d.id] || 0); if ((S.forge[d.id] || 0) < d.max && c < S.gold * 0.4) { A.buyForge(d.id); did = true; } }
        let best = null, bc = Infinity; for (const id of D.PARTY_ORDER) { if (!S.heroes[id]) continue; const c = F.levelCost(id, S.heroes[id]); if (c < bc) { bc = c; best = id; } }
        if (best && bc <= S.gold) { A.levelHero(best, 1); did = true; } if (!did) break;
      }
      if (W.rat) W.catchRat();
    }
  }
  return { ub, floor: S.maxFloorRun, t30: (t30 || t) / 60 };
}
for (const patched of [false, true]) {
  const tot = { knight: 0, archer: 0, mage: 0, cleric: 0 }; let fl = 0, t30 = 0;
  for (let s = 1; s <= SEEDS; s++) { const r = run(700 + s, patched); for (const k in tot) tot[k] += r.ub[k] / SEEDS; fl += r.floor / SEEDS; t30 += r.t30 / SEEDS; }
  const sum = Object.values(tot).reduce((a, b) => a + b, 0);
  console.log(`${PROFILE} ${MIN}m ${patched ? 'PATCHED (hold turn)' : 'live rule        '}: ults ${Object.entries(tot).map(([k, v]) => `${k} ${v.toFixed(0)} (${(100 * v / Math.max(1, sum)).toFixed(0)}%)`).join('  ')}  maxFloor ${fl.toFixed(1)}  min-to-F30 ${t30.toFixed(1)}`);
}
