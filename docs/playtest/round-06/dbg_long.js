// R6: boss fights that outlast the 3-minute enrage on HEAD (the enrage only works until the first wipe of a delve)
const { run } = require('./r6lib');
const args = process.argv.slice(2);
for (const p of ['typist', 'idle', 'light']) for (const seed of [1, 2]) {
  const R = run({ profile: p, seed, min: 2400, patch: args.includes('fix') ? (KK, hooks) => hooks.tick.push(() => { if (KK.world.wipeT < 0) KK.world.wipeT = 0; }) : undefined });
  const f = R.boss.filter((x) => x.active !== null);
  const long = f.filter((x) => x.adur > 180);
  const sum = long.reduce((a, x) => a + x.adur, 0);
  console.log(`${p} s${seed} 40h${args.includes('fix') ? ' (wipeT fix)' : ''}: ${f.length} boss fights, ${long.length} over 180 s (${long.filter((x) => x.how === 'kill').length} won), longest ${(Math.max(...f.map((x) => x.adur)) / 60).toFixed(1)} min, time in >3-min fights ${(sum / 3600).toFixed(1)} h, enrages ${R.sigTotals.bossEnrage}`);
}
