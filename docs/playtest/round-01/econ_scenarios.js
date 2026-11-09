// T1 economist, round 01: custom economy scenarios on the real sim (read-only use of the game code).
// The player model draws from the seeded KK RNG so runs are reproducible (tools/playtest.js is not: its typing model uses node Math.random).
// Usage (from project root): node docs/playtest/round-01/econ_scenarios.js [scenario]
//   scenarios: retirespam | quartermaster | battery | offline | sparks | prestige | legacy | heroes | prestigefix | sparkfix | combo | all
const load = require('../../../tools/headless');
const which = process.argv[2] || 'all';
const fmt = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(1));
const mm = (s) => (s / 60).toFixed(1) + 'm';

// ---------------------------------------------------------------- shared player model (same as tools/playtest.js)
function makePlayer(KK, o = {}) {
  const S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F;
  const P = { t: 0, profile: o.profile || 'typist', glance: o.glance || 60, nextGlance: 0, typing: false, sw: 0, acc: 0, log: [], stats: { forgeBuys: 0, recruits: {}, emptyGlances: 0, glances: 0, ultSparks: 0, sparksIn: 0 } };
  KK.on('recruit', ({ id }) => { P.stats.recruits[id] = P.stats.recruits[id] || []; P.stats.recruits[id].push(+(P.t / 60).toFixed(1)); });
  KK.on('upgrade', ({ store }) => { if (store === 'forge') P.stats.forgeBuys++; });
  P.activity = function (dt) {
    const pr = P.profile;
    if (pr === 'idle') return;
    P.sw -= dt;
    if (P.sw <= 0) { P.typing = !P.typing; P.sw = pr === 'burst' ? (P.typing ? 5 + KK.U.rand() * 10 : 60 + KK.U.rand() * 120) : (P.typing ? 20 + KK.U.rand() * 40 : 15 + KK.U.rand() * (pr === 'heavy' ? 10 : 40)); }
    if (P.typing) { P.acc += dt * (pr === 'heavy' ? 6 : 4); while (P.acc >= 1) { P.acc -= 1; P.stats.sparksIn++; KK.addActivity('key'); } }
  };
  P.spend = function () {
    const s = S();
    if (s.relicOffer) A.pickRelic(s.relicOffer[0]);
    if (KK.world.rat) KK.world.catchRat();
    for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) A.recruit(id);
    if (o.legacyPolicy) o.legacyPolicy(KK); else { let ch = true; while (ch) { ch = false; for (const d of D.LEGACY) if (A.buyLegacy(d.id)) ch = true; } }
    if (o.workshop) o.workshop(KK);
    for (let i = 0; i < 400; i++) {
      let did = false;
      if (!o.noForge) for (const d of D.FORGE) { const c = F.upCost(d, s.forge[d.id] || 0); if ((s.forge[d.id] || 0) < d.max && c < s.gold * 0.4) { A.buyForge(d.id); did = true; } }
      let best = null, bc = Infinity;
      for (const id of (o.levelOnly || D.PARTY_ORDER)) { if (!s.heroes[id]) continue; const c = F.levelCost(id, s.heroes[id]); if (c < bc) { bc = c; best = id; } }
      if (best && bc <= s.gold) { A.levelHero(best, 1); did = true; }
      if (!did) break;
    }
  };
  P.step = function (dt) {
    P.activity(dt);
    KK.world.update(dt);
    P.t += dt;
    if (P.t >= P.nextGlance) {
      P.nextGlance = P.t + P.glance;
      P.stats.glances++;
      if (o.onGlance) o.onGlance(KK, P);
      P.spend();
    }
  };
  return P;
}

