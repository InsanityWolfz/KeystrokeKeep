// Round 06 auditor: shared harness (copy of round-05/r5lib.js + signature-move, Codex, enrage telemetry, beat hook).
// Plays the real sim (tools/headless) with a nudge-following scripted player and records:
//  - novelty (majors, first omens, depth trophies, the game's own achievements from KK.ach),
//  - Sanctuary per boss fight (Vigil), Second Wind (game's 'secondWind' event), Ember sources,
//  - per-boss fight telemetry (duration, swings, slams, wipes) by hour, for the signature-move design,
//  - Legacy/Workshop saturation (what is left to buy), demo Renown cap and re-delve return values.
// Nothing here edits game files. o.patch(KK, hooks) may monkeypatch the private KK instance in memory.
const load = require('./headless_src'); // KK_SRC=<dir> to pin the js/ version

function run(o = {}) {
  const PROFILE = o.profile || 'typist', MIN = o.min || 480, SEED = o.seed || 1, RETIRE = o.retire || 'nudge', OMEN = o.omen || 'random', STUCK = (o.stuck || 8) * 60, GLANCE = o.glance || 60;
  const KK = load({ seed: SEED, demo: !!o.demo });
  const S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F, W = KK.world, rnd = KK.rng;
  const hooks = { tick: [], end: [], time: () => t, glance: [] };
  if (o.patch) o.patch(KK, hooks);
  W.reset();
  let t = 0;
  const R = { profile: PROFILE, seed: SEED, min: MIN, nov: [], ach: {}, trophies: [], sanct: {}, sw: {}, boss: [], retires: [], omenPicks: [], demo: {}, embers: {}, sat: {}, hs: [] };

  // ---------------- novelty
  const seenKeys = new Set();
  const first = (key, kind, label) => { if (seenKeys.has(key)) return; seenKeys.add(key); R.nov.push({ t, kind, label }); };
  KK.on('bossSpawn', ({ boss }) => first('bossname:' + boss.def.name, 'MAJOR', 'boss ' + boss.def.name + ' (f' + S().floor + ')'));
  KK.on('floor', ({ floor }) => { first('biome:' + F.biomeOf(floor).id, 'MAJOR', 'biome ' + F.biomeOf(floor).name); if (floor >= 20) first('retireUnlock', 'MAJOR', 'retire unlocked'); });
  KK.on('recruit', ({ id }) => first('recruit:' + id, 'MAJOR', 'recruit ' + id));
  KK.on('relicOffer', ({ ids }) => { first('relicOffer', 'MAJOR', 'first relic offer'); for (const id of ids) if (D.RELICS.find((x) => x.id === id).rar === 'epic') first('epic', 'MAJOR', 'first EPIC offered'); });
  KK.on('fervorTier', ({ to }) => { if (to === 3) first('flow', 'MAJOR', 'first FLOW'); });
  KK.on('ratSpawn', () => first('rat', 'MAJOR', 'first golden rat'));
  KK.on('retired', ({ gain }) => { first('retire', 'MAJOR', 'first RETIRE'); R.retires.push({ t, gain, from: lastMax }); });
  KK.on('omenPicked', ({ id }) => { if (id) { first('omen:' + id, 'OMEN', 'new omen ' + id); R.omenPicks.push({ t, id }); } });
  KK.on('revive', () => first('revive', 'MAJOR', 'first REVIVE'));
  KK.on('voidSlam', () => first('voidslam', 'MAJOR', 'first VOID SLAM'));
  KK.on('trophy', ({ floor }) => { R.trophies.push({ t, floor }); R.nov.push({ t, kind: 'TROPHY', label: 'trophy f' + floor }); });
  KK.on('achievement', ({ id }) => { if (R.ach[id] === undefined) { R.ach[id] = t; R.nov.push({ t, kind: 'ACH', label: 'ach ' + id }); } });
  // R6: Hollow Codex rank-ups are beats too; extra beat kinds can be pushed by patches via hooks.beat(kind,label)
  R.codex = [];
  KK.on('codex', ({ name, rank }) => { R.codex.push({ t, name, rank }); R.nov.push({ t, kind: 'CODEX', label: 'codex ' + name + ' ' + rank }); });
  hooks.beat = (kind, label) => R.nov.push({ t, kind, label });
  // R6: signature-move telemetry (per fight). sigEvents: event name -> counted per fight + totals
  const SIG_EVENTS = ['chargeWarn', 'warCharge', 'reassemble', 'bossEnrage', ...(o.sigEvents || [])];
  R.sigTotals = {};
  for (const name of SIG_EVENTS) {
    R.sigTotals[name] = 0;
    KK.on(name, (ev) => {
      R.sigTotals[name]++;
      if (!fight) return;
      fight.sig[name] = (fight.sig[name] || 0) + 1;
      if (fight.sigFirst[name] === undefined) fight.sigFirst[name] = t - (fight.active !== null ? fight.active : fight.t0);
      if (name === 'reassemble') fight.reassT = t;
    });
  }
  hooks.fight = () => fight;

  // ---------------- Sanctuary (per boss fight) + boss telemetry
  const sc = R.sanct = { casts: 0, bossCasts: 0, vigilCasts: 0, revives: 0, fights: 0, fightsCast: 0, fightsReach4: 0 };
  let fight = null;
  const endFight = (how) => {
    if (!fight) return;
    fight.dur = t - fight.t0; fight.how = how; fight.adur = fight.active !== null ? t - fight.active : 0; delete fight.bossRef;
    R.boss.push(fight);
    if (fight.pell) { sc.fights++; if (fight.cast) sc.fightsCast++; if (fight.swings >= 4) sc.fightsReach4++; }
    fight = null;
  };
  KK.on('bossSpawn', ({ boss }) => { endFight('replaced'); fight = { uid: boss.uid, key: boss.key, hollowed: !!boss.hollowed, floor: S().floor, t0: t, active: null, swings: 0, slams: 0, voidSlams: 0, cast: false, pell: !!S().heroes.cleric, kos: 0, retire: S().retires, hp0: boss.maxHp, heart: !!boss.heart, sig: {}, sigFirst: {}, bossRef: boss }; });
  KK.on('ult', ({ id }) => { if (id === 'cleric') { sc.casts++; if (fight) { sc.bossCasts++; fight.cast = true; } } });
  KK.on('revive', () => sc.revives++);
  KK.on('heroDown', () => { if (fight) fight.kos++; });
  KK.on('bossSlam', () => { if (fight) fight.slams++; });
  KK.on('voidSlam', () => { if (fight) fight.voidSlams++; });
  KK.on('kill', ({ e }) => { if (fight && e.uid === fight.uid) { fight.midCharge = e.chPhase || null; fight.afterReass = fight.reassT !== undefined ? t - fight.reassT : null; endFight('kill'); } });
  KK.on('wipe', () => { if (fight) endFight('wipe'); });
  KK.on('retired', () => endFight('retire'));
  function fightTick() {
    if (!fight) return;
    const b = W.boss && W.boss.uid === fight.uid ? W.boss : null;
    if (!b) return;
    if (b.active && fight.active === null) fight.active = t;
    fight.swings = b.swings || 0;
  }

  // ---------------- Second Wind via the game's own event; Sparks accounting by wrapper
  const sw = R.sw = { triggers: 0, bonusSparks: 0, sparksTotal: 0 };
  KK.on('secondWind', () => sw.triggers++);
  const origAdd = KK.addActivity;
  KK.addActivity = function (k) {
    const s = S(), sp0 = s.sparks, sw0 = s.secondWind || 0, trig0 = sw.triggers;
    origAdd(k);
    const used = (sw.triggers > trig0 ? KK.mods().secondWind : sw0) - (s.secondWind || 0);
    if (used > 0) sw.bonusSparks += Math.max(0, Math.min(2, s.sparks - sp0 - 1));
    sw.sparksTotal += Math.max(0, s.sparks - sp0);
  };

  // ---------------- Ember sources
  const em = R.embers = { ult: 0, boss: 0, rat: 0 };
  const origUlt = W.castUlt;
  W.castUlt = function (h, free) { const e0 = S().embers; const r = origUlt.call(this, h, free); em.ult += S().embers - e0; return r; };
  KK.on('kill', ({ e }) => { if (e.boss) em.boss += 10 * KK.mods().emberGain; });
  KK.on('ratCaught', () => { em.rat += 25 * KK.mods().emberGain; });

  // ---------------- saturation: when does every capped row max out
  const sat = R.sat = { legacyCappedAll: null, workshopCappedAll: null, hsMax: null };
  KK.on('upgrade', () => {
    const s = S();
    if (sat.legacyCappedAll === null && D.LEGACY.filter((d) => d.max < 999).every((d) => (s.legacy[d.id] || 0) >= d.max)) sat.legacyCappedAll = t;
    if (sat.workshopCappedAll === null && D.WORKSHOP.filter((d) => d.max < 999).every((d) => (s.workshop[d.id] || 0) >= d.max)) sat.workshopCappedAll = t;
    if (sat.hsMax === null && (s.legacy.headstart || 0) >= 8) sat.hsMax = t;
  });

  // ---------------- player model (same as R4: typist/idle/burst/heavy/light)
  let typing = false, typeSwitch = 0, keyAcc = 0;
  function activity(dt) {
    if (PROFILE === 'idle' || PROFILE === 'afk') return;
    typeSwitch -= dt;
    if (typeSwitch <= 0) {
      typing = !typing;
      if (PROFILE === 'burst') typeSwitch = typing ? 5 + rnd() * 10 : 60 + rnd() * 120;
      else if (PROFILE === 'light') typeSwitch = typing ? 10 + rnd() * 20 : 40 + rnd() * 80;
      else typeSwitch = typing ? 20 + rnd() * 40 : 15 + rnd() * (PROFILE === 'heavy' ? 10 : 40);
    }
    if (typing) { keyAcc += dt * (PROFILE === 'heavy' ? 6 : 4); while (keyAcc >= 1) { keyAcc -= 1; KK.addActivity('key'); } }
  }
  function smartSpend() {
    const s = S();
    for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) A.recruit(id);
    let changed = true;
    while (changed) {
      changed = false;
      const rows = D.LEGACY.filter((d) => (s.legacy[d.id] || 0) < d.max).sort((a, b) => (a.max === 999) - (b.max === 999) || a.cost(s.legacy[a.id] || 0) - b.cost(s.legacy[b.id] || 0));
      for (const d of rows) if (A.buyLegacy(d.id)) { changed = true; break; }
    }
    for (let k = 0; k < 50; k++) { let did = false; for (const d of D.WORKSHOP) if (A.buyWorkshop(d.id)) did = true; if (!did) break; }
    for (let i = 0; i < 400; i++) {
      let did = false;
      for (const d of D.FORGE) { const c = F.upCost(d, s.forge[d.id] || 0); if ((s.forge[d.id] || 0) < d.max && c < s.gold * 0.4) { A.buyForge(d.id); did = true; } }
      let best = null, bc = Infinity;
      for (const id of D.PARTY_ORDER) { if (!s.heroes[id]) continue; const c = F.levelCost(id, s.heroes[id]); if (c < bc) { bc = c; best = id; } }
      if (best && bc <= s.gold) { A.levelHero(best, 1); did = true; }
      if (!did) break;
    }
  }
  const omensSeen = new Set();
  function pickOmen() {
    const s = S();
    if (!s.omenOffer) return;
    let id = null;
    if (hooks.pickOmen) { const forced = hooks.pickOmen(s.omenOffer); if (forced !== undefined) { A.pickOmen(forced); return; } }
    if (OMEN === 'random') id = s.omenOffer[Math.floor(rnd() * s.omenOffer.length)];
    else if (OMEN === 'first') id = s.omenOffer[0];
    else if (OMEN === 'new') id = s.omenOffer.find((x) => !omensSeen.has(x)) || s.omenOffer[0];
    if (id) omensSeen.add(id);
    A.pickOmen(id);
  }

  // ---------------- demo bookkeeping
  const dm = R.demo = { cardAt: null, sealed: [], redelves: 0, renownAfter: 0, retireReturns: [] };
  KK.on('demoComplete', () => { dm.cardAt = t; });
  KK.on('demoSealed', ({ time }) => { dm.sealed.push({ t, time }); });
  KK.on('retired', ({ gain }) => { if (dm.cardAt !== null) { dm.redelves++; dm.renownAfter += gain || 0; } });

  // ---------------- loop
  const dt = 1 / 30;
  let nextGlance = 0, lastMax = 1, lastMaxT = 0, runStart = 0, nextHs = 0;
  const end = MIN * 60;
  while (t < end) {
    activity(dt);
    W.update(dt);
    t += dt;
    for (const fn of hooks.tick) fn(dt, t);
    fightTick();
    const s = S();
    if (t >= nextHs) { nextHs += 1800; R.hs.push({ t, hs: s.legacy.headstart || 0, start: KK.mods().startFloor, maxEver: s.maxFloorEver, renown: s.renown, life: s.renownLifetime, ach: Object.keys(s.ach || {}).length, tro: KK.mods().trophies }); }
    if (t >= nextGlance) {
      nextGlance = t + GLANCE;
      if (s.relicOffer) A.pickRelic(s.relicOffer[Math.floor(rnd() * s.relicOffer.length)]);
      pickOmen();
      smartSpend();
      for (const fn of hooks.glance) fn(t);
      if (W.rat) W.catchRat();
    }
    if (s.maxFloorRun > lastMax) { lastMax = s.maxFloorRun; lastMaxT = t; }
    const runT = t - runStart;
    let go = false;
    if (o.demo) {
      if (!s.demoDone) go = A.renownGain() > 0 && t - lastMaxT > STUCK;
      else if (s.runCapCleared) { const lastClear = dm.sealed.length ? dm.sealed[dm.sealed.length - 1].t : dm.cardAt; go = t - lastClear > 60; }
      else go = A.canRetire() && t - lastMaxT > STUCK;
    } else {
      const nudge = RETIRE === 'nudge' && A.renownGain() >= 30 && (runT > 25 * 60 || (s.retires === 0 && s.maxFloorRun >= 40));
      go = (t - lastMaxT > STUCK || nudge) && A.renownGain() > 0;
    }
    if (go) { const ret = A.retire(); if (o.demo) dm.retireReturns.push(ret); W.reset(); lastMax = S().maxFloorRun; lastMaxT = t; runStart = t; pickOmen(); }
  }
  endFight('end');
  R.proto = []; for (const fn of hooks.end) fn(R, KK);
  const s = S();
  R.end = { t, floor: s.floor, maxEver: s.maxFloorEver, retires: s.retires, renown: s.renown, renownLife: s.renownLifetime, keys: s.stats.keys, flow: s.stats.flowTime, ults: s.stats.ults, kills: s.stats.kills, chests: s.stats.chests, rats: s.stats.rats, heroes: Object.assign({}, s.heroes), workshop: Object.assign({}, s.workshop), legacy: Object.assign({}, s.legacy), bestCapTime: s.bestCapTime, demoLaps: s.demoLaps, fame: KK.mods().fame, trophies: KK.mods().trophies, embers: s.embers, achN: Object.keys(s.ach || {}).length, achTotal: KK.ach.LIST.length };
  R.KK = KK;
  return R;
}

const fmtT = (s) => (s === undefined || s === null ? '—' : `${Math.floor(s / 3600)}h${String(Math.floor(s / 60) % 60).padStart(2, '0')}`);
function buckets(list, size, from, to) { const r = []; for (let a = from; a < to; a += size) r.push(list.filter((n) => n.t >= a && n.t < a + size).length); return r; }
function gap(list, from, to) {
  const ts = [from, ...list.filter((n) => n.t >= from && n.t < to).map((n) => n.t).sort((a, b) => a - b), to];
  let g = 0, at = from;
  for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] > g) { g = ts[i] - ts[i - 1]; at = ts[i - 1]; }
  return { g, at };
}
const med = (a) => { if (!a.length) return NaN; const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
module.exports = { run, fmtT, buckets, gap, med };
