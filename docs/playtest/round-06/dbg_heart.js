// debug: why do some Heart/Hollowed fights outlast the 180 s enrage? (idle s1, 40h)
const { run } = require('./r6lib');
const R = run({ profile: 'idle', seed: 1, min: 2400, patch: (KK, hooks) => {
  hooks.tick.push(() => { const b = KK.world.boss; if (b && b.active) { b._act = (b._act || 0) + 1 / 30; } });
  KK.on('kill', ({ e }) => { if (e.boss && e._act > 170) console.log('long kill', e.def.name, 'activeT', e._act.toFixed(0), 'fightT', (e.fightT || 0).toFixed(0), 'floor', KK.S.floor); });
} });
