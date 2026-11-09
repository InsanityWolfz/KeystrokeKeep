// Round 04 auditor: shared harness. Plays the real sim (tools/headless) as a scripted player and records
// novelty, Sanctuary/ult/Second Wind/Hotkey telemetry, and the proposed achievement set (ACH below).
// Nothing here edits game files: everything is listeners + wrappers on a private KK instance.
// const run = require('./r4lib'); run({ profile: 'typist', min: 480, seed: 1, retire: 'nudge', omen: 'random', demo: false, trophies: null })
const load = require('../../../tools/headless');

// ------------------------------------------------------------------ proposed achievements
// Each: id, name, desc, demo (in the 5-demo set), trigger (exact rule, for the report), test(ctx) -> bool.
// ctx = { S, KK, W, ev: { type, data } | null, P: per-save achievement progress (proposed S.ach) }
// Event-driven tests run on the named event; 'poll' tests run once per sim-second.
const ACH = [
  // --- onboarding (hour 1)
  { id: 'first_boss', name: 'Cellar Door', demo: true, on: 'kill', trigger: "kill: e.boss (any boss; stats.bossKills >= 1)", test: (c) => c.ev.data.e.boss },
  { id: 'flow', name: 'Flow State', demo: true, on: 'fervorTier', trigger: 'fervorTier: to === 3', test: (c) => c.ev.data.to === 3 },
  { id: 'full_party', name: 'Fellowship', demo: true, on: 'recruit', trigger: "recruit: all of S.heroes.{knight,archer,mage,cleric} > 0", test: (c) => ['knight', 'archer', 'mage', 'cleric'].every((h) => c.S.heroes[h] > 0) },
  { id: 'rat', name: 'Gilded Whiskers', on: 'ratCaught', trigger: 'ratCaught (stats.rats >= 1)', test: () => true },
  { id: 'epic', name: 'Epic Loot', on: 'relicPicked', trigger: "relicPicked: RELICS[id].rar === 'epic'", test: (c) => c.KK.DATA.RELICS.find((r) => r.id === c.ev.data.id).rar === 'epic' },
  { id: 'caverns', name: 'Into the Moss', on: 'floor', trigger: 'floor: floor >= 21 (Mossy Caverns)', test: (c) => c.ev.data.floor >= 21 },
  { id: 'retire1', name: 'A New Generation', demo: true, on: 'retired', trigger: 'retired (S.retires >= 1)', test: () => true },
  { id: 'gatekeeper', name: 'Gatekeeper', demo: true, on: 'kill', trigger: 'kill: e.boss && S.floor === 40 (demo: same event as demoComplete)', test: (c) => c.ev.data.e.boss && c.S.floor === 40 },
  { id: 'comeback', name: 'Second Try', on: 'kill', trigger: 'kill: e.boss && the boss spawned while S.bossBlock === S.floor (capture at bossSpawn: killEnemy zeroes bossBlock before emitting kill)', test: (c) => c.ev.data.e.boss && c.P.blockedBoss === c.ev.data.e.uid },
  { id: 'echo', name: 'Say It Twice', on: 'echo', trigger: 'echo (Echo Rune fires)', test: () => true },
  // --- skill / moments
  { id: 'meteor3', name: 'Extinction Event', on: 'meteorLand', trigger: "3+ kills inside one meteorLand (count kill events whose last hit had ult && src.id==='mage' since the meteor shot landed)", test: (c) => c.P.meteorKills >= 3 },
  { id: 'ult_boss', name: 'Overkill', on: 'kill', trigger: "kill: e.boss && last hit on e had opts.ult (track via 'hit' event)", test: (c) => c.ev.data.e.boss && c.P.lastHitUlt[c.ev.data.e.uid] },
  { id: 'revive', name: 'Not Today', on: 'revive', trigger: 'revive (Sanctuary brings a hero back)', test: () => true },
  { id: 'speed40', name: 'Speedrunner', on: 'kill', trigger: 'kill: e.boss && S.floor === 40 && S.runTime < 600 && S.retires >= 1 (demo: bestCapTime < 600)', test: (c) => c.ev.data.e.boss && c.S.floor === 40 && c.S.runTime < 600 && c.S.retires >= 1 },
  { id: 'blitz', name: 'Blitz', on: 'kill', trigger: 'kill: e.boss; 5 boss kills within 600 s of sim time (P.bossTimes, KK.simTime)', test: (c) => { if (!c.ev.data.e.boss) return false; const now = c.KK.simTime; c.P.bossTimes = (c.P.bossTimes || []).filter((x) => now - x < 600); c.P.bossTimes.push(now); return c.P.bossTimes.length >= 5; } },
  { id: 'flow10', name: 'Locked In', on: 'poll', trigger: 'poll: 10 continuous minutes in fervorTier() === 3 (P.flowRun >= 600)', test: (c) => c.P.flowRun >= 600 },
  { id: 'hotkey25', name: 'Speed Dial', on: 'poll', trigger: 'poll: 25 Hotkey Ring free casts in one delve (P.hotkeyRun >= 25, reset on retired)', test: (c) => c.P.hotkeyRun >= 25 },
  { id: 'relics8', name: 'Packrat', on: 'relicPicked', trigger: 'relicPicked: S.relics.length >= 8', test: (c) => c.S.relics.length >= 8 },
  // --- depth
  { id: 'magma', name: 'Fire Below', on: 'floor', trigger: 'floor: floor >= 41', test: (c) => c.ev.data.floor >= 41 },
  { id: 'void', name: 'Into the Hollow', on: 'floor', trigger: 'floor: floor >= 61', test: (c) => c.ev.data.floor >= 61 },
  { id: 'hollow', name: 'Hollow Victory', on: 'kill', trigger: "kill: e.key === 'hollow'", test: (c) => c.ev.data.e.key === 'hollow' },
  { id: 'hollowed6', name: 'Echoes of the Deep', on: 'kill', trigger: 'kill: e.hollowed; P.hollowed (set of e.key) has all 6', test: (c) => c.P.hollowed.size >= 6 },
  { id: 'f100', name: 'Centurion', on: 'floor', trigger: 'floor: S.maxFloorEver >= 100', test: (c) => c.S.maxFloorEver >= 100 },
  { id: 'f125', name: 'Abyss Walker', on: 'floor', trigger: 'floor: S.maxFloorEver >= 125', test: (c) => c.S.maxFloorEver >= 125 },
  { id: 'f150', name: 'Bottomless', on: 'floor', trigger: 'floor: S.maxFloorEver >= 150', test: (c) => c.S.maxFloorEver >= 150 },
  // --- prestige / omens
  { id: 'retire10', name: 'Dynasty', on: 'retired', trigger: 'retired: S.retires >= 10', test: (c) => c.S.retires >= 10 },
  { id: 'renown500', name: 'Living Legend', on: 'retired', trigger: 'retired: S.renownLifetime >= 500', test: (c) => c.S.renownLifetime >= 500 },
  { id: 'omen1', name: 'Ill Omen', on: 'omenPicked', trigger: 'omenPicked: id !== null', test: (c) => !!c.ev.data.id },
  { id: 'omen10', name: 'Augur', on: 'omenPicked', trigger: 'omenPicked: P.omens (set of picked ids) has all 10', test: (c) => c.P.omens.size >= 10 },
  { id: 'deep100', name: 'Against the Omens', on: 'floor', trigger: "floor: S.omen === 'deep' && floor >= 90", test: (c) => c.S.omen === 'deep' && c.ev.data.floor >= 90 },
  { id: 'legacy_all', name: 'Hall of Legends', on: 'upgrade', trigger: "upgrade(store 'legacy'): every LEGACY row with max < 999 is at max", test: (c) => c.KK.DATA.LEGACY.filter((d) => d.max < 999).every((d) => (c.S.legacy[d.id] || 0) >= d.max) },
  // --- workshop / economy
  { id: 'overcharge10', name: 'Overcharged', on: 'upgrade', trigger: "upgrade: store 'workshop' && id 'overcharge' && lvl >= 10", test: (c) => (c.S.workshop.overcharge || 0) >= 10 },
  { id: 'crucible10', name: 'Forgemaster', on: 'upgrade', trigger: "upgrade: S.workshop.crucible >= 10 (max)", test: (c) => (c.S.workshop.crucible || 0) >= 10 },
  { id: 'lv100', name: 'Centenarian', on: 'levelUp', trigger: 'levelUp: to >= 100', test: (c) => c.ev.data.to >= 100 },
  { id: 'lv300', name: 'Old Guard', on: 'levelUp', trigger: 'levelUp: to >= 300', test: (c) => c.ev.data.to >= 300 },
  { id: 'chests100', name: 'Treasure Hunter', on: 'chest', trigger: 'chest: S.stats.chests >= 100', test: (c) => c.S.stats.chests >= 100 },
  { id: 'rats25', name: 'Rat Catcher', on: 'ratCaught', trigger: 'ratCaught: S.stats.rats >= 25', test: (c) => c.S.stats.rats >= 25 },
  // --- the typing itself (lifetime counters)
  { id: 'keys10k', name: 'Warming Up', on: 'poll', trigger: 'poll: S.stats.keys >= 10,000', test: (c) => c.S.stats.keys >= 1e4 },
  { id: 'keys100k', name: 'Wordsmith', on: 'poll', trigger: 'poll: S.stats.keys >= 100,000', test: (c) => c.S.stats.keys >= 1e5 },
  { id: 'keys1m', name: 'Million-Key March', on: 'poll', trigger: 'poll: S.stats.keys >= 1,000,000', test: (c) => c.S.stats.keys >= 1e6 },
  { id: 'flow1h', name: 'Deep Work', on: 'poll', trigger: 'poll: S.stats.flowTime >= 3600', test: (c) => c.S.stats.flowTime >= 3600 },
  { id: 'flow10h', name: 'Monk Mode', on: 'poll', trigger: 'poll: S.stats.flowTime >= 36000', test: (c) => c.S.stats.flowTime >= 36000 },
  { id: 'ults1k', name: 'Spark Plug', on: 'poll', trigger: 'poll: S.stats.ults >= 1,000', test: (c) => c.S.stats.ults >= 1000 },
  { id: 'idle50', name: 'Hands Off the Keyboard', on: 'floor', trigger: 'floor: floor >= 50 && P.runKeys === 0 (keys+clicks since this delve began; needs S.runKeys, reset on retired)', test: (c) => c.ev.data.floor >= 50 && c.P.runInputs === 0 && c.S.retires >= 1 },
  { id: 'kills100k', name: 'Exterminator', on: 'poll', trigger: 'poll: S.stats.kills >= 25,000', test: (c) => c.S.stats.kills >= 25000 },
];

