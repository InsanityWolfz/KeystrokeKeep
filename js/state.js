/* Keystroke Keep — persistent state, formulas, derived modifiers and economy actions. DOM-free. */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const KK = root.KK, U = KK.U, D = KK.DATA;
  const SAVE_KEY = 'keystroke-keep-save-v1';

  KK.newState = function () {
    return {
      v: 1,
      gold: 0, sparks: 0, embers: 0, incomeAvg: 0, renown: 0, renownLifetime: 0, retires: 0, renownFloor: 0,
      floor: 1, maxFloorRun: 1, maxFloorEver: 1, bossBlock: 0,
      heroes: { knight: 1, archer: 0, mage: 0, cleric: 0 },
      forge: {}, workshop: {}, legacy: {},
      relics: [], relicOffer: null, relicQueue: [],
      omen: null, omenOffer: null, epicGiven: false, secondWind: 0,
      seals: 0, sealDay: '', freeDelveDay: '', omenStar: null, omenStarDay: '', sealPT: null, delveDay: '', daysPlayed: 0, lastDay: '',
      codexKills: 0, slain: {}, bossWounds: {}, bossFirsts: {}, bannerFirsts: {}, bestMile: {},
      demoDone: false, glimpse: false, glimpseDone: false, demoPeek: false, runCapCleared: false, bestCapTime: 0, runTime: 0, demoSave: false, demoLaps: 0,
      gear: {}, gearBest: {}, mats: { ore: 0, wood: 0, fish: 0 }, skills: { ore: 0, wood: 0, fish: 0 },
      ach: {}, achP: {}, runInputs: 0, lastForge: {}, codex: {},
      fervor: 0, keyCounter: 0,
      incomeRate: 0,
      stats: { kills: 0, bossKills: 0, keys: 0, clicks: 0, ults: 0, goldEarned: 0, playTime: 0, chests: 0, rats: 0, flowTime: 0, wipes: 0 },
      settings: { sound: true, music: false, volume: 0.2, keySound: false, calm: !!(root.kkNative), combatSfx: !root.kkNative, fps: 24, lowGpu: 'auto', size: 'auto', countInput: true, chatter: true },
      tutorial: {},
      lastSave: Date.now(),
      created: Date.now(),
    };
  };

  KK.S = KK.newState();
  KK.DEMO_RENOWN_CAP = 120; // first clear 30 + 15 re-clears (~2 h typist); then best time is the score. The full game converts it on import.
  KK.MAX_FLOOR = 2500; // the bottom: enemy health stops fitting in a number near floor 2900
  KK.STORE_URL = ''; // e.g. 'steam://openurl/https://store.steampowered.com/app/<appid>' once the page exists

  // Next Fest demo mode: ?demo in the browser, --kk-demo / KK_DEMO=1 for the desktop build.
  KK.today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  /** Days the game has been played on (new Hollowed bosses join the rotation one per day). */
  KK.dayTick = () => { const S = KK.S, t = KK.today(); if (S.lastDay !== t) { if (!S.lastDay || t > S.lastDay) S.daysPlayed = (S.daysPlayed || 0) + 1; S.lastDay = t; } };
  KK.DEMO_CAP = (function () {
    try {
      if (root.kkNative && root.kkNative.demo) return 40;
      if (root.location && /[?&]demo\b/.test(root.location.search)) return 40;
    } catch (e) { /* ignore */ }
    return root.KK_DEMO_CAP || 0;
  })();

  // ---------------------------------------------------------------- formulas
  // Balance knobs (tools/sim.js can override these with BAL='{"hpG":1.2}')
  const B = KK.BAL = Object.assign({
    dmgLin: 0.45, dmgMile: 1.5, hpLin: 0.35, hpMile: 1.4, costG: 1.11,
    eHp: 28, eHpG: 1.275, eAtk: 2.2, eAtkG: 1.14, eGold: 1.6, eGoldG: 1.185,
  }, root.BAL_OVERRIDE || {});
  const echoCache = {};
  const F = KK.F = {
    heroDmg: (id, lvl) => D.HEROES[id].atk * (1 + B.dmgLin * (lvl - 1)) * Math.pow(B.dmgMile, Math.floor(lvl / 10)),
    heroHp: (id, lvl) => D.HEROES[id].hp * (1 + B.hpLin * (lvl - 1)) * Math.pow(B.hpMile, Math.floor(lvl / 10)),
    levelCost: (id, lvl) => D.HEROES[id].lvlCost * Math.pow(B.costG, lvl - 1),
    enemyHp: (f) => B.eHp * Math.pow(B.eHpG, f - 1),
    enemyAtk: (f) => B.eAtk * Math.pow(B.eAtkG, f - 1),
    enemyGold: (f) => B.eGold * Math.pow(B.eGoldG, f - 1),
    upCost: (def, lvl) => Math.ceil(def.base * Math.pow(def.growth, lvl)),
    renownFor: (maxFloor) => maxFloor < 20 ? 0 : Math.floor(Math.pow((maxFloor - 10) / 5, 1.9)),
    biomeOf: (f) => {
      // the Echoed Depths (f151+): every 10 floors an old biome comes back, hollowed, at depth stats
      if (f >= 151) {
        const band = Math.floor((f - 151) / 10);
        const open = Math.max(1, Math.min(D.BIOMES.length, (KK.S && KK.S.daysPlayed) || 1));
        const key = band + ':' + open;
        let e = echoCache[key];
        if (!e) {
          const base = D.BIOMES[band % open];
          e = echoCache[key] = Object.assign({}, base, { name: 'Echoed ' + ({ crypt: 'Crypt', caverns: 'Caverns', magma: 'Magma', void: 'Void', root: 'Heartroot' }[base.id] || base.name), from: 151 + band * 10, echo: true });
        }
        return e;
      }
      let b = D.BIOMES[0];
      for (const bb of D.BIOMES) if (f >= bb.from) b = bb;
      if (b.id === 'root' && ((f >= 121 && f <= 130) || (f >= 141 && f <= 150))) {
        return echoCache.deep || (echoCache.deep = Object.assign({}, b, { name: 'The Deep Heartroot', art: 'rootdeep', deep: true,
          pal: Object.assign({}, b.pal, { fog: '#070a06', wall: '#26211a', wallHi: '#363024', wallLo: '#181510', floor: '#2a2219', floorHi: '#3d3324', floorLo: '#14100b', accent: '#9cff8a', torch: '#9cff8a', dark: 0.62 }) }));
      }
      return b;
    },
    isBossFloor: (f) => f % 10 === 0,
    bossFor: (f) => {
      // past the Hollow, the Void throws every old boss back at you, hollowed out
      if (f === 70 || f === 100) return 'hollow';
      if (f >= 120 && f % 20 === 0) return (f / 20) % 2 === 0 ? 'rootmother' : 'keeper'; // the Heartroot's own, and their echoes
      if (f >= 80) { const six = ['ratking', 'boneking', 'broodmother', 'warlord', 'embergolem', 'magmalord']; const pool = six.slice(0, Math.max(2, Math.min(6, (KK.S.daysPlayed || 1) + 1))); return pool[((f < 110 ? (f - 80) / 10 : 2 + Math.floor((f - 110) / 20)) + (KK.S.retires || 0)) % pool.length]; } // + retires (not 2x): the Heartroot bosses take the even bands from f120
      const b = F.biomeOf(f);
      const idx = Math.floor(((f - b.from) % 20) / 10);
      return b.bosses[Math.min(idx, b.bosses.length - 1)];
    },
  };

  // ---------------------------------------------------------------- derived modifiers
  let modsCache = null;
  KK.dirty = () => { modsCache = null; KK.emit('dirty'); };
  KK.mods = function () {
    if (modsCache) return modsCache;
    const S = KK.S;
    const m = {
      dmg: 1, hp: 1, gold: 1, walk: 1, aspd: 1, ultCost: 1, ultPow: 1, fervDecay: 1, fervGain: 1,
      sparkCap: 150, chest: 0.08, offline: 0.4, offlineCap: 0.8, emberGain: 1, crit: 0.06, critMult: 2, lifesteal: 0, echo: 0, flowBonus: 0,
      keyCoin: 0, hotkey: false, knightHp: 1, knightDmg: 1, heroCost: 1, startLvl: 0, startFloor: 1,
      relicChoices: 3, auto: false, idlePow: 0, secondWind: 0, dynamo: 0, voidDmg: 1, eHp: 1, eAtk: 1, renownMult: 1,
    };
    for (const r of S.relics) { const def = D.RELICS.find((x) => x.id === r); if (def) def.apply(m); }
    for (const def of D.FORGE) { const l = S.forge[def.id] || 0; if (l) def.apply(m, l); }
    for (const def of D.WORKSHOP) { const l = S.workshop[def.id] || 0; if (l) def.apply(m, l); }
    for (const def of D.LEGACY) { const l = S.legacy[def.id] || 0; if (l) def.apply(m, l); }
    if (S.omen) { const o = D.OMENS.find((x) => x.id === S.omen); if (o) o.apply(m); }
    // old saves kept per-boss counts: fold them into the total once
    if (S.codex && Object.keys(S.codex).length && !S.codexKills) { S.codexKills = Object.values(S.codex).reduce((a, b) => a + b, 0); S.codex = {}; }
    const ck = S.codexKills || 0;
    m.codexRanks = Math.min(D.CODEX_MAX, Math.min(28, Math.floor(ck / D.CODEX_EVERY)) + Math.floor(Math.max(0, ck - 28 * D.CODEX_EVERY) / 16));
    m.codexExtra = Math.floor(Math.max(0, ck - D.CODEX_FULL) / D.CODEX_EXTRA_EVERY);
    if (m.codexRanks) { const c = Math.pow(1.03, m.codexRanks) * Math.pow(1.01, m.codexExtra); m.dmg *= c; m.gold *= c; }
    m.trophies = D.trophyCount(S.maxFloorEver);
    if (m.trophies) { const t = Math.pow(1.05, m.trophies); m.dmg *= t; m.gold *= t; }
    m.offline = Math.min(m.offlineCap, m.offline); // closing the game must never beat running it
    // Fame: +3% per lifetime Renown, compounding gently so late retires still push the wall
    const fame = (1 + 0.03 * S.renownLifetime) * Math.pow(1.004, S.renownLifetime);
    m.dmg *= fame; m.gold *= fame;
    m.fame = fame;
    modsCache = m;
    return m;
  };

  // ---------------------------------------------------------------- gear (prototype)
  const G = D.GEAR;
  KK.gearTier = (id) => (KK.S.gear && KK.S.gear[id]) || 0;
  KK.gearDmg = (id) => Math.pow(G.dmg, KK.gearTier(id));
  KK.gearHp = (id) => Math.pow(G.hp, KK.gearTier(id));
  KK.skillLevel = (kind) => G.skillLevel(KK.S.skills && KK.S.skills[kind]);
  /** Heroes make their own gear: the lowest tier goes first, front of the party before the back. */
  KK.autoCraft = function () {
    const S = KK.S;
    S.gear = S.gear || {}; S.gearBest = S.gearBest || {};
    let made = false;
    for (let guard = 0; guard < 40; guard++) {
      let best = null;
      for (const id of D.PARTY_ORDER) {
        if (!S.heroes[id]) continue;
        const t = S.gear[id] || 0;
        if (t >= G.tiers.length - 1) continue;
        if ((S.mats[G.uses[id]] || 0) < G.cost[t + 1]) continue;
        if (!best || t < (S.gear[best] || 0)) best = id;
      }
      if (!best) break;
      const t = (S.gear[best] || 0) + 1;
      S.mats[G.uses[best]] -= G.cost[t];
      S.gear[best] = t;
      const first = t > (S.gearBest[best] || 0);
      if (first) S.gearBest[best] = t;
      made = true;
      KK.dirty();
      KK.emit('gearUp', { id: best, tier: t, first });
    }
    return made;
  };
  /** A worked node: materials into the pack, one more toward the lifetime skill. */
  KK.harvest = function (kind, floor) {
    const S = KK.S;
    S.mats = S.mats || { ore: 0, wood: 0, fish: 0 }; S.skills = S.skills || { ore: 0, wood: 0, fish: 0 };
    let n = G.yieldAt(floor);
    if (kind === 'fish') n = Math.min(n, G.fishCap - (S.mats.fish || 0));
    S.mats[kind] = (S.mats[kind] || 0) + n;
    const before = KK.skillLevel(kind);
    S.skills[kind] = (S.skills[kind] || 0) + 1;
    const after = KK.skillLevel(kind);
    S.stats.nodes = (S.stats.nodes || 0) + 1;
    KK.emit('harvest', { kind, n });
    if (after > before) KK.emit('skillUp', { kind, level: after });
    KK.autoCraft();
    return n;
  };
  KK.on('recruit', () => KK.autoCraft()); // a new hero puts spare materials to use at once

  // Tiers are sticky: you enter a tier at its threshold but only drop out 12 points below it,
  // so a short pause doesn't flicker you in and out of FLOW (and replay its fanfare).
  let curTier = 0;
  KK.fervorTier = function () {
    const f = KK.S.fervor, T = D.FERVOR_TIERS;
    while (curTier < T.length - 1 && f >= T[curTier + 1].at) curTier++;
    while (curTier > 0 && f < T[curTier].at - 12) curTier--;
    return curTier;
  };
  /** Overall power multiplier from Fervor (applies to damage; speed gets half). */
  KK.powerMult = function () {
    const m = KK.mods(), t = KK.fervorTier();
    let mult = D.FERVOR_TIERS[t].mult;
    if (t === 3) mult += m.flowBonus;
    // Idle Battery and Dynamo are a floor, so starting to type can never make the party weaker
    return Math.max(mult, 1 + m.idlePow + m.dynamo) * (1 + 0.05 * t);
  };

  // ---------------------------------------------------------------- activity (the hook)
  let lastInputT = 0, lastKeyT = 0;
  KK.lastInputAgo = () => (KK.simTime || 0) - lastInputT;
  KK.lastKeyAgo = () => (KK.simTime || 0) - lastKeyT;
  KK.addActivity = function (kind) {
    const S = KK.S, m = KK.mods();
    if (!S.settings.countInput) return;
    if (m.secondWind > 0 && KK.lastInputAgo() >= 30 && kind === 'key') { S.secondWind = m.secondWind; KK.emit('secondWind', { keys: m.secondWind }); }
    lastInputT = KK.simTime || 0;
    if (kind === 'key') lastKeyT = lastInputT;
    const before = KK.fervorTier();
    if (kind === 'key') {
      S.stats.keys++; S.keyCounter++;
      S.fervor = Math.min(100, S.fervor + 1.2 * m.fervGain);
    } else {
      S.stats.clicks++;
      S.fervor = Math.min(100, S.fervor + 0.9 * m.fervGain);
    }
    const cap = m.sparkCap;
    let gain = 1;
    if (S.secondWind > 0 && kind === 'key') { S.secondWind--; gain += 2; }
    if (S.sparks < cap) S.sparks = Math.min(cap, S.sparks + gain);
    if (m.keyCoin > 0 && kind === 'key' && Math.random() < m.keyCoin) {
      const g = Math.max(S.incomeRate * 3, F.enemyGold(S.floor) * m.gold);
      KK.gainGold(g, 'keycoin');
      KK.emit('keycoin', { amount: g });
    }
    if (m.hotkey && kind === 'key' && S.keyCounter % 60 === 0) KK.emit('hotkey');
    const after = KK.fervorTier();
    if (after !== before) KK.emit('fervorTier', { from: before, to: after });
    KK.emit('activity', { kind });
  };
  KK.tickFervor = function (dt) {
    const S = KK.S, m = KK.mods();
    if (KK.lastInputAgo() > 3 && S.fervor > 0) {
      const before = KK.fervorTier();
      S.fervor = Math.max(0, S.fervor - 3.5 * m.fervDecay * dt);
      const after = KK.fervorTier();
      if (after !== before) KK.emit('fervorTier', { from: before, to: after });
    }
    if (KK.fervorTier() === 3) S.stats.flowTime += dt;
  };

  // ---------------------------------------------------------------- economy
  let goldWindow = 0;
  KK.gainGold = function (amount, src) {
    const S = KK.S;
    S.gold += amount;
    S.stats.goldEarned += amount;
    if (src === 'kill' || src === 'chest') goldWindow += amount;
  };
  /** Called once per sim-second: maintains a smoothed gold/sec for offline earnings & coin rewards. */
  KK.tickIncome = function () {
    const S = KK.S;
    S.incomeRate = S.incomeRate * 0.97 + goldWindow * 0.03;
    S.incomeAvg = (S.incomeAvg || 0) * (599 / 600) + goldWindow / 600; // ~10-minute average, for offline pay
    goldWindow = 0;
  };

  const A = KK.actions = {};
  A.heroCost = (id, n) => {
    const S = KK.S;
    let lvl = S.heroes[id], total = 0, count = 0;
    const max = n === 'max' ? 1000 : n;
    while (count < max) {
      const c = F.levelCost(id, lvl);
      if (n === 'max' && total + c > S.gold) break;
      total += c; lvl++; count++;
    }
    return { total, count };
  };
  A.levelHero = (id, n = 1) => {
    const S = KK.S;
    if (!S.heroes[id]) return false;
    const { total, count } = A.heroCost(id, n);
    if (count === 0 || total > S.gold) return false;
    const before = S.heroes[id];
    S.gold -= total;
    S.heroes[id] += count;
    KK.dirty();
    KK.emit('levelUp', { id, from: before, to: S.heroes[id] });
    return true;
  };
  A.recruitCost = (id) => Math.ceil(D.HEROES[id].recruit * KK.mods().heroCost);
  A.canRecruit = (id) => { const S = KK.S; return !S.heroes[id] && S.maxFloorRun >= D.HEROES[id].unlockFloor; };
  A.recruit = (id) => {
    const S = KK.S, c = A.recruitCost(id);
    if (!A.canRecruit(id) || S.gold < c) return false;
    S.gold -= c;
    S.heroes[id] = 1 + KK.mods().startLvl;
    KK.dirty();
    KK.emit('recruit', { id });
    return true;
  };
  function buyUp(list, store, id, currency) {
    const S = KK.S, def = list.find((d) => d.id === id);
    const l = S[store][id] || 0;
    if (!def || l >= def.max) return false;
    const c = F.upCost(def, l);
    if (S[currency] < c) return false;
    S[currency] -= c;
    S[store][id] = l + 1;
    KK.dirty();
    KK.emit('upgrade', { store, id, lvl: l + 1 });
    return true;
  }
  A.buyForge = (id) => buyUp(D.FORGE, 'forge', id, 'gold');
  A.buyWorkshop = (id) => buyUp(D.WORKSHOP, 'workshop', id, 'embers');
  /** Embers come from Sparks spent on ultimates, plus golden rats and bosses (so idle players get some too). */
  KK.gainEmbers = (n) => { KK.S.embers = (KK.S.embers || 0) + n * KK.mods().emberGain; };
  A.legacyCost = (id) => { const def = D.LEGACY.find((d) => d.id === id); return def.cost(KK.S.legacy[id] || 0); };
  A.buyLegacy = (id) => {
    const S = KK.S, def = D.LEGACY.find((d) => d.id === id);
    const l = S.legacy[id] || 0;
    if (!def || l >= def.max) return false;
    const c = def.cost(l);
    if (S.renown < c) return false;
    S.renown -= c;
    S.legacy[id] = l + 1;
    KK.dirty();
    const m = KK.mods();
    if (id === 'headstart' && S.floor < m.startFloor && S.maxFloorRun <= m.startFloor) { S.floor = m.startFloor; S.maxFloorRun = Math.max(S.maxFloorRun, m.startFloor); KK.emit('jumpFloor', { floor: S.floor }); }
    if (id === 'veterans' || id === 'headstart') for (const h of D.PARTY_ORDER) if (S.heroes[h] && S.heroes[h] < 1 + m.startLvl) S.heroes[h] = 1 + m.startLvl;
    KK.dirty();
    KK.emit('upgrade', { store: 'legacy', id, lvl: l + 1 });
    return true;
  };

  A.pickOmen = (id) => {
    const S = KK.S;
    if (!S.omenOffer || (id && !S.omenOffer.includes(id))) return false;
    S.omen = id || null;
    S.omenOffer = null;
    S.delveDay = KK.today(); // only a delve begun today can claim today's Seal
    if (id === 'muster') S.forge = Object.assign({}, S.lastForge || {});
    KK.dirty();
    const m = KK.mods();
    for (const h of D.PARTY_ORDER) if (S.heroes[h] && S.heroes[h] < 1 + m.startLvl) S.heroes[h] = 1 + m.startLvl;
    KK.dirty();
    KK.emit('omenPicked', { id });
    return true;
  };
  A.rollRelics = () => {
    const S = KK.S, m = KK.mods();
    const pool = D.RELICS.filter((r) => !(r.unique && S.relics.includes(r.id)) && !(r.minFloor && S.maxFloorEver < r.minFloor));
    const out = [];
    if (!S.epicGiven && S.floor === 30) {
      const epics = pool.filter((r) => r.rar === 'epic');
      if (epics.length) { const e = U.pick(epics); out.push(e.id); pool.splice(pool.indexOf(e), 1); S.epicGiven = true; }
    }
    while (out.length < m.relicChoices && pool.length) {
      const pick = U.weighted(pool, (r) => D.RARITY[r.rar].w);
      out.push(pick.id);
      pool.splice(pool.indexOf(pick), 1);
    }
    if (S.relicOffer) (S.relicQueue = S.relicQueue || []).push(out); // a postponed choice is never lost
    else S.relicOffer = out;
    KK.emit('relicOffer', { ids: out });
  };
  A.pickRelic = (id) => {
    const S = KK.S;
    if (!S.relicOffer || !S.relicOffer.includes(id)) return false;
    S.relics.push(id);
    S.relicOffer = (S.relicQueue && S.relicQueue.shift()) || null;
    KK.dirty();
    KK.emit('relicPicked', { id });
    return true;
  };

  A.renownGain = () => {
    const S = KK.S;
    // demo: the record can't go past 40, so each re-clear of floor 40 pays a small, repeatable +6
    const record = Math.max(0, Math.floor((F.renownFor(S.maxFloorRun) - F.renownFor(S.renownFloor || 0)) * KK.mods().renownMult));
    if (KK.DEMO_CAP && S.demoDone) return Math.max(record, S.runCapCleared && S.renownLifetime < KK.DEMO_RENOWN_CAP ? Math.min(6, KK.DEMO_RENOWN_CAP - S.renownLifetime) : 0);
    return record;
  };
  A.retireTarget = () => { const S = KK.S; let f = Math.max(20, S.maxFloorRun + 1); while (F.renownFor(f) - F.renownFor(S.renownFloor || 0) <= 0 && f < 2000) f++; return f; };
  // demo: once the cap is beaten, a 0-Renown "re-delve" restarts the run (new relics, beat your best time)
  // Omen of the Day: one starred omen per calendar day; reaching (record - 5) under it pays a Seal (10 + record/10 Renown)
  A.starOmen = () => { let h = 0; for (const c of KK.today()) h = (h * 31 + c.charCodeAt(0)) >>> 0; return D.OMENS[h % D.OMENS.length].id; };
  // a Seal needs a new calendar day (not an earlier one) AND two hours of play since the last Seal
  A.dailyOpen = () => { const S = KK.S, t = KK.today(); return !KK.DEMO_CAP && S.retires >= 2 && S.sealDay !== t && !(S.sealDay && t < S.sealDay) && (S.stats.playTime - (S.sealPT || -1e9)) >= 7200; };
  A.sealFloor = () => Math.max(40, (KK.S.renownFloor || 0) - 5);
  A.sealValue = () => 10 + Math.floor((KK.S.renownFloor || 0) / 10);
  A.claimSeal = () => { const S = KK.S; const v = A.sealValue() * (S.omen === S.omenStar && S.omenStarDay === KK.today() ? 1.5 : 1); const vv = Math.round(v); S.sealDay = KK.today(); S.sealPT = S.stats.playTime; S.seals = (S.seals || 0) + 1; S.renown += vv; S.renownLifetime += vv; KK.dirty(); KK.emit('seal', { n: S.seals, v: vv }); };
  A.canRedelve = () => !!(KK.DEMO_CAP && KK.S.demoDone && KK.S.maxFloorRun >= 20) || (A.dailyOpen() && KK.S.freeDelveDay !== KK.today() && A.renownGain() <= 0 && KK.S.maxFloorRun >= 20);
  A.canRetire = () => !KK.S.glimpse && (A.renownGain() > 0 || A.canRedelve());
  /** What the retire button should ask for when nothing can be earned yet. */
  A.retireHint = () => (KK.DEMO_CAP && KK.S.demoDone ? (KK.S.renownLifetime >= KK.DEMO_RENOWN_CAP ? 'DEMO RENOWN MAXED: BEAT YOUR BEST TIME' : 'CLEAR FLOOR ' + KK.DEMO_CAP + ' AGAIN FOR +6 RENOWN') : 'REACH FLOOR ' + A.retireTarget() + ' TO EARN RENOWN');
  A.retire = () => {
    const S = KK.S;
    const gain = A.renownGain();
    if (gain <= 0 && !A.canRedelve()) return false;
    if (S.glimpse) { S.glimpse = false; if (KK.world) KK.world.sealedX = 0; if (KK.DEMO_CAP && !S.demoDone) { S.demoDone = true; KK.emit('demoComplete'); } }
    S.renown += gain; S.renownLifetime += gain; S.retires++;
    S.runTime = 0; S.runCapCleared = false; S.bossWounds = {}; S.bossLosses = 0; S.campUntil = 0; S.campFloor = 0; S.campLevels = 0; S.slain = {}; S.graceSaves = {}; S.regroupUntil = 0;
    S.incomeRate = 0; S.incomeAvg = 0; // a fresh delve doesn't keep the old run's income
    // Delve Omens: from the 2nd retire on, the next delve offers 3 omens (not in the demo)
    S.omen = null;
    const prevOffer = S.lastOmenOffer || [];
    const pool = D.OMENS.map((o) => o.id).filter((id) => !prevOffer.includes(id));
    S.omenOffer = !KK.DEMO_CAP && S.retires >= 2 ? U.shuffle(pool).slice(0, 3) : null;
    if (S.omenOffer) S.lastOmenOffer = S.omenOffer.slice();
    S.omenStar = null;
    if (S.omenOffer && A.dailyOpen()) { const st = A.starOmen(); if (!S.omenOffer.includes(st)) S.omenOffer[0] = st; S.omenStar = st; S.omenStarDay = KK.today(); }
    if (gain <= 0 && !KK.DEMO_CAP) S.freeDelveDay = KK.today();
    S.renownFloor = Math.max(S.renownFloor || 0, S.maxFloorRun);
    S.lastForge = Object.assign({}, S.forge);
    S.gear = {}; S.mats = { ore: 0, wood: 0, fish: 0 }; // gear goes with the party; skills stay
    S.gold = 0; S.forge = {}; S.relics = []; S.relicOffer = null; S.relicQueue = []; S.bossBlock = 0;
    KK.dirty();
    const m = KK.mods();
    const had = Object.assign({}, S.heroes);
    S.heroes = { knight: 1 + m.startLvl, archer: 0, mage: 0, cleric: 0 };
    if (m.rejoin) for (const id of ['archer', 'mage', 'cleric']) if (had[id]) S.heroes[id] = 1 + m.startLvl; // Recruiter: veterans rejoin
    S.floor = m.startFloor; S.maxFloorRun = m.startFloor;
    KK.dirty();
    KK.emit('retired', { gain });
    return gain || 'redelve';
  };

  // ---------------------------------------------------------------- save/load
  // Desktop build: saves go to a JSON file (atomic write + rolling backups) through the
  // preload bridge, so they survive cache clears and can sync with Steam Cloud later.
  // Browser build: localStorage. A desktop player's old localStorage save is migrated once.
  const fileStore = () => (root.kkNative && root.kkNative.saveFile ? root.kkNative : null);
  KK.save = function (sync) {
    if (KK.resetting) return;
    try {
      KK.S.lastSave = Date.now();
      if (KK.DEMO_CAP) KK.S.demoSave = true;
      const json = JSON.stringify(KK.S);
      const fs = fileStore();
      if (fs) { if (sync === true) fs.saveFileSync(json); else fs.saveFile(json); return; }
      if (typeof localStorage !== 'undefined') localStorage.setItem(SAVE_KEY, json);
    } catch (e) { console.warn('[KK] save failed', e); }
  };
  KK.load = function () {
    try {
      const fs = fileStore();
      let raw = fs ? fs.loadFile() : null;
      if (!raw && typeof localStorage !== 'undefined') raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      const fresh = KK.newState();
      // shallow-merge so new fields added in later versions get defaults
      for (const k in fresh) {
        if (data[k] === undefined) continue;
        if (fresh[k] && typeof fresh[k] === 'object' && !Array.isArray(fresh[k])) fresh[k] = Object.assign(fresh[k], data[k]);
        else fresh[k] = data[k];
      }
      // fields added after newState() was written (Codex kills, days played, Seal timing, slain floors,
      // boss wounds, banner firsts...) were silently dropped on every load until R10: keep them all
      for (const k in data) if (!(k in fresh)) fresh[k] = data[k];
      // A demo save opened by the full game: demo Renown counts as progress already made, so the
      // record is raised until it would have paid that much (no bonus Renown on top).
      if (fresh.demoSave && !KK.DEMO_CAP) {
        fresh.demoSave = false; fresh.demoDone = false; fresh.runCapCleared = false;
        let rf = fresh.renownFloor || 0;
        while (F.renownFor(rf) < fresh.renownLifetime && rf < 400) rf++;
        fresh.renownFloor = rf;
      }
      if (fresh.glimpse && fresh.floor <= 40) fresh.glimpse = false;
      if (!fresh.settings.lowGpuMigrated) { if (fresh.settings.lowGpu === true) fresh.settings.lowGpu = 'auto'; fresh.settings.lowGpuMigrated = true; }
      if (!fresh.settings.calmMigrated) { if (fresh.settings.volume === 0.3) fresh.settings.volume = 0.2; fresh.settings.calmMigrated = true; }
      if ((fresh.workshop.dynamo || 0) > 6) { for (let l = 6; l < fresh.workshop.dynamo; l++) fresh.embers = (fresh.embers || 0) + Math.ceil(150 * Math.pow(1.6, l)); fresh.workshop.dynamo = 6; }
      if (fresh.workshop.jar) {
        let refund = 0;
        for (let l = 0; l < fresh.workshop.jar; l++) refund += Math.ceil(60 * Math.pow(1.4, l));
        fresh.embers = (fresh.embers || 0) + refund; delete fresh.workshop.jar;
      }
      if (fresh.workshop.battery) delete fresh.workshop.battery;
      if ((fresh.legacy.battery || 0) > 3) { fresh.renown += (fresh.legacy.battery - 3) * 9; fresh.legacy.battery = 3; }
      KK.S = fresh;
      KK.dirty();
      return true;
    } catch (e) { console.warn('[KK] load failed', e); return false; }
  };
  KK.wipeSave = function () {
    try { const fs = fileStore(); if (fs) fs.wipeFile(); } catch (e) { /* ignore */ }
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  };
})();
