// R6 market: census of every baked canvas (frames + their white/gold/dark tints, icons, chests) and the live back buffer.
(() => {
  const K = window.KKdebug.KK;
  const alpha = (c) => { try { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; } catch (e) { return 'err'; } };
  const res = { frames: 0, blankFrames: 0, tints: 0, blankTints: 0, icons: 0, blankIcons: 0, chests: [alpha(K.SPR.chest.c), alpha(K.SPR.chestOpen.c)], blankList: [] };
  for (const k in K.SPR.frames) for (const f of K.SPR.frames[k]) {
    res.frames++; if (alpha(f.c) === 0) { res.blankFrames++; res.blankList.push(k); }
    for (const t of ['white', 'gold', 'dark']) { res.tints++; if (alpha(f[t]) === 0) res.blankTints++; }
  }
  for (const k in K.SPR.icons) { res.icons++; if (alpha(K.SPR.icons[k].c) === 0) res.blankIcons++; }
  const g = document.getElementById('game').getContext('2d');
  res.mainCtxLost = typeof g.isContextLost === 'function' ? g.isContextLost() : 'n/a';
  res.knight0 = alpha(K.SPR.frames.knight[0].c);
  return res;
})()