// =========================================================== 1. retire spam with Head Start
function retirespam() {
  console.log('\n=== 1. RETIRE SPAM: does Head Start let you retire again instantly? ===');
  const KK = load({ seed: 7 });
  KK.world.reset();
  const S = KK.S, A = KK.actions;
  for (const lv of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
    KK.S = KK.newState(); KK.S.legacy.headstart = lv; KK.dirty();
    // simulate a retire so the new run starts at the Head Start floor
    KK.S.maxFloorRun = 20; const r0 = KK.S.renown; A.retire();
    let clicks = 0, renown = 0;
    while (A.canRetire() && clicks < 100) { renown += A.retire(); clicks++; }
    console.log(`headstart ${lv} (start floor ${1 + 5 * lv}, cumulative cost ${[...Array(lv).keys()].reduce((a, l) => a + 3 + 3 * l, 0)} renown): renownGain right after a retire = ${KK.F.renownFor(1 + 5 * lv)}; 100 retire clicks yield ${renown} renown`);
  }
}

// =========================================================== 2. Quartermaster starves the Forge / recruits
function quartermaster() {
  console.log('\n=== 2. QUARTERMASTER: autobuy every 0.5 s vs manual (same Legacy otherwise) ===');
  for (const qm of [0, 1]) {
    for (const seed of [1, 2]) {
      const KK = load({ seed });
      KK.S.renown = 0; KK.S.renownLifetime = 17; // what a first retire gives
      KK.S.legacy = { lineage: 2, treasury: 2, veterans: 1, recruiter: 1, zeal: 1, quartermaster: qm };
      KK.dirty(); KK.world.reset();
      const P = makePlayer(KK, {
        legacyPolicy: () => {},
        onGlance: (K, P) => {
          const s = K.S; let any = false;
          for (const d of K.DATA.FORGE) if ((s.forge[d.id] || 0) < d.max && K.F.upCost(d, s.forge[d.id] || 0) <= s.gold) any = true;
          for (const id of K.DATA.PARTY_ORDER) { if (K.actions.canRecruit(id) && s.gold >= K.actions.recruitCost(id)) any = true; if (s.heroes[id] && K.F.levelCost(id, s.heroes[id]) <= s.gold) any = true; }
          if (!any) P.stats.emptyGlances++;
          P.goldSamples = (P.goldSamples || []); P.goldSamples.push(s.gold);
        },
      });
      const marks = {};
      while (P.t < 45 * 60) { P.step(1 / 30); for (const f of [20, 30, 40, 50]) if (!marks[f] && KK.S.maxFloorRun >= f) marks[f] = mm(P.t); }
      const s = KK.S;
      console.log(`QM=${qm} seed ${seed}: 45 min -> max floor ${s.maxFloorRun}; reach f20/30/40/50 at ${[20, 30, 40, 50].map((f) => marks[f] || '-').join('/')}; forge buys ${P.stats.forgeBuys} (levels ${JSON.stringify(s.forge)}); recruits ${JSON.stringify(P.stats.recruits)}; glances with nothing affordable ${P.stats.emptyGlances}/${P.stats.glances}; median gold at glance ${fmt(P.goldSamples.sort((a, b) => a - b)[P.goldSamples.length >> 1])}`);
    }
  }
}

// =========================================================== 3. Idle Battery inverts the Fervor tiers
function battery() {
  console.log('\n=== 3. IDLE BATTERY: power multiplier per Fervor tier ===');
  const KK = load({ seed: 1 });
  const names = KK.DATA.FERVOR_TIERS.map((t) => t.name);
  let cum = 0;
  for (let l = 0; l <= 5; l++) {
    KK.S.workshop.battery = l; KK.dirty();
    const row = KK.DATA.FERVOR_TIERS.map((t) => { KK.S.fervor = t.at; return KK.powerMult().toFixed(2); });
    if (l > 0) cum += KK.F.upCost(KK.DATA.WORKSHOP.find((d) => d.id === 'battery'), l - 1);
    console.log(`battery ${l} (cumulative ${cum} sparks): ${names.map((n, i) => n + ' x' + row[i]).join('  ')}`);
  }
}

