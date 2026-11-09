// T1 economist, round 02: proposed fixes tested by overriding data/formulas in memory (no game file is edited).
// Usage (from project root): node docs/playtest/round-02/econ2fix.js <legacy|hoard|idleembers|offline|fame>
const load = require('../../../tools/headless');
const which = process.argv[2] || 'legacy';
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const fmt = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(1));

// same player model as econ2.js (smart spender, seeded typing)
function makePlayer(KK, o = {}) {
  const S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F, rnd = KK.rng;
  const P = { t: 0, profile: o.profile || 'typist', nextGlance: 0, typing: false, sw: 0, acc: 0, lastMax: 1, lastMaxT: 0, retires: [] };
  P.activity = (dt) => {
    const pr = P.profile; if (pr === 'idle') return;
    P.sw -= dt;
    if (P.sw <= 0) { P.typing = !P.typing; P.sw = pr === 'burst' ? (P.typing ? 5 + rnd() * 10 : 60 + rnd() * 120) : (P.typing ? 20 + rnd() * 40 : 15 + rnd() * (pr === 'heavy' ? 10 : 40)); }
    if (P.typing) { P.acc += dt * (pr === 'heavy' ? 6 : 4); while (P.acc >= 1) { P.acc -= 1; KK.addActivity('key'); } }
  };
  P.spend = () => {
    const s = S();
    if (s.relicOffer) A.pickRelic(s.relicOffer[0]);
    if (KK.world.rat) KK.world.catchRat();
    for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) A.recruit(id);
    if (o.legacyPolicy) o.legacyPolicy(KK); else { let ch = true; while (ch) { ch = false; for (const d of D.LEGACY) if (A.buyLegacy(d.id)) ch = true; } }
    if (!o.noWs) for (let k = 0; k < 50; k++) { let did = false; for (const d of D.WORKSHOP) if (A.buyWorkshop(d.id)) did = true; if (!did) break; }
    for (let i = 0; i < 400; i++) {
      let did = false;
      for (const d of D.FORGE) { const c = F.upCost(d, s.forge[d.id] || 0); if ((s.forge[d.id] || 0) < d.max && c < s.gold * 0.4) { A.buyForge(d.id); did = true; } }
      let best = null, bc = Infinity;
      for (const id of D.PARTY_ORDER) { if (!s.heroes[id]) continue; const c = F.levelCost(id, s.heroes[id]); if (c < bc) { bc = c; best = id; } }
      if (best && bc <= s.gold) { A.levelHero(best, 1); did = true; }
      if (!did) break;
    }
  };
  P.step = (dt) => {
    if (o.preStep) o.preStep(KK, P);
    P.activity(dt); KK.world.update(dt); P.t += dt;
    const s = S();
    if (s.maxFloorRun > P.lastMax) { P.lastMax = s.maxFloorRun; P.lastMaxT = P.t; }
    if (P.t >= P.nextGlance) { P.nextGlance = P.t + 60; P.spend(); }
    if (A.canRetire() && P.t - P.lastMaxT > (o.stuck || 8) * 60) {
      const gain = A.retire(); P.retires.push({ at: P.t, floor: P.lastMax, gain });
      KK.world.reset(); P.lastMax = s.maxFloorRun; P.lastMaxT = P.t; P.spend();
    }
  };
  P.run = (sec, cps = [], snap) => { const want = cps.slice(); while (P.t < sec) { P.step(1 / 30); while (want.length && P.t >= want[0]) snap(want.shift()); } return P; };
  return P;
}

// ---------------------------------------------------------------- proposed Legacy price/effect set
function applyLegacyFix(KK) {
  const L = KK.DATA.LEGACY, get = (id) => L.find((d) => d.id === id);
  get('lineage').cost = (l) => 3 + 3 * l;
  get('treasury').cost = (l) => 3 + 3 * l;
  get('quartermaster').cost = () => 8;
  get('recruiter').cost = () => 10;
  get('collector').cost = () => 30;
  get('battery').cost = (l) => 4 + 2 * l;
  // Head Start: begin at 10% of your record floor per rank (max 5 = 50%)
  const hs = get('headstart'); hs.max = 5; hs.cost = (l) => 6 + 4 * l;
  hs.apply = (m, l) => { m.startFloor = Math.max(m.startFloor, 1 + Math.floor((KK.S.renownFloor || 0) * 0.1 * l)); };
  // Veterans: +10 levels per rank, cheaper
  const v = get('veterans'); v.cost = (l) => 3 + 2 * l; v.apply = (m, l) => { m.startLvl += 10 * l; };
  KK.dirty();
}

