// Round 07 auditor: what a demo player has seen/done at 30, 60 and 120 minutes (per profile, 3 seeds).
// node demo_audit.js <profile> <seed>
const { run } = require('../round-06/r6lib');
const [profile = 'typist', seed = 1] = process.argv.slice(2);
const CUTS = [10, 20, 30, 45, 60, 90, 120];
const snap = [];
const seen = { mon: new Set(), boss: new Set(), relicOff: new Set(), relicPick: new Set(), moves: new Set(), biomes: new Set(), heroes: new Set(), rats: 0, chests: 0, retires: 0, wipes: 0, ults: 0, flow: false, card: null, sealedToasts: 0 };
const MOVES = { royalSummons: 'Royal Summons', reassemble: 'Reassemble', webShot: 'Web Shot', chargeWarn: 'War Charge', webTorn: 'web torn by an ult' };
run({ profile, seed: +seed, min: 120, demo: true, patch: (KK, hooks) => {
  const S = () => KK.S, D = KK.DATA;
  KK.on('kill', ({ e }) => { (e.boss ? seen.boss : seen.mon).add(e.def.name); });
  KK.on('wave', () => { for (const e of KK.world.enemies) if (!e.boss) seen.mon.add(e.def.name); });
  KK.on('relicOffer', ({ ids }) => ids.forEach((i) => seen.relicOff.add(i)));
  KK.on('relicPicked', ({ id }) => seen.relicPick.add(id));
  for (const m of Object.keys(MOVES)) KK.on(m, () => seen.moves.add(MOVES[m]));
  KK.on('floor', ({ floor }) => seen.biomes.add(KK.F.biomeOf(floor).name));
  KK.on('recruit', ({ id }) => seen.heroes.add(id));
  KK.on('ratCaught', () => seen.rats++);
  KK.on('chest', () => seen.chests++);
  KK.on('retired', () => seen.retires++);
  KK.on('wipe', () => seen.wipes++);
  KK.on('fervorTier', ({ to }) => { if (to === 3) seen.flow = true; });
  KK.on('demoComplete', () => { seen.card = hooks.time(); });
  KK.on('demoSealed', () => seen.sealedToasts++);
  let ci = 0;
  hooks.tick.push((dt, t) => {
    if (ci >= CUTS.length || t < CUTS[ci] * 60) return;
    const s = S(), m = KK.mods();
    const ach = KK.ach.LIST.filter((a) => a.demo && s.ach[a.id]).map((a) => a.name);
    const legacyRows = D.LEGACY.filter((d) => s.legacy[d.id]).length, wsRows = D.WORKSHOP.filter((d) => s.workshop[d.id]).length;
    snap.push(`${String(CUTS[ci]).padStart(3)} min | floor ${String(s.floor).padStart(2)} best ${String(s.maxFloorEver).padStart(2)} | biomes ${seen.biomes.size} | heroes ${1 + seen.heroes.size} | bosses ${[...seen.boss].map((n) => n.replace('The ', '')).join('/') || '-'} | moves ${[...seen.moves].join('/') || '-'} | monsters ${seen.mon.size}/6 | relics offered ${seen.relicOff.size}/17 picked ${seen.relicPick.size} | rats ${seen.rats} chests ${seen.chests} | retires ${seen.retires} (renown ${s.renownLifetime}) | Legacy rows ${legacyRows}/10 Workshop rows ${wsRows}/5 | demo ach ${ach.length}/5 | wipes ${seen.wipes} | FLOW ${seen.flow ? 'y' : 'n'} | card ${seen.card !== null ? (seen.card / 60).toFixed(0) + 'm' : '-'} laps ${s.demoLaps || 0}${s.bestCapTime ? ' best ' + (s.bestCapTime / 60).toFixed(1) + 'm' : ''}`);
    ci++;
  });
} });
console.log(`== demo ${profile} s${seed}`);
console.log(snap.join('\n'));
