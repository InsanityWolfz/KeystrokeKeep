// R5: how many baked canvases are blank, and did the canvases see a contextlost?
(() => {
  const K = window.KKdebug.KK;
  const alpha = (c) => { try { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; } catch (e) { return 'err'; } };
  const res = { frames: 0, blankFrames: 0, icons: 0, blankIcons: 0 };
  for (const k in K.SPR.frames) for (const f of K.SPR.frames[k]) { res.frames++; if (alpha(f.c) === 0) res.blankFrames++; }
  for (const k in K.SPR.icons) { res.icons++; if (alpha(K.SPR.icons[k].c) === 0) res.blankIcons++; }
  const g = document.getElementById('game').getContext('2d');
  res.mainCtxLost = typeof g.isContextLost === 'function' ? g.isContextLost() : 'n/a';
  res.lostEvents = window.__lost || 0;
  return res;
})()
