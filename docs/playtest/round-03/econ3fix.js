// T1 economist, round 03: in-memory tests of proposed fixes (no game file is edited; patches live in this process only).
// node docs/playtest/round-03/econ3fix.js demo [min] | kindling [hours] | overcharge [hours] | crucible
const load = require('../../../tools/headless');
const which = process.argv[2] || 'demo';
const hm = (s) => `${Math.floor(s / 3600)}h${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
const avg = (a) => { const b = a.filter((x) => x === x); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : NaN; };
const rng = (a) => { const b = a.filter((x) => x === x); return b.length ? `${Math.min(...b).toFixed(0)}-${Math.max(...b).toFixed(0)}` : 'n/a'; };

// same player model as econ3.js (copied so the two scripts stay independent)
function makePlayer(KK, o = {}) {
  const S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F, rnd = KK.rng;
  const P = { t: 0, profile: o.profile || 'typist', nextGlance: 0, typing: false, sw: 0, acc: 0, lastMax: 1, lastMaxT: 0, runStart: 0, retires: [], checkpoints: {} };
  P.activity = function (dt) {
    const pr = P.profile; if (pr === 'idle') return;
    P.sw -= dt;
    if (P.sw <= 0) { P.typing = !P.typing; P.sw = pr === 'burst' ? (P.typing ? 5 + rnd() * 10 : 60 + rnd() * 120) : (P.typing ? 20 + rnd() * 40 : 15 + rnd() * (pr === 'heavy' ? 10 : 40)); }
    if (P.typing) { P.acc += dt * (pr === 'heavy' ? 6 : 4); while (P.acc >= 1) { P.acc -= 1; KK.addActivity('key'); } }
  };
  P.spend = function () {
    const s = S();
    if (s.relicOffer) A.pickRelic(s.relicOffer[0]);
    if (KK.world.rat) KK.world.catchRat();
    for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) A.recruit(id);
    let ch = true; while (ch) { ch = false; for (const d of D.LEGACY) if (A.buyLegacy(d.id)) ch = true; }
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
  P.nudge = () => { const s = S(), g = A.renownGain(); return g >= 30 && ((P.t - P.runStart) > 25 * 60 || (s.retires === 0 && s.maxFloorRun >= 40)); };
  P.doRetire = function (free) {
    const s = S();
    let gain = 0;
    if (free) { // demo variant: a zero-Renown retire is allowed once the demo Renown is maxed
      s.retires++; s.gold = 0; s.forge = {}; s.relics = []; s.relicOffer = null; s.relicQueue = []; s.bossBlock = 0; KK.dirty();
      const m = KK.mods(); s.heroes = { knight: 1 + m.startLvl, archer: 0, mage: 0, cleric: 0 }; s.floor = m.startFloor; s.maxFloorRun = m.startFloor; KK.dirty();
    } else { gain = A.retire(); if (!gain) return false; }
    P.retires.push({ at: P.t, run: (P.t - P.runStart) / 60, floor: P.lastMax, gain, life: s.renownLifetime });
    KK.world.reset(); P.runStart = P.t; P.lastMax = s.maxFloorRun; P.lastMaxT = P.t;
    P.spend();
    return true;
  };
  P.step = function (dt) {
    P.activity(dt); KK.world.update(dt); P.t += dt;
    const s = S();
    if (s.maxFloorRun > P.lastMax) { P.lastMax = s.maxFloorRun; P.lastMaxT = P.t; }
    if (P.t >= P.nextGlance) {
      P.nextGlance = P.t + 60; P.spend();
      if (o.retirePolicy) { const r = o.retirePolicy(KK, P); if (r === 'free') P.doRetire(true); else if (r && A.canRetire()) P.doRetire(false); }
    }
  };
  P.run = function (sec, cps = []) {
    const want = cps.slice().sort((a, b) => a - b);
    while (P.t < sec) { P.step(1 / 30); while (want.length && P.t >= want[0]) { const c = want.shift(); P.checkpoints[c] = { floor: S().maxFloorEver, renown: S().renownLifetime }; } }
    return P;
  };
  return P;
}
const stall8 = (KK, P) => P.t - P.lastMaxT > 8 * 60;
const nudgeOrStall = (KK, P) => P.nudge() || P.t - P.lastMaxT > 8 * 60;

// ------------------------------------------------------------------ demo variants
function patchLoopWithBoss(KK) {
  // after the cap boss, the farm loop is floors 37-40 *including* the boss (relic chest + Embers every lap)
  const W = KK.world, F = KK.F;
  W.nextFloor = function () {
    const S = KK.S;
    if (KK.DEMO_CAP && S.floor >= KK.DEMO_CAP) { if (!S.demoDone) { S.demoDone = true; KK.emit('demoComplete'); } S.floor = KK.DEMO_CAP - 4; }
    S.floor++;
    if (S.floor > S.maxFloorRun) S.maxFloorRun = S.floor;
    if (S.floor > S.maxFloorEver) S.maxFloorEver = S.floor;
    W.wave = 0; W.door = null; W.chest = null; W.chestRolled = false; W.enemies = []; W.shots = [];
    for (const h of W.heroes) if (h.dead) { h.dead = false; h.hp = h.maxHp * 0.5; }
    KK.emit('floor', { floor: S.floor, biomeChange: F.biomeOf(S.floor) !== F.biomeOf(S.floor - 1), boss: F.isBossFloor(S.floor) });
  };
}
function demo() {
  const MIN = +(process.argv[3] || 120);
  const variants = {
    current: { cap: 40 },
    loopBoss: { cap: 40, loop: true },
    'loopBoss+freeRetire': { cap: 40, loop: true, free: true },
    cap50: { cap: 50 },
  };
  console.log(`=== demo variants, ${MIN} min, nudge-or-stall-8 retires, 5 seeds ===`);
  for (const [vname, v] of Object.entries(variants)) {
    for (const prof of ['typist', 'burst', 'idle']) {
      const r = { done: [], R: [], nret: [], offersAfter: [], embAfterH: [], lapMin: [], speed: [], buysAfter: [], b40: [] };
      for (const seed of [1, 2, 3, 4, 5]) {
        const KK = load({ seed, demo: true }); KK.DEMO_CAP = v.cap; KK.world.reset();
        if (v.loop) patchLoopWithBoss(KK);
        let doneT = NaN, offersAfter = 0, embAt = 0, capBoss = [], buysAfter = 0, runStartForSpeed = 0, speed = [];
        const pol = (K, P) => {
          if (v.free && K.S.demoDone && K.S.renownLifetime >= (K.F.renownFor(v.cap)) && !K.actions.canRetire()) {
            // speedrun loop: once maxed, retire for free after each cap-boss kill in this run
            if (P.capKilledThisRun) { P.capKilledThisRun = false; return 'free'; }
            return false;
          }
          return nudgeOrStall(K, P);
        };
        const P = makePlayer(KK, { profile: prof, retirePolicy: pol });
        KK.on('demoComplete', () => { doneT = P.t; embAt = KK.S.embers; });
        KK.on('relicOffer', () => { if (doneT === doneT) offersAfter++; });
        KK.on('upgrade', () => { if (doneT === doneT) buysAfter++; });
        KK.on('kill', ({ e }) => { if (e.boss && KK.S.floor === v.cap) { capBoss.push(P.t); if (KK.S.demoDone && P.retires.length) { speed.push((P.t - P.runStart) / 60); } P.capKilledThisRun = true; } });
        let embEarnAfter = 0;
        while (P.t < MIN * 60) { const e0 = KK.S.embers; P.step(1 / 30); if (doneT === doneT && KK.S.embers > e0) embEarnAfter += KK.S.embers - e0; }
        const after = doneT === doneT ? (MIN * 60 - doneT) / 3600 : NaN;
        r.done.push(doneT / 60); r.R.push(KK.S.renownLifetime); r.nret.push(P.retires.length);
        r.offersAfter.push(after > 0 ? offersAfter / after : NaN); r.embAfterH.push(after > 0 ? embEarnAfter / after : NaN);
        const laps = []; for (let i = 1; i < capBoss.length; i++) laps.push((capBoss[i] - capBoss[i - 1]) / 60);
        r.lapMin.push(laps.length ? avg(laps) : NaN); r.speed.push(speed.length ? Math.min(...speed) : NaN); r.buysAfter.push(after > 0 ? buysAfter / after : NaN);
      }
      console.log(`${vname.padEnd(20)} ${prof.padEnd(6)} demoComplete ${rng(r.done)}m | lifetime R ${rng(r.R)} | retires ${rng(r.nret)} | after cap: relic offers/h ${avg(r.offersAfter).toFixed(1)}, embers/h ${avg(r.embAfterH).toFixed(0)}, upgrades/h ${avg(r.buysAfter).toFixed(1)} | cap-boss lap ${avg(r.lapMin).toFixed(1)}m | best run-to-cap ${avg(r.speed).toFixed(1)}m`);
    }
  }
}

// ------------------------------------------------------------------ Kindling rework / Fervor grace
function patchGrace(KK, graceFn) {
  const S = () => KK.S;
  KK.tickFervor = function (dt) {
    const s = S(), m = KK.mods();
    const grace = graceFn(KK, m);
    if (KK.lastInputAgo() > grace && s.fervor > 0) {
      const before = KK.fervorTier();
      s.fervor = Math.max(0, s.fervor - 3.5 * m.fervDecay * dt);
      const after = KK.fervorTier();
      if (after !== before) KK.emit('fervorTier', { from: before, to: after });
    }
    if (KK.fervorTier() === 3) s.stats.flowTime += dt;
  };
}
function kindling() {
  const H = +(process.argv[3] || 8);
  const variants = {
    current: null,
    afterglow: (KK) => { // Kindling -> "+1 s Fervor grace per level" (3 s -> 13 s at max), no Fervor gain
      const k = KK.DATA.WORKSHOP.find((d) => d.id === 'kindling'); k.apply = (m, l) => { m.grace = 3 + l; };
      patchGrace(KK, (K, m) => m.grace || 3);
    },
    afterglow2: (KK) => { // +2 s per level, max 10 (23 s)
      const k = KK.DATA.WORKSHOP.find((d) => d.id === 'kindling'); k.apply = (m, l) => { m.grace = 3 + 2 * l; };
      patchGrace(KK, (K, m) => m.grace || 3);
    },
    grace8below60: (KK) => patchGrace(KK, (K) => (K.S.fervor < 60 ? 8 : 3)), // R2 F7 idea
  };
  console.log(`=== Kindling / Fervor-grace variants, ${H} h, stall-8 retires, 4 seeds ===`);
  for (const [vname, patch] of Object.entries(variants)) {
    for (const prof of ['burst', 'typist', 'idle']) {
      if (prof === 'idle' && vname !== 'current') continue;
      const f4 = [], f8 = [], r8 = [], tier = [0, 0, 0, 0];
      for (const seed of [1, 2, 3, 4]) {
        const KK = load({ seed }); if (patch) patch(KK); KK.world.reset();
        const P = makePlayer(KK, { profile: prof, retirePolicy: stall8 });
        while (P.t < H * 3600) { P.step(1 / 30); tier[KK.fervorTier()] += 1; if (Math.abs(P.t - 14400) < 1 / 60) f4.push(KK.S.maxFloorEver); }
        f8.push(KK.S.maxFloorEver); r8.push(KK.S.renownLifetime);
      }
      const tot = tier.reduce((a, b) => a + b, 0);
      console.log(`${vname.padEnd(14)} ${prof.padEnd(6)} deepest 4h f${avg(f4).toFixed(1)}  ${H}h f${avg(f8).toFixed(1)}  R ${avg(r8).toFixed(0)}  fervor IDLE/FOC/ZONE/FLOW ${tier.map((x) => Math.round(x / tot * 100) + '%').join('/')}`);
    }
  }
}

// ------------------------------------------------------------------ Overcharge cost growth (long-tail typist/idle gap)
function overcharge() {
  const H = +(process.argv[3] || 24);
  const cps = [4, 8, 16, 24].filter((h) => h <= H).map((h) => h * 3600);
  for (const g of [1.5, 1.6, 1.7]) {
    for (const prof of ['typist', 'idle']) {
      const rows = cps.map(() => ({ f: [], r: [] })); let oc = [];
      for (const seed of [1, 2, 3]) {
        const KK = load({ seed }); KK.DATA.WORKSHOP.find((d) => d.id === 'overcharge').growth = g; KK.world.reset();
        const P = makePlayer(KK, { profile: prof, retirePolicy: stall8 }).run(H * 3600, cps);
        cps.forEach((c, i) => { rows[i].f.push(P.checkpoints[c].floor); rows[i].r.push(P.checkpoints[c].renown); });
        oc.push(KK.S.workshop.overcharge || 0);
      }
      console.log(`overcharge growth ${g} ${prof.padEnd(6)} ` + cps.map((c, i) => `${hm(c)} f${avg(rows[i].f).toFixed(0)} R${avg(rows[i].r).toFixed(0)}`).join(' | ') + `  | overcharge lv at end ${oc.join('/')}`);
    }
  }
}

// ------------------------------------------------------------------ Crucible rush vs no Crucible
function crucible() {
  const H = +(process.argv[3] || 8);
  const rush = (K) => { while (K.actions.buyWorkshop('crucible')); if ((K.S.workshop.crucible || 0) < 10) return; for (let k = 0; k < 50; k++) { let d = false; for (const x of K.DATA.WORKSHOP) if (K.actions.buyWorkshop(x.id)) d = true; if (!d) break; } };
  const noCru = (K) => { for (let k = 0; k < 50; k++) { let d = false; for (const x of K.DATA.WORKSHOP) if (x.id !== 'crucible' && K.actions.buyWorkshop(x.id)) d = true; if (!d) break; } };
  const overRush = (K) => { while (K.actions.buyWorkshop('overcharge')); };
  for (const prof of ['typist', 'idle']) {
    for (const [name, ws] of [['default', null], ['crucibleRush', rush], ['noCrucible', noCru], ['overchargeOnly', overRush]]) {
      const cps = [3600, 4 * 3600, H * 3600]; const rows = cps.map(() => []);
      for (const seed of [1, 2, 3, 4]) {
        const KK = load({ seed }); KK.world.reset();
        const P = makePlayer(KK, { profile: prof, retirePolicy: stall8, workshop: ws || undefined }).run(H * 3600, cps);
        cps.forEach((c, i) => rows[i].push(P.checkpoints[c].floor));
      }
      console.log(`${prof.padEnd(6)} ${name.padEnd(14)} deepest ` + cps.map((c, i) => `${hm(c)} f${avg(rows[i]).toFixed(1)}`).join(' | '));
    }
  }
}


// ------------------------------------------------------------------ long tail past f100: soft wall options
function tail() {
  const H = +(process.argv[3] || 24);
  const cps = [8, 16, 24, 32, 40].filter((h) => h <= H).map((h) => h * 3600);
  const variants = {
    current: null,
    hpTaper122: (KK) => { const o = KK.F.enemyHp; KK.F.enemyHp = (f) => (f <= 100 ? o(f) : o(100) * Math.pow(1.22, f - 100)); },
    hpTaper125: (KK) => { const o = KK.F.enemyHp; KK.F.enemyHp = (f) => (f <= 100 ? o(f) : o(100) * Math.pow(1.25, f - 100)); },
    renownX2past100: (KK) => { const o = KK.F.renownFor; KK.F.renownFor = (f) => (f <= 100 ? o(f) : Math.floor(o(f) * (1 + (f - 100) / 50))); },
  };
  for (const [vname, patch] of Object.entries(variants)) {
    for (const prof of ['typist', 'idle']) {
      const rows = cps.map(() => ({ f: [], r: [] })); const lastGain = [], lastRun = [];
      for (const seed of [1, 2, 3]) {
        const KK = load({ seed }); if (patch) patch(KK); KK.world.reset();
        const P = makePlayer(KK, { profile: prof, retirePolicy: stall8 }).run(H * 3600, cps);
        cps.forEach((c, i) => { rows[i].f.push(P.checkpoints[c].floor); rows[i].r.push(P.checkpoints[c].renown); });
        const late = P.retires.filter((x) => x.at > (H - 8) * 3600);
        lastGain.push(late.length ? avg(late.map((x) => x.gain)) : 0); lastRun.push(late.length ? avg(late.map((x) => x.run)) : NaN);
      }
      console.log(`${vname.padEnd(16)} ${prof.padEnd(6)} ` + cps.map((c, i) => `${hm(c)} f${avg(rows[i].f).toFixed(0)} R${avg(rows[i].r).toFixed(0)}`).join(' | ') + ` | last 8h: avg gain +${avg(lastGain).toFixed(0)}, avg run ${avg(lastRun).toFixed(0)}m`);
    }
  }
}


// ------------------------------------------------------------------ light-typist / idle Workshop alternatives for the dead Kindling slot
function lightkeys() {
  const H = +(process.argv[3] || 8);
  const kind = (KK) => KK.DATA.WORKSHOP.find((d) => d.id === 'kindling');
  const variants = {
    current: null,
    kindlingSparks: (KK) => { // Kindling -> +10% Sparks per keystroke per level (fractional carry)
      kind(KK).apply = (m, l) => { m.sparkMult = 1 + 0.1 * l; };
      let carry = 0; const orig = KK.addActivity;
      KK.addActivity = function (k) { orig(k); const m = KK.mods(); if (!KK.S.settings.countInput || !(m.sparkMult > 1)) return; carry += m.sparkMult - 1; while (carry >= 1) { carry -= 1; if (KK.S.sparks < m.sparkCap) KK.S.sparks += 1; } };
    },
    kindlingRats: (KK) => { // Kindling -> golden rats 10% more often per level (idle-friendly)
      kind(KK).apply = (m, l) => { m.ratFreq = 1 + 0.1 * l; };
      const W = KK.world, up = W.update; let prev = W.nextRat || 0;
      W.update = function (dt) { up.call(W, dt); if (W.nextRat > prev + 1) W.nextRat /= (KK.mods().ratFreq || 1); prev = W.nextRat; };
    },
    firstKeysDouble: (KK) => { // the first 60 keys in each minute make 2 Sparks (light typists' keys count double)
      let win = -1, n = 0; const orig = KK.addActivity;
      KK.addActivity = function (k) { orig(k); const mi = Math.floor((KK.simTime || 0) / 60); if (mi !== win) { win = mi; n = 0; } if (++n <= 60 && KK.S.sparks < KK.mods().sparkCap) KK.S.sparks += 1; };
    },
  };
  console.log(`=== Kindling-slot alternatives, ${H} h, stall-8 retires, 4 seeds ===`);
  for (const [vname, patch] of Object.entries(variants)) {
    for (const prof of ['burst', 'typist', 'idle']) {
      if (vname === 'firstKeysDouble' && prof === 'idle') continue;
      const f4 = [], f8 = [], r8 = [], emb = [], ws = [];
      for (const seed of [1, 2, 3, 4]) {
        const KK = load({ seed }); KK.world.reset(); if (patch) patch(KK);
        let e = 0; const P = makePlayer(KK, { profile: prof, retirePolicy: stall8 });
        while (P.t < H * 3600) { const e0 = KK.S.embers; P.step(1 / 30); if (KK.S.embers > e0) e += KK.S.embers - e0; if (Math.abs(P.t - 14400) < 1 / 60) f4.push(KK.S.maxFloorEver); }
        f8.push(KK.S.maxFloorEver); r8.push(KK.S.renownLifetime); emb.push(e / H);
        if (seed === 1) ws.push(JSON.stringify(KK.S.workshop));
      }
      console.log(`${vname.padEnd(15)} ${prof.padEnd(6)} deepest 4h f${avg(f4).toFixed(1)}  ${H}h f${avg(f8).toFixed(1)}  R ${avg(r8).toFixed(0)}  embers/h ${avg(emb).toFixed(0)}  ws(seed1) ${ws[0]}`);
    }
  }
}

// warm start: after >= 60 s without input, the next 40 keys make +2 extra Sparks each (targets light typists only)
function warmstart() {
  const H = +(process.argv[3] || 8);
  for (const on of [false, true]) {
    for (const prof of ['burst', 'typist']) {
      const f4 = [], f8 = [], emb = [];
      for (const seed of [1, 2, 3, 4]) {
        const KK = load({ seed }); KK.world.reset();
        if (on) { let left = 0; const orig = KK.addActivity; KK.addActivity = function (k) { if (KK.lastInputAgo() >= 60) left = 40; orig(k); if (left > 0) { left--; const cap = KK.mods().sparkCap; KK.S.sparks = Math.min(cap, KK.S.sparks + 2); } }; }
        let e = 0; const P = makePlayer(KK, { profile: prof, retirePolicy: stall8 });
        while (P.t < H * 3600) { const e0 = KK.S.embers; P.step(1 / 30); if (KK.S.embers > e0) e += KK.S.embers - e0; if (Math.abs(P.t - 14400) < 1 / 60) f4.push(KK.S.maxFloorEver); }
        f8.push(KK.S.maxFloorEver); emb.push(e / H);
      }
      console.log(`warmStart ${on ? 'on ' : 'off'} ${prof.padEnd(6)} deepest 4h f${avg(f4).toFixed(1)}  ${H}h f${avg(f8).toFixed(1)}  embers/h ${avg(emb).toFixed(0)}`);
    }
  }
}

const SC = { demo, kindling, overcharge, crucible, tail, lightkeys, warmstart };
if (!SC[which]) { console.log('unknown scenario; one of ' + Object.keys(SC).join(' ')); process.exit(1); }
SC[which]();
