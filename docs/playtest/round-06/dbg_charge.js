// R6: how long are the Warlord's damage numbers hidden per War Charge (e.windup is only decremented outside the charge phases)?
// and how long do his void/enrage/attack timers freeze during charges? (demo idle + full typist 8h)
const { run, med } = require('./r6lib');
for (const o of [{ profile: 'idle', seed: 1, min: 180, demo: true }, { profile: 'typist', seed: 1, min: 480 }]) {
  const hid = [], frozen = [];
  run(Object.assign(o, { patch: (KK, hooks) => {
    let cur = null;
    KK.on('chargeWarn', ({ e }) => { e.windup = 1.0; cur = { e, hid: 0, frz: 0 }; }); // what fx.js does
    hooks.tick.push((dt) => {
      if (!cur) return;
      const e = cur.e;
      if (e.windup > 0 && !e.dead) cur.hid += dt;
      if (e.chPhase) cur.frz += dt;
      if (e.dead || (!e.chPhase && !(e.windup > 0))) { hid.push(cur.hid); frozen.push(cur.frz); cur = null; }
    });
  } }));
  console.log(`${o.profile}${o.demo ? ' demo' : ''}: charges ${hid.length}, damage numbers hidden per charge median ${med(hid).toFixed(2)} s (max ${Math.max(...hid).toFixed(2)}), boss timers frozen per charge median ${med(frozen).toFixed(2)} s`);
}