function legacy() {
  const one = (id) => (K) => { while (K.actions.buyLegacy(id)); };
  const plans = {
    buyAll: null, lineageOnly: one('lineage'),
    'lin+tre': (K) => { let ch = true; while (ch) { ch = false; for (const id of ['lineage', 'treasury']) if (K.actions.buyLegacy(id)) ch = true; } },
    'vet+lin': (K) => { while (K.actions.buyLegacy('veterans')); one('lineage')(K); },
    'head+lin': (K) => { while (K.actions.buyLegacy('headstart')); one('lineage')(K); },
    'head2+vet2+lin': (K) => { K.actions.buyLegacy('headstart'); K.actions.buyLegacy('headstart'); K.actions.buyLegacy('veterans'); K.actions.buyLegacy('veterans'); one('lineage')(K); },
    nothing: () => {},
  };
  for (const fix of [false, true]) {
    for (const [budget, rec, prof] of [[108, 69, 'typist'], [30, 40, 'idle']]) {
      console.log(`\n=== ${fix ? 'PROPOSED' : 'CURRENT'} Legacy: ${budget} Renown, record f${rec}, run 2, ${prof}, 3 seeds: floor at 15/30/60 min ===`);
      for (const [name, pol] of Object.entries(plans)) {
        const r = { 15: [], 30: [], 60: [] }; let leg = '', kinds = 0;
        for (const seed of [1, 2, 3]) {
          const KK = load({ seed }); if (fix) applyLegacyFix(KK);
          KK.S.renown = budget; KK.S.renownLifetime = budget; KK.S.renownFloor = rec; KK.S.retires = 1; KK.S.maxFloorEver = rec; KK.dirty();
          if (pol) pol(KK); else { let ch = true; while (ch) { ch = false; for (const d of KK.DATA.LEGACY) if (KK.actions.buyLegacy(d.id)) ch = true; } }
          const m = KK.mods(); KK.S.floor = m.startFloor; KK.S.maxFloorRun = m.startFloor; KK.S.heroes.knight = 1 + m.startLvl; KK.dirty(); KK.world.reset();
          if (seed === 1) { leg = JSON.stringify(KK.S.legacy); kinds = Object.keys(KK.S.legacy).length; }
          const P = makePlayer(KK, { profile: prof, stuck: 1e9, legacyPolicy: () => {} });
          for (const c of [15, 30, 60]) { P.run(c * 60); r[c].push(KK.S.maxFloorRun); }
        }
        console.log(`${name.padEnd(15)} f${avg(r[15]).toFixed(1)} / f${avg(r[30]).toFixed(1)} / f${avg(r[60]).toFixed(1)}  ${name === 'buyAll' ? '(' + kinds + '/10 kinds) ' : ''}${leg}`);
      }
    }
  }
  // full-game check with the proposed set
  console.log('\n=== 8 h stall-8 with CURRENT vs PROPOSED Legacy (3 seeds): deepest & renown at 2/4/8 h ===');
  for (const prof of ['typist', 'idle']) for (const fix of [false, true]) {
    const res = { 7200: [], 14400: [], 28800: [] }, rr = { 7200: [], 14400: [], 28800: [] };
    for (const seed of [1, 2, 3]) {
      const KK = load({ seed }); if (fix) applyLegacyFix(KK); KK.world.reset();
      makePlayer(KK, { profile: prof }).run(28800, [7200, 14400, 28800], (c) => { res[c].push(KK.S.maxFloorEver); rr[c].push(KK.S.renownLifetime); });
    }
    console.log(`${prof.padEnd(6)} ${fix ? 'proposed' : 'current '}: ` + [7200, 14400, 28800].map((c) => `${c / 3600}h f${avg(res[c]).toFixed(0)} R${avg(rr[c]).toFixed(0)}`).join(' | '));
  }
}

