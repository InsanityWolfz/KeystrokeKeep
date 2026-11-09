// R9 market: per-hour cap table (avg seeds 1+6).  node table8.js [full|proto]
const pre = process.argv[2] || '';
const rows = [['demo', 'idle', [0]], ['demo', 'idle', [1]], ['demo', 'typist', [0]], ['demo', 'typist', [1]], ['full', 'idle', [0]], ['full', 'idle', [6, 7]], ['full', 'typist', [0]], ['full', 'typist', [6, 7]]];
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
const geo = /^(FLOOR #|MOSSY CAVERNS|THE CRYPT|MAGMA DEPTHS|THE HOLLOW VOID)$/;
const cols = {
  alerts: (h) => sum(h.alert), bigBanners: (h) => sum(h.banner), bigExclFloorBiome: (h) => Object.entries(h.banner || {}).filter(([k]) => !geo.test(k)).reduce((a, [, v]) => a + v, 0),
  toasts: (h) => sum(h.toast), toastsNonTutorial: (h) => Object.entries(h.toast || {}).filter(([k]) => !/^tutorial/.test(k)).reduce((a, [, v]) => a + v, 0),
  strongFlash: (h) => sum(h.flashStrong), faintFlash: (h) => sum(h.flashFaint), shakes: (h) => sum(h.shake), SFX: (h) => sum(h.sound), loudSFX: (h) => sum(h.loudSound),
  ultBooms: (h) => ((h.sound || {}).ultKnight || 0) + ((h.sound || {}).meteor || 0), softBoom: (h) => (h.sound || {}).softBoom || 0, minorBanners: (h) => sum(h.minorBanner), achHeld: (h) => sum(h.suppressed), secsSound: (h) => (h.secs || {})['any sound started (seconds with >=1)'] || 0,
  goldPulse: (h) => sum(h.hud), flowPulseS: (h) => (h.secs || {})['FLOW vignette (pulsing)'] || 0, heroPulseS: (h) => (h.secs || {})['hero FLOW outline pulse 1.3 Hz (not calm-gated)'] || 0, plateS: (h) => (h.secs || {})['alert plate on screen (2 Hz text blink)'] || 0, bannerS: (h) => (h.secs || {})['big banner on screen'] || 0, modals: (h) => sum(h.modal),
};
console.log(['build', 'prof', 'h', ...Object.keys(cols)].join('\t'));
for (const [b, p, hs] of rows) {
  const v = Object.keys(cols).map(() => 0); let n = 0;
  for (const s of [1, 6]) { const r = require(`./out/c9_${pre}${b}_${p}_${s}.json`); for (const h of hs) { const ph = r.perHour[h]; if (!ph) continue; n++; Object.values(cols).forEach((f, i) => (v[i] += f(ph))); } }
  console.log([b, p, hs.map((h) => 'h' + (h + 1)).join('+'), ...v.map((x) => Math.round(x / n))].join('\t'));
}
