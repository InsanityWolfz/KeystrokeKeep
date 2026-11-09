// Round 03 auditor: pass/fail checks for the R2 fixes (Crucible, Sanctuary, ult value, relics, Hollowed rotation, Battery, Head Start, demo save).
// node docs/playtest/round-03/verify_r2.js
const load = require('../../../tools/headless');
const dt = 1 / 30;
const out = [];
const log = (...a) => { out.push(a.join(' ')); console.error(a.join(' ')); };

function play(KK, secs, opts = {}) {
  const S = KK.S, A = KK.actions, D = KK.DATA, F = KK.F, W = KK.world, rnd = KK.rng;
  let t = 0, typing = false, sw = 0, acc = 0, nextG = 0;
  const rate = opts.rate === undefined ? 4 : opts.rate;
  while (t < secs) {
    if (rate > 0) { sw -= dt; if (sw <= 0) { typing = !typing; sw = typing ? 20 + rnd() * 40 : 15 + rnd() * 40; } if (typing) { acc += dt * rate; while (acc >= 1) { acc--; KK.addActivity('key'); } } }
    W.update(dt); t += dt;
    if (opts.each) opts.each(t);
    if (t >= nextG) {
      nextG = t + 60;
      if (S.relicOffer) { if (opts.noRelics) { S.relicOffer = null; S.relicQueue = []; } else A.pickRelic(S.relicOffer[0]); }
      for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && S.gold >= A.recruitCost(id)) A.recruit(id);
      if (!opts.noWorkshop) for (let k = 0; k < 50; k++) { let did = false; for (const d of D.WORKSHOP) if (A.buyWorkshop(d.id)) did = true; if (!did) break; }
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
}

// ---------- A. Ember Crucible: Ember income with crucible 0 vs 10 (typist and idle, 45 min, no workshop spending)
{
  const rows = [];
  for (const prof of ['typist', 'idle']) for (const lv of [0, 10]) {
    let e = 0;
    for (let s = 1; s <= 3; s++) { const KK = load({ seed: 500 + s }); KK.S.workshop = { crucible: lv }; KK.dirty(); KK.world.reset(); play(KK, 45 * 60, { noWorkshop: true, rate: prof === 'idle' ? 0 : 4 }); e += KK.S.embers; }
    rows.push(`${prof} crucible ${lv}: ${(e / 3).toFixed(0)} Embers/45min`);
  }
  const KK0 = load({}); let tot = 0; for (let l = 0; l < 10; l++) tot += KK0.F.upCost(KK0.DATA.WORKSHOP[0], l);
  log('A. Crucible: ' + rows.join(' | ') + ` | all 10 levels cost ${tot}`);
}

// ---------- B. Echo Rune always double-casts; Hotkey Ring every 60th key
{
  const KK = load({ seed: 21 }); const S = KK.S; KK.world.reset();
  let paid = 0, echo = 0, ult = 0; const W = KK.world;
  const orig = W.castUlt; W.castUlt = function (h, free) { if (!free) paid++; return orig.call(this, h, free); };
  KK.on('echo', () => echo++); KK.on('ult', () => ult++);
  play(KK, 20 * 60, { each: () => { if (!S.relics.includes('echo')) { S.relics.push('echo'); KK.dirty(); } } });
  log(`B1. Echo Rune: paid casts ${paid}, echo events ${echo}, total ult events ${ult} (expect echo == casts, ult == 2x)`);
}
{
  const KK = load({ seed: 22 }); const S = KK.S; KK.world.reset();
  let hk = 0, freeCast = 0; const W = KK.world;
  const orig = W.castUlt; W.castUlt = function (h, free) { if (free) freeCast++; return orig.call(this, h, free); };
  KK.on('hotkey', () => hk++);
  const k0 = S.stats.keys;
  play(KK, 30 * 60, { each: () => { if (!S.relics.includes('hotkey')) { S.relics.push('hotkey'); KK.dirty(); } } });
  const keys = S.stats.keys - k0;
  log(`B2. Hotkey Ring: keys ${keys}, keys/60 = ${(keys / 60).toFixed(0)}, procs ${hk}, free casts ${freeCast} (${(100 * freeCast / Math.max(1, hk)).toFixed(0)}% of procs fire; the rest land out of combat)`);
}

// ---------- C. Midnight Oil raises the offline cap
{
  const KK = load({ seed: 1 }); const S = KK.S; const rows = [];
  for (let c = 0; c <= 4; c++) { S.legacy.campfire = c; S.relics = []; KK.dirty(); const a = KK.mods().offline; S.relics = ['oil']; KK.dirty(); const b = KK.mods().offline; rows.push(`campfire ${c}: ${Math.round(a * 100)}% -> Oil ${Math.round(b * 100)}%`); }
  log('C. offline share: ' + rows.join(' | '));
}

// ---------- D. Idle Battery cap and powerMult
{
  const KK = load({ seed: 1 }); const S = KK.S, D = KK.DATA; const rows = [];
  for (let b = 0; b <= 3; b++) {
    S.legacy.battery = b; KK.dirty();
    const vals = D.FERVOR_TIERS.map((tier) => { S.fervor = tier.at + 1; return KK.powerMult().toFixed(2); });
    rows.push(`rank ${b}: ${vals.join('/')}`);
    for (let i = 0; i < 4; i++) { S.fervor = 0; KK.fervorTier(); }
  }
  log(`D. Battery max ${D.LEGACY.find((d) => d.id === 'battery').max}; powerMult IDLE/FOCUSED/ZONE/FLOW: ` + rows.join(' | '));
}

// ---------- E. Head Start bought mid-transition
{
  const res = [];
  for (let seed = 1; seed <= 5; seed++) {
    const KK = load({ seed }); const S = KK.S, A = KK.actions, W = KK.world; W.reset();
    S.renown = 1000; A.buyLegacy('headstart');
    play(KK, 60);
    let tries = 0; while (!(W.trans > 0 && !W.transFloorDone) && tries++ < 30 * 600) { KK.addActivity('key'); W.update(dt); }
    const before = S.floor; A.buyLegacy('headstart'); for (let i = 0; i < 60; i++) W.update(dt);
    res.push(`f${before}->f${S.floor}`);
  }
  log('E. Head Start 2 bought mid-door (target floor 11): ' + res.join(', '));
}

// ---------- F. Hollowed rotation table
{
  const KK = load({}); const rows = [];
  const short = { hollow: 'HOLLOW', ratking: 'rat', boneking: 'bone', broodmother: 'brood', warlord: 'warl', embergolem: 'colos', magmalord: 'magma' };
  for (let r = 0; r <= 7; r++) { KK.S.retires = r; rows.push(`r${r}: ` + [70, 80, 90, 100, 110].map((f) => short[KK.F.bossFor(f)]).join(',')); }
  log('F. bosses at floors 70/80/90/100/110 by retire count: ' + rows.join(' | '));
}

// ---------- G. demo save round-trip: is demoDone persisted?
{
  const KK = load({ seed: 1, demo: true });
  const G = KK.world.update.constructor('return this')();
  const store = {}; G.localStorage = { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  KK.S.demoDone = true; KK.S.floor = 39; KK.S.maxFloorRun = 40; KK.save();
  KK.load();
  log(`G. demo save: demoDone before save true -> after load ${KK.S.demoDone}`);
  // what happens next session: party on 39 clears to 40?
  KK.world.reset(); let demoEv = 0, boss40 = 0; KK.on('demoComplete', () => demoEv++); KK.on('bossSpawn', () => { if (KK.S.floor === 40) boss40++; });
  KK.S.heroes = { knight: 120, archer: 110, mage: 99, cleric: 84 }; KK.dirty(); KK.world.reset();
  for (let t = 0; t < 600; t += dt) KK.world.update(dt);
  log(`   after reload, 10 min of farming: floor-40 boss spawned ${boss40}x, demoComplete modal fired ${demoEv}x`);
}
console.log(out.join('\n'));