// =========================================================== 4. offline vs online gold rate
function offline() {
  console.log('\n=== 4. OFFLINE vs ONLINE: gold/s while away relative to measured online income ===');
  for (const [label, legacy, relics] of [['fresh', {}, []], ['campfire 4', { campfire: 4 }, []], ['campfire 4 + Midnight Oil', { campfire: 4 }, ['oil']]]) {
    for (const prof of ['typist', 'idle']) {
      const KK = load({ seed: 3 });
      KK.world.reset();
      const P = makePlayer(KK, { profile: prof });
      while (P.t < 30 * 60) P.step(1 / 30);
      KK.S.legacy = Object.assign({}, legacy); KK.S.relics = relics.slice(); KK.dirty();
      // measure online gold/s over the next 10 minutes the way the game sees it
      const g0 = KK.S.stats.goldEarned, t0 = P.t;
      const samples = []; let nextS = t0;
      while (P.t < t0 + 600) {
        P.step(1 / 30);
        if (P.t >= nextS) { nextS += 5; const m = KK.mods(); samples.push(Math.max(KK.S.incomeRate, KK.F.enemyGold(KK.S.floor) * 0.3) * m.offline); } // js/main.js:62-63
      }
      const online = (KK.S.stats.goldEarned - g0) / 600;
      const m = KK.mods();
      samples.sort((a, b) => a - b);
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      console.log(`${label.padEnd(26)} ${prof.padEnd(6)} online ${fmt(online)}/s  offline avg ${fmt(avg)}/s (min ${fmt(samples[0])}, max ${fmt(samples[samples.length - 1])})  avg ratio ${(avg / online).toFixed(2)}x  (m.offline ${m.offline})`);
    }
  }
}

// =========================================================== 5. Spark flow for a typist, and Workshop if ults were reserved
function sparks() {
  console.log('\n=== 5. SPARKS: income vs ult spend, and what a reserve rule would do ===');
  for (const prof of ['typist', 'heavy', 'burst']) {
    for (const reserve of [false, true]) {
      const KK = load({ seed: 4 });
      KK.world.reset();
      // reserve rule (hypothetical fix, simulated by refunding): ults only allowed while sparks > 50% of cap
      let ultsSpent = 0, ults = 0;
      const origCast = KK.world.castUlt;
      KK.world.castUlt = function (h, free) {
        const cost = Math.ceil(KK.DATA.HEROES[h.id].ult.cost * KK.mods().ultCost);
        if (!free && reserve && KK.S.sparks - cost < KK.mods().sparkCap * 0.5) { h.ultCd = 1; return; }
        if (!free) { ultsSpent += cost; ults++; }
        return origCast.call(this, h, free);
      };
      const firsts = {};
      KK.on('upgrade', ({ store, id, lvl }) => { if (store === 'workshop' && !firsts[id]) firsts[id] = mm(P.t); });
      const P = makePlayer(KK, {
        profile: prof,
        workshop: (K) => { for (const d of K.DATA.WORKSHOP) { const c = K.F.upCost(d, K.S.workshop[d.id] || 0); if (c <= K.S.sparks && (K.S.workshop[d.id] || 0) < d.max) K.actions.buyWorkshop(d.id); } },
      });
      let maxSpark = 0;
      while (P.t < 120 * 60) { P.step(1 / 30); maxSpark = Math.max(maxSpark, KK.S.sparks); }
      console.log(`${prof.padEnd(6)} reserve=${reserve ? 'on ' : 'off'}: 120 min, keys ${P.stats.sparksIn} (${(P.stats.sparksIn / 7200).toFixed(2)}/s), ults ${ults} spending ${ultsSpent} sparks (${Math.round(100 * ultsSpent / Math.max(1, P.stats.sparksIn))}% of income), peak bank ${Math.floor(maxSpark)}, workshop ${JSON.stringify(KK.S.workshop)} first buys ${JSON.stringify(firsts)}, max floor ${KK.S.maxFloorRun}`);
    }
  }
}

