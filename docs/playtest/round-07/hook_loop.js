// Round 07: preload for tools/playtest.js (node -r): counts re-kills of a boss already beaten this delve (camp loop). Read-only.
const Module = require('module'); const orig = Module._load;
Module._load = function (req) {
  const r = orig.apply(this, arguments);
  if (/headless$/.test(req) && typeof r === 'function') return function (o) { const KK = r(o); attach(KK); return KK; };
  return r;
};
function attach(KK) {
  const P = { kills: 0, re: 0, reH: 0, wipesX1: 0 }; let beaten = new Set();
  KK.on('kill', ({ e }) => { if (!e.boss) return; P.kills++; const f = KK.S.floor; if (beaten.has(f) && !(KK.DEMO_CAP && f === 40)) { P.re++; if (e.hollowed || e.key === 'hollow') P.reH++; } beaten.add(f); });
  KK.on('retired', () => { beaten = new Set(); });
  KK.on('wipe', ({ floor }) => { if (floor % 10 === 1) P.wipesX1++; });
  process.on('exit', () => console.error(`LOOP boss kills ${P.kills}, re-kills of a boss already beaten this delve ${P.re} (Hollowed ${P.reH}), wipes on an x1 floor ${P.wipesX1}`));
}