// ---------------------------------------------------------------- Boss Hoard: ults saved for boss floors, Jar = hoard size
function hoard() {
  console.log('=== Boss Hoard test: typist, fresh save, 120 min, no retire, 3 seeds ===');
  for (const mode of ['stream', 'hoard']) for (const jar of [0, 5, 10]) {
    const fl = [], em = [], bossT = [];
    for (const seed of [1, 2, 3]) {
      const KK = load({ seed }); KK.world.reset();
      KK.S.workshop.jar = jar; KK.dirty();
      let bank = 0, bt = 0;
      const pre = mode === 'hoard' ? (K) => {
        const S = K.S, cap = K.mods().sparkCap;
        if (!K.F.isBossFloor(S.floor)) { bank = Math.min(cap, bank + S.sparks); S.sparks = 0; if (bank >= cap) { S.sparks = bank; bank = 0; } }
        else if (bank > 0) { S.sparks = Math.min(cap, S.sparks + bank); bank = 0; }
      } : null;
      const P = makePlayer(KK, { profile: "typist", stuck: 1e9, preStep: pre, noWs: true });
      while (P.t < 7200) { P.step(1 / 30); if (KK.F.isBossFloor(KK.S.floor)) bt += 1 / 30; }
      fl.push(KK.S.maxFloorRun); em.push(KK.S.embers); bossT.push(bt / 60);
    }
    console.log(`${mode.padEnd(6)} jar ${String(jar).padStart(2)} (cap ${150 + 100 * jar}): floor ${avg(fl).toFixed(1)}  embers ${avg(em).toFixed(0)}  minutes on boss floors ${avg(bossT).toFixed(1)}`);
  }
}

// ---------------------------------------------------------------- idle Ember trickle: rats and first boss kills pay Embers
function idleembers() {
  console.log('=== Ember trickle for non-typists: +25 Embers per golden rat, +10 per boss kill; 4 h, stall-8, 3 seeds ===');
  for (const prof of ['idle', 'burst', 'typist']) for (const fix of [false, true]) {
    const e = [], ws = [], fl = [];
    for (const seed of [1, 2, 3]) {
      const KK = load({ seed }); KK.world.reset();
      if (fix) { KK.on('ratCaught', () => { KK.S.embers += 25; }); KK.on('kill', ({ e }) => { if (e.boss) KK.S.embers += 10; }); }
      let earned = 0;
      const P = makePlayer(KK, { profile: prof });
      while (P.t < 14400) { const a = KK.S.embers; P.step(1 / 30); if (KK.S.embers > a) earned += KK.S.embers - a; }
      e.push(earned); let l = 0; for (const k in KK.S.workshop) l += KK.S.workshop[k]; ws.push(l); fl.push(KK.S.maxFloorEver);
    }
    console.log(`${prof.padEnd(6)} ${fix ? 'trickle' : 'current'}: embers/h ${(avg(e) / 4).toFixed(0).padStart(5)}  workshop levels ${avg(ws).toFixed(1)}  deepest ${avg(fl).toFixed(0)}`);
  }
}

// ---------------------------------------------------------------- offline: instantaneous EMA vs a 10-minute trailing average
function offline() {
  console.log('=== offline payout rate / online gold/s, current EMA (33 s) vs 10-min trailing average; 20-min window after 40 min of play, 3 seeds ===');
  for (const prof of ['typist', 'idle']) {
    const res = { ema: [], emaPeak: [], tr: [], trPeak: [] };
    for (const seed of [1, 2, 3]) {
      const KK = load({ seed }); KK.world.reset();
      const P = makePlayer(KK, { profile: prof, stuck: 1e9 });
      const hist = []; let win = 0;
      KK.on('kill', ({ e }) => {}); // gold listened via gainGold wrap below
      const og = KK.gainGold; KK.gainGold = function (a, src) { if (src === 'kill' || src === 'chest') win += a; return og.call(this, a, src); };
      P.run(40 * 60);
      const g0 = KK.S.stats.goldEarned, t0 = P.t; let sE = 0, sT = 0, pE = 0, pT = 0, n = 0, acc = 0;
      while (P.t < t0 + 20 * 60) {
        P.step(1 / 30); acc += 1 / 30;
        if (acc >= 1) { acc -= 1; hist.push(win); win = 0; if (hist.length > 600) hist.shift(); }
        const tr = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
        const ema = KK.S.incomeRate; const off = KK.mods().offline;
        sE += ema * off; sT += Math.min(ema, tr) * off; pE = Math.max(pE, ema * off); pT = Math.max(pT, Math.min(ema, tr) * off); n++;
      }
      const online = (KK.S.stats.goldEarned - g0) / (P.t - t0);
      res.ema.push(sE / n / online); res.emaPeak.push(pE / online); res.tr.push(sT / n / online); res.trPeak.push(pT / online);
    }
    console.log(`${prof.padEnd(6)} EMA: avg ${avg(res.ema).toFixed(2)}x best-moment ${avg(res.emaPeak).toFixed(2)}x | min(EMA, 10-min avg): avg ${avg(res.tr).toFixed(2)}x best-moment ${avg(res.trPeak).toFixed(2)}x`);
  }
}

