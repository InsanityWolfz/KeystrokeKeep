// R5 market: why do baked sprites vanish in low-GPU mode? Run with KK_PROBE=eval KK_EVAL=<this file>.
(() => {
  const K = window.KKdebug.KK;
  const spr = K.SPR.frames.knight[0];
  const alpha = (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; };
  const fresh = (w, h, opts) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d', opts); return c; };
  const out = { sprSize: spr.w + 'x' + spr.h, sprAlphaPx: alpha(spr.c), goldAlphaPx: alpha(spr.gold) };
  // 1) draw onto a fresh small canvas
  let t = fresh(64, 64); t.getContext('2d').drawImage(spr.c, 0, 0); out.freshSmall = alpha(t);
  // 2) draw onto a fresh large canvas (like the 854x64 buffer)
  t = fresh(900, 64); t.getContext('2d').drawImage(spr.c, 10, 10); out.freshLarge = alpha(t);
  // 3) large canvas that has been drawn to many times first (accelerated after N frames?)
  t = fresh(900, 64); const g = t.getContext('2d');
  for (let i = 0; i < 200; i++) { g.fillStyle = '#123'; g.fillRect(0, 0, 900, 64); g.drawImage(spr.c, 10, 10); }
  out.largeAfter200Frames = alpha(t);
  // 4) willReadFrequently target
  t = fresh(900, 64, { willReadFrequently: true }); t.getContext('2d').drawImage(spr.c, 10, 10); out.wrfTarget = alpha(t);
  // 5) via an ImageBitmap-free copy: rebuild the sprite with putImageData into a NEW canvas, draw that
  const src = spr.c.getContext('2d').getImageData(0, 0, spr.w, spr.h);
  const copy = fresh(spr.w, spr.h); copy.getContext('2d').putImageData(src, 0, 0);
  t = fresh(900, 64); const g5 = t.getContext('2d'); for (let i = 0; i < 200; i++) { g5.clearRect(0, 0, 900, 64); g5.drawImage(copy, 10, 10); } out.putImageDataCopy = alpha(t);
  // 6) what the game's back buffer holds right now around the hero
  return out;
})()
