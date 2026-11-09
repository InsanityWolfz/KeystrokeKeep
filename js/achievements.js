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
    { id: 'retire1', name: 'A New Generation', desc: 'Retire your party for the first time.', demo: true, on: 'retired', test: () => true },
    { id: 'gatekeeper', name: 'Gatekeeper', desc: 'Defeat the boss of floor 40.', demo: true, on: 'kill', test: (c) => c.ev.e.boss && c.S.floor === 40 },
    { id: 'rat', name: 'Gilded Whiskers', desc: 'Catch a golden rat.', on: 'ratCaught', test: () => true },
    { id: 'epic', name: 'Epic Loot', desc: 'Take an epic relic.', on: 'relicPicked', test: (c) => { const r = D.RELICS.find((x) => x.id === c.ev.id); return !!r && r.rar === 'epic'; } },
    { id: 'caverns', name: 'Into the Moss', desc: 'Reach the Mossy Caverns.', on: 'floor', test: (c) => c.ev.floor >= 21 },
    { id: 'comeback', name: 'Second Try', desc: 'Beat a boss that wiped your party before.', on: 'kill', test: (c) => c.ev.e.boss && c.ev.e.wasBlocking },
    { id: 'echo', name: 'Say It Twice', desc: 'Have an ultimate echo.', on: 'echo', test: () => true },
    // moments
    { id: 'ult_boss', name: 'Overkill', desc: 'Finish a boss with an ultimate.', on: 'kill', test: (c) => c.ev.e.boss && c.ev.e.lastUlt },
    { id: 'revive', name: 'Not Today', desc: 'Sanctuary brings a fallen hero back.', on: 'revive', test: () => true },
    { id: 'speed60', name: 'Speedrunner', desc: 'Beat the floor-60 boss within 10 minutes of a new delve.', on: 'kill', test: (c) => c.ev.e.boss && c.S.floor === 60 && (c.S.runTime || 0) < 600 && c.S.retires >= 1 },
    { id: 'blitz', name: 'Blitz', desc: 'Defeat 8 bosses within 10 minutes.', on: 'kill', test: (c) => { if (!c.ev.e.boss) return false; const now = c.S.stats.playTime || 0; c.P.bossTimes = (c.P.bossTimes || []).filter((x) => now - x < 600); c.P.bossTimes.push(now); return c.P.bossTimes.length >= 8; } },
    // depth
    { id: 'magma', name: 'Fire Below', desc: 'Reach the Magma Depths.', on: 'floor', test: (c) => c.ev.floor >= 41 },
    { id: 'void', name: 'Into the Void', desc: 'Reach the Hollow Void.', on: 'floor', test: (c) => c.ev.floor >= 61 },
    { id: 'hollow', name: 'Hollow Victory', desc: 'Defeat The Hollow.', on: 'kill', test: (c) => c.ev.e.key === 'hollow' },
    { id: 'hollowed6', name: 'Echoes of the Deep', desc: 'Defeat all six Hollowed bosses.', on: 'kill', test: (c) => { if (!c.ev.e.hollowed) return false; const s = new Set(c.P.hollowed || []); s.add(c.ev.e.key); c.P.hollowed = [...s]; return s.size >= 6; } },
    { id: 'f100', name: 'Heart of the Keep', desc: 'Reach floor 100.', on: 'floor', test: (c) => c.S.maxFloorEver >= 100 },
    { id: 'codex28', name: 'Hollow Scholar', desc: 'Complete every rank of the Hollow Codex.', on: 'codex', test: () => KK.mods().codexRanks >= KK.DATA.CODEX_MAX },
    { id: 'f125', name: 'Abyss Walker', desc: 'Reach floor 125.', on: 'floor', test: (c) => c.S.maxFloorEver >= 125 },
    // prestige & omens
    { id: 'retire10', name: 'Dynasty', desc: 'Retire 10 times for 10+ Renown each.', on: 'retired', test: (c) => { if ((c.ev.gain || 0) >= 10) c.P.bigRetires = (c.P.bigRetires || 0) + 1; return (c.P.bigRetires || 0) >= 10; } },
    { id: 'omen1', name: 'Ill Omen', desc: 'Start a delve under an omen.', on: 'omenPicked', test: (c) => !!c.ev.id },
    { id: 'omen10', name: 'Augur', desc: 'Delve under all ten omens.', on: 'omenPicked', test: (c) => { if (!c.ev.id) return false; const s = new Set(c.P.omens || []); s.add(c.ev.id); c.P.omens = [...s]; return s.size >= D.OMENS.length; } },
    { id: 'deep90', name: 'Against the Omens', desc: 'Reach floor 90 under the Deep Omen.', on: 'floor', test: (c) => c.S.omen === 'deep' && c.ev.floor >= 90 },
    { id: 'legacy_all', name: 'Hall of Legends', desc: 'Max every capped Legacy upgrade.', on: 'upgrade', test: (c) => D.LEGACY.filter((d) => d.max < 999).every((d) => (c.S.legacy[d.id] || 0) >= d.max) },
    // workshop & economy
    { id: 'crucible10', name: 'Forgemaster', desc: 'Max the Ember Crucible.', on: 'upgrade', test: (c) => (c.S.workshop.crucible || 0) >= 10 },
    { id: 'lv100', name: 'Centenarian', desc: 'Raise a hero to level 100.', on: 'levelUp', test: (c) => c.ev.to >= 100 },
    { id: 'chests100', name: 'Treasure Hunter', desc: 'Open 100 treasure chests.', on: 'chest', test: (c) => c.S.stats.chests >= 100 },
    { id: 'rats25', name: 'Rat Catcher', desc: 'Catch 25 golden rats.', on: 'ratCaught', test: (c) => c.S.stats.rats >= 25 },
    { id: 'idle50', name: 'Hands Off', desc: 'Reach floor 50 in a delve without typing.', on: 'floor', test: (c) => c.ev.floor >= 50 && (c.S.runInputs || 0) === 0 && c.S.retires >= 1 },
    // the typing itself
    { id: 'keys10k', name: 'Warming Up', desc: 'Type 10,000 keystrokes.', on: 'poll', test: (c) => c.S.stats.keys >= 1e4 },
    { id: 'keys100k', name: 'Wordsmith', desc: 'Type 100,000 keystrokes.', on: 'poll', test: (c) => c.S.stats.keys >= 1e5 },
    { id: 'flow1h', name: 'Deep Work', desc: 'Spend an hour in FLOW STATE.', on: 'poll', test: (c) => c.S.stats.flowTime >= 3600 },
    { id: 'flow10h', name: 'Monk Mode', desc: 'Spend ten hours in FLOW STATE.', on: 'poll', test: (c) => c.S.stats.flowTime >= 36000 },
    { id: 'ults1k', name: 'Spark Plug', desc: 'Cast 1,000 ultimates.', on: 'poll', test: (c) => c.S.stats.ults >= 1000 },
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