// =========================================================== 6. prestige policy: retire as soon as a run stalls for N minutes vs at a floor target
function prestige() {
  console.log('\n=== 6. PRESTIGE POLICY: lifetime Renown after 4 h by retire rule ===');
  const rules = [
    ['stall 2 min', (P, s, stall) => stall > 120],
    ['stall 4 min', (P, s, stall) => stall > 240],
    ['stall 8 min', (P, s, stall) => stall > 480],
    ['stall 15 min', (P, s, stall) => stall > 900],
    ['at +10 floors over Head Start', (P, s) => s.maxFloorRun >= s.__start + 10],
    ['at +20 floors over Head Start', (P, s) => s.maxFloorRun >= s.__start + 20],
  ];
  for (const prof of ['typist', 'idle']) for (const [name, rule] of rules) {
    let total = 0, n = 0, maxEver = 0, retires = 0;
    for (const seed of [1, 2]) {
      const KK = load({ seed });
      KK.world.reset();
      const P = makePlayer(KK, { profile: prof });
      let lastMax = 1, lastMaxT = 0; KK.S.__start = 1;
      while (P.t < 240 * 60) {
        P.step(1 / 30);
        const s = KK.S;
        if (s.maxFloorRun > lastMax) { lastMax = s.maxFloorRun; lastMaxT = P.t; }
        if (KK.actions.canRetire() && rule(P, s, P.t - lastMaxT)) {
          KK.actions.retire(); KK.world.reset(); KK.S.__start = KK.S.floor; lastMax = KK.S.maxFloorRun; lastMaxT = P.t; retires++;
        }
      }
      total += KK.S.renownLifetime; maxEver = Math.max(maxEver, KK.S.maxFloorEver); n++;
    }
    console.log(`${prof.padEnd(6)} ${name.padEnd(30)} lifetime renown avg ${Math.round(total / n)}  retires ${retires / n}  deepest ${maxEver}`);
  }
}

// =========================================================== 7. Legacy saturation: what is left to buy after each retire
function legacy() {
  console.log('\n=== 7. LEGACY SATURATION (typist, smart buy-all, stall 8 min) ===');
  const KK = load({ seed: 1 });
  KK.world.reset();
  const D = KK.DATA;
  const P = makePlayer(KK, {});
  let lastMax = 1, lastMaxT = 0;
  KK.on('retired', ({ gain }) => {
    // let the shop run right away
    const before = KK.S.renown;
    let ch = true; while (ch) { ch = false; for (const d of D.LEGACY) if (KK.actions.buyLegacy(d.id)) ch = true; }
    const capped = D.LEGACY.filter((d) => (KK.S.legacy[d.id] || 0) >= d.max).map((d) => d.id);
    const open = D.LEGACY.filter((d) => (KK.S.legacy[d.id] || 0) < d.max).map((d) => `${d.id}:${KK.S.legacy[d.id] || 0}/${d.max === 999 ? 'inf' : d.max}(next ${d.cost(KK.S.legacy[d.id] || 0)})`);
    console.log(`${mm(P.t)} retire #${KK.S.retires} +${gain}: spent ${before - KK.S.renown}, left ${KK.S.renown}; maxed [${capped.join(',')}]; still open ${open.join(' ')}`);
  });
  while (P.t < 360 * 60) {
    P.step(1 / 30);
    const s = KK.S;
    if (s.maxFloorRun > lastMax) { lastMax = s.maxFloorRun; lastMaxT = P.t; }
    if (KK.actions.canRetire() && P.t - lastMaxT > 480) { KK.actions.retire(); KK.world.reset(); lastMax = KK.S.maxFloorRun; lastMaxT = P.t; }
  }
}

