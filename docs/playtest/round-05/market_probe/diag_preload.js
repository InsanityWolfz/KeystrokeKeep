// R5 market diag preload (probe only, registered on the probe's session): canvases created at preload time,
// polled every 25 ms, to time the low-GPU canvas wipe and see which canvas kinds survive it.
const t0 = performance.now();
const mk = (opts, read) => { const c = document.createElement('canvas'); c.width = 16; c.height = 16; const g = c.getContext('2d', opts); g.fillStyle = '#f00'; g.fillRect(2, 2, 8, 8); if (read) g.getImageData(0, 0, 1, 1); return c; };
const cs = { plain: mk({}), wrf: mk({ willReadFrequently: true }), readOnce: mk({}, true) };
const a = (c) => { const d = c.getContext('2d').getImageData(0, 0, 16, 16).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; };
const log = []; let last = '';
const poll = () => {
  const s = Object.fromEntries(Object.entries(cs).map(([k, c]) => [k, a(c)]));
  const key = JSON.stringify(s);
  if (key !== last) { last = key; log.push(Object.assign({ t: Math.round(performance.now()) }, s)); if (document.documentElement) document.documentElement.dataset.kkdiag = JSON.stringify(log); }
  if (performance.now() - t0 < 6000) setTimeout(poll, 25);
};
for (const c of Object.values(cs)) { c.addEventListener('contextlost', () => log.push({ t: Math.round(performance.now()), ev: 'contextlost' })); c.addEventListener('contextrestored', () => log.push({ t: Math.round(performance.now()), ev: 'contextrestored' })); }
poll();
window.addEventListener('DOMContentLoaded', () => { log.push({ t: Math.round(performance.now()), ev: 'DOMContentLoaded' }); });
