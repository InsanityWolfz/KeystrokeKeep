/* Keystroke Keep — juice: particles, damage numbers, shake, flashes, banners, coins, lights.
   All coordinates are world game-pixels; render.js converts with the camera. */
(function () {
  'use strict';
  const KK = window.KK, U = KK.U;
  const W = KK.world;
  const FX = KK.fx = {
    parts: [], texts: [], rings: [], lights: [], banners: [], coins: [], beams: [], pillars: [],
    shakeT: 0, shakeAmp: 0, flashA: 0, flashCol: '#fff', hitstop: 0, slowT: 0, slowF: 1,
  };
  const MAX_PARTS = 900;

  FX.timeScale = () => (FX.hitstop > 0 ? 0 : FX.slowT > 0 ? FX.slowF : 1);

  FX.update = function (dt) {
    FX.hitstop = Math.max(0, FX.hitstop - dt);
    FX.slowT = Math.max(0, FX.slowT - dt);
    FX.shakeT = Math.max(0, FX.shakeT - dt);
    FX.flashA = Math.max(0, FX.flashA - dt * 2.2);
    const live = [];
    for (const p of FX.parts) {
      p.life -= dt;
      if (p.life <= 0) continue;
      if (p.home) {
        // homing spark (keystroke energy flying into the party)
        const tx = p.home.x, ty = p.home.y;
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
        p.vx += (dx / (d + 0.01)) * 520 * dt; p.vy += (dy / (d + 0.01)) * 520 * dt;
        p.vx *= 0.92; p.vy *= 0.92;
        if (d < 4) { p.life = 0; FX.burst(p.x, p.y, 2, [p.col], { spd: 20, life: 0.2 }); continue; }
      }
      p.vy += (p.grav || 0) * dt;
      p.vx *= p.drag || 1; p.vy *= p.drag || 1;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.floor && p.y > W.GROUND + 2) { p.y = W.GROUND + 2; p.vy *= -0.35; p.vx *= 0.6; }
      live.push(p);
    }
    FX.parts = live;
    FX.texts = FX.texts.filter((t) => { t.life -= dt; t.y = Math.max(15, t.y + t.vy * dt); t.vy *= 0.9; if (t.bump > 0) t.bump -= dt; return t.life > 0; });
    FX.rings = FX.rings.filter((r) => (r.t += dt) < r.life);
    FX.lights = FX.lights.filter((l) => (l.t += dt) < l.life);
    FX.beams = FX.beams.filter((b) => (b.t += dt) < b.life);
    FX.pillars = FX.pillars.filter((p) => (p.t += dt) < p.life);
    // banners play one at a time; a waiting queue makes the current one hurry up
    if (FX.banners.length) {
      const b0 = FX.banners[0];
      b0.t += dt * (FX.banners.length > 1 ? 1.7 : 1);
      if (b0.t >= b0.life) FX.banners.shift();
    }
    // coins: pop, bounce, then fly to the HUD gold counter
    const v = KK.view;
    FX.coins = FX.coins.filter((c) => {
      c.t += dt;
      if (c.t < c.pop) {
        c.vy += 260 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.y > W.GROUND + 1) { c.y = W.GROUND + 1; c.vy *= -0.45; c.vx *= 0.7; }
        return true;
      }
      if (!v) return false;
      const dx = v.goldX - c.x, dy = v.goldY - c.y, d = Math.hypot(dx, dy);
      const sp = 140 + (c.t - c.pop) * 900;
      if (d < sp * dt + 3) { KK.emit('coinArrive'); return false; }
      c.x += (dx / d) * sp * dt; c.y += (dy / d) * sp * dt;
      return true;
    });
  };

  FX.particle = function (x, y, o = {}) {
    if (FX.parts.length > MAX_PARTS) FX.parts.shift();
    const p = { x, y, vx: o.vx || 0, vy: o.vy || 0, life: o.life || 0.6, max: o.life || 0.6, col: o.col || '#fff', size: o.size || 1, grav: o.grav || 0, drag: o.drag, floor: o.floor, glow: o.glow, home: o.home, add: o.add };
    FX.parts.push(p);
    return p;
  };
  FX.burst = function (x, y, n, cols, o = {}) {
    const spd = o.spd || 60;
    for (let i = 0; i < n; i++) {
      const a = o.angle !== undefined ? o.angle + U.rand(-(o.spread || 0.6), o.spread || 0.6) : Math.random() * Math.PI * 2;
      const s = U.rand(spd * 0.3, spd);
      FX.particle(x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s + (o.up || 0), life: U.rand(0.5, 1) * (o.life || 0.6), col: U.pick(cols), grav: o.grav !== undefined ? o.grav : 120, drag: o.drag || 0.97, floor: o.floor, size: o.size || 1, glow: o.glow, add: o.add });
    }
  };
  /** Shatter a sprite into its own pixels. */
  FX.debris = function (spr, cx, footY, flip, big) {
    if (!spr) return;
    const step = spr.px.length > 220 ? 3 : spr.px.length > 120 ? 2 : 1;
    for (let i = 0; i < spr.px.length; i += step) {
      const p = spr.px[i];
      const px = cx - spr.w / 2 + (flip ? spr.w - 1 - p.x : p.x);
      const py = footY - spr.h + p.y;
      const a = Math.atan2(py - (footY - spr.h / 2), px - cx) + U.rand(-0.5, 0.5);
      const s = U.rand(20, big ? 140 : 80);
      FX.particle(px, py, { vx: Math.cos(a) * s + 15, vy: Math.sin(a) * s - U.rand(20, 70), life: U.rand(0.5, big ? 1.6 : 1.0), col: p.col, grav: 220, drag: 0.985, floor: true, size: step > 1 ? 2 : 1 });
    }
  };
  FX.text = function (x, y, str, col = '#fff', scale = 1, o = {}) {
    if (FX.texts.length > 14) FX.texts.shift();
    FX.texts.push({ x: x + U.rand(-2, 2), y, str: String(str), col, scale, life: o.life || 0.85, max: o.life || 0.85, vy: o.vy !== undefined ? o.vy : -38, pop: !!o.pop, bump: 0 });
  };
  FX.ring = (x, y, r0, r1, col, life = 0.5, w = 1) => FX.rings.push({ x, y, r0, r1, col, life, t: 0, w });
  FX.light = (x, y, r, life, col = '#ffd27a', a = 1) => FX.lights.push({ x, y, r, life, t: 0, col, a });
  // Calm mode (Settings): this lives on screen all day, so flashes/shake/hitstop can be turned way down.
  const calm = () => !!(KK.S && KK.S.settings.calm);
  FX.shake = (amp, dur) => { if (calm()) return; if (amp >= FX.shakeAmp * (FX.shakeT > 0 ? 1 : 0)) { FX.shakeAmp = amp; } FX.shakeT = Math.max(FX.shakeT, dur); };
  FX.flash = (col, a = 0.6) => { if (calm()) a = Math.min(a, 0.06); FX.flashCol = col; FX.flashA = Math.max(FX.flashA, a); };
  FX.stop = (s) => { if (calm()) return; FX.hitstop = Math.max(FX.hitstop, s); };
  FX.slowmo = (f, dur) => { if (calm()) return; FX.slowF = f; FX.slowT = dur; };
  /** Anything animating that deserves full frame rate? (main.js drops to an idle fps otherwise) */
  FX.busy = () => FX.banners.length > 0 || FX.coins.length > 0 || FX.parts.length > 30 || FX.flashA > 0.02 || FX.shakeT > 0;
  FX.banner = (text, sub, col = '#fff', life = 2.2, o = {}) => {
    if (FX.banners.some((b) => b.text === text)) return;
    // minor banners (plain floor numbers) are skipped when something else is showing
    if (o.big === false && FX.banners.length) return;
    FX.banners.push({ text, sub, col, life, t: 0, subCol: o.subCol || '#c9b8ea', big: o.big !== false, prio: o.prio || 0 });
    if (FX.banners.length > 4) FX.banners.splice(1, 1);
  };
  FX.coinBurst = function (x, y, n) {
    n = Math.min(n, 30);
    for (let i = 0; i < n; i++) {
      FX.coins.push({ x, y, vx: U.rand(-40, 70), vy: U.rand(-130, -60), t: 0, pop: U.rand(0.35, 0.65) + i * 0.012 });
    }
  };
  FX.pillar = (x, col = '#ffd76a', life = 0.9, w = 10) => FX.pillars.push({ x, col, life, t: 0, w });

  // ---------------------------------------------------------------- event wiring
  const S = () => KK.S;
  const fmt = U.fmt;
  const headY = (e) => e.y - e.def.h - 2;

  // Damage numbers: rapid hits on the same target merge into one rising number.
  let stagger = 0;
  function dmgText(e, dmg, col, scale, kind) {
    const key = e.uid + kind;
    const prev = FX.texts.find((t) => t.key === key && t.max - t.life < 0.25);
    if (prev) { prev.val += dmg; prev.str = fmt(prev.val) + (kind === 'c' ? '!' : ''); prev.life = prev.max; prev.bump = 0.08; return; }
    stagger = (stagger + 1) % 3;
    FX.texts.push({ key, val: dmg, x: e.x + (stagger - 1) * 5, y: headY(e) - stagger * 2, str: fmt(dmg) + (kind === 'c' ? '!' : ''), col, scale, life: 0.8, max: 0.8, vy: -30, pop: kind === 'c', bump: 0 });
    if (FX.texts.length > 14) FX.texts.shift();
  }
  KK.on('hit', ({ e, dmg, crit, ult }) => {
    if (crit) {
      dmgText(e, dmg, '#ffd34a', 2, 'c');
      FX.stop(0.035);
      FX.burst(e.x - e.def.w / 2, e.y - e.def.h / 2, 6, ['#fff', '#ffd34a'], { spd: 90, grav: 60, life: 0.35 });
    } else if (ult) {
      dmgText(e, dmg, '#7ee8f6', 1, 'u');
    } else {
      dmgText(e, dmg, '#ffffff', 1, 'n');
      FX.burst(e.x - e.def.w / 2 + 1, e.y - e.def.h / 2, 2, ['#fff', '#ffe9b0'], { spd: 50, grav: 60, life: 0.25 });
    }
    if (e.boss && (crit || ult)) FX.shake(1.5, 0.12);
  });

  KK.on('kill', ({ e, gold }) => {
    const spr = KK.SPR.frame(e.key, 0);
    FX.debris(spr, e.x, e.y + (e.def.fly ? 0 : 0), false, e.boss);
    const n = e.boss ? 26 : Math.max(1, Math.min(6, Math.round(Math.log10(gold + 1) * 1.6)));
    FX.coinBurst(e.x, e.y - e.def.h / 2, n);
    if (e.boss) {
      FX.text(e.x, headY(e) - 6, '+' + fmt(gold), '#fbd14b', 1, { life: 1.6, vy: -22 });
      FX.slowmo(0.25, 0.9);
      FX.flash('#ffffff', 0.85);
      FX.shake(6, 0.8);
      FX.ring(e.x, e.y - e.def.h / 2, 4, 120, '#ffd76a', 0.8, 2);
      FX.ring(e.x, e.y - e.def.h / 2, 2, 70, '#ffffff', 0.5, 1);
      FX.light(e.x, e.y - 10, 160, 1.4, '#ffd76a');
      FX.burst(e.x, e.y - e.def.h / 2, 60, ['#ffd76a', '#fff', '#ff9a3a'], { spd: 200, grav: 160, life: 1.4, floor: true });
      FX.banner('VICTORY!', e.def.name + ' falls', '#ffd76a', 2.6, { subCol: '#fff' });
    } else {
      FX.burst(e.x, e.y - e.def.h / 2, 5, ['#ffffff', '#ffe9b0'], { spd: 70, life: 0.4 });
    }
  });

  KK.on('heroHit', ({ h, dmg }) => {
    FX.text(h.x, h.y - 18, fmt(dmg), '#ff6b6b', 1, { life: 0.6, vy: -24 });
  });
  KK.on('bossSlam', ({ e }) => {
    FX.shake(3.5, 0.3);
    FX.ring(e.x - 10, W.GROUND, 2, 70, '#ff6b6b', 0.5, 1);
    FX.burst(e.x - 10, W.GROUND, 16, ['#9a8a7a', '#6b5f55'], { spd: 90, up: -40, life: 0.6, floor: true });
  });
  KK.on('heroDown', ({ h }) => {
    FX.text(h.x, h.y - 20, 'KO', '#ff6b6b', 2, { life: 1.2 });
    FX.burst(h.x, h.y - 8, 12, ['#ff6b6b', '#ffffff'], { spd: 80, life: 0.6 });
  });
  KK.on('heal', ({ h, amt }) => { if (amt >= 1) FX.text(h.x, h.y - 18, '+' + fmt(amt), '#7dff8a', 1, { life: 0.7, vy: -20 }); });
  KK.on('healBeam', ({ from, to }) => {
    FX.beams.push({ x0: from.x + 4, y0: from.y - 12, x1: to.x, y1: to.y - 8, col: '#b6ffb0', t: 0, life: 0.3 });
    FX.burst(to.x, to.y - 8, 5, ['#b6ffb0', '#ffffff'], { spd: 30, grav: -40, life: 0.6 });
  });
  KK.on('revive', ({ h }) => { FX.pillar(h.x, '#fff6c9', 1.1, 12); FX.text(h.x, h.y - 22, 'REVIVED', '#fff6c9', 1, { life: 1.3 }); });

  const ULT_TXT = { knight: 'EARTHSHATTER!', archer: 'ARROW STORM!', mage: 'METEOR!', cleric: 'SANCTUARY!' };
  KK.on('ult', ({ h, id }) => {
    FX.text(h.x, h.y - 24, ULT_TXT[id], '#7ee8f6', 1, { life: 1.1, vy: -16 });
    FX.burst(h.x, h.y - 8, 14, ['#7ee8f6', '#ffffff', '#2f9cb8'], { spd: 70, grav: -30, life: 0.7 });
    FX.light(h.x, h.y - 8, 50, 0.6, '#7ee8f6');
    if (id === 'cleric') {
      for (const o of W.heroes) { FX.pillar(o.x, '#ffe9a0', 1.1, 12); FX.ring(o.x, o.y - 8, 2, 26, '#ffe9a0', 0.7); }
      FX.flash('#fff6c9', 0.15);
      FX.light(W.partyX - 20, 30, 120, 1.2, '#ffe9a0');
    }
  });
  KK.on('echo', ({ h }) => FX.text(h.x, h.y - 32, 'ECHO!', '#c472ff', 1, { life: 1.2 }));
  KK.on('slamLand', ({ x }) => {
    FX.shake(2, 0.25);
    FX.ring(x, W.GROUND, 3, 75, '#ffe9b0', 0.5, 2);
    FX.burst(x, W.GROUND, 26, ['#9a8a7a', '#c9b8a0', '#6b5f55'], { spd: 120, up: -60, life: 0.9, floor: true });
    FX.flash('#ffffff', 0.07);
  });
  KK.on('skyarrowLand', ({ x, y }) => FX.burst(x, y, 4, ['#ffe9b0', '#fff'], { spd: 50, up: -30, life: 0.35 }));
  KK.on('meteorLand', ({ x, y }) => {
    FX.shake(3.5, 0.4);
    FX.flash('#ffb347', 0.22);
    FX.ring(x, y, 4, 90, '#ffb347', 0.6, 2);
    FX.ring(x, y, 2, 50, '#fff', 0.35, 1);
    FX.light(x, y - 10, 140, 1.0, '#ff9a3a');
    FX.burst(x, y - 4, 70, ['#ff5a2e', '#ffb347', '#ffe08a', '#5a3a2a'], { spd: 180, up: -70, grav: 200, life: 1.2, floor: true });
    FX.stop(0.06);
  });
  KK.on('explode', ({ x, y }) => {
    FX.burst(x, y, 12, ['#ff5a2e', '#ffb347', '#ffe08a'], { spd: 80, grav: 40, life: 0.45 });
    FX.light(x, y, 40, 0.35, '#ff9a3a');
  });
  KK.on('chest', ({ x, gold }) => {
    FX.coinBurst(x, W.GROUND - 8, 14);
    FX.light(x, W.GROUND - 8, 70, 1.0, '#ffd76a');
    FX.ring(x, W.GROUND - 6, 2, 40, '#ffd76a', 0.6);
    FX.burst(x, W.GROUND - 8, 24, ['#ffd76a', '#ffffff'], { spd: 100, up: -80, grav: 150, life: 1, floor: true });
    FX.text(x, W.GROUND - 22, 'TREASURE! +' + fmt(gold), '#ffd76a', 1, { life: 1.6, vy: -14 });
  });
  KK.on('floor', ({ floor, biomeChange, boss }) => {
    const b = KK.F.biomeOf(floor);
    if (biomeChange) FX.banner(b.name.toUpperCase(), 'FLOOR ' + floor, '#ffffff', 3, { subCol: b.pal.accent });
    else if (boss) FX.banner('FLOOR ' + floor, 'A POWERFUL FOE AWAITS...', '#ff8a8a', 2.2, { subCol: '#ffb4a0' });
    else FX.banner('FLOOR ' + floor, null, '#ffffff', 1.4, { big: false });
  });
  KK.on('bossSpawn', ({ boss }) => {
    FX.banner(boss.def.name.toUpperCase(), 'BOSS', '#ff6b6b', 2.6, { subCol: '#ffd76a' });
    FX.shake(2, 1.6);
    FX.flash('#300010', 0.5);
  });
  KK.on('wipe', () => {
    FX.banner('RETREAT!', 'THE PARTY FALLS BACK A FLOOR', '#ff6b6b', 2.4, { subCol: '#ffb4a0' });
    FX.flash('#5a0010', 0.6);
  });
  let lastFlowParty = -1e9;
  KK.on('fervorTier', ({ from, to }) => {
    if (to <= from) return;
    const x = W.partyX - 20;
    if (to === 3 && performance.now() - lastFlowParty < 600000) {
      FX.text(x, 22, 'FLOW!', '#ffd76a', 1, { life: 1.4, vy: -10 });
      FX.ring(x, 40, 4, 80, '#ffd76a', 0.6, 1);
      FX.light(x, 34, 120, 1.0, '#ffd76a');
    } else if (to === 3) {
      lastFlowParty = performance.now();
      FX.banner('FLOW STATE!', 'x' + KK.powerMult().toFixed(1) + ' POWER', '#ffd76a', 2.0, { slot: 'flow', subCol: '#fff6c9' });
      FX.flash('#ffd76a', 0.45);
      FX.ring(x, 40, 4, 110, '#ffd76a', 0.7, 2);
      FX.light(x, 34, 160, 1.2, '#ffd76a');
      FX.burst(x, 40, 40, ['#ffd76a', '#fff6c9', '#ffffff'], { spd: 140, grav: -20, life: 1.2 });
    } else if (to === 2) {
      FX.text(x, 22, 'IN THE ZONE', '#ff9a3a', 1, { life: 1.4, vy: -10 });
      FX.ring(x, 40, 4, 60, '#ff9a3a', 0.5);
    } else if (to === 1) {
      FX.text(x, 24, 'FOCUSED', '#ffb070', 1, { life: 1.1, vy: -10 });
    }
  });
  KK.on('levelUp', ({ id, from, to }) => {
    const h = W.heroes.find((x) => x.id === id);
    if (!h) return;
    const milestone = Math.floor(to / 10) > Math.floor(from / 10);
    FX.pillar(h.x, milestone ? '#ffd76a' : '#fff6c9', milestone ? 1.2 : 0.6, milestone ? 14 : 8);
    FX.burst(h.x, h.y - 8, milestone ? 30 : 8, ['#ffd76a', '#ffffff'], { spd: milestone ? 110 : 50, grav: -50, life: 0.8 });
    FX.text(h.x, h.y - 24, to - from > 1 ? `LV ${to} (+${to - from})` : 'LV ' + to, '#ffd76a', 1, { life: 1.0, vy: -18 });
    if (milestone) {
      FX.banner(KK.DATA.HEROES[id].name.toUpperCase() + ' LV ' + Math.floor(to / 10) * 10, 'x' + KK.BAL.dmgMile + ' DAMAGE!', '#ffd76a', 2, { slot: 'lvl', subCol: '#fff' });
      FX.flash('#ffd76a', 0.25);
      FX.shake(2, 0.2);
    }
  });
  KK.on('recruit', ({ id }) => {
    setTimeout(() => {
      const h = W.heroes.find((x) => x.id === id);
      if (!h) return;
      FX.pillar(h.x, '#ffffff', 1.4, 16);
      FX.ring(h.x, h.y - 8, 2, 50, '#ffffff', 0.6);
      FX.burst(h.x, h.y - 8, 30, ['#ffffff', '#ffd76a', '#7ee8f6'], { spd: 120, grav: -20, life: 1 });
    }, 50);
    FX.banner(KK.DATA.HEROES[id].name.toUpperCase() + ' JOINS!', 'THE ' + KK.DATA.HEROES[id].cls.toUpperCase(), '#ffffff', 2.4, { subCol: '#7ee8f6' });
    FX.flash('#ffffff', 0.3);
  });
  KK.on('relicPicked', () => {
    const x = W.partyX - 20;
    FX.flash('#c472ff', 0.35);
    FX.ring(x, 40, 4, 90, '#c472ff', 0.7, 2);
    FX.burst(x, 40, 30, ['#c472ff', '#ffffff', '#7ee8f6'], { spd: 120, grav: -20, life: 1 });
  });
  KK.on('ratCaught', ({ x, y, gold }) => {
    FX.coinBurst(x, y - 4, 24);
    FX.burst(x, y - 4, 40, ['#ffd76a', '#fff6c9', '#ffffff'], { spd: 160, grav: 100, life: 1.2, floor: true });
    FX.ring(x, y - 4, 2, 60, '#ffd76a', 0.6, 2);
    FX.light(x, y, 90, 1, '#ffd76a');
    FX.text(x, y - 18, 'GOLDEN RAT! +' + fmt(gold), '#ffd76a', 1, { life: 1.8, vy: -14 });
    FX.flash('#ffd76a', 0.3);
    FX.shake(2, 0.2);
  });
  KK.on('keycoin', () => {
    const x = W.partyX + U.rand(-30, 40);
    FX.coinBurst(x, W.GROUND - 30, 1);
    FX.burst(x, W.GROUND - 30, 4, ['#ffd76a', '#fff'], { spd: 30, life: 0.4 });
  });
  KK.on('poke', ({ e }) => FX.burst(e.x, e.y - e.def.h / 2, 6, ['#ffffff', '#7ee8f6'], { spd: 80, life: 0.3 }));

  // keystroke energy: a spark rises from the floor and flies into the party
  let sparkBudget = 0;
  KK.on('activity', () => {
    const v = KK.view;
    if (!v || sparkBudget > 40) return;
    sparkBudget++;
    const tier = KK.fervorTier();
    const col = tier === 3 ? U.pick(['#ffd76a', '#fff6c9']) : tier === 2 ? U.pick(['#ffb070', '#7ee8f6']) : U.pick(['#7ee8f6', '#c9f7ff']);
    const living = W.heroes.filter((h) => !h.dead);
    const h = living.length ? U.pick(living) : null;
    const x = U.rand(v.left + 10, v.right - 10);
    const p = FX.particle(x, 66, { vx: U.rand(-30, 30), vy: U.rand(-120, -70), life: 2.0, col, glow: true, add: true });
    p.home = h ? { get x() { return h.x; }, get y() { return h.y - 8; } } : { x: W.partyX, y: 40 };
    setTimeout(() => sparkBudget--, 300);
  });
})();