// =========================================================== 8. hero investment: is one hero dominant?
function heroes() {
  console.log('\n=== 8. HERO SPEND POLICY: max floor after 40 min (typist, no retire) ===');
  const D = load({ seed: 1 }).DATA;
  const pols = [['cheapest level (default)', null], ['knight only', ['knight']], ['knight+archer only', ['knight', 'archer']], ['no Forge at all', 'noforge']];
  for (const [name, lv] of pols) {
    const res = [];
    for (const seed of [1, 2, 3]) {
      const KK = load({ seed }); KK.world.reset();
      const P = makePlayer(KK, { levelOnly: Array.isArray(lv) ? lv : null, noForge: lv === 'noforge' });
      while (P.t < 40 * 60) P.step(1 / 30);
      res.push(KK.S.maxFloorRun);
    }
    console.log(`${name.padEnd(26)} max floor @40m: ${res.join(', ')}`);
  }
  // raw per-gold damage of each hero at equal spend
  const KK = load({ seed: 1 }); const F = KK.F;
  for (const budget of [1e3, 1e5, 1e7]) {
    const row = Object.keys(D.HEROES).map((id) => { let L = 1, spent = 0; while (spent + F.levelCost(id, L) <= budget) { spent += F.levelCost(id, L); L++; } return `${id} L${L} dmg ${fmt(F.heroDmg(id, L))}`; });
    console.log(`budget ${fmt(budget)} gold into one hero: ${row.join('  ')}`);
  }
}


// =========================================================== 9. proposed prestige fix, tested by overriding the formula in memory
function prestigefix() {
  console.log('\n=== 9. PRESTIGE FIX CANDIDATES (' + (process.env.PROF || 'typist') + ', ' + (process.env.H || 4) + ' h, avg of seeds 1-2; env PROF and H override) ===');
  const variants = [
    ['current: renownFor(max)', null],
    ['V1: renownFor(max) - renownFor(start)', { exp: 1.6, sub: true }],
    ['V2: V1 with exponent 2.0', { exp: 2.0, sub: true }],
    ['V3: V1 with exponent 2.0, div 6', { exp: 2.0, sub: true, div: 6 }],
    ['V4: 3*1.08^(max-20) - same(start)', { expo: true, sub: true }],
    ['V5: V1 + 15-min minimum run', { exp: 1.6, sub: true, minRun: 900 }],
    ['V6: V4 + 15-min minimum run', { expo: true, sub: true, minRun: 900 }],
    ['V7: record-based, exp 1.6', { exp: 1.6, record: true }],
    ['V8: record-based, exp 1.9', { exp: 1.9, record: true }],
  ];
  const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
  const rules = [
    ['stall 2 min', (s, stall) => stall > 120],
    ['stall 8 min', (s, stall) => stall > 480],
    ['stall 15 min', (s, stall) => stall > 900],
    ['+20 floors over start', (s) => s.maxFloorRun >= s.__start + 20],
    ['+10 floors over start', (s) => s.maxFloorRun >= s.__start + 10],
  ];
  for (const [vi, [vname, v]] of variants.entries()) for (const [rname, rule] of rules) {
    if (only && !only.includes(vi)) continue;
    let tot = 0, deep = 0, ret = 0;
    for (const seed of [1, 2]) {
      const KK = load({ seed });
      if (v) {
        const rf = (f) => (f < 20 ? 0 : v.expo ? 3 * Math.pow(1.08, f - 20) : Math.pow((f - 10) / (v.div || 5), v.exp));
        KK.actions.renownGain = () => (v.minRun && P.t - (KK.S.__runT || 0) < v.minRun) ? 0 : Math.max(0, v.record ? Math.floor(rf(KK.S.maxFloorRun)) - Math.floor(rf(KK.S.__best || 1)) : Math.floor(rf(KK.S.maxFloorRun) - (v.sub ? rf(KK.S.__start || 1) : 0)));
      }
      KK.world.reset(); KK.S.__start = 1; KK.S.__runT = 0;
      var P = makePlayer(KK, { profile: process.env.PROF || 'typist' });
      let lastMax = 1, lastMaxT = 0;
      while (P.t < (+process.env.H || 4) * 3600) {
        P.step(1 / 30);
        const s = KK.S;
        if (s.maxFloorRun > lastMax) { lastMax = s.maxFloorRun; lastMaxT = P.t; }
        if (KK.actions.canRetire() && rule(s, P.t - lastMaxT)) { const bestBefore = Math.max(KK.S.__best || 1, KK.S.maxFloorRun); KK.actions.retire(); KK.S.__best = bestBefore; KK.world.reset(); KK.S.__start = KK.S.floor; KK.S.__runT = P.t; lastMax = KK.S.maxFloorRun; lastMaxT = P.t; ret++; }
      }
      tot += KK.S.renownLifetime; deep = Math.max(deep, KK.S.maxFloorEver);
    }
    console.log(`${vname.padEnd(40)} ${rname.padEnd(24)} renown ${String(Math.round(tot / 2)).padStart(5)}  retires ${ret / 2}  deepest ${deep}`);
  }
}

