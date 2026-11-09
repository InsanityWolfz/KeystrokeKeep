(() => {
  const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const cr = (a, b) => { const [h, l] = a > b ? [a, b] : [b, a]; return (h + 0.05) / (l + 0.05); };
  const cvs = document.getElementById('game'); const g = cvs.getContext('2d'); const cr0 = cvs.getBoundingClientRect();
  const sx = cvs.width / cr0.width, sy = cvs.height / cr0.height;
  const sels = ['#hud-gold .val', '#hud-rate', '#hud-spark .val', '#hud-embers', '#hud-floor', '#hud-biome', '#fv-tier', '#fv-mult', '#hud-demo', '.hbtn'];
  const out = { size: KK.S.settings.size, stripH: Math.round(cr0.height), canvasScale: Math.round(sx * 100) / 100 };
  for (const s of sels) {
    const el = document.querySelector(s); if (!el) { out[s] = 'missing'; continue; }
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    if (!r.width || cs.display === 'none' || el.closest('.hidden')) { out[s] = 'hidden'; continue; }
    const m = cs.color.match(/\d+(\.\d+)?/g).map(Number); const tl = lum(m[0], m[1], m[2]);
    let bgs = [];
    try {
      const x0 = Math.max(0, Math.floor((r.left - cr0.left) * sx)), y0 = Math.max(0, Math.floor((r.top - cr0.top) * sy));
      const w = Math.max(1, Math.min(cvs.width - x0, Math.floor(r.width * sx))), h = Math.max(1, Math.min(cvs.height - y0, Math.floor(r.height * sy)));
      const d = g.getImageData(x0, y0, w, h).data; for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 0) bgs.push(lum(d[i], d[i + 1], d[i + 2]));
    } catch (e) { bgs = []; }
    bgs.sort((a, b) => a - b);
    const med = bgs.length ? bgs[bgs.length >> 1] : 0, p90 = bgs.length ? bgs[Math.floor(bgs.length * 0.9)] : 0;
    out[s] = { text: el.textContent.trim().slice(0, 24), px: cs.fontSize, font: cs.fontFamily.split(',')[0], color: cs.color, shadow: cs.textShadow !== 'none', crMedian: +cr(tl, med).toFixed(2), crP90bright: +cr(tl, p90).toFixed(2), hPx: Math.round(r.height) };
  }
  return out;
})()
