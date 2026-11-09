/* Keystroke Keep — achievements. DOM-free: unlocks are stored in the save (S.ach = { id: unix ms })
   and announced with KK.emit('achievement'). The Steam layer (later) mirrors S.ach to Steam; the
   demo tracks them too, and the full game grants everything in an imported demo save.
   Triggers were measured with the playtest sim (docs/playtest/round-04/auditor.md). */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const KK = root.KK, D = KK.DATA;

  const HEROES = ['knight', 'archer', 'mage', 'cleric'];
  // demo: part of the 5-achievement demo set. on: event name or 'poll' (checked once per second).
  const LIST = [
    // onboarding
    { id: 'first_boss', name: 'Cellar Door', desc: 'Defeat your first boss.', demo: true, on: 'kill', test: (c) => c.ev.e.boss },
    { id: 'flow', name: 'Flow State', desc: 'Reach FLOW STATE.', demo: true, on: 'fervorTier', test: (c) => c.ev.to === 3 },
    { id: 'full_party', name: 'Fellowship', desc: 'Recruit all four heroes.', demo: true, on: 'recruit', test: (c) => HEROES.every((h) => c.S.heroes[h] > 0) },
    { id: 'retire1', big: true, name: 'A New Generation', desc: 'Retire your party for the first time.', demo: true, on: 'retired', test: () => true },
    { id: 'gatekeeper', big: true, name: 'Gatekeeper', desc: 'Defeat the boss of floor 40.', demo: true, on: 'kill', test: (c) => c.ev.e.boss && c.S.floor === 40 },
    { id: 'rat', name: 'Gilded Whiskers', desc: 'Catch a golden rat.', on: 'ratCaught', test: () => true },
    { id: 'epic', name: 'Epic Loot', desc: 'Take an epic relic.', on: 'relicPicked', test: (c) => { const r = D.RELICS.find((x) => x.id === c.ev.id); return !!r && r.rar === 'epic'; } },
    { id: 'caverns', name: 'Into the Moss', desc: 'Reach the Mossy Caverns.', on: 'floor', test: (c) => c.ev.floor >= 21 },
    { id: 'comeback', name: 'Second Try', desc: 'Beat a boss that wiped your party before.', on: 'kill', test: (c) => c.ev.e.boss && c.ev.e.wasBlocking },
    { id: 'echo', name: 'Say It Twice', desc: 'Have an ultimate echo.', on: 'echo', test: () => true },
    // moments
    { id: 'ult_boss', name: 'Overkill', desc: 'Finish a boss with an ultimate.', on: 'kill', test: (c) => c.ev.e.boss && c.ev.e.lastUlt },
    { id: 'revive', name: 'Not Today', desc: 'Sanctuary brings a fallen hero back.', on: 'revive', test: () => true },
    { id: 'speed60', name: 'Speedrunner', desc: 'Beat the floor-60 boss within 10 minutes of a new delve.', on: 'kill', test: (c) => c.ev.e.boss && c.S.floor === 60 && (c.S.runTime || 0) < 600 && c.S.retires >= 1 },
    { id: 'blitz', goal: 8, cur: (S, P) => P.blitzBest || 0, name: 'Blitz', desc: 'Defeat 8 bosses within 10 minutes.', on: 'kill', test: (c) => { if (!c.ev.e.boss) return false; const now = c.S.stats.playTime || 0; c.P.bossTimes = (c.P.bossTimes || []).filter((x) => now - x < 600); c.P.bossTimes.push(now); c.P.blitzBest = Math.max(c.P.blitzBest || 0, c.P.bossTimes.length); return c.P.bossTimes.length >= 8; } },
    // depth
    { id: 'magma', name: 'Fire Below', desc: 'Reach the Magma Depths.', on: 'floor', test: (c) => c.ev.floor >= 41 && !c.S.glimpse },
    { id: 'void', name: 'Into the Void', desc: 'Reach the Hollow Void.', on: 'floor', test: (c) => c.ev.floor >= 61 },
    { id: 'hollow', big: true, name: 'Hollow Victory', desc: 'Defeat The Hollow.', on: 'kill', test: (c) => c.ev.e.key === 'hollow' },
    { id: 'hollowed6', goal: 6, cur: (S, P) => (P.hollowed || []).length, name: 'Echoes of the Deep', desc: 'Defeat all six Hollowed bosses.', on: 'kill', test: (c) => { if (!c.ev.e.hollowed) return false; const s = new Set(c.P.hollowed || []); s.add(c.ev.e.key); c.P.hollowed = [...s]; return s.size >= 6; } },
    { id: 'f100', big: true, goal: 100, from: 61, cur: (S) => Math.min(S.maxFloorEver, 99), name: 'Heart of the Keep', desc: 'Defeat the Heart of the Keep on floor 100.', on: 'kill', test: (c) => !!c.ev.e.heart || (c.ev.e.boss && c.S.floor >= 100) },
    { id: 'codex28', big: true, get goal() { return D.CODEX_MAX; }, cur: () => KK.mods().codexRanks || 0, name: 'Hollow Scholar', desc: 'Complete every rank of the Hollow Codex.', on: 'codex', test: () => KK.mods().codexRanks >= KK.DATA.CODEX_MAX },
    { id: 'seals7', goal: 7, cur: (S) => S.seals || 0, name: 'Faithful', desc: 'Earn 7 Seals of the Day.', on: 'seal', test: (c) => (c.S.seals || 0) >= 7 },
    { id: 'seals30', big: true, goal: 30, cur: (S) => S.seals || 0, name: 'Devout', desc: 'Earn 30 Seals of the Day.', on: 'seal', test: (c) => (c.S.seals || 0) >= 30 },
    { id: 'f125', goal: 125, from: 100, cur: (S) => S.maxFloorEver, name: 'Abyss Walker', desc: 'Reach floor 125.', on: 'floor', test: (c) => c.S.maxFloorEver >= 125 },
    { id: 'f150', big: true, goal: 150, from: 100, cur: (S) => S.maxFloorEver, name: 'Bottom of the Keep', desc: 'Reach floor 150.', on: 'floor', test: (c) => c.S.maxFloorEver >= 150 },
    // prestige & omens
    { id: 'retire10', goal: 10, cur: (S, P) => P.bigRetires || 0, name: 'Dynasty', desc: 'Retire 10 times for 10+ Renown each.', on: 'retired', test: (c) => { if ((c.ev.gain || 0) >= 10) c.P.bigRetires = (c.P.bigRetires || 0) + 1; return (c.P.bigRetires || 0) >= 10; } },
    { id: 'omen1', name: 'Ill Omen', desc: 'Start a delve under an omen.', on: 'omenPicked', test: (c) => !!c.ev.id },
    { id: 'omen10', get goal() { return D.OMENS.length; }, cur: (S, P) => (P.omens || []).length, name: 'Augur', desc: 'Delve under all ten omens.', on: 'omenPicked', test: (c) => { if (!c.ev.id) return false; const s = new Set(c.P.omens || []); s.add(c.ev.id); c.P.omens = [...s]; return s.size >= D.OMENS.length; } },
    { id: 'deep90', goal: 90, from: 40, cur: (S, P) => P.deepBest || 0, name: 'Against the Omens', desc: 'Reach floor 90 under the Deep Omen.', on: 'floor', test: (c) => { if (c.S.omen === 'deep') c.P.deepBest = Math.max(c.P.deepBest || 0, c.ev.floor); return c.S.omen === 'deep' && c.ev.floor >= 90; } },
    { id: 'legacy_all', get goal() { return D.LEGACY.filter((d) => d.max < 999).length; }, cur: (S) => D.LEGACY.filter((d) => d.max < 999 && (S.legacy[d.id] || 0) >= d.max).length, name: 'Living Legend', desc: 'Max every capped Legacy upgrade.', on: 'upgrade', test: (c) => D.LEGACY.filter((d) => d.max < 999).every((d) => (c.S.legacy[d.id] || 0) >= d.max) },
    // workshop & economy
    { id: 'crucible10', goal: 10, cur: (S) => S.workshop.crucible || 0, name: 'Forgemaster', desc: 'Max the Ember Crucible.', on: 'upgrade', test: (c) => (c.S.workshop.crucible || 0) >= 10 },
    { id: 'lv100', goal: 100, from: 30, cur: (S, P) => Math.max(P.lvBest || 0, ...HEROES.map((h) => S.heroes[h] || 0)), name: 'Centenarian', desc: 'Raise a hero to level 100.', on: 'levelUp', test: (c) => { c.P.lvBest = Math.max(c.P.lvBest || 0, c.ev.to); return c.ev.to >= 100; } },
    { id: 'chests100', goal: 100, cur: (S) => S.stats.chests, name: 'Treasure Hunter', desc: 'Open 100 treasure chests.', on: 'chest', test: (c) => c.S.stats.chests >= 100 },
    { id: 'rats25', goal: 25, cur: (S) => S.stats.rats, name: 'Rat Catcher', desc: 'Catch 25 golden rats.', on: 'ratCaught', test: (c) => c.S.stats.rats >= 25 },
    { id: 'idle50', name: 'Hands Off', desc: 'Reach floor 50 in a delve without typing.', on: 'floor', test: (c) => c.ev.floor >= 50 && (c.S.runInputs || 0) === 0 && c.S.retires >= 1 },
    // the typing itself
    { id: 'keys10k', goal: 1e4, cur: (S) => S.stats.keys, name: 'Warming Up', desc: 'Type 10,000 keystrokes.', on: 'poll', test: (c) => c.S.stats.keys >= 1e4 },
    { id: 'keys100k', goal: 1e5, cur: (S) => S.stats.keys, name: 'Wordsmith', desc: 'Type 100,000 keystrokes.', on: 'poll', test: (c) => c.S.stats.keys >= 1e5 },
    { id: 'flow1h', goal: 3600, cur: (S) => S.stats.flowTime, fmt: (v) => KK.U.fmtTime(v), name: 'Deep Work', desc: 'Spend an hour in FLOW STATE.', on: 'poll', test: (c) => c.S.stats.flowTime >= 3600 },
    { id: 'flow10h', goal: 36000, cur: (S) => S.stats.flowTime, fmt: (v) => KK.U.fmtTime(v), name: 'Monk Mode', desc: 'Spend ten hours in FLOW STATE.', on: 'poll', test: (c) => c.S.stats.flowTime >= 36000 },
    { id: 'ults1k', goal: 1000, cur: (S) => S.stats.ults, name: 'Spark Plug', desc: 'Cast 1,000 ultimates.', on: 'poll', test: (c) => c.S.stats.ults >= 1000 },
  ];

  const A = KK.ach = { LIST };
  A.unlock = function (id) {
    const S = KK.S;
    S.ach = S.ach || {};
    if (S.ach[id]) return false;
    S.ach[id] = Date.now();
    const def = LIST.find((x) => x.id === id);
    KK.emit('achievement', { id, def });
    return true;
  };
  function check(def, ev) {
    const S = KK.S;
    if (S.ach && S.ach[def.id]) return;
    S.achP = S.achP || {};
    let ok = false;
    try { ok = def.test({ S, P: S.achP, ev: ev || {} }); } catch (e) { ok = false; }
    if (ok) A.unlock(def.id);
  }
  /** Progress toward a counter achievement: { cur, goal, pct, txt } or null (binary / hidden / done). */
  A.progress = (def) => {
    if (!def.goal || !def.cur) return null;
    const S = KK.S, P = S.achP || {};
    let cur;
    try { cur = def.cur(S, P); } catch (e) { return null; }
    if (def.from && cur < def.from) return null;
    if (cur >= def.goal) { A.unlock(def.id); return null; } // old saves past a goal unlock on sight
    const f = def.fmt || KK.U.fmt;
    const g = def.fmt ? (def.goal % 3600 === 0 ? def.goal / 3600 + 'h' : f(def.goal)) : def.goal >= 1000 && def.goal % 1000 === 0 ? def.goal / 1000 + 'K' : String(def.goal);
    return { cur, goal: def.goal, pct: Math.floor((100 * cur) / def.goal), txt: f(Math.floor(cur)) + '/' + g };
  };
  A.next = () => {
    let best = null;
    for (const d of LIST) {
      if ((KK.S.ach || {})[d.id] || (KK.DEMO_CAP && !d.demo)) continue;
      const p = A.progress(d);
      if (p && p.pct > 0 && (!best || p.pct > best.pct)) best = Object.assign({ def: d }, p);
    }
    return best;
  };
  const byEv = {};
  for (const d of LIST) (byEv[d.on] = byEv[d.on] || []).push(d);
  for (const ev of Object.keys(byEv)) if (ev !== 'poll') KK.on(ev, (data) => { for (const d of byEv[ev]) check(d, data); });
  let acc = 0;
  A.tick = function (dt) {
    acc += dt;
    if (acc < 1) return;
    acc = 0;
    for (const d of byEv.poll || []) check(d);
  };
  // helpers the triggers rely on
  KK.on('hit', ({ e, ult }) => { e.lastUlt = !!ult; });
  KK.on('bossSpawn', ({ boss }) => { if (KK.S.bossBlock === KK.S.floor) boss.wasBlocking = true; });
  KK.on('activity', ({ kind }) => { if (kind === 'key') KK.S.runInputs = (KK.S.runInputs || 0) + 1; });
  KK.on('retired', () => { KK.S.runInputs = 0; });
  KK.on('omenPicked', () => { KK.S.runInputs = 0; });
})();
