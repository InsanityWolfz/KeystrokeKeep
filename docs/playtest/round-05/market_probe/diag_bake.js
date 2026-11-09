// R5: bake a sprite now (after boot) and see if it holds pixels; also inspect the boot-time icon data URL
(() => {
  const K = window.KKdebug.KK;
  const key = Object.keys(K.PAL).find((k) => k !== '.' && k !== ' ');
  const alpha = (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; };
  const s = K.SPR.bake([key + key + key, key + key + key]);
  const out = { palKey: key, palCol: K.PAL[key], bakedNow: alpha(s.c), bakedWhite: alpha(s.white) };
  // fillRect with a 1x1 loop like bake()
  const c = document.createElement('canvas'); c.width = 4; c.height = 4; const g = c.getContext('2d');
  g.fillStyle = K.PAL[key]; for (let i = 0; i < 4; i++) g.fillRect(i, 0, 1, 1); out.loopFill = alpha(c);
  g.fillStyle = '#ff0000'; g.fillRect(0, 1, 4, 1); out.hexFill = alpha(c) - out.loopFill;
  out.iconURLlen = (K.SPR.iconURL.coin || Object.values(K.SPR.iconURL)[0] || '').length;
  out.palSample = Object.entries(K.PAL).slice(0, 6);
  return out;
})()
