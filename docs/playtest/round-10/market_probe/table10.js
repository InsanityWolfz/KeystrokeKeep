// R10 market: per-hour cap table (avg seeds 1+6) from out/c10_*.json.  node table10.js
const rows = [['demo', 'idle', [0]], ['demo', 'idle', [1]], ['demo', 'typist', [0]], ['demo', 'typist', [1]], ['full', 'idle', [0]], ['full', 'idle', [6, 7]], ['full', 'idle', [10, 11]], ['full', 'typist', [0]], ['full', 'typist', [2, 3]], ['full', 'typist', [6, 7]], ['full', 'typist', [10, 11]]];
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
const cols = {
  alerts: (h) => sum(h.alert), heartAlerts: (h) => Object.entries(h.alert || {}).filter(([k]) => /OVERGROWTH|LOCKDOWN/.test(k)).reduce((a, [, v]) => a + v, 0),
  bigBanners: (h) => sum(h.banner), bigRepeat: (h) => sum(h.bannerRepeat),
  toasts: (h) => sum(h.toast), toastsNonTut: (h) => Object.entries(h.toast || {}).filter(([k]) => !/^tutorial/.test(k)).reduce((a, [, v]) => a + v, 0),
  toastsNonTutNoRecruit: (h) => Object.entries(h.toast || {}).filter(([k]) => !/^tutorial|recruited/.test(k)).reduce((a, [, v]) => a + v, 0),
  strongFlash: (h) => sum(h.flashStrong), shakes: (h) => sum(h.shake), SFX: (h) => sum(h.sound), loudSFX: (h) => sum(h.loudSound), crit: (h) => (h.sound || {}).crit || 0,
  secsSound: (h) => (h.secs || {})['any sound started (seconds with >=1)'] || 0, popups: (h) => sum(h.popup),
  plateS: (h) => (h.secs || {})['alert plate on screen (2 Hz text blink)'] || 0, bannerS: (h) => (h.secs || {})['big banner on screen'] || 0,
};
console.log(['build', 'prof', 'h', ...Object.keys(cols)].join('\t'));
for (const [b, p, hs] of rows) {
  const v = Object.keys(cols).map(() => 0); let n = 0;
  for (const s of [1, 6]) { const r = require(`./out/c10_${b}_${p}_${s}.json`); for (const h of hs) { const ph = r.perHour[h]; if (!ph) continue; n++; Object.values(cols).forEach((f, i) => (v[i] += f(ph))); } }
  console.log([b, p, hs.map((h) => 'h' + (h + 1)).join('+'), ...v.map((x) => Math.round(x / n))].join('\t'));
}
for (const f of ['full_typist_1', 'full_typist_6', 'full_idle_1', 'full_idle_6', 'demo_typist_1', 'demo_typist_6', 'demo_idle_1', 'demo_idle_6']) { const r = require(`./out/c10_${f}.json`); console.log(f, JSON.stringify(r.final)); }
