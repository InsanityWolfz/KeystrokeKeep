// T1 economist, round 02: economy scenarios on the real sim (read-only use of the game code).
// Usage (from project root): node docs/playtest/round-02/econ2.js <scenario> [args]
//   verify | firstretire | gainwatch | legacy | embers | wsvalue | autoclick | offline | qm | heroes | fairness
const load = require('../../../tools/headless');
const which = process.argv[2] || 'verify';
const fmt = (n) => (n >= 1e12 ? (n / 1e12).toFixed(2) + 'T' : n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(1));
const hm = (s) => `${Math.floor(s / 3600)}h${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;

// ---------------------------------------------------------------- player model (mirrors tools/playtest.js smart strategy)
function makePlayer(KK, o = {}) {
  const S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F;
  const rnd = KK.rng;
  const P = { t: 0, profile: o.profile || 'typist', glance: o.glance || 60, nextGlance: 0, typing: false, sw: 0, acc: 0,
    lastMax: 1, lastMaxT: 0, runStart: 0, retires: [], checkpoints: {}, kps: o.kps, stats: { keys: 0, emberAt: [] } };
  P.activity = function (dt) {
    const pr = P.profile;
    if (pr === 'idle') return;
    if (pr === 'autoclick') { P.acc += dt * (o.kps || 15); while (P.acc >= 1) { P.acc -= 1; P.stats.keys++; KK.addActivity('click'); } return; }
    P.sw -= dt;
    if (P.sw <= 0) { P.typing = !P.typing; P.sw = pr === 'burst' ? (P.typing ? 5 + rnd() * 10 : 60 + rnd() * 120) : (P.typing ? 20 + rnd() * 40 : 15 + rnd() * (pr === 'heavy' ? 10 : 40)); }
    if (P.typing) { P.acc += dt * (pr === 'heavy' ? 6 : 4); while (P.acc >= 1) { P.acc -= 1; P.stats.keys++; KK.addActivity('key'); } }
  };
  P.spend = function () {
    const s = S();
    if (s.relicOffer) A.pickRelic(s.relicOffer[0]);
    if (KK.world.rat) KK.world.catchRat();
    for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) A.recruit(id);
    if (o.legacyPolicy) o.legacyPolicy(KK); else { let ch = true; while (ch) { ch = false; for (const d of D.LEGACY) if (A.buyLegacy(d.id)) ch = true; } }
    if (o.workshop) o.workshop(KK); else for (let k = 0; k < 50; k++) { let did = false; for (const d of D.WORKSHOP) if (A.buyWorkshop(d.id)) did = true; if (!did) break; }
    if (o.noManual) return;
    for (let i = 0; i < 400; i++) {
      let did = false;
      for (const d of D.FORGE) { const c = F.upCost(d, s.forge[d.id] || 0); if ((s.forge[d.id] || 0) < d.max && c < s.gold * 0.4) { A.buyForge(d.id); did = true; } }
      let best = null, bc = Infinity;
      for (const id of D.PARTY_ORDER) { if (!s.heroes[id]) continue; const c = F.levelCost(id, s.heroes[id]); if (c < bc) { bc = c; best = id; } }
      if (best && bc <= s.gold) { A.levelHero(best, 1); did = true; }
      if (!did) break;
    }
  };
  P.doRetire = function (why) {
    const s = S();
    const gain = A.retire();
    if (!gain) return false;
    P.retires.push({ at: P.t, run: (P.t - P.runStart) / 60, floor: P.lastMax, gain, why });
    KK.world.reset(); P.runStart = P.t; P.lastMax = s.maxFloorRun; P.lastMaxT = P.t;
    P.spend();
    return true;
  };
  P.step = function (dt) {
    P.activity(dt);
    KK.world.update(dt);
    P.t += dt;
    const s = S();
    if (s.maxFloorRun > P.lastMax) { P.lastMax = s.maxFloorRun; P.lastMaxT = P.t; }
    if (P.t >= P.nextGlance) {
      P.nextGlance = P.t + P.glance;
      if (o.onGlance) o.onGlance(KK, P);
      P.spend();
      if (o.retirePolicy && A.canRetire() && o.retirePolicy(KK, P)) P.doRetire('policy');
    }
    if (!o.retirePolicy && A.canRetire() && P.t - P.lastMaxT > (o.stuck || 8) * 60) P.doRetire('stuck');
  };
  P.run = function (sec, cps = []) {
    const dt = 1 / 30;
    const want = cps.slice().sort((a, b) => a - b);
    while (P.t < sec) {
      P.step(dt);
      while (want.length && P.t >= want[0]) { const c = want.shift(); P.checkpoints[c] = { floor: S().maxFloorEver, renown: S().renownLifetime, retires: S().retires, embers: S().embers, ws: { ...S().workshop }, maxRun: S().maxFloorRun }; }
    }
    return P;
  };
  return P;
}

function stallPolicy(min) { return (KK, P) => P.t - P.lastMaxT > min * 60; }

// =========================================================== verify R1 findings
function verify() {
  console.log('=== R1 F1: retire spam with Head Start ===');
  for (const lv of [0, 4, 8]) {
    const KK = load({ seed: 7 }); KK.world.reset();
    KK.S.legacy.headstart = lv; KK.S.maxFloorRun = 20; KK.dirty();
    const g0 = KK.actions.retire();
    let clicks = 0, renown = 0;
    while (KK.actions.canRetire() && clicks < 100) { renown += KK.actions.retire(); clicks++; }
    console.log(`headstart ${lv}: first retire from f20 +${g0}; start floor ${KK.S.floor}; canRetire after = ${KK.actions.canRetire()}; 100 more clicks = +${renown}`);
  }
  console.log('\n=== R1 F7: Idle Battery is a floor ===');
  {
    const KK = load({ seed: 1 }); KK.S.legacy.battery = 5; KK.dirty();
    const out = [];
    for (const f of [0, 30, 70, 95]) { KK.S.fervor = f; out.push(`fervor ${f} -> ${KK.powerMult().toFixed(2)}`); }
    console.log('battery 5: ' + out.join(', '));
  }
  console.log('\n=== R1 F2: prestige policies (lifetime renown, deepest floor), 3 seeds ===');
  for (const prof of ['typist', 'idle']) {
    for (const [name, pol] of [['stall 2', stallPolicy(2)], ['stall 4', stallPolicy(4)], ['stall 8', stallPolicy(8)], ['stall 15', stallPolicy(15)],
      ['+10 floors farm', (KK, P) => KK.S.maxFloorRun >= (KK.mods().startFloor + 10)], ['+20 floors farm', (KK, P) => KK.S.maxFloorRun >= (KK.mods().startFloor + 20)]]) {
      const r4 = [], f4 = [], r8 = [], f8 = [];
      for (const seed of [1, 2, 3]) {
        const KK = load({ seed }); KK.world.reset();
        const P = makePlayer(KK, { profile: prof, retirePolicy: pol }).run(8 * 3600, [4 * 3600, 8 * 3600]);
        r4.push(P.checkpoints[14400].renown); f4.push(P.checkpoints[14400].floor); r8.push(P.checkpoints[28800].renown); f8.push(P.checkpoints[28800].floor);
      }
      console.log(`${prof.padEnd(6)} ${name.padEnd(16)} 4h: renown ${avg(r4).toFixed(0).padStart(4)} deepest ${avg(f4).toFixed(0)} | 8h: renown ${avg(r8).toFixed(0).padStart(4)} deepest ${avg(f8).toFixed(0)}`);
    }
  }
}

// =========================================================== first retire timing
// First retire when reaching floor N (or by stall rule), afterwards stall-8. What does it cost/gain by 2/4/8 h?
function firstretire() {
  const prof = process.argv[3] || 'typist';
  const seeds = [1, 2, 3, 4];
  const opts = [['stall 8 (harness)', null], ...[30, 35, 40, 45, 50, 55, 60].map((n) => ['first at f' + n, n])];
  console.log(`=== first-retire timing, ${prof}, ${seeds.length} seeds; later retires on 8-min stall ===`);
  for (const [name, N] of opts) {
    const rows = { t1: [], f1: [], g1: [], c2: [], c4: [], c8: [], r2: [], r4: [], r8: [], back: [] };
    for (const seed of seeds) {
      const KK = load({ seed }); KK.world.reset();
      const pol = (K, P) => (K.S.retires === 0 && N ? K.S.maxFloorRun >= N : P.t - P.lastMaxT > 8 * 60);
      const P = makePlayer(KK, { profile: prof, retirePolicy: pol });
      // time for run 2 to reach the run-1 record
      let rec = null, backAt = null;
      const H = 8 * 3600; const cps = [7200, 14400, 28800];
      while (P.t < H) {
        P.step(1 / 30);
        if (KK.S.retires === 1 && rec === null) rec = P.retires[0].floor;
        if (rec !== null && backAt === null && KK.S.retires === 1 && KK.S.maxFloorRun >= rec) backAt = P.t - P.retires[0].at;
        while (cps.length && P.t >= cps[0]) { const c = cps.shift(); P.checkpoints[c] = { floor: KK.S.maxFloorEver, renown: KK.S.renownLifetime }; }
      }
      const r1 = P.retires[0] || { at: NaN, floor: NaN, gain: NaN };
      rows.t1.push(r1.at / 60); rows.f1.push(r1.floor); rows.g1.push(r1.gain); rows.back.push(backAt === null ? NaN : backAt / 60);
      rows.c2.push(P.checkpoints[7200].floor); rows.c4.push(P.checkpoints[14400].floor); rows.c8.push(P.checkpoints[28800].floor);
      rows.r2.push(P.checkpoints[7200].renown); rows.r4.push(P.checkpoints[14400].renown); rows.r8.push(P.checkpoints[28800].renown);
    }
    const a = (k, d = 0) => avg(rows[k]).toFixed(d);
    console.log(`${name.padEnd(18)} 1st retire ${a('t1')}min f${a('f1')} +${a('g1')} | run2 back to record in ${a('back', 1)}min | deepest 2h/4h/8h ${a('c2')}/${a('c4')}/${a('c8')} | renown 2h/4h/8h ${a('r2')}/${a('r4')}/${a('r8')}`);
  }
}

// =========================================================== what the shown "+X renown" does over time (no retire)
function gainwatch() {
  for (const prof of ['typist', 'burst', 'idle']) {
    const KK = load({ seed: 1 }); KK.world.reset();
    const P = makePlayer(KK, { profile: prof, retirePolicy: () => false });
    const line = [];
    let lastMax = 0, lastT = 0, stalls = [];
    for (let m = 5; m <= 180; m += 5) {
      P.run(m * 60);
      line.push(`${m}m:f${KK.S.maxFloorRun}/+${KK.actions.renownGain()}`);
    }
    console.log(`${prof}: ${line.join(' ')}`);
  }
}

// =========================================================== Legacy: what does the first retire buy?
function legacy() {
  const D = load({ seed: 1 }).DATA;
  let first = 0;
  const rows = [];
  for (const d of D.LEGACY) { first += d.cost(0); let tot = 0; for (let l = 0; l < Math.min(d.max, 20); l++) tot += d.cost(l); rows.push(`${d.id} first ${d.cost(0)} / ${d.max === 999 ? '20 lv' : 'max ' + d.max} ${tot}`); }
  console.log('Legacy prices: ' + rows.join('; '));
  console.log('Sum of every first level:', first);
  const finite = D.LEGACY.filter((d) => d.max < 999); let all = 0; for (const d of finite) for (let l = 0; l < d.max; l++) all += d.cost(l);
  console.log('Cost to max every capped item:', all);
  // simulate default buy-all order with a budget
  for (const budget of [13, 30, 51, 61, 108, 150, 242]) {
    const KK = load({ seed: 1 }); KK.S.renown = budget; KK.dirty();
    let ch = true; while (ch) { ch = false; for (const d of D.LEGACY) if (KK.actions.buyLegacy(d.id)) ch = true; }
    const owned = D.LEGACY.filter((d) => KK.S.legacy[d.id]).length;
    console.log(`budget ${String(budget).padStart(3)} (buy-all loop): ${owned}/10 kinds, left ${KK.S.renown}: ${JSON.stringify(KK.S.legacy)}`);
  }
}

// =========================================================== Embers pacing
function embers() {
  for (const prof of ['typist', 'heavy', 'burst', 'idle']) {
    const rows = [];
    for (const seed of [1, 2, 3]) {
      const KK = load({ seed }); KK.world.reset();
      const earned = { v: 0 };
      KK.on('ult', () => {});
      const P = makePlayer(KK, { profile: prof, stuck: 8 });
      const cps = [600, 1800, 3600, 7200, 14400, 28800];
      const snaps = {};
      let prevE = 0, totalE = 0;
      while (P.t < 28800) {
        const e0 = KK.S.embers || 0; P.step(1 / 30); const e1 = KK.S.embers || 0; if (e1 > e0) totalE += e1 - e0;
        while (cps.length && P.t >= cps[0]) { const c = cps.shift(); snaps[c] = { tot: totalE, ws: { ...KK.S.workshop }, bank: KK.S.embers }; }
      }
      rows.push(snaps);
    }
    console.log(`\n${prof}: total embers earned (avg 3 seeds) and workshop levels (seed 1)`);
    for (const c of [600, 1800, 3600, 7200, 14400, 28800]) {
      console.log(`  ${hm(c)}: earned ${avg(rows.map((r) => r[c].tot)).toFixed(0).padStart(6)}  ws ${JSON.stringify(rows[0][c].ws)} bank ${rows[0][c].bank.toFixed(0)}`);
    }
  }
}

// =========================================================== value of each Workshop upgrade
// Spend the same Ember budget on one upgrade only; measure floor reached in a fixed window.
function wsvalue() {
  const prof = process.argv[3] || 'typist';
  const mins = +(process.argv[4] || 60);
  const plans = {
    none: () => {},
    default: null,
    jarOnly: (K) => { while (K.actions.buyWorkshop('jar')); },
    overOnly: (K) => { while (K.actions.buyWorkshop('overcharge')); },
    kindOnly: (K) => { while (K.actions.buyWorkshop('kindling')); },
    staticOnly: (K) => { while (K.actions.buyWorkshop('static')); },
    noJar: (K) => { for (let k = 0; k < 50; k++) { let d = false; for (const id of ['overcharge', 'kindling', 'static']) if (K.actions.buyWorkshop(id)) d = true; if (!d) break; } },
  };
  console.log(`=== Workshop value: ${prof}, fresh save, ${mins} min, no retire, 4 seeds ===`);
  for (const [name, ws] of Object.entries(plans)) {
    const fl = [], em = [], lv = [], gold = [];
    for (const seed of [1, 2, 3, 4]) {
      const KK = load({ seed }); KK.world.reset();
      const P = makePlayer(KK, { profile: prof, retirePolicy: () => false, workshop: ws || undefined });
      P.run(mins * 60);
      fl.push(KK.S.maxFloorRun); em.push(KK.S.embers); gold.push(KK.S.stats.goldEarned);
      lv.push(JSON.stringify(KK.S.workshop));
    }
    console.log(`${name.padEnd(10)} floor ${avg(fl).toFixed(1)}  goldEarned ${fmt(avg(gold))}  unspent embers ${avg(em).toFixed(0)}  ws(seed1) ${lv[0]}`);
  }
}

// =========================================================== autoclicker / key-hold at the 15/s token bucket
function autoclick() {
  console.log('=== autoclicker at the input cap vs typists, fresh save, 120 min, no retire, 2 seeds ===');
  for (const [prof, kps] of [['idle'], ['burst'], ['typist'], ['heavy'], ['autoclick', 6], ['autoclick', 10], ['autoclick', 15]]) {
    const r = { f: [], e: [], ws: [], keys: [] };
    for (const seed of [1, 2]) {
      const KK = load({ seed }); KK.world.reset();
      const P = makePlayer(KK, { profile: prof, kps, retirePolicy: () => false }).run(7200);
      r.f.push(KK.S.maxFloorRun); r.e.push(KK.S.embers); r.keys.push(P.stats.keys);
      let lvls = 0; for (const k in KK.S.workshop) lvls += KK.S.workshop[k]; r.ws.push(lvls);
      if (seed === 1) r.wsd = JSON.stringify(KK.S.workshop);
    }
    console.log(`${(prof + (kps ? '@' + kps + '/s' : '')).padEnd(14)} inputs ${avg(r.keys).toFixed(0).padStart(6)}  floor ${avg(r.f).toFixed(1)}  workshop lv ${avg(r.ws).toFixed(0)} ${r.wsd}`);
  }
}

// =========================================================== offline vs online
// Measured online gold/s over 20 minutes at a fixed state vs. what main.js awayCheck would pay.
function offline() {
  console.log('=== offline payout (main.js formula) vs online, 2 seeds ===');
  for (const prof of ['typist', 'idle']) {
    for (const [name, leg, relics] of [['fresh', {}, []], ['campfire 4', { campfire: 4 }, []], ['campfire 4 + oil', { campfire: 4 }, ['oil']]]) {
      const ratios = [], closeAtPeak = [];
      for (const seed of [1, 2]) {
        const KK = load({ seed }); KK.world.reset();
        const P = makePlayer(KK, { profile: prof, retirePolicy: () => false });
        P.run(40 * 60); // get into the game
        KK.S.legacy = Object.assign({}, KK.S.legacy, leg); for (const r of relics) if (!KK.S.relics.includes(r)) KK.S.relics.push(r); KK.dirty();
        const g0 = KK.S.stats.goldEarned, t0 = P.t; let offSum = 0, n = 0, peak = 0;
        while (P.t < t0 + 20 * 60) {
          P.step(1 / 30);
          const rate = KK.S.incomeRate > 0 ? KK.S.incomeRate : KK.F.enemyGold(KK.S.floor) * 0.3;
          offSum += rate * KK.mods().offline; n++; peak = Math.max(peak, rate * KK.mods().offline);
        }
        const online = (KK.S.stats.goldEarned - g0) / (P.t - t0);
        ratios.push(offSum / n / online); closeAtPeak.push(peak / online);
      }
      console.log(`${prof.padEnd(6)} ${name.padEnd(17)} offline/online avg ${avg(ratios).toFixed(2)}x  (closing at the best moment: ${avg(closeAtPeak).toFixed(2)}x)`);
    }
  }
  // typist leaves for lunch: keep it running (party goes idle) vs close it (paid on FLOW-time incomeRate)
  console.log('\n--- 1h lunch break after 60 min of typing: leave running (no typing) vs close ---');
  for (const seed of [1, 2, 3]) {
    const mk = () => { const KK = load({ seed }); KK.world.reset(); const P = makePlayer(KK, { profile: 'typist', retirePolicy: () => false }); P.run(3600); return { KK, P }; };
    const a = mk(); const g0 = a.KK.S.stats.goldEarned; a.P.profile = 'idle'; a.P.run(7200); const run = a.KK.S.stats.goldEarned - g0;
    const b = mk(); const m = b.KK.mods(); const rate = b.KK.S.incomeRate > 0 ? b.KK.S.incomeRate : b.KK.F.enemyGold(b.KK.S.floor) * 0.3; const closed = rate * 3600 * m.offline;
    console.log(`seed ${seed}: left running ${fmt(run)} gold (floor ${a.KK.S.maxFloorRun}); closed ${fmt(closed)} gold (offline ${m.offline}) -> ratio ${(closed / run).toFixed(2)}`);
  }
}

// =========================================================== Quartermaster on/off
function qm() {
  console.log('=== Quartermaster (frugal) on vs off, run 2 after a typical first retire, 45 min, 3 seeds ===');
  for (const on of [0, 1]) {
    const r = { f: [], empty: [], gold: [], cleric: [], mage: [] };
    for (const seed of [1, 2, 3]) {
      const KK = load({ seed });
      KK.S.renownLifetime = 108; KK.S.renownFloor = 69; KK.S.retires = 1;
      KK.S.legacy = { lineage: 3, treasury: 3, veterans: 2, recruiter: 1, zeal: 1, campfire: 1, battery: 1, headstart: 1, collector: 1, quartermaster: on };
      KK.dirty(); KK.world.reset(); KK.S.floor = KK.mods().startFloor; KK.S.maxFloorRun = KK.S.floor; KK.S.heroes.knight = 1 + KK.mods().startLvl;
      let empty = 0, golds = [], rec = {};
      KK.on('recruit', ({ id }) => { rec[id] = rec[id] || 0; });
      const P = makePlayer(KK, { profile: 'typist', retirePolicy: () => false, legacyPolicy: () => {},
        onGlance: (K, P) => { golds.push(K.S.gold); } });
      let t0 = {}; KK.on('recruit', ({ id }) => { t0[id] = P.t / 60; });
      P.run(45 * 60);
      r.f.push(KK.S.maxFloorRun); r.gold.push(golds.sort((a, b) => a - b)[golds.length >> 1]); r.cleric.push(t0.cleric || NaN); r.mage.push(t0.mage || NaN);
    }
    console.log(`QM ${on ? 'on ' : 'off'}: floor ${r.f.join('/')}  median gold at glance ${r.gold.map(fmt).join('/')}  mage at ${r.mage.map((x) => x.toFixed(1)).join('/')}m  cleric at ${r.cleric.map((x) => x.toFixed(1)).join('/')}m`);
  }
}

// =========================================================== hero DPS per gold (R1 F8)
function heroes() {
  const KK = load({ seed: 1 }); const F = KK.F, D = KK.DATA;
  console.log('=== DPS bought by spending a budget on one hero (from level 1) ===');
  for (const budget of [1e3, 1e4, 1e6, 1e8, 1e10]) {
    const out = [];
    for (const id of ['knight', 'archer', 'mage', 'cleric']) {
      let lvl = 1, spent = 0; while (spent + F.levelCost(id, lvl) <= budget) { spent += F.levelCost(id, lvl); lvl++; }
      const h = D.HEROES[id]; let dps = F.heroDmg(id, lvl) / h.spd; if (id === 'mage') dps *= 1.5; if (id === 'cleric') dps *= 3.2; // cleric: heal/s
      out.push(`${id} L${lvl} ${fmt(dps)}${id === 'cleric' ? 'hps' : ''}`);
    }
    console.log(`budget ${fmt(budget)}: ${out.join('  ')}`);
  }
}

// =========================================================== typist vs idle at equal wall clock, realistic retire rules
function fairness() {
  const pol = process.argv[3] || 'stall8';
  const policies = { stall8: stallPolicy(8), stall4: stallPolicy(4), stall15: stallPolicy(15) };
  console.log(`=== typist / burst / idle at equal time, ${pol}, 4 seeds ===`);
  const cps = [1800, 3600, 7200, 14400, 28800];
  const res = {};
  for (const prof of ['typist', 'heavy', 'burst', 'idle']) {
    const per = cps.map(() => ({ f: [], r: [] })); const first = [];
    for (const seed of [1, 2, 3, 4]) {
      const KK = load({ seed }); KK.world.reset();
      const P = makePlayer(KK, { profile: prof, retirePolicy: policies[pol] }).run(28800, cps);
      cps.forEach((c, i) => { per[i].f.push(P.checkpoints[c].floor); per[i].r.push(P.checkpoints[c].renown); });
      first.push(P.retires[0] ? `${(P.retires[0].at / 60).toFixed(0)}m/f${P.retires[0].floor}/+${P.retires[0].gain}` : 'none');
    }
    res[prof] = per;
    console.log(`${prof.padEnd(6)} first retire ${first.join(' ')}`);
    console.log(`       ` + cps.map((c, i) => `${hm(c)}: f${avg(per[i].f).toFixed(0)} R${avg(per[i].r).toFixed(0)}`).join(' | '));
  }
  console.log('typist/idle renown ratio: ' + cps.map((c, i) => `${hm(c)} ${(avg(res.typist[i].r) / Math.max(1, avg(res.idle[i].r))).toFixed(1)}x`).join('  '));
  console.log('typist/idle depth  ratio: ' + cps.map((c, i) => `${hm(c)} ${(avg(res.typist[i].f) / avg(res.idle[i].f)).toFixed(2)}x`).join('  '));
}

// =========================================================== share of damage from ultimates, boss vs trash, by Overcharge level
function ultshare() {
  console.log('=== damage share from ultimates (typist, 90 min, no retire, 2 seeds) ===');
  for (const oc of [0, 4, 8]) {
    const r = { ultAll: [], ultBoss: [], floor: [], bossTime: [] };
    for (const seed of [1, 2]) {
      const KK = load({ seed }); KK.world.reset();
      KK.S.workshop.overcharge = oc; KK.dirty();
      let u = 0, n = 0, ub = 0, nb = 0, bossT = 0;
      KK.on('hit', ({ e, dmg, ult }) => { const d = Math.min(dmg, e.maxHp || dmg); if (ult) u += dmg; else n += dmg; if (e.boss) { if (ult) ub += dmg; else nb += dmg; } });
      const P = makePlayer(KK, { profile: 'typist', retirePolicy: () => false, workshop: () => {} });
      while (P.t < 5400) { P.step(1 / 30); if (KK.F.isBossFloor(KK.S.floor)) bossT += 1 / 30; }
      r.ultAll.push(u / (u + n)); r.ultBoss.push(ub / Math.max(1, ub + nb)); r.floor.push(KK.S.maxFloorRun); r.bossTime.push(bossT / P.t);
    }
    console.log(`overcharge ${oc}: ult share of all damage ${(avg(r.ultAll) * 100).toFixed(0)}%, of boss damage ${(avg(r.ultBoss) * 100).toFixed(0)}%, time on boss floors ${(avg(r.bossTime) * 100).toFixed(0)}%, floor ${avg(r.floor).toFixed(1)}`);
  }
}

// =========================================================== Legacy value: spend the first-retire Renown different ways
function legvalue() {
  const budget = +(process.argv[3] || 108), rec = +(process.argv[4] || 69), prof = process.argv[5] || 'typist';
  const one = (id) => (K) => { while (K.actions.buyLegacy(id)); };
  const plans = {
    buyAll: null,
    lineageOnly: one('lineage'),
    treasuryOnly: one('treasury'),
    'lin+tre': (K) => { let ch = true; while (ch) { ch = false; for (const id of ['lineage', 'treasury']) if (K.actions.buyLegacy(id)) ch = true; } },
    'vet+lin': (K) => { while (K.actions.buyLegacy('veterans')); one('lineage')(K); },
    'head+lin': (K) => { while (K.actions.buyLegacy('headstart')); one('lineage')(K); },
    nothing: () => {},
  };
  console.log(`=== Legacy value: ${budget} Renown (lifetime ${budget}, record f${rec}), run 2, ${prof}, 3 seeds: floor at 15/30/60 min ===`);
  for (const [name, pol] of Object.entries(plans)) {
    const r = { 15: [], 30: [], 60: [] }; let leg = '';
    for (const seed of [1, 2, 3]) {
      const KK = load({ seed });
      KK.S.renown = budget; KK.S.renownLifetime = budget; KK.S.renownFloor = rec; KK.S.retires = 1; KK.S.maxFloorEver = rec; KK.dirty();
      if (pol) pol(KK); else { let ch = true; while (ch) { ch = false; for (const d of KK.DATA.LEGACY) if (KK.actions.buyLegacy(d.id)) ch = true; } }
      const m = KK.mods(); KK.S.floor = m.startFloor; KK.S.maxFloorRun = m.startFloor; KK.S.heroes.knight = 1 + m.startLvl; KK.dirty(); KK.world.reset();
      if (seed === 1) leg = JSON.stringify(KK.S.legacy);
      const P = makePlayer(KK, { profile: prof, retirePolicy: () => false, legacyPolicy: () => {} });
      for (const c of [15, 30, 60]) { P.run(c * 60); r[c].push(KK.S.maxFloorRun); }
    }
    console.log(`${name.padEnd(13)} f${avg(r[15]).toFixed(1)} / f${avg(r[30]).toFixed(1)} / f${avg(r[60]).toFixed(1)}   ${leg}`);
  }
}

const SC = { legvalue, ultshare, verify, firstretire, gainwatch, legacy, embers, wsvalue, autoclick, offline, qm, heroes, fairness };
if (!SC[which]) { console.log('unknown scenario; one of ' + Object.keys(SC).join(' ')); process.exit(1); }
SC[which]();