// ---------------------------------------------------------------- long-run: compounding Fame variants
function fame() {
  const variants = {
    current: null,
    'x1.004^R': (R) => 1 + 0.03 * R > 0 ? Math.pow(1.004, R) : 1,
    'x1.008^R': (R) => Math.pow(1.008, R),
  };
  console.log('=== Fame variants (extra multiplier on dmg & gold on top of 1+0.03R), stall-8, 3 seeds ===');
  for (const prof of ['typist', 'idle']) for (const [name, fn] of Object.entries(variants)) {
    const res = { 3600: [], 7200: [], 14400: [], 28800: [] }, rr = { 3600: [], 7200: [], 14400: [], 28800: [] }; const first = [], lastGains = [];
    for (const seed of [1, 2, 3]) {
      const KK = load({ seed });
      if (fn) { const orig = KK.mods; KK.mods = function () { const m = orig(); if (!m._f) { const x = fn(KK.S.renownLifetime); m.dmg *= x; m.gold *= x; m._f = true; } return m; }; }
      KK.world.reset();
      const P = makePlayer(KK, { profile: prof }).run(28800, [3600, 7200, 14400, 28800], (c) => { res[c].push(KK.S.maxFloorEver); rr[c].push(KK.S.renownLifetime); });
      first.push(P.retires[0] ? `${(P.retires[0].at / 60).toFixed(0)}m` : '-');
      lastGains.push(P.retires.filter((r) => r.at > 4 * 3600).map((r) => r.gain).join('+') || '0');
    }
    console.log(`${prof.padEnd(6)} ${name.padEnd(9)}: ` + Object.keys(res).map((c) => `${c / 3600}h f${avg(res[c]).toFixed(0)} R${avg(rr[c]).toFixed(0)}`).join(' | ') + `  first retire ${first.join('/')}  retires after 4h ${lastGains.join(', ')}`);
  }
}

({ legacy, hoard, idleembers, offline, fame, workshop })[which]();

// ---------------------------------------------------------------- Workshop rework: Jar -> Ember Crucible (+15% Embers/level), Overcharge multiplicative
function workshop() {
  const variants = {
    current: null,
    'crucible+mulOC': (KK) => {
      const W = KK.DATA.WORKSHOP; const jar = W.find((d) => d.id === 'jar'), oc = W.find((d) => d.id === 'overcharge');
      jar.apply = (m, l) => { m.emberMult = 1 + 0.15 * l; }; jar.max = 10;
      oc.apply = (m, l) => { m.ultPow *= Math.pow(1.3, l); };
      // wrap ember banking: scale ember gains by emberMult
      let last = 0; KK.on('ult', () => {}); return (K) => { const e = K.S.embers; if (e > last) { const mult = K.mods().emberMult || 1; K.S.embers = last + (e - last) * mult; } last = K.S.embers; };
    },
  };
  console.log('=== Workshop rework, fresh save, no retire, 3 seeds: floor at 60/180 min, embers earned, levels ===');
  for (const prof of ['typist', 'burst']) for (const [name, fn] of Object.entries(variants)) {
    const f60 = [], f180 = [], lv = [];
    for (const seed of [1, 2, 3]) {
      const KK = load({ seed }); KK.world.reset();
      const pre = fn ? fn(KK) : null;
      const P = makePlayer(KK, { profile: prof, stuck: 1e9, preStep: pre ? (K) => pre(K) : null });
      P.run(3600); f60.push(KK.S.maxFloorRun); P.run(10800); f180.push(KK.S.maxFloorRun);
      if (seed === 1) lv.push(JSON.stringify(KK.S.workshop));
    }
    console.log(`${prof.padEnd(6)} ${name.padEnd(15)} floor 60m ${avg(f60).toFixed(1)}  180m ${avg(f180).toFixed(1)}  ws(seed1) ${lv[0]}`);
  }
}
