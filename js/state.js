/* Keystroke Keep — persistent state, formulas, derived modifiers and economy actions. DOM-free. */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const KK = root.KK, U = KK.U, D = KK.DATA;
  const SAVE_KEY = 'keystroke-keep-save-v1';

  KK.newState = function () {
    return {
      v: 1,
      gold: 0, sparks: 0, embers: 0, renown: 0, renownLifetime: 0, retires: 0, renownFloor: 0,
      floor: 1, maxFloorRun: 1, maxFloorEver: 1, bossBlock: 0,
      heroes: { knight: 1, archer: 0, mage: 0, cleric: 0 },
      forge: {}, workshop: {}, legacy: {},
      relics: [], relicOffer: null,
      fervor: 0, keyCounter: 0,
      incomeRate: 0,
      stats: { kills: 0, bossKills: 0, keys: 0, clicks: 0, ults: 0, goldEarned: 0, playTime: 0, chests: 0, rats: 0, flowTime: 0, wipes: 0 },
      settings: { sound: true, music: false, volume: 0.3, keySound: false, calm: false, fps: 30, size: 'auto', countInput: true },
      tutorial: {},
      lastSave: Date.now(),
      created: Date.now(),
    };
  };

  KK.S = KK.newState();

  // ---------------------------------------------------------------- formulas
  // Balance knobs (tools/sim.js can override these with BAL='{"hpG":1.2}')
  const B = KK.BAL = Object.assign({
    dmgLin: 0.45, dmgMile: 1.5, hpLin: 0.35, hpMile: 1.4, costG: 1.11,
    eHp: 28, eHpG: 1.27, eAtk: 2.2, eAtkG: 1.14, eGold: 1.6, eGoldG: 1.185,
  }, root.BAL_OVERRIDE || {});
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
      let b = D.BIOMES[0];
      for (const bb of D.BIOMES) if (f >= bb.from) b = bb;
      return b;
    },
    isBossFloor: (f) => f % 10 === 0,
    bossFor: (f) => {
      // past the Hollow, the Void throws every old boss back at you, hollowed out
      if (f >= 70) { const all = ['hollow', 'ratking', 'boneking', 'broodmother', 'warlord', 'embergolem', 'magmalord']; return all[Math.floor((f - 70) / 10) % all.length]; }
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
      sparkCap: 150, chest: 0.08, offline: 0.4, crit: 0.06, critMult: 2, lifesteal: 0, echo: 0, flowBonus: 0,
      keyCoin: 0, hotkey: false, knightHp: 1, knightDmg: 1, heroCost: 1, startLvl: 0, startFloor: 1,
      relicChoices: 3, auto: false, idlePow: 0,
    };
    for (const r of S.relics) { const def = D.RELICS.find((x) => x.id === r); if (def) def.apply(m); }
    for (const def of D.FORGE) { const l = S.forge[def.id] || 0; if (l) def.apply(m, l); }
    for (const def of D.WORKSHOP) { const l = S.workshop[def.id] || 0; if (l) def.apply(m, l); }
    for (const def of D.LEGACY) { const l = S.legacy[def.id] || 0; if (l) def.apply(m, l); }
    m.offline = Math.min(0.8, m.offline); // closing the game must never beat running it
    const fame = 1 + 0.03 * S.renownLifetime;
    m.dmg *= fame; m.gold *= fame;
    m.fame = fame;
    modsCache = m;
    return m;
  };

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
    // Idle Battery is a floor, so starting to type can never make the party weaker
    return Math.max(mult, 1 + m.idlePow);
  };

  // ---------------------------------------------------------------- activity (the hook)
  let lastInputT = 0;
  KK.lastInputAgo = () => (KK.simTime || 0) - lastInputT;
  KK.addActivity = function (kind) {
    const S = KK.S, m = KK.mods();
    if (!S.settings.countInput) return;
    lastInputT = KK.simTime || 0;
    const before = KK.fervorTier();
    if (kind === 'key') {
      S.stats.keys++; S.keyCounter++;
      S.fervor = Math.min(100, S.fervor + 1.2 * m.fervGain);
    } else {
      S.stats.clicks++;
      S.fervor = Math.min(100, S.fervor + 0.9 * m.fervGain);
    }
    const cap = m.sparkCap;
    if (S.sparks < cap) S.sparks = Math.min(cap, S.sparks + 1);
    if (m.keyCoin > 0 && kind === 'key' && Math.random() < m.keyCoin) {
      const g = Math.max(S.incomeRate * 3, F.enemyGold(S.floor) * m.gold);
      KK.gainGold(g, 'keycoin');
      KK.emit('keycoin', { amount: g });
    }
    if (m.hotkey && kind === 'key' && S.keyCounter % 150 === 0) KK.emit('hotkey');
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
    if (id === 'veterans') for (const h of D.PARTY_ORDER) if (S.heroes[h] && S.heroes[h] < 1 + m.startLvl) S.heroes[h] = 1 + m.startLvl;
    KK.dirty();
    KK.emit('upgrade', { store: 'legacy', id, lvl: l + 1 });
    return true;
  };

  A.rollRelics = () => {
    const S = KK.S, m = KK.mods();
    const pool = D.RELICS.filter((r) => !(r.unique && S.relics.includes(r.id)));
    const out = [];
    while (out.length < m.relicChoices && pool.length) {
      const pick = U.weighted(pool, (r) => D.RARITY[r.rar].w);
      out.push(pick.id);
      pool.splice(pool.indexOf(pick), 1);
    }
    S.relicOffer = out;
    KK.emit('relicOffer', { ids: out });
  };
  A.pickRelic = (id) => {
    const S = KK.S;
    if (!S.relicOffer || !S.relicOffer.includes(id)) return false;
    S.relics.push(id);
    S.relicOffer = null;
    KK.dirty();
    KK.emit('relicPicked', { id });
    return true;
  };

  A.renownGain = () => Math.max(0, F.renownFor(KK.S.maxFloorRun) - F.renownFor(KK.S.renownFloor || 0));
  A.retireTarget = () => { const S = KK.S; let f = Math.max(20, S.maxFloorRun + 1); while (F.renownFor(f) - F.renownFor(S.renownFloor || 0) <= 0 && f < 2000) f++; return f; };
  A.canRetire = () => A.renownGain() > 0;
  A.retire = () => {
    const S = KK.S;
    const gain = A.renownGain();
    if (gain <= 0) return false;
    S.renown += gain; S.renownLifetime += gain; S.retires++;
    S.renownFloor = Math.max(S.renownFloor || 0, S.maxFloorRun);
    S.gold = 0; S.forge = {}; S.relics = []; S.relicOffer = null; S.bossBlock = 0;
    KK.dirty();
    const m = KK.mods();
    S.heroes = { knight: 1 + m.startLvl, archer: 0, mage: 0, cleric: 0 };
    S.floor = m.startFloor; S.maxFloorRun = m.startFloor;
    KK.dirty();
    KK.emit('retired', { gain });
    return gain;
  };

  // ---------------------------------------------------------------- save/load
  KK.save = function () {
    if (typeof localStorage === 'undefined' || KK.resetting) return;
    try {
      KK.S.lastSave = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(KK.S));
    } catch (e) { console.warn('[KK] save failed', e); }
  };
  KK.load = function () {
    if (typeof localStorage === 'undefined') return false;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      const fresh = KK.newState();
      // shallow-merge so new fields added in later versions get defaults
      for (const k in fresh) {
        if (data[k] === undefined) continue;
        if (fresh[k] && typeof fresh[k] === 'object' && !Array.isArray(fresh[k])) fresh[k] = Object.assign(fresh[k], data[k]);
        else fresh[k] = data[k];
      }
      KK.S = fresh;
      KK.dirty();
      return true;
    } catch (e) { console.warn('[KK] load failed', e); return false; }
  };
  KK.wipeSave = function () {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  };
})();