function run(o = {}) {
  const PROFILE = o.profile || 'typist', MIN = o.min || 480, SEED = o.seed || 1, RETIRE = o.retire || 'nudge', OMEN = o.omen || 'random', STUCK = (o.stuck || 8) * 60, GLANCE = o.glance || 60;
  const KK = load({ seed: SEED, demo: !!o.demo });
  const S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F, W = KK.world, rnd = KK.rng;
  if (o.patch) o.patch(KK); // in-memory design experiments (never written to js/)
  W.reset();
  let t = 0;
  const R = { profile: PROFILE, seed: SEED, min: MIN, nov: [], ach: {}, sanct: {}, ult: {}, sw: {}, hk: {}, epic: [], f70: [], floorsFirst: {}, retires: [], omenPicks: [], demo: {} };

  // ---------------- novelty
  const seenKeys = new Set();
  const first = (key, kind, label) => { if (seenKeys.has(key)) return; seenKeys.add(key); R.nov.push({ t, kind, label }); };
  KK.on('wave', () => { for (const e of W.enemies) if (!e.boss) first('mon:' + e.key, 'minor', 'monster ' + e.def.name); });
  KK.on('bossSpawn', ({ boss }) => { first('bossname:' + boss.def.name, 'MAJOR', 'boss ' + boss.def.name + ' (f' + S().floor + ')'); if (S().floor === 70) R.f70.push({ t, r: S().retires, n: boss.def.name }); });
  KK.on('floor', ({ floor }) => {
    first('biome:' + F.biomeOf(floor).id, 'MAJOR', 'biome ' + F.biomeOf(floor).name);
    if (floor >= 20) first('retireUnlock', 'MAJOR', 'retire unlocked');
    for (let ms = 50; ms <= 200; ms += 5) if (floor >= ms && R.floorsFirst[ms] === undefined) R.floorsFirst[ms] = t;
  });
  KK.on('recruit', ({ id }) => first('recruit:' + id, 'MAJOR', 'recruit ' + id));
  KK.on('ult', ({ id }) => first('ult:' + id, 'minor', 'first ' + D.HEROES[id].ult.name));
  KK.on('relicOffer', ({ ids }) => {
    first('relicOffer', 'MAJOR', 'first relic offer');
    for (const id of ids) { const r = D.RELICS.find((x) => x.id === id); first('relic:' + id, 'minor', 'relic ' + r.name); if (r.rar === 'epic') first('epic', 'MAJOR', 'first EPIC offered'); }
  });
  KK.on('fervorTier', ({ to }) => { if (to === 3) first('flow', 'MAJOR', 'first FLOW'); });
  KK.on('ratSpawn', () => first('rat', 'MAJOR', 'first golden rat'));
  KK.on('upgrade', ({ store, id }) => first(`up:${store}:${id}`, 'minor', `first buy ${store}:${id}`));
  KK.on('retired', ({ gain }) => { first('retire', 'MAJOR', 'first RETIRE'); R.retires.push({ t, gain, from: lastMax }); });
  KK.on('omenPicked', ({ id }) => { if (id) { first('omen:' + id, 'OMEN', 'new omen ' + id); R.omenPicks.push({ t, id }); } });
  KK.on('revive', () => first('revive', 'MAJOR', 'first REVIVE'));

  // ---------------- Sanctuary
  const sc = R.sanct = { casts: 0, bossCasts: 0, revives: 0, fights: 0, fightsCast: 0, hardFights: 0, hardCast: 0, heroDownWithPell: 0, slamsUnder50: 0, wipesWithPell: 0, at50: [], noTouch: 0 };
  let fight = null;
  KK.on('ult', ({ id }) => { if (id === 'cleric') { sc.casts++; if (fight) { sc.bossCasts++; fight.cast = true; } } });
  KK.on('revive', () => sc.revives++);
  KK.on('heroDown', () => { if (S().heroes.cleric) { sc.heroDownWithPell++; if (fight) fight.hard = true; } });
  KK.on('wipe', () => { if (S().heroes.cleric) sc.wipesWithPell++; if (fight) fight.hard = true; });
  KK.on('bossSlam', () => { if (S().heroes.cleric && W.heroes.some((h) => !h.dead && h.hp / h.maxHp < 0.5)) { sc.slamsUnder50++; if (fight) fight.hard = true; } });
  function fightTick() {
    const b = W.boss && !W.boss.dead && W.boss.active ? W.boss : null;
    if (b && !fight && S().heroes.cleric) fight = { uid: b.uid, cast: false, hard: false, half: false, minHp: 1 };
    if (fight) {
      for (const h of W.heroes) if (!h.dead) fight.minHp = Math.min(fight.minHp, h.hp / h.maxHp); else fight.minHp = 0;
      if (b && !fight.half && b.hp / b.maxHp < 0.5) { fight.half = true; sc.at50.push(Math.min(...W.heroes.map((h) => (h.dead ? 0 : h.hp / h.maxHp)))); }
    }
    if (fight && (!b || b.uid !== fight.uid)) {
      sc.fights++; if (fight.cast) sc.fightsCast++; if (fight.hard) { sc.hardFights++; if (fight.cast) sc.hardCast++; }
      if (fight.minHp > 0.5) sc.noTouch++;
      (sc.minHps = sc.minHps || []).push(fight.minHp);
      fight = null;
    }
  }

  // ---------------- ult shares
  const ub = R.ult = { knight: 0, archer: 0, mage: 0, cleric: 0 };
  KK.on('ult', ({ id }) => ub[id]++);

  // ---------------- Second Wind / Hotkey (wrappers)
  const sw = R.sw = { triggers: 0, bonusKeys: 0, bonusSparks: 0, bonusLost: 0, sparksTotal: 0 };
  const hk = R.hk = { procs: 0, casts: 0, banked: 0, fromBank: 0, overflow: 0 };
  let inAct = false, inHot = false;
  const origAdd = KK.addActivity;
  KK.addActivity = function (k) {
    const s = S(), before = s.secondWind, sp0 = s.sparks, m = KK.mods();
    const willTrigger = m.secondWind > 0 && KK.lastInputAgo() >= 60 && k === 'key' && s.settings.countInput;
    inAct = true; origAdd(k); inAct = false;
    if (willTrigger) sw.triggers++;
    const used = (willTrigger ? m.secondWind : before) - s.secondWind;
    if (used > 0) { sw.bonusKeys += used; const got = s.sparks - sp0; sw.bonusSparks += Math.max(0, Math.min(2, got - 1)); if (got < 3) sw.bonusLost += 3 - Math.max(got, 1); }
    sw.sparksTotal += Math.max(0, s.sparks - sp0);
    P.runInputs++;
  };
  const origEmit = KK.emit;
  KK.emit = function (type, data) {
    if (type === 'hotkey') {
      const b0 = W.hotkeyBank || 0;
      if (inAct) hk.procs++; else hk.fromBank++;
      inHot = true; origEmit(type, data); inHot = false;
      const b1 = W.hotkeyBank || 0;
      if (b1 > b0) hk.banked++;
      else if (b0 === 3 && inAct && b1 === 3) hk.overflow++;
      return;
    }
    return origEmit(type, data);
  };
  const origCast = W.castUlt;
  W.castUlt = function (h, free) { if (free && inHot) { hk.casts++; P.hotkeyRun++; } return origCast.call(this, h, free); };

  // ---------------- epic guarantee
  const origRoll = A.rollRelics;
  A.rollRelics = function () {
    const before = S().epicGiven, f = S().floor;
    const res = origRoll();
    const offer = S().relicQueue && S().relicQueue.length ? S().relicQueue[S().relicQueue.length - 1] : S().relicOffer;
    if (f === 30 && !before) R.epic.push({ t, r: S().retires, hadEpic: (offer || []).some((id) => D.RELICS.find((x) => x.id === id).rar === 'epic'), flag: S().epicGiven });
    return res;
  };

  // ---------------- achievements
  const P = { blockedBoss: null, meteorKills: 0, lastHitUlt: {}, flowRun: 0, hotkeyRun: 0, hollowed: new Set(), omens: new Set(), runInputs: 0 };
  let meteorWindow = false;
  KK.on('bossSpawn', ({ boss }) => { P.blockedBoss = S().bossBlock === S().floor ? boss.uid : null; });
  KK.on('hit', ({ e, ult, src }) => { if (e.boss) P.lastHitUlt[e.uid] = !!ult; if (meteorWindow && e.hp <= 0 && ult && src && src.id === 'mage') P.meteorKills++; });
  KK.on('kill', ({ e }) => { if (e.hollowed) P.hollowed.add(e.key); });
  KK.on('omenPicked', ({ id }) => { if (id) P.omens.add(id); });
  KK.on('retired', () => { P.hotkeyRun = 0; P.runInputs = 0; });
  // meteor: damage is applied inside updateShots before meteorLand is emitted, so open a window per meteor shot
  const origUpd = W.update;
  const achList = o.ach === false ? [] : ACH;
  const byEv = {};
  for (const a of achList) (byEv[a.on] = byEv[a.on] || []).push(a);
  const unlock = (a) => { if (R.ach[a.id] === undefined) R.ach[a.id] = t; };
  for (const evType of Object.keys(byEv)) {
    if (evType === 'poll' || evType === 'meteorLand') continue;
    KK.on(evType, (data) => { for (const a of byEv[evType]) if (R.ach[a.id] === undefined) { try { if (a.test({ S: S(), KK, W, P, ev: { type: evType, data } })) unlock(a); } catch (err) { /* ignore */ } } });
  }
  KK.on('meteorLand', () => { if (P.meteorKills >= 3 && byEv.meteorLand) for (const a of byEv.meteorLand) unlock(a); P.meteorKills = 0; });
  // the meteor's kills happen just before meteorLand in the same frame: keep the window open always, reset on land
  meteorWindow = true;

  // ---------------- player model
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
    // Legacy: finite rows first (cheapest first), then the infinite ones, like a player reading the panel
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
  function pickOmen() {
    const s = S();
    if (!s.omenOffer) return;
    let id = null;
    if (OMEN === 'random') id = s.omenOffer[Math.floor(rnd() * s.omenOffer.length)];
    else if (OMEN === 'first') id = s.omenOffer[0];
    else if (OMEN === 'new') id = s.omenOffer.find((x) => !P.omens.has(x)) || s.omenOffer[0];
    A.pickOmen(id);
  }

  // ---------------- demo bookkeeping
  const dm = R.demo = { cardAt: null, sealed: [], redelves: 0, renownAfter: 0, capTimes: [] };
  KK.on('demoComplete', () => { dm.cardAt = t; });
  KK.on('demoSealed', ({ time }) => { dm.sealed.push({ t, time }); });
  KK.on('retired', ({ gain }) => { if (dm.cardAt !== null) { dm.redelves++; dm.renownAfter += gain || 0; } });

  // ---------------- loop
  const dt = 1 / 30;
  let nextGlance = 0, lastMax = 1, lastMaxT = 0, runStart = 0, secAcc = 0, flowNow = 0, maxFlowRun = 0;
  const end = MIN * 60;
  while (t < end) {
    activity(dt);
    W.update(dt);
    t += dt;
    fightTick();
    const s = S();
    if (KK.fervorTier() === 3) { flowNow += dt; P.flowRun = flowNow; maxFlowRun = Math.max(maxFlowRun, flowNow); } else { flowNow = 0; P.flowRun = 0; }
    secAcc += dt;
    if (secAcc >= 1) { secAcc -= 1; if (byEv.poll) for (const a of byEv.poll) if (R.ach[a.id] === undefined && a.test({ S: s, KK, W, P, ev: null })) unlock(a); }
    if (t >= nextGlance) {
      nextGlance = t + GLANCE;
      if (s.relicOffer) A.pickRelic(s.relicOffer[Math.floor(rnd() * s.relicOffer.length)]);
      pickOmen();
      smartSpend();
      if (W.rat) W.catchRat();
    }
    if (s.maxFloorRun > lastMax) { lastMax = s.maxFloorRun; lastMaxT = t; }
    const runT = t - runStart;
    let go = false;
    if (o.demo) {
      if (!s.demoDone) go = A.renownGain() > 0 && t - lastMaxT > STUCK; // stuck before the cap
      else if (s.runCapCleared) { const lastClear = dm.sealed.length ? dm.sealed[dm.sealed.length - 1].t : dm.cardAt; go = t - lastClear > (o.redelveDelay || 60); } // re-delve a minute after the toast/card
      else go = A.canRetire() && t - lastMaxT > STUCK; // stuck below 40 after the card: plain re-delve
    } else {
      const nudge = RETIRE === 'nudge' && A.renownGain() >= 30 && (runT > 25 * 60 || (s.retires === 0 && s.maxFloorRun >= 40));
      go = (t - lastMaxT > STUCK || nudge) && A.renownGain() > 0;
    }
    if (go) { A.retire(); W.reset(); lastMax = S().maxFloorRun; lastMaxT = t; runStart = t; pickOmen(); }
  }
  R.maxFlowRun = maxFlowRun;
  R.end = { t, floor: S().floor, maxEver: S().maxFloorEver, retires: S().retires, renownLife: S().renownLifetime, keys: S().stats.keys, flow: S().stats.flowTime, ults: S().stats.ults, kills: S().stats.kills, chests: S().stats.chests, rats: S().stats.rats, gold: S().stats.goldEarned, heroes: Object.assign({}, S().heroes), workshop: Object.assign({}, S().workshop), legacy: Object.assign({}, S().legacy), bestCapTime: S().bestCapTime, fame: KK.mods().fame };
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
module.exports = { run, ACH, fmtT, buckets, gap };
