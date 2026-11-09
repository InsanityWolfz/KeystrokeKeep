// Round 07: preload for tools/playtest.js (node -r) that logs wipes, camp state and repeated boss kills. Read-only.
const Module = require('module'); const orig = Module._load;
Module._load = function (req, parent, isMain) {
  const r = orig.apply(this, arguments);
  if (/headless$/.test(req) && typeof r === 'function') return function (o) { const KK = r(o); attach(KK); return KK; };
  return r;
};
function attach(KK) {
  const S = () => KK.S, T = () => (S().stats.playTime / 60).toFixed(1) + 'm';
  KK.on('wipe', ({ floor, reason }) => console.error(`[${T()}] WIPE f${floor} ${reason || ''} campFloor ${S().campFloor} campUntil ${((S().campUntil - S().stats.playTime) / 60).toFixed(1)}m bossBlock ${S().bossBlock}`));
  KK.on('kill', ({ e }) => { if (e.boss) console.error(`[${T()}] BOSS KILL f${S().floor} ${e.def.name} campFloor ${S().campFloor} campLeft ${((S().campUntil - S().stats.playTime) / 60).toFixed(1)}m`); });
}
