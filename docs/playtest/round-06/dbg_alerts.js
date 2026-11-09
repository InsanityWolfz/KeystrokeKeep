// R6: how often does the War Charge alert overwrite (or get overwritten by) the VOID SLAM alert? FX.alert shows only the newest one.
const { run } = require('./r6lib');
for (const o of [{ profile: 'typist', seed: 1, min: 2400 }, { profile: 'idle', seed: 1, min: 2400 }]) {
  let lastV = -99, lastC = -99, n = 0, coll = 0, voidN = 0;
  run(Object.assign(o, { patch: (KK, hooks) => {
    KK.on('chargeWarn', ({ e }) => { if (!e.hollowed) return; n++; const t = hooks.time(); lastC = t; if (t - lastV < 1.1) coll++; });
    KK.on('voidWarn', ({ e }) => { if (e.key !== 'warlord') return; voidN++; const t = hooks.time(); lastV = t; if (t - lastC < 1.0) coll++; });
  } }));
  console.log(`${o.profile} 40h: Hollowed Warlord charge warnings ${n}, void warnings ${voidN}, alerts that overlap (one hides the other) ${coll} (${(100 * coll / Math.max(1, voidN)).toFixed(0)}% of void warnings)`);
}