// =========================================================== 10. proposed Spark fix candidates
function sparkfix() {
  console.log('\n=== 10. SPARK/WORKSHOP FIX CANDIDATES (120 min, seed 4) ===');
  const variants = ['current', 'reserve 40% of jar', 'Embers: every Spark spent on an ult also banks 1 Workshop Ember'];
  for (const prof of ['typist', 'burst', 'heavy']) for (const vname of variants) {
    const KK = load({ seed: 4 });
    KK.world.reset();
    let embers = 0, ults = 0;
    const orig = KK.world.castUlt;
    KK.world.castUlt = function (h, free) {
      const cost = Math.ceil(KK.DATA.HEROES[h.id].ult.cost * KK.mods().ultCost);
      if (!free && vname.startsWith('reserve') && KK.S.sparks - cost < KK.mods().sparkCap * 0.4) { h.ultCd = 1; return; }
      if (!free) { ults++; if (vname.startsWith('Embers')) embers += cost; }
      return orig.call(this, h, free);
    };
    const firsts = {};
    const P = makePlayer(KK, {
      profile: prof,
      workshop: (K) => {
        for (const d of K.DATA.WORKSHOP) {
          const l = K.S.workshop[d.id] || 0, c = K.F.upCost(d, l);
          if (l >= d.max) continue;
          if (vname.startsWith('Embers')) { if (c <= embers) { embers -= c; K.S.workshop[d.id] = l + 1; K.dirty(); firsts[d.id] = firsts[d.id] || mm(P.t); } }
          else if (c <= K.S.sparks) { K.actions.buyWorkshop(d.id); firsts[d.id] = firsts[d.id] || mm(P.t); }
        }
      },
    });
    while (P.t < 120 * 60) P.step(1 / 30);
    const lv = Object.values(KK.S.workshop).reduce((a, b) => a + b, 0);
    console.log(`${prof.padEnd(6)} ${vname.slice(0, 20).padEnd(20)} ults ${String(ults).padStart(4)}  workshop levels ${String(lv).padStart(2)} ${JSON.stringify(KK.S.workshop)}  firsts ${JSON.stringify(firsts)}  max floor ${KK.S.maxFloorRun}`);
  }
}

