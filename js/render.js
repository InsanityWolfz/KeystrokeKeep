/* Keystroke Keep — renders the dungeon strip into a low-res buffer, then upscales crisp. */
(function () {
  'use strict';
  const KK = window.KK, U = KK.U, D = KK.DATA, F = KK.F;
  const W = KK.world, FX = KK.fx;
  const H = 64;
  const R = KK.render = { H, scale: 3 };

  let cvs, ctx, buf, b, light, lg, Wd = 320, camX = 0, pxScale = 3;
  const biomeArt = {};
  const motes = [];

  R.init = function () {
    cvs = document.getElementById('game');
    ctx = cvs.getContext('2d');
    buf = document.createElement('canvas');
    b = buf.getContext('2d');
    light = document.createElement('canvas');
    lg = light.getContext('2d');
    for (const bi of D.BIOMES) biomeArt[bi.id] = makeBiomeArt(bi);
    R.resize();
    window.addEventListener('resize', R.resize);
    camX = W.partyX - Wd * 0.38;
  };

  R.resize = function () {
    const size = KK.S.settings.size;
    // 'auto' keeps the strip to ~13% of the screen height (S on 1080p, M on 1440p, L on big 4K)
    const autoScale = () => Math.max(2, Math.min(4, Math.floor(((window.screen && window.screen.height) || 1080) * 0.135 / H)));
    let scale = size === 'S' ? 2 : size === 'L' ? 4 : size === 'M' ? 3 : autoScale();
    if (window.innerWidth < 700) scale = Math.min(scale, 2);
    R.scale = scale;
    const dpr = window.devicePixelRatio || 1;
    pxScale = Math.max(1, Math.floor(scale * dpr)); // never oversize the backing store
    Wd = Math.ceil(window.innerWidth / scale);
    buf.width = Wd; buf.height = H;
    light.width = Wd; light.height = H;
    cvs.width = Wd * pxScale; cvs.height = H * pxScale;
    cvs.style.width = Wd * scale + 'px';
    cvs.style.height = H * scale + 'px';
    document.documentElement.style.setProperty('--strip-h', H * scale + 'px');
    b.imageSmoothingEnabled = false;
    ctx.imageSmoothingEnabled = false;
    R.hudRects();
    KK.emit('resized', { scale, w: Wd });
  };
  R.hudRects = function () {
    const strip = document.getElementById('strip').getBoundingClientRect();
    const g = document.querySelector('#hud-gold .ico');
    if (g) { const r = g.getBoundingClientRect(); R.goldScreen = { x: (r.left + r.width / 2 - strip.left) / R.scale, y: (r.top + r.height / 2 - strip.top) / R.scale }; }
  };
  /** Screen (client) px -> world game px. */
  R.toWorld = function (clientX, clientY) {
    const r = cvs.getBoundingClientRect();
    return { x: (clientX - r.left) / R.scale + camX, y: (clientY - r.top) / R.scale };
  };

  // ---------------------------------------------------------------- procedural biome art
  function makeBiomeArt(bi) {
    const p = bi.pal;
    const TW = 48, TH = 50;
    const wall = document.createElement('canvas'); wall.width = TW; wall.height = TH;
    const g = wall.getContext('2d', { willReadFrequently: true });
    const emis = document.createElement('canvas'); emis.width = TW; emis.height = TH;
    const eg = emis.getContext('2d', { willReadFrequently: true });
    g.fillStyle = p.mortar; g.fillRect(0, 0, TW, TH);
    const BW = 12, BH = 6;
    for (let row = 0; row < Math.ceil(TH / BH); row++) {
      const off = row % 2 ? BW / 2 : 0;
      for (let col = -1; col < TW / BW + 1; col++) {
        const x = col * BW + off, y = row * BH;
        const h = U.hash2(row * 7 + bi.from, col * 13 + 3);
        if (bi.id === 'caverns' && h < 0.25) continue; // ragged rock
        g.fillStyle = h < 0.3 ? p.wallLo : h > 0.8 ? p.wallHi : p.wall;
        g.fillRect(x + 1, y + 1, BW - 1, BH - 1);
        g.fillStyle = p.wallHi; g.fillRect(x + 1, y + 1, BW - 2, 1);
        g.fillStyle = p.wallLo; g.fillRect(x + 1, y + BH - 1, BW - 1, 1);
        if (h > 0.9) { g.fillStyle = p.mortar; g.fillRect(x + 4, y + 2, 1, 2); g.fillRect(x + 5, y + 3, 2, 1); }
      }
    }
    // biome flavor
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(U.hash(i * 3.1 + bi.from) * TW), y = Math.floor(U.hash(i * 7.7 + bi.from) * TH);
      if (bi.id === 'caverns') { g.fillStyle = U.hash(i) > 0.5 ? '#3f7a45' : '#2f5a35'; g.fillRect(x, y, 1, 1 + Math.floor(U.hash(i * 2) * 3)); }
      if (bi.id === 'crypt' && i < 10) { g.fillStyle = '#2a2438'; g.fillRect(x, y, 2, 1); }
    }
    if (bi.id === 'magma') {
      eg.fillStyle = '#ff5a2e';
      for (let row = 0; row < Math.ceil(TH / BH); row++) for (let x = 0; x < TW; x++) if (U.hash2(row, x) > 0.55) eg.fillRect(x, row * BH, 1, 1);
    }
    if (bi.id === 'void') {
      for (let i = 0; i < 18; i++) { eg.fillStyle = U.hash(i * 9) > 0.5 ? '#c472ff' : '#7ee8f6'; eg.fillRect(Math.floor(U.hash(i * 5.3) * TW), Math.floor(U.hash(i * 2.9) * TH), 1, 1); }
    }
    // floor tile
    const FW = 64, FH = H - 50;
    const floor = document.createElement('canvas'); floor.width = FW; floor.height = FH;
    const fg = floor.getContext('2d', { willReadFrequently: true });
    fg.fillStyle = p.floorLo; fg.fillRect(0, 0, FW, FH);
    fg.fillStyle = p.floor; fg.fillRect(0, 1, FW, 5);
    fg.fillStyle = p.floorHi; fg.fillRect(0, 0, FW, 1);
    for (let x = 0; x < FW; x += 16) {
      const o = Math.floor(U.hash(x + bi.from) * 6);
      fg.fillStyle = p.floorLo; fg.fillRect(x + o, 1, 1, 5);
      fg.fillStyle = p.floorHi; fg.fillRect(x + o + 1, 1, 1, 1);
    }
    fg.fillStyle = p.floor; fg.fillRect(0, 7, FW, 3);
    for (let x = 8; x < FW; x += 20) { fg.fillStyle = p.floorLo; fg.fillRect(x, 7, 1, 3); }
    for (let i = 0; i < 14; i++) { fg.fillStyle = U.hash(i * 4) > 0.5 ? p.floorHi : p.mortar; fg.fillRect(Math.floor(U.hash(i * 1.7 + bi.from) * FW), 2 + Math.floor(U.hash(i * 3.3) * 10), 1, 1); }
    return { wall, emis, floor, TW, TH, FW, FH };
  }

  // ---------------------------------------------------------------- frame
  let t = 0;
  R.draw = function (dt) {
    t += dt;
    const S = KK.S;
    const biome = F.biomeOf(S.floor);
    const pal = biome.pal;
    const art = biomeArt[biome.id];
    const tier = KK.fervorTier();

    // camera
    const target = W.partyX - Wd * 0.38;
    camX += (target - camX) * Math.min(1, dt * 3);
    if (Math.abs(target - camX) > Wd) camX = target;
    let sx = 0, sy = 0;
    if (FX.shakeT > 0) { const a = FX.shakeAmp * Math.min(1, FX.shakeT * 4); sx = Math.round(U.rand(-a, a)); sy = Math.round(U.rand(-a, a) * 0.6); }
    const cx = Math.round(camX) - sx;
    KK.view = {
      left: camX, right: camX + Wd, w: Wd,
      goldX: camX + (R.goldScreen ? R.goldScreen.x : 12), goldY: R.goldScreen ? R.goldScreen.y : 8,
    };

    // ---- background wall (parallax 0.55)
    b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
    b.fillStyle = pal.fog; b.fillRect(0, 0, Wd, H);
    const px = Math.round(cx * 0.55) - sy * 0;
    for (let x = -((px % art.TW) + art.TW) % art.TW; x < Wd; x += art.TW) b.drawImage(art.wall, x, sy);
    // baseboard
    b.fillStyle = pal.wallLo; b.fillRect(0, 46 + sy, Wd, 4);
    b.fillStyle = pal.mortar; b.fillRect(0, 49 + sy, Wd, 1);

    // decorations on the wall (same parallax)
    const torches = [];
    const SEG = 64;
    const s0 = Math.floor(px / SEG) - 1, s1 = Math.ceil((px + Wd) / SEG) + 1;
    for (let s = s0; s <= s1; s++) {
      const h = U.hash(s * 1.37 + biome.from * 3);
      const x = s * SEG - px + 32;
      if (h > 0.5) {
        drawTorch(x, 20 + sy, pal, s);
        torches.push({ x, y: 18 + sy, s });
      } else if (h > 0.36) drawBanner(x, 6 + sy, biome, s);
      else if (h > 0.26) drawNiche(x, 22 + sy, biome, s);
      else if (h > 0.2) drawChains(x, sy, pal);
    }

    // ---- floor (parallax 1)
    for (let x = -((cx % art.FW) + art.FW) % art.FW; x < Wd; x += art.FW) b.drawImage(art.floor, x, 50 + sy);

    // ---- world props
    const sxw = (wx) => Math.round(wx - cx);
    if (W.door) drawDoor(sxw(W.door.x), sy, pal);
    for (const p of W.props) {
      if (p.opened !== undefined) {
        const spr = p.opened ? KK.SPR.chestOpen : KK.SPR.chest;
        const bounce = !p.opened && p.openT > 0 ? Math.round(Math.abs(Math.sin(p.openT * 30)) * 2) : 0;
        shadow(sxw(p.x), W.GROUND + sy, 6);
        b.drawImage(spr.c, sxw(p.x) - 6, W.GROUND - spr.h + sy - bounce);
        if (!p.opened && Math.sin(t * 6) > 0.6) { b.fillStyle = '#fff'; b.fillRect(sxw(p.x) + 3, W.GROUND - spr.h + sy + 1, 1, 1); }
      }
    }

    // ---- enemies
    for (const e of W.enemies) {
      if (e.dead) continue;
      drawEnemy(e, sxw(e.x), sy);
    }
    // ---- heroes (back to front)
    for (let i = W.heroes.length - 1; i >= 0; i--) drawHero(W.heroes[i], sxw(W.heroes[i].x), sy, tier);

    // ---- golden rat
    if (W.rat) {
      const r = W.rat, spr = KK.SPR.frame('goldrat', Math.floor(t * 14));
      const rx = sxw(r.x);
      shadow(rx, r.y + sy, 6);
      b.drawImage(spr.c, rx - spr.w / 2, r.y - spr.h + sy - (Math.floor(t * 14) % 2));
      if (Math.random() < 0.5) FX.particle(r.x + U.rand(-4, 6), r.y - U.rand(0, 8), { vx: U.rand(10, 30), vy: U.rand(-20, -5), life: 0.6, col: U.pick(['#ffd76a', '#fff6c9']), add: true });
    }

    // ---- projectiles
    for (const s of W.shots) drawShot(s, cx, sy);

    // ---- particles (normal)
    drawParticles(cx, sy, false);

    // ---- lighting
    const tierDark = [0, 0.06, 0.13, 0.24][tier];
    const dark = Math.max(0.12, pal.dark - tierDark);
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, Wd, H);
    lg.fillStyle = pal.fog; lg.globalAlpha = dark; lg.fillRect(0, 0, Wd, H); lg.globalAlpha = 1;
    lg.globalCompositeOperation = 'destination-out';
    const flick = (s) => 1 + Math.sin(t * 9 + s * 3) * 0.06 + Math.sin(t * 23 + s) * 0.04;
    for (const tc of torches) hole(tc.x, tc.y, (30 + tier * 4) * flick(tc.s), 1);
    hole(sxw(W.partyX - 20), 40 + sy, 62 + tier * 10, 0.9);
    for (const l of FX.lights) hole(sxw(l.x), l.y + sy, l.r * (1 - l.t / l.life * 0.5), (1 - l.t / l.life) * l.a);
    if (W.rat) hole(sxw(W.rat.x), W.rat.y + sy - 4, 26, 0.8);
    if (W.door) hole(sxw(W.door.x), 40 + sy, 28, 0.7);
    b.drawImage(light, 0, 0);

    // additive glows
    b.globalCompositeOperation = 'lighter';
    for (const tc of torches) glow(tc.x, tc.y, 14 * flick(tc.s), pal.torch, 0.22);
    for (const l of FX.lights) glow(sxw(l.x), l.y + sy, l.r * 0.5, l.col, 0.35 * (1 - l.t / l.life) * l.a);
    if (W.boss && !W.boss.dead) glow(sxw(W.boss.x), W.boss.y - W.boss.def.h / 2 + sy, 30 + Math.sin(t * 4) * 4, W.boss.hollowed ? '#a24cff' : '#ff3a3a', 0.18);
    // emissive biome layer (lava cracks / void stars)
    if (biome.id === 'magma' || biome.id === 'void') {
      b.globalAlpha = 0.35 + Math.sin(t * 1.5) * 0.1;
      for (let x = -((px % art.TW) + art.TW) % art.TW; x < Wd; x += art.TW) b.drawImage(art.emis, x, sy);
      b.globalAlpha = 1;
    }
    drawParticles(cx, sy, true);
    // pillars of light (level ups, revives)
    for (const p of FX.pillars) {
      const k = p.t / p.life, a = (1 - k) * 0.7;
      const w = Math.max(1, Math.round(p.w * (1 - k * 0.6)));
      const g = b.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, p.col); g.addColorStop(1, p.col);
      b.globalAlpha = a; b.fillStyle = g; b.fillRect(sxw(p.x) - w / 2, 0, w, W.GROUND + sy);
      b.globalAlpha = 1;
    }
    b.globalCompositeOperation = 'source-over';

    // ---- foreground pillars (parallax 1.3) for depth
    const fpx = cx * 1.3;
    const FSEG = 300;
    for (let s = Math.floor(fpx / FSEG) - 1; s <= Math.ceil((fpx + Wd) / FSEG) + 1; s++) {
      if (U.hash(s * 9.13 + 1) < 0.45) continue;
      const x = Math.round(s * FSEG - fpx + U.hash(s) * 100);
      if (x < -20 || x > Wd + 20) continue;
      // never hide the fight: pillars in front of a hero or an active foe go mostly transparent
      const blocks = W.heroes.some((h) => Math.abs(sxw(h.x) - x - 4) < 16) || W.enemies.some((e) => !e.dead && Math.abs(sxw(e.x) - x - 4) < 10 + e.def.w / 2);
      b.globalAlpha = blocks ? 0.28 : 1;
      b.fillStyle = '#05030a'; b.fillRect(x, 0, 9, H);
      b.fillStyle = pal.wallLo; b.fillRect(x + 1, 0, 1, H);
      b.fillStyle = '#05030a'; b.fillRect(x - 2, 0, 13, 4); b.fillRect(x - 2, H - 6, 13, 6);
      b.globalAlpha = 1;
    }

    // ---- rings, beams
    for (const r of FX.rings) {
      const k = r.t / r.life;
      b.globalAlpha = 1 - k;
      b.strokeStyle = r.col; b.lineWidth = r.w;
      b.beginPath(); b.ellipse(sxw(r.x) + 0.5, r.y + sy + 0.5, r.r0 + (r.r1 - r.r0) * U.ease.outCubic(k), (r.r0 + (r.r1 - r.r0) * U.ease.outCubic(k)) * 0.45, 0, 0, Math.PI * 2); b.stroke();
    }
    b.globalAlpha = 1;
    for (const bm of FX.beams) {
      b.globalAlpha = 1 - bm.t / bm.life;
      line(sxw(bm.x0), bm.y0 + sy, sxw(bm.x1), bm.y1 + sy, bm.col);
    }
    b.globalAlpha = 1;

    // ---- coins in flight
    for (const c of FX.coins) {
      const x = sxw(c.x), y = Math.round(c.y + sy);
      const f = Math.floor((t * 12 + c.pop * 10) % 4);
      b.fillStyle = '#1b1424'; b.fillRect(x - 2, y - 2, f === 2 ? 2 : 4, 4);
      b.fillStyle = f === 2 ? '#c08a2a' : '#fbd14b'; b.fillRect(x - 1, y - 1, f === 2 ? 1 : 2, 2);
      if (f === 0) { b.fillStyle = '#fff6c9'; b.fillRect(x - 1, y - 1, 1, 1); }
    }

    // ---- HP bars + boss bar
    for (const h of W.heroes) {
      if (h.dead) continue;
      const spr = KK.SPR.frame(h.id, 0);
      bar(sxw(h.x) - 5, h.y - spr.h - 3 + sy, 10, h.hp / h.maxHp, h.hp / h.maxHp > 0.5 ? '#6cd05a' : h.hp / h.maxHp > 0.25 ? '#fbd14b' : '#e04848');
    }
    for (const e of W.enemies) {
      if (e.dead || e.boss || e.hp >= e.maxHp) continue;
      bar(sxw(e.x) - 6, e.y - e.def.h - 3 + sy, 12, e.hp / e.maxHp, '#e04848');
    }
    if (W.boss && !W.boss.dead) {
      const bw = Math.min(110, Wd * 0.22), bx = Math.round(Wd - bw - 10), by = 26;
      b.fillStyle = '#000'; b.fillRect(bx - 1, by - 1, bw + 2, 5);
      b.fillStyle = '#3a0a14'; b.fillRect(bx, by, bw, 3);
      b.fillStyle = '#e04848'; b.fillRect(bx, by, Math.ceil(bw * W.boss.hp / W.boss.maxHp), 3);
      b.fillStyle = '#ff9a9a'; b.fillRect(bx, by, Math.ceil(bw * W.boss.hp / W.boss.maxHp), 1);
      KK.font.draw(b, W.boss.def.name.toUpperCase() + (W.boss.wounded ? ' (WOUNDED)' : ''), bx + bw / 2, by + 6, '#ffb4b4');
      // enrage timer: a thin bar that fills toward the 3-minute retreat
      const ek = Math.min(1, (W.boss.fightT || 0) / 180);
      if (ek > 0.33) { b.fillStyle = '#000'; b.fillRect(bx - 1, by + 3, bw + 2, 2); b.fillStyle = ek > 0.85 ? '#ff6b6b' : '#ffb070'; b.fillRect(bx, by + 3, Math.ceil(bw * ek), 1); }
      if (ek >= 0.66) KK.font.draw(b, 'ENRAGE ' + Math.max(0, Math.ceil(180 - W.boss.fightT)) + 'S', bx + bw / 2, by + 12, ek > 0.9 ? '#ff6b6b' : '#ffb070');
    }

    // ---- floating texts
    for (const tx of FX.texts) {
      const k = 1 - tx.life / tx.max;
      let sc = tx.scale;
      if (tx.pop && k < 0.1) sc = tx.scale + 1;
      const col = tx.bump > 0 ? '#ffffff' : tx.col;
      if (tx.life < 0.25) b.globalAlpha = tx.life / 0.25;
      if (FX.banners.length && FX.banners[0].big) b.globalAlpha *= 0.35; // big banners stay readable
      KK.font.draw(b, tx.str, sxw(tx.x), Math.round(tx.y + sy - (tx.bump > 0 ? 1 : 0)), col, sc);
      b.globalAlpha = 1;
    }

    // ---- Flow vignette
    if (tier >= 2) {
      const a = tier === 3 ? 0.22 + Math.sin(t * 5) * 0.08 : 0.08;
      const col = tier === 3 ? '255,215,106' : '255,138,58';
      b.globalCompositeOperation = 'lighter';
      let g = b.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.25, `rgba(${col},0)`); g.addColorStop(0.8, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${a})`);
      b.fillStyle = g; b.fillRect(0, 0, Wd, H);
      g = b.createLinearGradient(0, 0, Wd, 0);
      g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.08, `rgba(${col},0)`); g.addColorStop(0.92, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${a})`);
      b.fillStyle = g; b.fillRect(0, 0, Wd, H);
      b.globalCompositeOperation = 'source-over';
    }

    // ---- banners
    if (FX.banners.length) drawBanner2(FX.banners[0]);
    // ---- alerts (never dropped, on a plate, over the party)
    if (FX.alerts.length) {
      const a = FX.alerts[FX.alerts.length - 1];
      const ax = Math.round(sxw(W.partyX - 10)), ay = 24;
      const w = a.str.length * 4 + 8;
      b.globalAlpha = Math.min(1, (a.life - a.t) / 0.2);
      b.fillStyle = '#000000cc'; b.fillRect(ax - w / 2, ay - 4, w, 11);
      KK.font.draw(b, a.str, ax, ay, Math.floor(a.t * 8) % 2 ? '#ffffff' : a.col);
      b.globalAlpha = 1;
    }

    // ---- full-screen flash / transitions
    if (FX.flashA > 0) { b.globalAlpha = Math.min(1, FX.flashA); b.fillStyle = FX.flashCol; b.fillRect(0, 0, Wd, H); b.globalAlpha = 1; }
    if (W.trans > 0) {
      const k = 1 - Math.abs(W.trans - 0.45) / 0.45;
      b.globalAlpha = U.clamp(k * 1.2, 0, 1); b.fillStyle = '#000'; b.fillRect(0, 0, Wd, H); b.globalAlpha = 1;
    }
    if (W.wipeT > 0) {
      const k = U.clamp((2.4 - W.wipeT) / 1.2, 0, 1) * U.clamp(W.wipeT / 0.6, 0, 1);
      b.globalAlpha = k * 0.6; b.fillStyle = '#2a0008'; b.fillRect(0, 0, Wd, H); b.globalAlpha = 1;
    }
    // ambient motes
    if (motes.length < 26 && Math.random() < 0.3) motes.push({ x: Math.random() * Wd, y: Math.random() * 48, vx: U.rand(-3, 3), vy: U.rand(-2, 1), life: U.rand(3, 7), t: 0 });
    b.fillStyle = tier === 3 ? '#ffe9a0' : '#c9b8ea';
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i]; m.t += dt; m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.t > m.life) { motes.splice(i, 1); continue; }
      b.globalAlpha = Math.sin((m.t / m.life) * Math.PI) * 0.35;
      b.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
    }
    b.globalAlpha = 1;

    // ---- upscale
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, Wd * pxScale, H * pxScale);
  };

  // ---------------------------------------------------------------- helpers
  function hole(x, y, r, a) {
    if (r <= 0 || a <= 0) return;
    const g = lg.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.6})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    lg.fillStyle = g; lg.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function glow(x, y, r, col, a) {
    if (r <= 0 || a <= 0) return;
    const g = b.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    b.globalAlpha = a; b.fillStyle = g; b.fillRect(x - r, y - r, r * 2, r * 2); b.globalAlpha = 1;
  }
  function shadow(x, y, w) {
    b.fillStyle = 'rgba(0,0,0,0.35)';
    b.fillRect(x - w, y - 1, w * 2, 2);
    b.fillRect(x - w + 2, y - 2, w * 2 - 4, 1);
  }
  function bar(x, y, w, k, col) {
    x = Math.round(x); y = Math.round(y);
    b.fillStyle = '#000'; b.fillRect(x - 1, y - 1, w + 2, 3);
    b.fillStyle = '#3a2a3a'; b.fillRect(x, y, w, 1);
    b.fillStyle = col; b.fillRect(x, y, Math.max(0, Math.ceil(w * U.clamp(k, 0, 1))), 1);
  }
  function line(x0, y0, x1, y1, col) {
    b.fillStyle = col;
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) b.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1);
  }

  function drawTorch(x, y, pal, s) {
    b.fillStyle = '#1b1424'; b.fillRect(x - 2, y + 2, 5, 2); b.fillRect(x - 1, y + 4, 3, 4);
    b.fillStyle = '#6b5f55'; b.fillRect(x - 1, y + 2, 3, 1);
    const f = Math.floor(t * 10 + s * 3) % 3;
    b.fillStyle = pal.torch; b.fillRect(x - 1, y - 2 - (f === 1 ? 1 : 0), 3, 4);
    b.fillStyle = '#ffe08a'; b.fillRect(x, y - 1, 1, 2);
    if (f === 2) { b.fillStyle = pal.torch; b.fillRect(x - (s % 2 ? 1 : -1), y - 4, 1, 1); }
  }
  function drawBanner(x, y, biome, s) {
    const col = ['#7a2a3a', '#2a4a7a', '#3a6a3a', '#6a3a7a'][s % 4 < 0 ? 0 : Math.abs(s) % 4];
    b.fillStyle = '#1b1424'; b.fillRect(x - 6, y - 1, 13, 2);
    b.fillStyle = col; b.fillRect(x - 5, y + 1, 11, 16);
    b.fillStyle = '#1b1424'; b.fillRect(x - 5, y + 17, 3, 2); b.fillRect(x + 3, y + 17, 3, 2); b.fillRect(x - 1, y + 16, 3, 2);
    b.fillStyle = '#fbd14b'; b.fillRect(x - 1, y + 5, 3, 3); b.fillRect(x, y + 4, 1, 5);
    b.fillStyle = 'rgba(0,0,0,0.25)'; b.fillRect(x + 3, y + 1, 2, 16);
  }
  function drawNiche(x, y, biome, s) {
    b.fillStyle = '#0b0812'; b.fillRect(x - 6, y, 12, 9); b.fillRect(x - 5, y - 1, 10, 1);
    const skull = KK.SPR.icons.skull;
    if (biome.id === 'crypt' || biome.id === 'void') b.drawImage(skull.c, x - 4, y + 2);
    else { b.fillStyle = '#5ec26a'; b.fillRect(x - 2, y + 6, 4, 3); b.fillStyle = '#9cff8a'; b.fillRect(x - 1, y + 5, 1, 1); }
  }
  function drawChains(x, sy, pal) {
    b.fillStyle = '#4a4458';
    for (let y = 0; y < 18; y += 3) { b.fillRect(x, y + sy, 1, 2); b.fillRect(x + 6, y + sy + 1, 1, 2); }
    b.fillStyle = '#6b6478'; b.fillRect(x - 1, 18 + sy, 3, 2); b.fillRect(x + 5, 19 + sy, 3, 2);
  }
  function drawDoor(x, sy, pal) {
    const y = W.GROUND + sy;
    b.fillStyle = '#05030a'; b.fillRect(x - 9, y - 26, 18, 26); b.fillRect(x - 7, y - 28, 14, 2);
    b.fillStyle = '#1b1424'; b.fillRect(x - 11, y - 26, 2, 26); b.fillRect(x + 9, y - 26, 2, 26); b.fillRect(x - 9, y - 30, 18, 2);
    b.fillStyle = pal.wallHi; b.fillRect(x - 12, y - 26, 1, 26); b.fillRect(x + 11, y - 26, 1, 26); b.fillRect(x - 9, y - 31, 18, 1);
    for (let i = 0; i < 4; i++) { b.fillStyle = i % 2 ? '#1e1a28' : '#2a2438'; b.fillRect(x - 7 + i * 2, y - 6 + i * 2 - 6, 14 - i * 4, 2); }
    const a = 0.5 + Math.sin(t * 3) * 0.2;
    b.globalAlpha = a; b.fillStyle = pal.accent; b.fillRect(x - 1, y - 24, 2, 2); b.globalAlpha = 1;
    // little arrow hint
    if (Math.floor(t * 2) % 2) { b.fillStyle = '#fbd14b'; b.fillRect(x - 1, y - 38, 3, 1); b.fillRect(x, y - 37, 1, 1); }
  }

  function drawHero(h, x, sy, tier) {
    const frames = KK.SPR.frames[h.id];
    if (!frames) return;
    const walking = W.walking && !h.dead && W.trans <= 0;
    const f = walking ? Math.floor(h.anim) % 2 : 0;
    const spr = frames[f];
    let y = h.y - spr.h + sy;
    if (walking && f === 1) y -= 1;
    let dx = 0;
    if (h.lunge > 0) dx = Math.round(Math.sin((h.lunge / 0.15) * Math.PI) * 3);
    if (h.jump > 0) { const k = 1 - h.jump / 0.55; y -= Math.round(Math.sin(k * Math.PI) * 18); dx += Math.round(k * 6); }
    if (h.cast > 0 && h.id !== 'knight') y -= 1;
    const dxp = x - spr.w / 2 + dx;
    shadow(x, h.y + sy, h.jump > 0 ? 3 : 5);
    if (h.dead) {
      b.save(); b.globalAlpha = 0.6; b.translate(x, h.y + sy - 3); b.rotate(Math.PI / 2);
      b.drawImage(spr.dark, -spr.h / 2, -spr.w / 2); b.restore(); b.globalAlpha = 1;
      return;
    }
    if (tier === 3) {
      if (walking) { b.globalAlpha = 0.18; b.drawImage(spr.gold, dxp - 6, y); b.globalAlpha = 0.32; b.drawImage(spr.gold, dxp - 3, y); }
      b.globalAlpha = 0.55 + Math.sin(t * 8 + h.slot) * 0.25;
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) b.drawImage(spr.gold, dxp + ox, y + oy);
      b.globalAlpha = 1;
    }
    b.drawImage(spr.c, Math.round(dxp), Math.round(y));
    if (h.flash > 0) { b.globalAlpha = 0.8; b.drawImage(KK.SPR.frames[h.id][f].white, Math.round(dxp), Math.round(y)); b.globalAlpha = 1; }
    // mage orb / cleric halo glow
    if (h.id === 'mage') { b.globalCompositeOperation = 'lighter'; glow(dxp + 14, y + 2, 5 + (h.cast > 0 ? 4 : 0), '#7ee8f6', 0.6); b.globalCompositeOperation = 'source-over'; }
    // ultimate charge: the hero whose turn it is shows a bar that your typing fills
    if (W.ultTurn === h.id) {
      const def = D.HEROES[h.id];
      const cost = Math.ceil(def.ult.cost * KK.mods().ultCost);
      const k = Math.min(1, KK.S.sparks / cost);
      const bx = Math.round(x - 5), by = Math.round(h.y + sy) + 3; // under the feet, away from the HP bar
      b.fillStyle = '#000'; b.fillRect(bx - 3, by - 1, 14, 4);
      b.fillStyle = '#ffd34a'; b.fillRect(bx - 2, by, 1, 2); // spark pip
      b.fillStyle = '#123842'; b.fillRect(bx, by, 10, 2);
      const ready = k >= 1 && h.ultCd <= 0;
      b.fillStyle = ready ? (Math.floor(t * 6) % 2 ? '#ffffff' : '#7ee8f6') : '#4fb8cc';
      b.fillRect(bx, by, Math.max(1, Math.round(10 * k)), 2);
      if (ready) { b.globalCompositeOperation = 'lighter'; glow(x, by + 1, 6, '#7ee8f6', 0.5); b.globalCompositeOperation = 'source-over'; }
    }
  }
  // Hollowed bosses (floor 70+) get a void-purple tint so they read as new foes
  const tintCache = new WeakMap();
  function hollowTint(c) {
    let out = tintCache.get(c);
    if (out) return out;
    out = document.createElement('canvas'); out.width = c.width; out.height = c.height;
    const g = out.getContext('2d', { willReadFrequently: true });
    g.drawImage(c, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.5; g.fillStyle = '#6a2cff'; g.fillRect(0, 0, c.width, c.height);
    tintCache.set(c, out);
    return out;
  }

  function drawEnemy(e, x, sy) {
    const spr = KK.SPR.frame(e.key, (e.moving || e.def.fly) ? Math.floor(e.anim) : 0);
    if (!spr) return;
    let y = e.y - spr.h + sy;
    if (e.def.fly) y += Math.round(Math.sin(e.anim * 0.7) * 2);
    let dx = 0;
    if (e.lunge > 0) dx = -Math.round(Math.sin((e.lunge / 0.15) * Math.PI) * 4);
    const k = U.clamp(e.spawnT, 0, 1);
    if (k < 1) y += Math.round((1 - k) * 8);
    shadow(x, W.GROUND + sy, Math.max(4, Math.round(spr.w / 3)));
    b.globalAlpha = k;
    const dxp = Math.round(x - spr.w / 2 + dx);
    if (e.pile > 0) {
      // the Bone King collapses into a pile, then pulls himself back up
      const k2 = 1 - Math.min(1, e.pile / 1.5);
      const hh = Math.max(Math.round(spr.h * 0.35), Math.round(spr.h * k2));
      b.drawImage(e.hollowed ? hollowTint(spr.c) : spr.c, 0, spr.h - hh, spr.w, hh, dxp, Math.round(y) + spr.h - hh, spr.w, hh);
    } else b.drawImage(e.hollowed ? hollowTint(spr.c) : spr.c, dxp, Math.round(y));
    if ((e.windup > 0 || (e.boss && (e.fightT || 0) > 165)) && Math.floor(t * 8) % 2) { b.globalAlpha = 0.55 * k; b.drawImage(spr.white, dxp, Math.round(y)); b.globalAlpha = 1; }
    if (e.flash > 0) { b.globalAlpha = 0.9 * k; b.drawImage(spr.white, dxp, Math.round(y)); }
    b.globalAlpha = 1;
    if (e.stun > 0) {
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + i * 2.1;
        b.fillStyle = '#fbd14b'; b.fillRect(Math.round(x + Math.cos(a) * 5), Math.round(y - 3 + Math.sin(a) * 1.5), 1, 1);
      }
    }
  }

  function drawShot(s, cx, sy) {
    if (s.delay > 0 || s.type === 'echo' || s.type === 'slam') return;
    const x = Math.round(s.x - cx), y = Math.round(s.y + sy);
    switch (s.type) {
      case 'arrow': {
        b.fillStyle = '#e8dcc0'; b.fillRect(x - 4, y, 5, 1);
        b.fillStyle = '#fff'; b.fillRect(x + 1, y, 1, 1);
        b.fillStyle = '#9a6238'; b.fillRect(x - 5, y - 1, 1, 1); b.fillRect(x - 5, y + 1, 1, 1);
        break;
      }
      case 'skyarrow': {
        line(x - 3, y - 4, x, y, '#e8dcc0');
        b.fillStyle = '#7ee8f6'; b.fillRect(x, y, 1, 1);
        if (Math.random() < 0.5) FX.particle(s.x, s.y, { life: 0.25, col: '#7ee8f6', add: true });
        break;
      }
      case 'fireball': {
        b.fillStyle = '#ff5a2e'; b.fillRect(x - 1, y - 1, 3, 3);
        b.fillStyle = '#ffe08a'; b.fillRect(x, y, 1, 1);
        FX.particle(s.x, s.y, { vx: U.rand(-20, -5), vy: U.rand(-10, 10), life: 0.3, col: U.pick(['#ff5a2e', '#ffb347']), add: true });
        FX.light(s.x, s.y, 16, 0.05, '#ff9a3a');
        break;
      }
      case 'holy': {
        b.fillStyle = '#fff6c9'; b.fillRect(x - 1, y, 3, 1); b.fillRect(x, y - 1, 1, 3);
        break;
      }
      case 'efire': {
        b.fillStyle = '#ff3a1e'; b.fillRect(x - 1, y - 1, 2, 2);
        FX.particle(s.x, s.y, { vx: U.rand(5, 20), vy: U.rand(-8, 8), life: 0.25, col: '#ff7a2e', add: true });
        break;
      }
      case 'ebeam': {
        b.fillStyle = '#f27cc0'; b.fillRect(x - 2, y, 4, 1);
        FX.particle(s.x, s.y, { life: 0.2, col: '#c472ff', add: true });
        break;
      }
      case 'meteor': {
        b.fillStyle = '#5a3a2a'; b.fillRect(x - 3, y - 3, 6, 6);
        b.fillStyle = '#ff5a2e'; b.fillRect(x - 2, y - 2, 4, 4);
        b.fillStyle = '#ffe08a'; b.fillRect(x - 1, y - 1, 2, 2);
        for (let i = 0; i < 3; i++) FX.particle(s.x + U.rand(-2, 2), s.y + U.rand(-2, 2), { vx: U.rand(20, 60), vy: U.rand(-40, -10), life: 0.5, col: U.pick(['#ff5a2e', '#ffb347', '#ffe08a']), add: true, size: 2 });
        FX.light(s.x, s.y, 40, 0.05, '#ff9a3a');
        break;
      }
    }
  }

  function drawParticles(cx, sy, additive) {
    for (const p of FX.parts) {
      if (!!p.add !== additive) continue;
      const k = p.life / p.max;
      b.globalAlpha = Math.min(1, k * 2);
      b.fillStyle = p.col;
      const sz = p.size || 1;
      b.fillRect(Math.round(p.x - cx), Math.round(p.y + sy), sz, sz);
      if (p.glow && additive) { b.globalAlpha = k * 0.35; b.fillRect(Math.round(p.x - cx) - 1, Math.round(p.y + sy) - 1, 3, 3); }
    }
    b.globalAlpha = 1;
  }

  function drawBanner2(bn) {
    const k = bn.t / bn.life;
    const inT = 0.18, outT = 0.82;
    let off = 0;
    if (k < inT) off = (1 - U.ease.outBack(k / inT)) * -Wd * 0.6;
    else if (k > outT) off = U.ease.inCubic((k - outT) / (1 - outT)) * Wd * 0.6;
    const cy = 30;
    const sc = bn.big ? 2 : 1;
    const bandA = (k < inT ? k / inT : k > outT ? 1 - (k - outT) / (1 - outT) : 1) * 0.4;
    b.globalAlpha = bandA; b.fillStyle = '#000'; b.fillRect(0, cy - 8 * sc / 2 - 3, Wd, (bn.sub ? 10 : 0) + 7 * sc + 6); b.globalAlpha = 1;
    KK.font.draw(b, bn.text, Wd / 2 + off, cy, bn.col, sc);
    if (bn.sub) KK.font.draw(b, bn.sub, Wd / 2 - off * 0.5, cy + 7 * sc / 2 + 5, bn.subCol, 1);
  }
})();
