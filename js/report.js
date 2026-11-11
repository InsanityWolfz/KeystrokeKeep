/* Keystroke Keep — the shift report: one shareable picture of a day's work.
   Drawn at 300x170 game pixels and scaled x4 to a 1200x680 PNG. Counts only, never which keys. */
(function () {
  'use strict';
  const KK = window.KK, D = KK.DATA, U = KK.U;
  const W = 300, H = 170, SCALE = 4;
  const R = KK.report = {};

  const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dateLabel = (date) => { const [y, m, d] = date.split('-').map(Number); const dt = new Date(y, m - 1, d); return `${DOW[dt.getDay()]} ${d} ${MON[m - 1]} ${y}`; };
  const num = (n) => Math.floor(n).toLocaleString('en-US');
  const dur = (s) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)}H ${String(m % 60).padStart(2, '0')}M` : `${m}M`; };

  /** Days that have a record, oldest first. */
  R.days = () => Object.keys(KK.S.days || {}).filter((k) => { const d = KK.S.days[k]; return d && d.keys + d.clicks + d.play > 0; }).sort();

  /** Draw the card for a day ('YYYY-MM-DD'); returns a 1200x680 canvas. */
  R.draw = function (date) {
    const d = (KK.S.days || {})[date];
    const lo = document.createElement('canvas'); lo.width = W; lo.height = H;
    const g = lo.getContext('2d');
    const text = (s, x, y, col, sc, align) => KK.font.draw(g, s, x, y, col, sc || 1, align || 'left');

    // ---- panel
    g.fillStyle = '#0c0812'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#171022'; g.fillRect(2, 2, W - 4, H - 4);
    g.fillStyle = '#2e2440'; g.fillRect(2, 2, W - 4, 1); g.fillRect(2, H - 3, W - 4, 1); g.fillRect(2, 2, 1, H - 4); g.fillRect(W - 3, 2, 1, H - 4);

    // ---- header
    text('SHIFT REPORT', 9, 12, '#ffd76a', 2);
    text(dateLabel(date), W - 9, 12, '#b8a8d8', 1, 'right');
    g.fillStyle = '#2e2440'; g.fillRect(9, 21, W - 18, 1);

    if (!d) { text('NO SHIFT ON THIS DAY', W / 2, 80, '#b8a8d8', 1, 'center'); return up(lo); }

    // ---- four big numbers
    const stats = [
      [num(d.keys), 'KEYSTROKES', '#7ee8f6'],
      [dur(d.flow), 'IN FLOW', '#ffd76a'],
      [num(d.floors), 'FLOORS CLEARED', '#ffffff'],
      [num(d.deep), 'DEEPEST FLOOR', '#e9a2ff'],
    ];
    stats.forEach(([v, label, col], i) => {
      const cx = 9 + (W - 18) * (i + 0.5) / 4;
      text(v, cx, 33, col, 2, 'center');
      text(label, cx, 44, '#8f80b0', 1, 'center');
    });

    // ---- the day's Clatter: 48 half-hour bars
    const cx0 = 6, cy1 = 98, ch = 32;
    text('THE CLATTER', 9, 58, '#b8a8d8');
    const extra = [d.clicks ? num(d.clicks) + ' CLICKS' : '', d.boss ? num(d.boss) + (d.boss === 1 ? ' BOSS' : ' BOSSES') : '', d.ults ? num(d.ults) + ' ULTIMATES' : ''].filter(Boolean).join('   ');
    text(extra, W - 9, 58, '#8f80b0', 1, 'right');
    const peak = Math.max(600, ...d.h); // a half hour of steady typing fills the chart
    for (let i = 0; i < 48; i++) {
      const x = cx0 + i * 6;
      g.fillStyle = '#231a33'; g.fillRect(x, cy1, 5, 1);
      const v = d.h[i] || 0;
      if (!v) continue;
      const k = Math.min(1, v / peak), bh = Math.max(1, Math.round(ch * Math.sqrt(k)));
      g.fillStyle = k > 0.6 ? '#ffd76a' : k > 0.25 ? '#7ee8f6' : '#4fb8cc';
      g.fillRect(x, cy1 - bh, 5, bh);
      g.fillStyle = k > 0.6 ? '#fff6c9' : '#c9f6ff'; g.fillRect(x, cy1 - bh, 5, 1);
    }
    for (const hr of [0, 6, 12, 18]) { const x = cx0 + hr * 12; g.fillStyle = '#3b2a57'; g.fillRect(x, cy1 + 1, 1, 2); text(String(hr).padStart(2, '0') + ':00', x + 2, cy1 + 6, '#6f6090'); }

    // ---- the party, under the floorboards, with one remark about the day
    const sy = 112, wallH = 40, ground = sy + wallH + 4;
    const b = D.BIOMES[0];
    let biome = b; for (const bb of D.BIOMES) if (d.deep >= bb.from) biome = bb;
    const p = biome.pal;
    g.fillStyle = p.mortar; g.fillRect(3, sy, W - 6, wallH);
    for (let row = 0; row < Math.ceil(wallH / 6); row++) for (let col = -1; col < W / 12 + 1; col++) {
      const x = col * 12 + (row % 2 ? 6 : 0), y = sy + row * 6;
      const h = U.hash2(row * 7 + biome.from, col * 13 + 3);
      g.fillStyle = h < 0.3 ? p.wallLo : h > 0.8 ? p.wallHi : p.wall;
      const x0 = Math.max(3, x + 1), x1 = Math.min(W - 3, x + 12);
      if (x1 > x0) g.fillRect(x0, y + 1, x1 - x0, Math.min(5, sy + wallH - y - 1));
    }
    g.fillStyle = p.floorHi; g.fillRect(3, sy + wallH, W - 6, 1);
    g.fillStyle = p.floor; g.fillRect(3, sy + wallH + 1, W - 6, 5);
    g.fillStyle = p.floorLo; g.fillRect(3, sy + wallH + 6, W - 6, H - 3 - (sy + wallH + 6));
    g.fillStyle = 'rgba(8,4,14,0.35)'; g.fillRect(3, sy, W - 6, H - 3 - sy);
    const line = KK.shiftLine(d, date);
    const looks = d.looks || [0, -1, -1, -1];
    let hx = 30, speakerX = 30;
    D.PARTY_ORDER.slice().reverse().forEach((id) => {
      const t = looks[D.PARTY_ORDER.indexOf(id)];
      if (t < 0) return;
      const fr = (KK.SPR.gearFrames && KK.SPR.gearFrames[id] && KK.SPR.gearFrames[id][t]) || KK.SPR.frames[id];
      const spr = fr[0];
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(hx - 5, ground, 10, 1);
      g.drawImage(spr.c, Math.round(hx - spr.w / 2), ground - spr.h);
      if (id === line.hero) speakerX = hx;
      hx += 17;
    });
    // speech plate
    const tw = KK.font.width(line.text), px = Math.max(8, Math.min(W - 8 - tw - 6, speakerX - 10)), py = ground - 32;
    g.fillStyle = '#0c0812'; g.fillRect(px, py, tw + 6, 11);
    g.fillStyle = '#f4f1ea'; g.fillRect(px + 1, py + 1, tw + 4, 9);
    g.fillStyle = '#f4f1ea'; g.fillRect(Math.max(px + 3, Math.min(px + tw, speakerX - 1)), py + 10, 3, 2);
    KK.font.draw(g, line.text, px + 3, py + 5.5, '#1b1424', 1, 'left', null);
    // footer
    text('KEYSTROKE KEEP', W - 9, ground - 8, '#ffd76a', 1, 'right');
    text('COUNTS YOUR KEYS. NEVER READS THEM.', W - 9, ground + 1, '#b8a8d8', 1, 'right');
    return up(lo);
  };

  function up(lo) {
    const c = document.createElement('canvas'); c.width = W * SCALE; c.height = H * SCALE;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(lo, 0, 0, c.width, c.height);
    return c;
  }

  R.fileName = (date) => `keystroke-keep-shift-${date}.png`;
  R.save = function (date) {
    const a = document.createElement('a');
    a.href = R.draw(date).toDataURL('image/png'); a.download = R.fileName(date);
    document.body.appendChild(a); a.click(); a.remove();
  };
  /** Copy the card to the clipboard as an image. Resolves false where the browser won't allow it. */
  R.copy = function (date) {
    return new Promise((resolve) => {
      try {
        if (!navigator.clipboard || !window.ClipboardItem) return resolve(false);
        R.draw(date).toBlob((blob) => {
          if (!blob) return resolve(false);
          navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(() => resolve(true), () => resolve(false));
        }, 'image/png');
      } catch (e) { resolve(false); }
    });
  };

  /** Dev: fill a day with a believable office day so the card can be looked at (never saved over a real day). */
  R.sample = function (date) {
    const S = KK.S; S.days = S.days || {};
    const rnd = (a, b) => a + Math.random() * (b - a);
    const h = new Array(48).fill(0);
    for (let i = 17; i < 36; i++) h[i] = Math.round(i === 24 || i === 25 ? rnd(0, 40) : rnd(120, 520));
    h[21] = 640; h[22] = 700; h[30] = 590; h[44] = 180; h[45] = 90;
    const keys = h.reduce((a, b) => a + b, 0);
    S.days[date] = { keys: Math.round(keys * 0.88), clicks: Math.round(keys * 0.12), flow: 4380, longFlow: 1560, play: 30600, floors: 212, deep: 118, boss: 19, retires: 2, ults: 640, h, looks: [4, 4, 3, 4] };
    return date;
  };
})();