// =========================================================== 11. proposed package: record-based Renown (exp 1.9) + re-priced Legacy (+ optional Embers)
// node docs/playtest/round-01/econ_scenarios.js combo   (env PROF=idle, H=6, EMBERS=1)
function combo() {
  const prof = process.env.PROF || 'typist', hours = +process.env.H || 4, embersOn = !!process.env.EMBERS;
  console.log(`\n=== 11. PACKAGE: record-based renown exp 1.9 + Legacy re-price${embersOn ? ' + Embers' : ''} (${prof}, ${hours} h, stall 8, seed 1) ===`);
  const KK = load({ seed: 1 });
  const L = (id) => KK.DATA.LEGACY.find((d) => d.id === id);
  const price = process.env.PRICE === 'a' ? { lineage: (l) => 2 + 2 * l, treasury: (l) => 2 + 2 * l, quartermaster: () => 6, recruiter: () => 8, veterans: (l) => 4 + 3 * l, headstart: (l) => 8 + 6 * l, zeal: (l) => 4 + 2 * l, campfire: (l) => 4 + 2 * l, collector: () => 20 }
    : { lineage: (l) => 2 + 2 * l, treasury: (l) => 2 + 2 * l, quartermaster: () => 10, recruiter: () => 12, veterans: (l) => 8 + 5 * l, headstart: (l) => 15 + 10 * l, zeal: (l) => 6 + 3 * l, campfire: (l) => 6 + 3 * l, collector: () => 35 };
  for (const id in price) L(id).cost = price[id];
  const rf = (f) => (f < 20 ? 0 : Math.floor(Math.pow((f - 10) / 5, 1.9)));
  KK.actions.renownGain = () => Math.max(0, rf(KK.S.maxFloorRun) - rf(KK.S.__best || 1));
  let embers = 0;
  if (embersOn) { const orig = KK.world.castUlt; KK.world.castUlt = function (h, free) { if (!free) embers += Math.ceil(KK.DATA.HEROES[h.id].ult.cost * KK.mods().ultCost); return orig.call(this, h, free); }; }
  KK.world.reset();
  const P = makePlayer(KK, {
    profile: prof,
    // buy the cheapest affordable Legacy item each time (a "spread" player)
    legacyPolicy: (K) => { for (let i = 0; i < 50; i++) { let best = null, bc = Infinity; for (const d of K.DATA.LEGACY) { const l = K.S.legacy[d.id] || 0; if (l < d.max && d.cost(l) < bc) { bc = d.cost(l); best = d; } } if (!best || bc > K.S.renown) break; K.actions.buyLegacy(best.id); } },
    workshop: embersOn ? (K) => { for (const d of K.DATA.WORKSHOP) { const l = K.S.workshop[d.id] || 0, c = K.F.upCost(d, l); if (l < d.max && c <= embers) { embers -= c; K.S.workshop[d.id] = l + 1; K.dirty(); } } } : null,
  });
  let lastMax = 1, lastMaxT = 0, runStart = 0; const marks = []; let mk = {};
  while (P.t < hours * 3600) {
    P.step(1 / 30);
    const s = KK.S;
    if (s.maxFloorRun > lastMax) { lastMax = s.maxFloorRun; lastMaxT = P.t; for (const f of [20, 40, 60, 80]) if (!mk[f] && s.maxFloorRun >= f) mk[f] = ((P.t - runStart) / 60).toFixed(0); }
    if (KK.actions.canRetire() && P.t - lastMaxT > 480) {
      const best = Math.max(s.__best || 1, s.maxFloorRun), gain = KK.actions.renownGain();
      KK.actions.retire(); s.__best = best;
      P.spend();
      const owned = KK.DATA.LEGACY.filter((d) => s.legacy[d.id]).map((d) => d.id + ':' + s.legacy[d.id]).join(' ');
      const afford = KK.DATA.LEGACY.filter((d) => (s.legacy[d.id] || 0) < d.max).length;
      console.log(`${mm(P.t)} retire #${s.retires} at f${best} +${gain} (run ${mm(P.t - runStart)}, run reached f20/40/60/80 at ${[20, 40, 60, 80].map((f) => mk[f] || '-').join('/')} min) -> legacy ${owned}; renown left ${s.renown}; open items ${afford}`);
      KK.world.reset(); lastMax = s.maxFloorRun; lastMaxT = P.t; runStart = P.t; mk = {};
    }
  }
  console.log(`END ${hours}h: maxEver ${KK.S.maxFloorEver}, lifetime renown ${KK.S.renownLifetime}, workshop ${JSON.stringify(KK.S.workshop)}`);
}

const all = { retirespam, quartermaster, battery, offline, sparks, prestige, legacy, heroes, prestigefix, sparkfix, combo };
if (which === 'all') { for (const f of Object.values(all)) f(); } else if (all[which]) all[which](); else console.log('unknown scenario; one of: ' + Object.keys(all).join(' '));
