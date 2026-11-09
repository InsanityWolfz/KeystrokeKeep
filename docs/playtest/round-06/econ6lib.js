// T1 economist, round 06: shared player model + loader (read-only use of the game code).
// Same smart-spend player as round-04/econ4.js, plus telemetry for achievements, trophies,
// void slams / Hollowed boss fights and Sanctuary casts.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// like tools/headless.js, but can inject a fake kkNative (to drive the real KK.load path)
function load(opts = {}) {
  const ctx = { console, Math: Object.create(Math), Date, JSON, Object, Array, Set, Map, String, Number, Infinity, NaN, isFinite, parseInt, parseFloat };
  if (opts.seed !== undefined) ctx.Math.random = mulberry32(opts.seed >>> 0);
  ctx.globalThis = ctx;
  if (opts.bal) ctx.BAL_OVERRIDE = opts.bal;
  if (opts.demo) ctx.KK_DEMO_CAP = 40;
  if (opts.native) ctx.kkNative = opts.native;
  vm.createContext(ctx);
  for (const f of ['util', 'data', 'state', 'world', 'achievements']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  }
  ctx.KK.rng = ctx.Math.random;
  return ctx.KK;
}

const hm = (s) => `${Math.floor(s / 3600)}h${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
const avg = (a) => { const b = a.filter((x) => x === x && x !== undefined && x !== null); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : NaN; };
const rg = (a, d = 0) => { const b = a.filter((x) => x === x && x !== undefined && x !== null); return b.length ? `${Math.min(...b).toFixed(d)}-${Math.max(...b).toFixed(d)}` : 'n/a'; };
const SEEDS = (n, o = 0) => Array.from({ length: n }, (_, i) => i + 1 + o);

const RELIC_RANK = {
  typist: ['echo', 'flowpend', 'glass', 'hotkey', 'lens', 'enter', 'whetstone', 'coffee', 'capslock', 'fang', 'belt', 'luckycoin', 'spacebar', 'keycap', 'map', 'oil', 'boots'],
  idle: ['echo', 'glass', 'lens', 'whetstone', 'coffee', 'enter', 'fang', 'belt', 'luckycoin', 'spacebar', 'map', 'oil', 'boots', 'capslock', 'keycap', 'flowpend', 'hotkey'],
};

function makePlayer(KK, o = {}) {
  const S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F, rnd = KK.rng, W = KK.world;
  const prof = o.profile || 'typist';
  const rank = RELIC_RANK[prof === 'idle' ? 'idle' : 'typist'];
  const P = { t: 0, nextG: 0, typing: false, sw: 0, acc: 0, lastMax: S().maxFloorRun, lastMaxT: 0, runStart: 0, retires: [], cps: {}, omens: {}, embersEarned: 0, relicOffers: 0, swSparks: 0, swTrig: 0,
    ach: {}, achFloor: {}, trophyT: {}, hf: [], voidSlams: 0, sanct: 0, sanctVoid: 0, wipes: 0, wipesHollow: 0, blockHollowT: 0, deaths: 0 };
  // ------------------------------------------------ telemetry
  KK.on('achievement', ({ id }) => { if (!(id in P.ach)) { P.ach[id] = P.t; P.achFloor[id] = S().maxFloorEver; } });
  KK.on('trophy', ({ floor }) => { if (!(floor in P.trophyT)) P.trophyT[floor] = P.t; });
  let fight = null;
  KK.on('bossSpawn', ({ boss }) => {
    if (o.noVoid) boss.voidT = 1e9;
    if (boss.hollowed || boss.key === 'hollow') fight = { floor: S().floor, start: P.t, boss, slams: 0, sanct: 0, deaths: 0 };
    else fight = null;
  });
  KK.on('voidSlam', () => { P.voidSlams++; if (fight) fight.slams++; });
  KK.on('ult', ({ id }) => { if (id === 'cleric') { P.sanct++; if (fight && !fight.boss.dead) { P.sanctVoid++; fight.sanct++; } } });
  KK.on('heroDown', () => { P.deaths++; if (fight && !fight.boss.dead) fight.deaths++; });
  KK.on('kill', ({ e }) => { if (fight && e === fight.boss) { P.hf.push({ floor: fight.floor, dur: P.t - fight.start, won: true, slams: fight.slams, sanct: fight.sanct, deaths: fight.deaths, t: P.t, prof }); fight = null; } });
  KK.on('wipe', () => { P.wipes++; if (fight && !fight.boss.dead) { P.wipesHollow++; P.hf.push({ floor: fight.floor, dur: P.t - fight.start, won: false, slams: fight.slams, sanct: fight.sanct, deaths: fight.deaths, t: P.t, prof }); fight = null; } });
  KK.on('retired', () => { fight = null; closeBF('retired'); });
  // ---- R6: every boss fight (enrage, War Charge, Reassemble), Codex ranks
  P.bf = []; P.enrages = 0; P.warCharges = 0; P.reassembles = 0; P.codexT = []; P.streaks = []; P.enrageByFloor = {};
  let bf = null, streak = { floor: 0, n: 0 };
  function closeBF(out) {
    if (!bf) return;
    bf.out = out; bf.wall = P.t - bf.start; bf.fightT = bf.boss.fightT || 0; delete bf.boss; P.bf.push(bf);
    if (out === 'enrage') { if (streak.floor === bf.floor) streak.n++; else { if (streak.n) P.streaks.push({ ...streak, end: 'moved' }); streak = { floor: bf.floor, n: 1, t0: P.t }; } }
    else if (out === 'won' && streak.floor === bf.floor && streak.n) { P.streaks.push({ ...streak, end: 'won', dt: P.t - streak.t0 }); streak = { floor: 0, n: 0 }; }
    else if (out === 'retired' && streak.n) { P.streaks.push({ ...streak, end: 'retired', dt: P.t - streak.t0 }); streak = { floor: 0, n: 0 }; }
    bf = null;
  }
  P.flushStreak = () => { if (streak.n) P.streaks.push({ ...streak, end: 'open', dt: P.t - streak.t0 }); streak = { floor: 0, n: 0 }; };
  KK.on('bossSpawn', ({ boss }) => {
    closeBF('lost?');
    if (o.softEnrage) boss.fightT = -1e9;
    if (o.wounds && wound[S().floor] !== undefined) { const w = wound[S().floor]; boss.hp = boss.maxHp * (w + (1 - w) * o.wounds); }
    if (o.noEnrage) boss.fightT = -1e9; else if (o.enrageAt) boss.fightT = 180 - o.enrageAt;
    if (o.noWarCharge && boss.key === 'warlord') boss.chT = 1e12;
    if (o.noReassemble && boss.key === 'boneking') boss.reassembled = true;
    bf = { floor: S().floor, key: boss.key, hollow: !!(boss.hollowed || boss.key === 'hollow'), start: P.t, boss, omen: S().omen, prof, deaths: 0 };
  });
  KK.on('heroDown', () => { if (bf) bf.deaths++; });
  // test-only: the fix for the shipped enrage guard (W.wipeT ends slightly negative after recover, so !W.wipeT is false for the rest of the delve)
  if (o.fixEnrage) KK.on('recovered', () => { KK.world.wipeT = 0; });
  const wound = {};
  if (o.wounds) { KK.on('bossEnrage', ({ e }) => { wound[S().floor] = Math.max(0.05, e.hp / e.maxHp); }); KK.on('retired', () => { for (const k in wound) delete wound[k]; }); KK.on('kill', ({ e }) => { if (e.boss) delete wound[S().floor]; }); }
  KK.on('bossEnrage', () => { P.enrages++; P.enrageByFloor[S().floor] = (P.enrageByFloor[S().floor] || 0) + 1; if (bf) bf.enraged = true; });
  KK.on('warCharge', () => { P.warCharges++; });
  KK.on('reassemble', () => { P.reassembles++; });
  KK.on('codex', () => { P.codexT.push({ t: P.t, total: KK.mods().codexRanks }); });
  KK.on('kill', ({ e }) => { if (bf && e === bf.boss) closeBF('won'); });
  KK.on('wipe', () => { if (bf) closeBF(bf.enraged ? 'enrage' : 'wipe'); });
  if (o.codexMult) { const om = KK.mods; let last = null; KK.mods = function () { const m = om(); if (m !== last) { last = m; if (m.codexRanks) { const c = Math.pow(o.codexMult / 1.03, m.codexRanks); m.dmg *= c; m.gold *= c; } } return m; }; }
  if (o.noVigil) { const orig = W.sanctuaryReact; W.sanctuaryReact = function () { return orig.call(W, false); }; }
  if (o.noSanct) { W.sanctuaryReact = function () {}; }
  // test-only: cap one regular Cleric heal at o.healCap x the target's max HP (Sanctuary's full heal passes amt === maxHp)
  if (o.healCap) { const origH = W.healHero; W.healHero = function (h, amt, src) { if (src && src.id === 'cleric' && amt !== h.maxHp) amt = Math.min(amt, h.maxHp * o.healCap); return origH.call(W, h, amt, src); }; }
  // ------------------------------------------------ player
  P.activity = (dt) => {
    if (prof === 'idle') return;
    P.sw -= dt;
    if (P.sw <= 0) { P.typing = !P.typing; P.sw = prof === 'burst' ? (P.typing ? 5 + rnd() * 10 : 60 + rnd() * 120) : (P.typing ? 20 + rnd() * 40 : 15 + rnd() * (prof === 'heavy' ? 10 : 40)); }
    if (P.typing) { P.acc += dt * (prof === 'heavy' ? 6 : 4); while (P.acc >= 1) { P.acc -= 1; const sw0 = S().secondWind, ago = KK.lastInputAgo(); KK.addActivity('key'); if (S().secondWind < sw0 || (ago >= 30 && S().secondWind > 0)) P.swSparks += 2; if (ago >= 30 && KK.mods().secondWind > 0) P.swTrig++; } }
  };
  P.pickRelic = () => {
    const s = S();
    while (s.relicOffer) {
      const off = s.relicOffer;
      const id = (o.relic === 'first') ? off[0] : off.slice().sort((a, b) => rank.indexOf(a) - rank.indexOf(b))[0];
      A.pickRelic(id);
    }
  };
  P.spend = () => {
    const s = S();
    P.pickRelic();
    if (KK.world.rat && !o.noRats) KK.world.catchRat();
    for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) A.recruit(id);
    if (o.legacy) o.legacy(KK); else { let ch = true; while (ch) { ch = false; for (const d of D.LEGACY) if (A.buyLegacy(d.id)) ch = true; } }
    if (o.workshop) o.workshop(KK); else for (let k = 0; k < 50; k++) { let did = false; for (const d of D.WORKSHOP) if (A.buyWorkshop(d.id)) did = true; if (!did) break; }
    for (let i = 0; i < 400; i++) {
      let did = false;
      for (const d of D.FORGE) { if (o.skipForge && o.skipForge.includes(d.id)) continue; const c = F.upCost(d, s.forge[d.id] || 0); if ((s.forge[d.id] || 0) < d.max && c < s.gold * 0.4) { A.buyForge(d.id); did = true; } }
      let best = null, bc = Infinity;
      for (const id of D.PARTY_ORDER) { if (!s.heroes[id]) continue; const c = F.levelCost(id, s.heroes[id]); if (c < bc) { bc = c; best = id; } }
      if (best && bc <= s.gold) { A.levelHero(best, 1); did = true; }
      if (!did) break;
    }
  };
  P.chooseOmen = () => {
    const s = S();
    if (!s.omenOffer) return;
    let id = null;
    if (o.forceOmen) { if (o.forceOmen !== 'none') { if (!s.omenOffer.includes(o.forceOmen)) s.omenOffer[0] = o.forceOmen; id = o.forceOmen; } }
    else if (o.omenRank) { const r = o.omenRank; const best = s.omenOffer.filter((x) => r.includes(x)).sort((a, b) => r.indexOf(a) - r.indexOf(b))[0]; id = best || null; }
    else if (o.omen === 'random') id = s.omenOffer[Math.floor(rnd() * 3)];
    else if (o.omen === 'first') id = s.omenOffer[0];
    A.pickOmen(id);
    P.omens[id || 'none'] = (P.omens[id || 'none'] || 0) + 1;
  };
  P.doRetire = (why) => {
    const s = S();
    const life0 = s.renownLifetime;
    const g = A.retire();
    if (!g) return false;
    P.retires.push({ at: P.t, run: (P.t - P.runStart) / 60, floor: P.lastMax, gain: s.renownLifetime - life0, why, omen: P.curOmen || null, life: s.renownLifetime });
    KK.world.reset(); P.runStart = P.t; P.lastMax = s.maxFloorRun; P.lastMaxT = P.t;
    P.chooseOmen(); P.curOmen = s.omen;
    P.spend();
    return true;
  };
  P.nudge = () => {
    const s = S(), g = A.renownGain();
    if (KK.DEMO_CAP && !s.demoDone) return false;
    return g >= 30 && ((s.runTime || 0) / 60 > 25 || (s.retires === 0 && s.maxFloorRun >= 40));
  };
  P.step = (dt) => {
    P.activity(dt);
    const e0 = S().embers;
    KK.world.update(dt);
    if (o.softEnrage) { const b = KK.world.boss; if (b && !b.dead && b.active && !(KK.world.wipeT > 0)) { b._ft = (b._ft || 0) + dt; if (b._ft > o.softEnrage) b.atk *= Math.pow(1.02, dt); } }
    if (S().embers > e0) P.embersEarned += S().embers - e0;
    P.t += dt;
    const s = S();
    if (s.bossBlock >= 70) P.blockHollowT += dt;
    if (s.maxFloorRun > P.lastMax) { P.lastMax = s.maxFloorRun; P.lastMaxT = P.t; }
    if (P.t >= P.nextG) {
      P.nextG = P.t + (o.glance || 60);
      if (s.relicOffer) P.relicOffers++;
      P.spend();
      if (o.retirePolicy) { if (o.retirePolicy(KK, P)) P.doRetire('policy'); }
      else {
        const stall = P.t - P.lastMaxT > (o.stuck || 8) * 60;
        if (A.canRetire() && ((o.retire !== 'stall' && P.nudge()) || stall)) P.doRetire(stall ? 'stall' : 'nudge');
      }
    }
  };
  P.run = (sec, cps = []) => {
    const want = cps.slice().sort((a, b) => a - b);
    while (P.t < sec) {
      P.step(1 / 30);
      while (want.length && P.t >= want[0]) { const c = want.shift(); P.cps[c] = P.snap(); }
    }
    return P;
  };
  P.snap = () => { const s = S(); return { floor: s.maxFloorEver, renown: s.renownLifetime, retires: s.retires, embers: P.embersEarned, oc: s.workshop.overcharge || 0, ws: { ...s.workshop }, fame: KK.mods().fame, wipes: s.stats.wipes, trophies: KK.mods().trophies, ach: Object.keys(P.ach).length, voidSlams: P.voidSlams, sanct: P.sanct, wipesHollow: P.wipesHollow, codex: KK.mods().codexRanks, enrages: P.enrages, idlePow: KK.powerMult() }; };
  return P;
}

module.exports = { load, makePlayer, hm, avg, rg, SEEDS, RELIC_RANK };
