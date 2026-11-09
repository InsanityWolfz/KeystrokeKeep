/* Keystroke Keep — game data: heroes, monsters, biomes, relics, upgrades. */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const KK = root.KK;

  const HEROES = {
    knight: {
      name: 'Sir Clank', cls: 'Knight', role: 'melee', hp: 70, atk: 5, spd: 1.0, range: 14,
      recruit: 0, unlockFloor: 1, lvlCost: 8,
      ult: { name: 'Earthshatter', cost: 25, cd: 6, desc: 'Leaps and slams: 400% damage to all nearby foes, stuns them.' },
      blurb: 'Takes the hits so nobody else has to.',
    },
    archer: {
      name: 'Wren', cls: 'Archer', role: 'ranged', hp: 38, atk: 7, spd: 0.8, range: 120,
      recruit: 60, unlockFloor: 3, lvlCost: 25,
      ult: { name: 'Arrow Storm', cost: 30, cd: 7, desc: '8 arrows rain from the ceiling, 150% damage each.' },
      blurb: 'Never misses. Mostly.',
    },
    mage: {
      name: 'Mortimer', cls: 'Mage', role: 'caster', hp: 30, atk: 15, spd: 1.7, range: 110, splash: 0.5,
      recruit: 1500, unlockFloor: 10, lvlCost: 80,
      ult: { name: 'Meteor', cost: 50, cd: 9, desc: 'Calls down a meteor: 800% damage to everything it lands near.' },
      blurb: 'Slow, old, and extremely explosive.',
    },
    cleric: {
      name: 'Sister Pell', cls: 'Cleric', role: 'healer', hp: 44, atk: 4, spd: 1.2, range: 100,
      recruit: 4000, unlockFloor: 18, lvlCost: 400,
      ult: { name: 'Sanctuary', cost: 0, cd: 25, free: true, desc: 'Answers the first boss slam of every fight and any knockout: fully heals the party and revives the fallen.' },
      blurb: 'Patches up whatever is left of the others.',
    },
  };
  const PARTY_ORDER = ['knight', 'archer', 'cleric', 'mage']; // front -> back

  // hp/atk/gold are multipliers on the per-floor base; w/h is the footprint in game pixels
  const MONSTERS = {
    rat: { name: 'Cellar Rat', hp: 0.8, atk: 0.8, gold: 0.8, speed: 16, range: 10, w: 16, h: 8 },
    bat: { name: 'Crypt Bat', hp: 0.6, atk: 0.9, gold: 0.9, speed: 20, range: 10, w: 14, h: 8, fly: true },
    skeleton: { name: 'Skeleton', hp: 1.5, atk: 1.1, gold: 1.3, speed: 11, range: 12, w: 12, h: 16 },
    slime: { name: 'Moss Slime', hp: 1.3, atk: 0.8, gold: 1.0, speed: 9, range: 10, w: 14, h: 10 },
    spider: { name: 'Cave Spider', hp: 0.9, atk: 1.3, gold: 1.1, speed: 18, range: 10, w: 16, h: 8 },
    goblin: { name: 'Goblin', hp: 1.2, atk: 1.2, gold: 1.5, speed: 14, range: 11, w: 12, h: 14 },
    imp: { name: 'Fire Imp', hp: 0.8, atk: 1.1, gold: 1.2, speed: 14, range: 70, w: 12, h: 12, fly: true, ranged: 'fireball' },
    golem: { name: 'Rock Golem', hp: 2.4, atk: 1.3, gold: 1.8, speed: 7, range: 12, w: 14, h: 16 },
    magslime: { name: 'Magma Slime', hp: 1.4, atk: 1.0, gold: 1.1, speed: 9, range: 10, w: 14, h: 10 },
    eye: { name: 'Watcher', hp: 0.9, atk: 1.3, gold: 1.3, speed: 10, range: 80, w: 12, h: 12, fly: true, ranged: 'beam' },
    wraith: { name: 'Wraith', hp: 1.1, atk: 1.4, gold: 1.3, speed: 16, range: 11, w: 12, h: 14, fly: true },
    voidknight: { name: 'Void Knight', hp: 2.0, atk: 1.5, gold: 1.8, speed: 10, range: 13, w: 16, h: 16 },
    // bosses
    ratking: { name: 'The Rat King', boss: true, hp: 1, atk: 1, gold: 1, speed: 10, range: 18, w: 32, h: 22 },
    boneking: { name: 'The Bone King', boss: true, hp: 1.2, atk: 1, gold: 1.1, speed: 8, range: 18, w: 24, h: 40 },
    broodmother: { name: 'Brood Mother', boss: true, hp: 1, atk: 1.2, gold: 1, speed: 10, range: 20, w: 32, h: 16 },
    warlord: { name: 'Goblin Warlord', boss: true, hp: 1.2, atk: 1.1, gold: 1.2, speed: 9, range: 18, w: 24, h: 36 },
    embergolem: { name: 'Ember Colossus', boss: true, hp: 1.4, atk: 1.1, gold: 1.2, speed: 6, range: 20, w: 28, h: 32 },
    magmalord: { name: 'Magma Lord', boss: true, hp: 1.1, atk: 1.3, gold: 1.2, speed: 9, range: 18, w: 24, h: 32, fly: true },
    hollow: { name: 'The Hollow', boss: true, hp: 1.3, atk: 1.3, gold: 1.3, speed: 8, range: 20, w: 24, h: 30, fly: true },
  };

  const BIOMES = [
    {
      id: 'crypt', name: 'The Crypt', from: 1,
      monsters: ['rat', 'bat', 'skeleton'], bosses: ['ratking', 'boneking'],
      pal: { fog: '#0e0b16', wall: '#3a3350', wallHi: '#4a4264', wallLo: '#2b253c', mortar: '#1a1626', floor: '#463d5a', floorHi: '#5d5276', floorLo: '#2a2438', accent: '#6b5f8a', torch: '#ffa040', dark: 0.58 },
    },
    {
      id: 'caverns', name: 'Mossy Caverns', from: 21,
      monsters: ['slime', 'spider', 'goblin'], bosses: ['broodmother', 'warlord'],
      pal: { fog: '#08120f', wall: '#2c3b36', wallHi: '#3b4f47', wallLo: '#1f2b27', mortar: '#111a17', floor: '#38483f', floorHi: '#4c6255', floorLo: '#202b25', accent: '#5ec26a', torch: '#9cff8a', dark: 0.6 },
    },
    {
      id: 'magma', name: 'Magma Depths', from: 41,
      monsters: ['imp', 'magslime', 'golem'], bosses: ['embergolem', 'magmalord'],
      pal: { fog: '#160806', wall: '#3a2420', wallHi: '#4d302a', wallLo: '#271714', mortar: '#ff5a2e', floor: '#43282a', floorHi: '#5a3632', floorLo: '#24130f', accent: '#ff7a2e', torch: '#ff7030', dark: 0.5 },
    },
    {
      id: 'void', name: 'The Hollow Void', from: 61,
      monsters: ['eye', 'wraith', 'voidknight'], bosses: ['hollow', 'hollow'],
      pal: { fog: '#07040e', wall: '#231a38', wallHi: '#30244c', wallLo: '#170f27', mortar: '#0b0714', floor: '#2a1f40', floorHi: '#3c2d5a', floorLo: '#140d22', accent: '#c472ff', torch: '#c472ff', dark: 0.62 },
    },
  ];

  const RARITY = { common: { w: 58, label: 'COMMON' }, rare: { w: 30, label: 'RARE' }, epic: { w: 15, label: 'EPIC' } };
  const RELICS = [
    { id: 'whetstone', name: 'Whetstone', rar: 'common', icon: 'whetstone', desc: '+20% party damage.', apply: (m) => { m.dmg *= 1.2; } },
    { id: 'luckycoin', name: 'Lucky Coin', rar: 'common', icon: 'coin', desc: '+30% gold from all sources.', apply: (m) => { m.gold *= 1.3; } },
    { id: 'spacebar', name: 'Spacebar Shield', rar: 'common', icon: 'shield', desc: '+35% party max HP.', apply: (m) => { m.hp *= 1.35; } },
    { id: 'boots', name: 'Backspace Boots', rar: 'common', icon: 'boots', desc: '+25% walking speed.', apply: (m) => { m.walk *= 1.25; } },
    { id: 'coffee', name: 'Bottomless Coffee', rar: 'common', icon: 'mug', desc: '+15% attack speed.', apply: (m) => { m.aspd *= 1.15; } },
    { id: 'belt', name: "Giant's Belt", rar: 'common', icon: 'belt', desc: 'Sir Clank: +60% HP and +30% damage.', apply: (m) => { m.knightHp *= 1.6; m.knightDmg *= 1.3; } },
    { id: 'keycap', name: 'Clacky Keycap', rar: 'rare', icon: 'keycap', desc: 'Every keystroke has a 3% chance to mint a coin worth 3s of income.', apply: (m) => { m.keyCoin += 0.03; } },
    { id: 'capslock', name: 'Caps Lock Crown', rar: 'rare', icon: 'crown', desc: 'Fervor drains 35% slower.', apply: (m) => { m.fervDecay *= 0.65; } },
    { id: 'enter', name: 'Enter Amulet', rar: 'rare', icon: 'amulet', desc: 'Ultimates cost 40% fewer Sparks.', apply: (m) => { m.ultCost *= 0.6; } },
    { id: 'fang', name: 'Vampire Fang', rar: 'rare', icon: 'fang', desc: 'Heroes heal for 4% of the damage they deal.', apply: (m) => { m.lifesteal += 0.04; } },
    { id: 'oil', name: 'Midnight Oil', rar: 'rare', icon: 'candle', desc: 'Offline earnings +20 points (and their cap rises to 100%). Treasure chests are 50% more common.', apply: (m) => { m.offline += 0.2; m.offlineCap = 1; m.chest *= 1.5; } },
    { id: 'map', name: 'Treasure Map', rar: 'rare', icon: 'map', desc: 'Treasure chests appear twice as often.', apply: (m) => { m.chest *= 2; } },
    { id: 'lens', name: "Critic's Lens", rar: 'rare', icon: 'lens', desc: '+10% crit chance. Crits deal 3x.', unique: true, apply: (m) => { m.crit += 0.1; m.critMult = Math.max(m.critMult, 3); } },
    { id: 'echo', name: 'Echo Rune', rar: 'epic', icon: 'rune', desc: 'Every ultimate casts twice.', unique: true, apply: (m) => { m.echo += 1; } },
    { id: 'glass', name: 'Glass Cannon', rar: 'epic', icon: 'gem', desc: '+75% damage, but -25% max HP.', unique: true, apply: (m) => { m.dmg *= 1.75; m.hp *= 0.75; } },
    { id: 'flowpend', name: 'Flow Pendant', rar: 'epic', icon: 'pendant', desc: 'FLOW STATE grants an extra +100% power.', unique: true, apply: (m) => { m.flowBonus += 1; } },
    { id: 'hotkey', name: 'Hotkey Ring', rar: 'epic', icon: 'ring', desc: 'Every 60th keystroke fires the next hero\'s ultimate for free.', unique: true, apply: (m) => { m.hotkey = true; } },
  ];

  // Gold upgrades (reset on retire)
  const FORGE = [
    { id: 'blades', name: 'Sharpen Blades', icon: 'sword', base: 120, growth: 1.7, max: 999, desc: (l) => `+15% party damage per level (now +${15 * l}%)`, apply: (m, l) => { m.dmg *= 1 + 0.15 * l; } },
    { id: 'armor', name: 'Rivet Armor', icon: 'shield', base: 100, growth: 1.65, max: 999, desc: (l) => `+15% party max HP per level (now +${15 * l}%)`, apply: (m, l) => { m.hp *= 1 + 0.15 * l; } },
    { id: 'purse', name: 'Gilded Purse', icon: 'coin', base: 250, growth: 1.85, max: 999, desc: (l) => `+12% gold per level (now +${12 * l}%)`, apply: (m, l) => { m.gold *= 1 + 0.12 * l; } },
    { id: 'swift', name: 'Swift Boots', icon: 'boots', base: 180, growth: 2.1, max: 10, desc: (l) => `+6% walk speed per level (now +${6 * l}%)`, apply: (m, l) => { m.walk *= 1 + 0.06 * l; } },
    { id: 'keen', name: 'Keen Edge', icon: 'lens', base: 400, growth: 2.1, max: 10, desc: (l) => `+3% crit chance and +25% crit damage per level (now +${3 * l}%, +${25 * l}%)`, apply: (m, l) => { m.crit += 0.03 * l; m.critMult += 0.25 * l; } },
  ];

  // Ember upgrades (never reset). Every Spark spent on an ultimate also banks 1 Ember.
  const WORKSHOP = [
    { id: 'crucible', name: 'Ember Crucible', icon: 'spark', base: 60, growth: 1.6, max: 10, desc: (l) => `+15% Embers from every source per level (now +${15 * l}%)`, apply: (m, l) => { m.emberGain *= 1 + 0.15 * l; } },
    { id: 'overcharge', name: 'Overcharge', icon: 'gem', base: 100, growth: 1.6, max: 999, desc: (l) => `Ultimate damage x1.3 per level (now x${Math.pow(1.3, l).toFixed(2)})`, apply: (m, l) => { m.ultPow *= Math.pow(1.3, l); } },
    { id: 'kindling', name: 'Second Wind', icon: 'candle', base: 120, growth: 1.55, max: 10, needsTyping: 'FOR TYPISTS WHO PAUSE', desc: (l) => `After a break of 30s+, your next ${4 * l} keys each give +2 extra Sparks`, apply: (m, l) => { m.secondWind += 4 * l; } },
    { id: 'dynamo', name: 'Dynamo', icon: 'clock', base: 150, growth: 1.6, max: 10, desc: (l) => `+10% power per level while you're not typing (now +${10 * l}%)`, apply: (m, l) => { m.dynamo += 0.10 * l; } },
    { id: 'static', name: 'Static Coins', icon: 'keycap', base: 140, growth: 1.75, max: 8, needsTyping: true, desc: (l) => `Each keystroke: +1% chance per level to mint a coin (now ${l}%)`, apply: (m, l) => { m.keyCoin += 0.01 * l; } },
  ];

  // Renown upgrades (permanent)
  const LEGACY = [
    { id: 'lineage', name: 'Heroic Lineage', icon: 'sword', max: 999, cost: (l) => 2 + 2 * l, desc: (l) => `+25% damage per level (now +${25 * l}%)`, apply: (m, l) => { m.dmg *= 1 + 0.25 * l; } },
    { id: 'treasury', name: 'Royal Treasury', icon: 'coin', max: 999, cost: (l) => 2 + 2 * l, desc: (l) => `+25% gold per level (now +${25 * l}%)`, apply: (m, l) => { m.gold *= 1 + 0.25 * l; } },
    { id: 'quartermaster', name: 'Quartermaster', icon: 'hammer', max: 1, cost: () => 6, desc: () => 'Automatically levels your heroes with spare gold (toggle in Settings).', apply: (m, l) => { if (l) m.auto = true; } },
    { id: 'veterans', name: 'Veteran Recruits', icon: 'shield', max: 10, cost: (l) => 3 + 2 * l, desc: (l) => `Heroes join at +10 levels per rank (now +${10 * l})`, apply: (m, l) => { m.startLvl += 10 * l; } },
    { id: 'headstart', name: 'Head Start', icon: 'boots', get max() { return KK.DEMO_CAP ? 2 : 8; }, cost: (l) => 3 + 2 * l, desc: (l) => `Begin each delve 5 floors deeper, heroes 8 levels higher (now floor ${1 + 5 * Math.min(l, KK.DEMO_CAP ? 2 : 8)}, +${8 * Math.min(l, KK.DEMO_CAP ? 2 : 8)} levels)`, apply: (m, l) => { const k = KK.DEMO_CAP ? Math.min(l, 2) : l; m.startFloor += 5 * k; m.startLvl += 8 * k; } },
    { id: 'zeal', name: 'Zealous Spirit', icon: 'candle', max: 5, cost: (l) => 4 + 2 * l, desc: (l) => `Fervor drains 12% slower per rank (now -${Math.round((1 - Math.pow(0.88, l)) * 100)}%)`, apply: (m, l) => { m.fervDecay *= Math.pow(0.88, l); } },
    { id: 'recruiter', name: 'Recruiter', icon: 'heart', max: 1, cost: () => 8, desc: () => 'Recruiting heroes costs 75% less.', apply: (m, l) => { if (l) m.heroCost *= 0.25; } },
    { id: 'campfire', name: 'Warm Campfire', icon: 'clock', max: 4, cost: (l) => 4 + 2 * l, desc: (l) => `Offline earnings +10 points per rank (now ${40 + 10 * l}% of your recent kill income, max 80%)`, apply: (m, l) => { m.offline += 0.1 * l; } },
    { id: 'battery', name: 'Idle Battery', icon: 'clock', max: 3, cost: (l) => 3 + 2 * l, desc: (l) => `+6% power while you're not typing, per rank (now +${6 * l}%)`, apply: (m, l) => { m.idlePow += 0.06 * l; } },
    { id: 'collector', name: 'Relic Collector', icon: 'gem', max: 1, cost: () => 20, desc: () => 'Bosses offer 4 relics to choose from.', apply: (m, l) => { if (l) m.relicChoices = 4; } },
  ];

  // Delve Omens: from the 2nd retire on, each new delve picks 1 of 3 modifiers (or none). Not in the demo.
  const OMENS = [
    { id: 'gilded', name: 'Gilded Delve', icon: 'coin', desc: 'Gold x2, but monsters have +40% HP.', apply: (m) => { m.gold *= 2; m.eHp *= 1.4; } },
    { id: 'glass', name: 'Glass Delve', icon: 'gem', desc: 'Party damage x1.6, but party HP x0.65 and attacks 20% slower.', apply: (m) => { m.dmg *= 1.6; m.hp *= 0.65; m.aspd *= 0.8; } },
    { id: 'storm', name: 'Storm Front', icon: 'spark', desc: 'Ultimates cost 30% less and hit 50% harder, but Fervor drains twice as fast.', apply: (m) => { m.ultCost *= 0.7; m.ultPow *= 1.5; m.fervDecay *= 2; } },
    { id: 'quiet', name: 'Quiet Halls', icon: 'clock', desc: 'The party fights at x1.35 even when you are not typing, but Fervor builds half as fast.', apply: (m) => { m.idlePow = Math.max(m.idlePow, 0.35); m.fervGain *= 0.5; } },
    { id: 'fever', name: 'Treasure Fever', icon: 'map', desc: 'Treasure chests x3, but monsters hit 25% harder.', apply: (m) => { m.chest *= 3; m.eAtk *= 1.25; } },
    { id: 'embertide', name: 'Ember Tide', icon: 'candle', desc: 'Embers x2, but gold x0.85.', apply: (m) => { m.emberGain *= 2; m.gold *= 0.85; } },
    { id: 'march', name: 'Forced March', icon: 'boots', desc: 'Walk 50% faster and attack 15% faster, but party HP x0.85.', apply: (m) => { m.walk *= 1.5; m.aspd *= 1.15; m.hp *= 0.85; } },
    { id: 'hoard', name: 'Relic Hoard', icon: 'gem', desc: 'Bosses offer one extra relic, but monsters have +20% HP.', apply: (m) => { m.relicChoices += 1; m.eHp *= 1.2; } },
    { id: 'muster', name: "Veterans' Muster", icon: 'shield', desc: 'Keep all Forge upgrades from your last delve, but gold x0.8.', apply: (m) => { m.gold *= 0.8; } },
    { id: 'deep', name: 'Deep Omen', icon: 'crown', desc: 'Renown x1.12 this delve, but monsters have +30% HP and hit 30% harder.', apply: (m) => { m.renownMult *= 1.12; m.eHp *= 1.3; m.eAtk *= 1.3; } },
  ];

  // Depth trophies: permanent x1.05 damage & gold for each record depth reached
  // Hollow Codex: each late boss (The Hollow + 6 Hollowed) ranks up at these kill counts, x1.03 each
  const CODEX_RANKS = [3, 10, 20, 40]; // legacy per-boss thresholds (old saves)
  const CODEX_EVERY = 8, CODEX_MAX = 28; // one rank per 8 Hollowed kills
  const TROPHIES = [75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 140, 150];

  const FERVOR_TIERS = [
    { at: 0, name: 'IDLE', mult: 1.0 },
    { at: 25, name: 'FOCUSED', mult: 1.25 },
    { at: 60, name: 'IN THE ZONE', mult: 1.6 },
    { at: 90, name: 'FLOW STATE', mult: 2.2 },
  ];

  KK.DATA = { HEROES, PARTY_ORDER, MONSTERS, BIOMES, RELICS, RARITY, FORGE, WORKSHOP, LEGACY, FERVOR_TIERS, OMENS, TROPHIES, CODEX_RANKS, CODEX_EVERY, CODEX_MAX };
})();
