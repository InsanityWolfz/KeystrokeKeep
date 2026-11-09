// R7 market: per-hour table (avg over seeds) for the report.  node table.js
const O = __dirname + '/out/';
const sig = ['WEB SHOT!', 'SQUEAK! THE RAT KING SUMMONS', 'MAGMA SHELL: AN ULTIMATE CRACKS IT', 'SHELL CRACKED!', 'LAVA RAIN!', 'WAR CHARGE!', 'VOID SLAM INCOMING', 'THE BONE KING REASSEMBLES!', 'THE HOLLOWED BONE KING REASSEMBLES!'];
const rows = [['demo', 'idle', [0]], ['demo', 'idle', [1]], ['demo', 'typist', [0]], ['demo', 'typist', [1]], ['full', 'idle', [0]], ['full', 'idle', [6, 7]], ['full', 'typist', [0]], ['full', 'typist', [6, 7]]];
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
const cols = {
  'alerts': (h) => sum(h.alert), 'sig-move alerts': (h) => sig.reduce((a, k) => a + ((h.alert || {})[k] || 0), 0), 'big banners': (h) => sum(h.banner), 'floor banners': (h) => sum(h.minorBanner),
  'toasts (unsolicited)': (h) => sum(h.toast), 'achv toasts': (h) => (h.toast || {}).achievement || 0, 'strong flashes': (h) => sum(h.flashStrong), 'shakes': (h) => sum(h.shake), 'fades': (h) => sum(h.screen),
  'SFX': (h) => sum(h.sound), 'loud SFX': (h) => sum(h.loudSound), 'thumps': (h) => (h.sound || {}).slam || 0, 'ult booms': (h) => ((h.sound || {}).ultKnight || 0) + ((h.sound || {}).meteor || 0), 'wipe sfx': (h) => (h.sound || {}).wipe || 0,
  'secs w/ sound': (h) => (h.secs || {})['any sound started (seconds with >=1)'] || 0, 'gold pulses': (h) => sum(h.hud), 'FLOW s': (h) => (h.secs || {})['FLOW vignette (pulsing)'] || 0,
};
console.log(['build', 'profile', 'hours', ...Object.keys(cols)].join('\t'));
for (const [b, p, hs] of rows) {
  const vals = Object.keys(cols).map(() => 0); let n = 0;
  for (const s of [1, 6]) { const r = require(O + `census_${b}_${p}_${s}.json`); for (const h of hs) { const ph = r.perHour[h]; if (!ph) continue; n++; Object.values(cols).forEach((f, i) => (vals[i] += f(ph))); } }
  console.log([b, p, hs.map((h) => 'h' + (h + 1)).join('+'), ...vals.map((v) => Math.round(v / n))].join('\t'));
}
