// R6, WORKING TREE: does the Bone King ever stand up again? (pile decrements only after the stun; damage is not blocked)
const { run, med } = require('./r6lib');
for (const o of [{ profile: 'typist', seed: 1, min: 180, demo: true }, { profile: 'idle', seed: 1, min: 180, demo: true }]) {
  const d = []; let diedAsPile = 0, n = 0, pileLen = [];
  run(Object.assign(o, { patch: (KK, hooks) => {
    let cur = null;
    KK.on('reassemble', ({ e }) => { cur = { e, t0: hooks.time() }; n++; });
    hooks.tick.push(() => { if (cur && !cur.e.dead && !(cur.e.pile > 0) && cur.end === undefined) { cur.end = hooks.time(); pileLen.push(cur.end - cur.t0); } });
    KK.on('kill', ({ e }) => { if (cur && e === cur.e) { d.push(hooks.time() - cur.t0); if (e.pile > 0) diedAsPile++; cur = null; } });
  } }));
  console.log(`${o.profile} demo 3h (working tree): reassembles ${n}, re-death median ${med(d).toFixed(2)} s after collapsing, died while still a pile ${diedAsPile}/${d.length}, pile lasts median ${med(pileLen).toFixed(2)} s`);
}
