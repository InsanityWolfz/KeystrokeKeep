// T1 economist, round 03: economy scenarios on the real sim (read-only use of the game code).
// Usage (from project root): node docs/playtest/round-03/econ3.js <scenario> [args]
//   pacing [hours] [policy] | longrun [hours] | demo [min] | wsvalue [profile] [min] | legvalue budget rec profile
//   offline | heroes | legacy | firstretire profile | crucible | fametable | sanct
const load = require('../../../tools/headless');
const which = process.argv[2] || 'pacing';
const fmt = (n) => (n >= 1e15 ? n.toExponential(2) : n >= 1e12 ? (n / 1e12).toFixed(2) + 'T' : n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(1));
const hm = (s) => `${Math.floor(s / 3600)}h${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
const avg = (a) => { const b = a.filter((x) => x === x); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : NaN; };
const rng = (a) => { const b = a.filter((x) => x === x); return b.length ? `${Math.min(...b).toFixed(0)}-${Math.max(...b).toFixed(0)}` : 'n/a'; };
const fameOf = (R) => (1 + 0.03 * R) * Math.pow(1.004, R);

// ---------------------------------------------------------------- player model (mirrors tools/playtest.js smart strategy)
function makePlayer(KK, o = {}) {
  const S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F;
  const rnd = KK.rng;
  const P = { t: 0, profile: o.profile || 'typist', glance: o.glance || 60, nextGlance: 0, typing: false, sw: 0, acc: 0,
    lastMax: 1, lastMaxT: 0, runStart: 0, retires: [], checkpoints: {}, stats: { keys: 0 }, nudgeT: null, events: {} };
  P.activity = function (dt) {
    const pr = P.profile;
    if (pr === 'idle') return;
    P.sw -= dt;
    if (P.sw <= 0) { P.typing = !P.typing; P.sw = pr === 'burst' ? (P.typing ? 5 + rnd() * 10 : 60 + rnd() * 120) : (P.typing ? 20 + rnd() * 40 : 15 + rnd() * (pr === 'heavy' ? 10 : 40)); }
    if (P.typing) { P.acc += dt * (pr === 'heavy' ? 6 : 4); while (P.acc >= 1) { P.acc -= 1; P.stats.keys++; KK.addActivity('key'); } }
  };
  P.spend = function () {
    const s = S();
    if (s.relicOffer) A.pickRelic(o.relicPick ? o.relicPick(KK, s.relicOffer) : s.relicOffer[0]);
    if (KK.world.rat && !o.noRats) KK.world.catchRat();
    for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) A.recruit(id);
    if (o.legacyPolicy) o.legacyPolicy(KK); else { let ch = true; while (ch) { ch = false; for (const d of D.LEGACY) if (A.buyLegacy(d.id)) ch = true; } }
    if (o.workshop) o.workshop(KK); else for (let k = 0; k < 50; k++) { let did = false; for (const d of D.WORKSHOP) if (A.buyWorkshop(d.id)) did = true; if (!did) break; }
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
    P.retires.push({ at: P.t, run: (P.t - P.runStart) / 60, floor: P.lastMax, gain, why, life: s.renownLifetime });
    KK.world.reset(); P.runStart = P.t; P.lastMax = s.maxFloorRun; P.lastMaxT = P.t;
    P.spend();
    return true;
  };
  // the in-game nudge (ui.js hookTutorial): gain >= 30 and (run > 25 min, or first run at f40)
  P.nudge = () => { const s = S(), g = A.renownGain(); return g >= 30 && ((P.t - P.runStart) > 25 * 60 || (s.retires === 0 && s.maxFloorRun >= 40)); };
  P.step = function (dt) {
    P.activity(dt);
    KK.world.update(dt);
    P.t += dt;
    const s = S();
    if (s.maxFloorRun > P.lastMax) { P.lastMax = s.maxFloorRun; P.lastMaxT = P.t; }
    if (P.t >= P.nextGlance) {
      P.nextGlance = P.t + P.glance;
      if (P.nudgeT === null && P.nudge()) P.nudgeT = P.t;
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
      while (want.length && P.t >= want[0]) { const c = want.shift(); P.checkpoints[c] = { floor: S().maxFloorEver, renown: S().renownLifetime, retires: S().retires, embers: S().embers, ws: { ...S().workshop }, maxRun: S().maxFloorRun, fame: KK.mods().fame }; }
    }
    return P;
  };
  return P;
}
const stall = (min) => (KK, P) => P.t - P.lastMaxT > min * 60;
const nudgeOrStall = (min) => (KK, P) => P.nudge() || P.t - P.lastMaxT > min * 60;
const POL = { stall8: stall(8), stall4: stall(4), nudge: nudgeOrStall(8) };

// =========================================================== pacing: boss 10/20, first retire, run 2, depth, ratio
function pacing() {
  const H = +(process.argv[3] || 8), polName = process.argv[4] || 'stall8', demo = process.argv.includes('--demo');
  const seeds = [1, 2, 3, 4, 5];
  const cps = [3600, 7200, 14400, 28800].filter((c) => c <= H * 3600);
  console.log(`=== pacing, ${H} h, policy ${polName}${demo ? ' DEMO' : ''}, ${seeds.length} seeds ===`);
  const res = {};
  for (const prof of ['typist', 'heavy', 'burst', 'idle']) {
    const r = { b10: [], b20: [], b40: [], nud: [], nudF: [], t1: [], f1: [], g1: [], back: [], cp: cps.map(() => ({ f: [], r: [] })), ws: [], emb: [] };
    for (const seed of seeds) {
      const KK = load({ seed, demo }); KK.world.reset();
      const P = makePlayer(KK, { profile: prof, retirePolicy: POL[polName] });
      let b10 = NaN, b20 = NaN, b40 = NaN, rec = null, back = NaN, nudF = NaN, embTot = 0;
      KK.on('kill', ({ e }) => { if (!e.boss) return; const f = KK.S.floor; if (f === 10 && b10 !== b10) b10 = P.t / 60; if (f === 20 && b20 !== b20) b20 = P.t / 60; if (f === 40 && b40 !== b40) b40 = P.t / 60; });
      const want = cps.slice();
      while (P.t < H * 3600) {
        const e0 = KK.S.embers; P.step(1 / 30); if (KK.S.embers > e0) embTot += KK.S.embers - e0;
        if (P.nudgeT !== null && nudF !== nudF) nudF = KK.S.maxFloorRun;
        if (KK.S.retires === 1 && rec === null) rec = P.retires[0].floor;
        if (rec !== null && back !== back && KK.S.retires === 1 && KK.S.maxFloorRun >= rec) back = (P.t - P.retires[0].at) / 60;
        while (want.length && P.t >= want[0]) { const c = want.shift(); const i = cps.indexOf(c); r.cp[i].f.push(KK.S.maxFloorEver); r.cp[i].r.push(KK.S.renownLifetime); }
      }
      const r1 = P.retires[0] || { at: NaN, floor: NaN, gain: NaN };
      r.b10.push(b10); r.b20.push(b20); r.b40.push(b40); r.nud.push(P.nudgeT === null ? NaN : P.nudgeT / 60); r.nudF.push(nudF);
      r.t1.push(r1.at / 60); r.f1.push(r1.floor); r.g1.push(r1.gain); r.back.push(back); r.emb.push(embTot / H);
      let lv = 0; for (const k in KK.S.workshop) lv += KK.S.workshop[k]; r.ws.push(lv);
      if (seed === 1) r.ws1 = JSON.stringify(KK.S.workshop), r.ret1 = P.retires.map((x) => `${hm(x.at)}/f${x.floor}/+${x.gain}`).join(' ');
    }
    res[prof] = r;
    console.log(`${prof.padEnd(6)} boss10 ${rng(r.b10)}m  boss20 ${rng(r.b20)}m  boss40 ${rng(r.b40)}m | nudge ${rng(r.nud)}m (f${rng(r.nudF)}) | 1st retire ${rng(r.t1)}m f${rng(r.f1)} +${rng(r.g1)} | run2 back to record ${avg(r.back).toFixed(1)}m (${rng(r.back)})`);
    console.log(`       ` + cps.map((c, i) => `${hm(c)}: f${avg(r.cp[i].f).toFixed(0)} (${rng(r.cp[i].f)}) R${avg(r.cp[i].r).toFixed(0)}`).join(' | ') + ` | embers/h ${avg(r.emb).toFixed(0)} ws lv ${avg(r.ws).toFixed(1)}`);
    console.log(`       seed1 ws ${r.ws1}  retires ${r.ret1}`);
  }
  console.log('typist/idle renown ratio: ' + cps.map((c, i) => `${hm(c)} ${(avg(res.typist.cp[i].r) / Math.max(1, avg(res.idle.cp[i].r))).toFixed(2)}x`).join('  '));
  console.log('typist/idle depth  ratio: ' + cps.map((c, i) => `${hm(c)} ${(avg(res.typist.cp[i].f) / avg(res.idle.cp[i].f)).toFixed(2)}x`).join('  '));
  console.log('burst/idle  depth  ratio: ' + cps.map((c, i) => `${hm(c)} ${(avg(res.burst.cp[i].f) / avg(res.idle.cp[i].f)).toFixed(2)}x`).join('  '));
}

// =========================================================== long run: is compounding Fame safe over 24-40 h?
function longrun() {
  const H = +(process.argv[3] || 40), polName = process.argv[4] || 'stall8';
  const profs = (process.argv[5] || 'typist,idle').split(',');
  const seeds = [1, 2, 3];
  for (const prof of profs) {
    console.log(`\n=== long run ${prof}, ${H} h, policy ${polName}, ${seeds.length} seeds ===`);
    const cps = []; for (let h = 4; h <= H; h += 4) cps.push(h * 3600);
    const rows = cps.map(() => ({ f: [], r: [], fame: [], gain: [], run: [], nret: [] }));
    for (const seed of seeds) {
      const KK = load({ seed }); KK.world.reset();
      const P = makePlayer(KK, { profile: prof, retirePolicy: POL[polName] });
      P.run(H * 3600, cps);
      cps.forEach((c, i) => {
        const cp = P.checkpoints[c]; rows[i].f.push(cp.floor); rows[i].r.push(cp.renown); rows[i].fame.push(cp.fame);
        const win = P.retires.filter((x) => x.at > c - 4 * 3600 && x.at <= c);
        rows[i].gain.push(win.length ? avg(win.map((x) => x.gain)) : 0); rows[i].run.push(win.length ? avg(win.map((x) => x.run)) : NaN); rows[i].nret.push(win.length);
      });
      if (seed === 1) console.log('seed1 retires: ' + P.retires.map((x) => `${hm(x.at)} f${x.floor} +${x.gain} (${x.run.toFixed(0)}m)`).join(', '));
    }
    cps.forEach((c, i) => {
      const R = rows[i];
      console.log(`${hm(c).padStart(6)}: deepest f${avg(R.f).toFixed(0)} (${rng(R.f)})  lifetime R ${avg(R.r).toFixed(0)}  fame x${fmt(avg(R.fame))}  retires in window ${avg(R.nret).toFixed(1)}  avg gain +${avg(R.gain).toFixed(0)}  avg run ${avg(R.run).toFixed(0)}m`);
    });
  }
}

// =========================================================== demo economy (cap 40)
function demo() {
  const MIN = +(process.argv[3] || 120);
  const seeds = [1, 2, 3, 4, 5];
  console.log(`=== DEMO (cap 40), ${MIN} min, ${seeds.length} seeds ===`);
  for (const polName of ['stall8', 'nudge']) {
    for (const prof of ['typist', 'burst', 'idle']) {
      const r = { b40: [], done: [], ret: [], t1: [], t2: [], R: [], last: [], legKinds: [], legLeft: [], ws: [], emb: [], afterDoneBuys: [], goldIdle: [], R30: [], R60: [], R90: [], maxRun2: [] };
      let detail = '';
      for (const seed of seeds) {
        const KK = load({ seed, demo: true }); KK.world.reset();
        const P = makePlayer(KK, { profile: prof, retirePolicy: POL[polName] });
        let doneT = NaN, R30 = 0, R60 = 0, R90 = 0, exhaustT = NaN, lastBuyT = 0, buysAfter = { legacy: 0, workshop: 0, forge: 0, level: 0 };
        KK.on('demoComplete', () => { doneT = P.t / 60; });
        KK.on('upgrade', ({ store }) => { if (doneT === doneT) buysAfter[store]++; });
        KK.on('levelUp', () => { if (doneT === doneT) buysAfter.level++; });
        let maxRun2 = 0;
        while (P.t < MIN * 60) {
          P.step(1 / 30);
          if (P.t >= 1800 && !R30) R30 = KK.S.renownLifetime || 0.001;
          if (P.t >= 3600 && !R60) R60 = KK.S.renownLifetime || 0.001;
          if (P.t >= 5400 && !R90) R90 = KK.S.renownLifetime || 0.001;
          if (KK.S.retires >= 1) maxRun2 = Math.max(maxRun2, KK.S.maxFloorRun);
          if (exhaustT !== exhaustT && KK.S.renownLifetime >= 30) exhaustT = P.t / 60;
        }
        const S = KK.S;
        r.done.push(doneT); r.ret.push(P.retires.length); r.t1.push(P.retires[0] ? P.retires[0].at / 60 : NaN); r.t2.push(exhaustT);
        r.R.push(S.renownLifetime); r.R30.push(R30); r.R60.push(R60); r.R90.push(R90); r.maxRun2.push(maxRun2);
        r.legKinds.push(KK.DATA.LEGACY.filter((d) => S.legacy[d.id]).length);
        let lv = 0; for (const k in S.workshop) lv += S.workshop[k]; r.ws.push(lv); r.emb.push(S.embers);
        r.afterDoneBuys.push(buysAfter.workshop);
        if (seed === 1) detail = `seed1: retires ${P.retires.map((x) => `${(x.at / 60).toFixed(0)}m f${x.floor} +${x.gain}`).join(', ')} | legacy ${JSON.stringify(S.legacy)} renown left ${S.renown} | ws ${JSON.stringify(S.workshop)} embers ${Math.floor(S.embers)} | end floor ${S.floor} max run ${S.maxFloorRun} demoDone ${!!S.demoDone} canRetire ${KK.actions.canRetire()} retireTarget ${KK.actions.retireTarget()} | after cap: ${JSON.stringify(buysAfter)}`;
      }
      console.log(`${polName.padEnd(6)} ${prof.padEnd(6)} demoComplete ${rng(r.done)}m | retires ${rng(r.ret)} first ${rng(r.t1)}m | R=30 reached ${rng(r.t2)}m | lifetime R @30/60/90m ${avg(r.R30).toFixed(0)}/${avg(r.R60).toFixed(0)}/${avg(r.R90).toFixed(0)} end ${avg(r.R).toFixed(0)} | run2+ max floor ${rng(r.maxRun2)} | legacy kinds ${avg(r.legKinds).toFixed(1)} | ws lv ${avg(r.ws).toFixed(1)} bank ${avg(r.emb).toFixed(0)} | ws buys after cap ${avg(r.afterDoneBuys).toFixed(1)}`);
      console.log('       ' + detail);
    }
  }
}

// =========================================================== value of each Workshop plan (fresh save, no retire)
function wsvalue() {
  const prof = process.argv[3] || 'typist', mins = +(process.argv[4] || 180);
  const only = (id) => (K) => { while (K.actions.buyWorkshop(id)); };
  const firstThen = (id) => (K) => { while (K.actions.buyWorkshop(id)); for (let k = 0; k < 50; k++) { let d = false; for (const x of K.DATA.WORKSHOP) if (K.actions.buyWorkshop(x.id)) d = true; if (!d) break; } };
  const without = (id) => (K) => { for (let k = 0; k < 50; k++) { let d = false; for (const x of K.DATA.WORKSHOP) if (x.id !== id && K.actions.buyWorkshop(x.id)) d = true; if (!d) break; } };
  const plans = { none: () => {}, default: null, crucibleOnly: only('crucible'), overOnly: only('overcharge'), kindOnly: only('kindling'), staticOnly: only('static'),
    crucibleFirst: firstThen('crucible'), overFirst: firstThen('overcharge'), staticFirst: firstThen('static'), noCrucible: without('crucible'), noOver: without('overcharge'), noStatic: without('static') };
  const seeds = [1, 2, 3, 4];
  console.log(`=== Workshop value: ${prof}, fresh save, ${mins} min, no retire, ${seeds.length} seeds ===`);
  for (const [name, ws] of Object.entries(plans)) {
    const fl = [], gold = [], emb = [], lv = [], f60 = [];
    for (const seed of seeds) {
      const KK = load({ seed }); KK.world.reset();
      let embTot = 0;
      const P = makePlayer(KK, { profile: prof, retirePolicy: () => false, workshop: ws || undefined });
      while (P.t < mins * 60) { const e0 = KK.S.embers; P.step(1 / 30); if (KK.S.embers > e0) embTot += KK.S.embers - e0; if (Math.abs(P.t - 3600) < 1 / 60) f60.push(KK.S.maxFloorRun); }
      fl.push(KK.S.maxFloorRun); gold.push(KK.S.stats.goldEarned); emb.push(embTot); lv.push(JSON.stringify(KK.S.workshop));
    }
    console.log(`${name.padEnd(13)} f@60m ${avg(f60).toFixed(1)}  f@${mins}m ${avg(fl).toFixed(1)}  goldEarned ${fmt(avg(gold))}  embers earned ${avg(emb).toFixed(0)}  ws(seed1) ${lv[0]}`);
  }
}

// =========================================================== Workshop value over a full stall-8 day (with retires), 8 h
function wsday() {
  const prof = process.argv[3] || 'typist', H = +(process.argv[4] || 8);
  const only = (id) => (K) => { while (K.actions.buyWorkshop(id)); };
  const without = (id) => (K) => { for (let k = 0; k < 50; k++) { let d = false; for (const x of K.DATA.WORKSHOP) if (x.id !== id && K.actions.buyWorkshop(x.id)) d = true; if (!d) break; } };
  const overStack = (K) => { only('overcharge')(K); };
  const plans = { none: () => {}, default: null, noCrucible: without('crucible'), noOver: without('overcharge'), noStatic: without('static'), noKindling: without('kindling'), overOnly: overStack, staticOnly: only('static') };
  const seeds = [1, 2, 3];
  console.log(`=== Workshop over a stall-8 day: ${prof}, ${H} h, ${seeds.length} seeds ===`);
  for (const [name, ws] of Object.entries(plans)) {
    const f4 = [], f8 = [], r8 = [], embs = [];
    let ws1 = '';
    for (const seed of seeds) {
      const KK = load({ seed }); KK.world.reset();
      const P = makePlayer(KK, { profile: prof, retirePolicy: POL.stall8, workshop: ws || undefined }).run(H * 3600, [4 * 3600, H * 3600]);
      f4.push(P.checkpoints[14400].floor); f8.push(P.checkpoints[H * 3600].floor); r8.push(P.checkpoints[H * 3600].renown);
      if (seed === 1) ws1 = JSON.stringify(KK.S.workshop);
    }
    console.log(`${name.padEnd(11)} deepest 4h f${avg(f4).toFixed(1)}  ${H}h f${avg(f8).toFixed(1)}  R ${avg(r8).toFixed(0)}  ws(seed1) ${ws1}`);
  }
}

// =========================================================== Legacy value: spend a first-retire budget different ways
function legvalue() {
  const budget = +(process.argv[3] || 30), rec = +(process.argv[4] || 40), prof = process.argv[5] || 'typist';
  const demo = process.argv.includes('--demo');
  const one = (id) => (K) => { while (K.actions.buyLegacy(id)); };
  const plans = {
    buyAll: null,
    lineageOnly: one('lineage'),
    'lin+tre': (K) => { let ch = true; while (ch) { ch = false; for (const id of ['lineage', 'treasury']) if (K.actions.buyLegacy(id)) ch = true; } },
    'vet+lin': (K) => { while (K.actions.buyLegacy('veterans')); one('lineage')(K); },
    'vet2+lin': (K) => { K.actions.buyLegacy('veterans'); K.actions.buyLegacy('veterans'); one('lineage')(K); },
    'head+lin': (K) => { while (K.actions.buyLegacy('headstart')); one('lineage')(K); },
    'head2+lin': (K) => { K.actions.buyLegacy('headstart'); K.actions.buyLegacy('headstart'); one('lineage')(K); },
    'bat3+lin': (K) => { while (K.actions.buyLegacy('battery')); one('lineage')(K); },
    nothing: () => {},
  };
  const marks = [10, 20, 30, 60];
  console.log(`=== Legacy value: ${budget} Renown (record f${rec}), run 2, ${prof}${demo ? ' DEMO' : ''}, 4 seeds: floor at ${marks.join('/')} min ===`);
  for (const [name, pol] of Object.entries(plans)) {
    const r = Object.fromEntries(marks.map((m) => [m, []])); let leg = '';
    for (const seed of [1, 2, 3, 4]) {
      const KK = load({ seed, demo });
      KK.S.renown = budget; KK.S.renownLifetime = budget; KK.S.renownFloor = rec; KK.S.retires = 1; KK.S.maxFloorEver = rec; KK.dirty();
      if (pol) pol(KK); else { let ch = true; while (ch) { ch = false; for (const d of KK.DATA.LEGACY) if (KK.actions.buyLegacy(d.id)) ch = true; } }
      const m = KK.mods(); KK.S.floor = m.startFloor; KK.S.maxFloorRun = m.startFloor; KK.S.heroes.knight = 1 + m.startLvl; KK.dirty(); KK.world.reset();
      if (seed === 1) leg = JSON.stringify(KK.S.legacy) + ' left ' + KK.S.renown;
      const P = makePlayer(KK, { profile: prof, retirePolicy: () => false, legacyPolicy: () => {} });
      for (const c of marks) { P.run(c * 60); r[c].push(KK.S.maxFloorRun); }
    }
    console.log(`${name.padEnd(10)} ` + marks.map((c) => `f${avg(r[c]).toFixed(1)}`).join(' / ') + `   ${leg}`);
  }
}

// =========================================================== offline vs online (current main.js formula)
function offline() {
  console.log('=== offline payout (main.js: min(incomeRate, incomeAvg) x offline) vs online, 3 seeds ===');
  for (const prof of ['typist', 'idle']) {
    for (const [name, leg, relics] of [['fresh', {}, []], ['campfire 4', { campfire: 4 }, []], ['campfire 4 + oil', { campfire: 4 }, ['oil']]]) {
      const ratios = [], peaks = [], postBoss = [], postRetire = [];
      for (const seed of [1, 2, 3]) {
        const KK = load({ seed }); KK.world.reset();
        const P = makePlayer(KK, { profile: prof, retirePolicy: () => false });
        P.run(40 * 60);
        KK.S.legacy = Object.assign({}, KK.S.legacy, leg); for (const r of relics) if (!KK.S.relics.includes(r)) KK.S.relics.push(r); KK.dirty();
        const g0 = KK.S.stats.goldEarned, t0 = P.t; let sum = 0, n = 0, peak = 0;
        const pay = () => { const S = KK.S, avgI = S.incomeAvg || 0; const rate = S.incomeRate > 0 ? (avgI > 0 ? Math.min(S.incomeRate, avgI) : S.incomeRate) : KK.F.enemyGold(S.floor) * 0.3; return rate * KK.mods().offline; };
        let bossPay = [];
        KK.on('kill', ({ e }) => { if (e.boss) bossPay.push({ t: P.t + 5 }); });
        while (P.t < t0 + 20 * 60) {
          P.step(1 / 30);
          const p = pay(); sum += p; n++; peak = Math.max(peak, p);
        }
        const online = (KK.S.stats.goldEarned - g0) / (P.t - t0);
        ratios.push(sum / n / online); peaks.push(peak / online);
      }
      console.log(`${prof.padEnd(6)} ${name.padEnd(17)} offline/online avg ${avg(ratios).toFixed(2)}x  (closing at the best moment: ${avg(peaks).toFixed(2)}x)`);
    }
  }
  // close right after a retire: incomeAvg still carries the deep previous run, incomeRate quickly rises at shallow floors
  console.log('\n--- close the game 2/5/10 min after a retire (stall-8 typist, 2nd run) ---');
  for (const seed of [1, 2, 3]) {
    const KK = load({ seed }); KK.world.reset();
    const P = makePlayer(KK, { profile: 'typist', retirePolicy: POL.stall8 });
    while (KK.S.retires < 1) P.step(1 / 30);
    const tR = P.t; const out = [];
    for (const d of [2, 5, 10, 20]) {
      P.run(tR + d * 60);
      const S = KK.S, rate = Math.min(S.incomeRate, S.incomeAvg || S.incomeRate) * KK.mods().offline;
      const g0 = S.stats.goldEarned, t0 = P.t; P.run(t0 + 300); const online = (S.stats.goldEarned - g0) / 300;
      out.push(`${d}m: inc ${fmt(S.incomeRate)} avg ${fmt(S.incomeAvg)} pay/online ${(rate / online).toFixed(2)}x`);
    }
    console.log(`seed ${seed}: ` + out.join(' | '));
  }
}

// =========================================================== hero DPS per gold (R2 F8)
function heroes() {
  const KK = load({ seed: 1 }); const F = KK.F, D = KK.DATA;
  console.log('=== DPS bought by spending a budget on one hero (from level 1), relative to knight ===');
  for (const budget of [1e3, 1e4, 1e6, 1e8, 1e10, 1e14]) {
    const out = []; let kd = 0;
    for (const id of ['knight', 'archer', 'mage', 'cleric']) {
      let lvl = 1, spent = 0; while (spent + F.levelCost(id, lvl) <= budget) { spent += F.levelCost(id, lvl); lvl++; }
      const h = D.HEROES[id]; let dps = F.heroDmg(id, lvl) / h.spd; if (id === 'mage') dps *= 1.5;
      if (id === 'knight') kd = dps;
      out.push(`${id} L${lvl} ${id === 'cleric' ? fmt(dps) : (dps / kd).toFixed(2) + 'x'}`);
    }
    console.log(`budget ${fmt(budget)}: ${out.join('  ')}`);
  }
}

// =========================================================== Legacy prices
function legacy() {
  const D = load({ seed: 1 }).DATA;
  let first = 0; const rows = [];
  for (const d of D.LEGACY) { first += d.cost(0); let tot = 0; for (let l = 0; l < Math.min(d.max, 20); l++) tot += d.cost(l); rows.push(`${d.id} ${d.cost(0)}/${d.max === 999 ? '20lv' : 'max' + d.max}=${tot}`); }
  console.log('Legacy prices: ' + rows.join('; '));
  console.log('Sum of every first level:', first);
  const finite = D.LEGACY.filter((d) => d.max < 999); let all = 0; for (const d of finite) for (let l = 0; l < d.max; l++) all += d.cost(l);
  console.log('Cost to max every capped item:', all);
  for (const budget of [13, 28, 30, 61, 112, 150, 300]) {
    const KK = load({ seed: 1 }); KK.S.renown = budget; KK.dirty();
    let ch = true; while (ch) { ch = false; for (const d of D.LEGACY) if (KK.actions.buyLegacy(d.id)) ch = true; }
    console.log(`budget ${String(budget).padStart(3)} (buy-all loop): ${D.LEGACY.filter((d) => KK.S.legacy[d.id]).length}/10 kinds, left ${KK.S.renown}: ${JSON.stringify(KK.S.legacy)}`);
  }
  console.log('renownFor: ' + [20, 25, 30, 35, 39, 40, 50, 60, 70, 80, 90, 100, 110, 120, 150, 200].map((f) => `f${f}=${KK0.F.renownFor(f)}`).join(' '));
  console.log('fame: ' + [13, 30, 60, 100, 150, 200, 300, 400, 500, 750, 1000].map((R) => `R${R}=x${fameOf(R).toFixed(1)}`).join(' '));
}
const KK0 = load({ seed: 1 });

// =========================================================== first-retire timing (reuse of R2 F1)
function firstretire() {
  const prof = process.argv[3] || 'typist';
  const seeds = [1, 2, 3, 4];
  const opts = [['stall 8', null], ['nudge', 'nudge'], ...[30, 40, 50].map((n) => ['first at f' + n, n])];
  console.log(`=== first-retire timing, ${prof}, ${seeds.length} seeds; later retires on 8-min stall ===`);
  for (const [name, N] of opts) {
    const rows = { t1: [], f1: [], g1: [], c2: [], c4: [], c8: [], r4: [], r8: [], back: [] };
    for (const seed of seeds) {
      const KK = load({ seed }); KK.world.reset();
      const pol = (K, P) => (K.S.retires === 0 && N ? (N === 'nudge' ? P.nudge() : K.S.maxFloorRun >= N) : P.t - P.lastMaxT > 8 * 60);
      const P = makePlayer(KK, { profile: prof, retirePolicy: pol });
      let rec = null, backAt = null; const cps = [7200, 14400, 28800];
      while (P.t < 28800) {
        P.step(1 / 30);
        if (KK.S.retires === 1 && rec === null) rec = P.retires[0].floor;
        if (rec !== null && backAt === null && KK.S.retires === 1 && KK.S.maxFloorRun >= rec) backAt = P.t - P.retires[0].at;
        while (cps.length && P.t >= cps[0]) { const c = cps.shift(); P.checkpoints[c] = { floor: KK.S.maxFloorEver, renown: KK.S.renownLifetime }; }
      }
      const r1 = P.retires[0] || { at: NaN, floor: NaN, gain: NaN };
      rows.t1.push(r1.at / 60); rows.f1.push(r1.floor); rows.g1.push(r1.gain); rows.back.push(backAt === null ? NaN : backAt / 60);
      rows.c2.push(P.checkpoints[7200].floor); rows.c4.push(P.checkpoints[14400].floor); rows.c8.push(P.checkpoints[28800].floor);
      rows.r4.push(P.checkpoints[14400].renown); rows.r8.push(P.checkpoints[28800].renown);
    }
    const a = (k, d = 0) => avg(rows[k]).toFixed(d);
    console.log(`${name.padEnd(12)} 1st retire ${a('t1')}min f${a('f1')} +${a('g1')} | run2 back in ${a('back', 1)}min | deepest 2h/4h/8h ${a('c2')}/${a('c4')}/${a('c8')} | renown 4h/8h ${a('r4')}/${a('r8')}`);
  }
}

// =========================================================== Overcharge stacking: does ult damage take over late?
function ultshare() {
  console.log('=== damage share from ultimates by Overcharge level (typist, run at a mid-game save, 60 min, 2 seeds) ===');
  for (const oc of [0, 8, 12, 16, 20]) {
    const r = { ultAll: [], ultBoss: [], floor: [] };
    for (const seed of [1, 2]) {
      const KK = load({ seed }); KK.world.reset();
      KK.S.workshop = { crucible: 10, kindling: 10, static: 8, overcharge: oc }; KK.dirty();
      let u = 0, n = 0, ub = 0, nb = 0;
      KK.on('hit', ({ e, dmg, ult }) => { if (ult) u += dmg; else n += dmg; if (e.boss) { if (ult) ub += dmg; else nb += dmg; } });
      const P = makePlayer(KK, { profile: 'typist', retirePolicy: () => false, workshop: () => {} });
      P.run(3600);
      r.ultAll.push(u / (u + n)); r.ultBoss.push(ub / Math.max(1, ub + nb)); r.floor.push(KK.S.maxFloorRun);
    }
    const c = (() => { let s = 0; for (let l = 0; l < oc; l++) s += Math.ceil(100 * Math.pow(1.5, l)); return s; })();
    console.log(`overcharge ${String(oc).padStart(2)} (x${Math.pow(1.3, oc).toFixed(1)}, cumulative cost ${fmt(c)} Embers): ult share all ${(avg(r.ultAll) * 100).toFixed(0)}%  boss ${(avg(r.ultBoss) * 100).toFixed(0)}%  floor@60m ${avg(r.floor).toFixed(1)}`);
  }
}

// =========================================================== Ember income sources
function embersrc() {
  for (const prof of ['typist', 'burst', 'idle']) {
    const tot = { ult: 0, boss: 0, rat: 0 }; let H = 4;
    for (const seed of [1, 2, 3]) {
      const KK = load({ seed }); KK.world.reset();
      const orig = KK.gainEmbers; let src = 'ult';
      KK.on('kill', () => {});
      const W = KK.world; const ok = W.killEnemy, cr = W.catchRat;
      W.killEnemy = function (e) { src = e.boss ? 'boss' : 'ult'; const r = ok.call(this, e); src = 'ult'; return r; };
      W.catchRat = function () { src = 'rat'; const r = cr.call(this); src = 'ult'; return r; };
      KK.gainEmbers = (n) => { tot[src] += n * KK.mods().emberGain; orig(n); };
      makePlayer(KK, { profile: prof, retirePolicy: POL.stall8 }).run(H * 3600);
    }
    const all = tot.ult + tot.boss + tot.rat;
    console.log(`${prof.padEnd(6)} embers/h ${(all / 3 / H).toFixed(0)}: ults ${(tot.ult / all * 100).toFixed(0)}%  bosses ${(tot.boss / all * 100).toFixed(0)}%  rats ${(tot.rat / all * 100).toFixed(0)}%`);
  }
}

const SC = { pacing, longrun, demo, wsvalue, wsday, legvalue, offline, heroes, legacy, firstretire, ultshare, embersrc };
if (!SC[which]) { console.log('unknown scenario; one of ' + Object.keys(SC).join(' ')); process.exit(1); }
SC[which]();
