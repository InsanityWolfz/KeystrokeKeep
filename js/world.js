/* Keystroke Keep — the dungeon simulation (DOM-free so tools/sim.js can run it headless).
   Coordinates are in game pixels. The party walks right; x grows to the right. */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const KK = root.KK, U = KK.U, D = KK.DATA, F = KK.F;

  const GROUND = 54;      // feet line
  const SLOT = 15;        // spacing between heroes
  const SPAWN_AHEAD = 150;
  const WAVES = 3;

  const W = KK.world = {
    GROUND,
    heroes: [], enemies: [], shots: [], props: [],
    partyX: 40, wave: 0, waves: WAVES, door: null, chest: null,
    trans: 0, transFloorDone: false, wipeT: 0, ultGap: 0, t: 0,
    rat: null, nextRat: U.rand(150, 260), secAcc: 0, autoAcc: 0,
    boss: null, bossIntro: 0, id: 1,
  };

  // ---------------------------------------------------------------- setup
  W.reset = function () {
    W.enemies = []; W.shots = []; W.props = [];
    W.wave = 0; W.door = null; W.chest = null; W.trans = 0; W.wipeT = 0; W.boss = null;
    W.heroes = [];
    W.syncHeroes(true);
  };

  /** Make sure every recruited hero has an entity; refresh max HP from level/mods. */
  W.syncHeroes = function (heal) {
    const S = KK.S, m = KK.mods();
    const owned = D.PARTY_ORDER.filter((id) => S.heroes[id] > 0);
    W.heroes = W.heroes.filter((h) => owned.includes(h.id));
    owned.forEach((id, slot) => {
      let h = W.heroes.find((x) => x.id === id);
      const maxHp = F.heroHp(id, S.heroes[id]) * m.hp * (id === 'knight' ? m.knightHp : 1);
      if (!h) {
        h = { kind: 'hero', id, uid: W.id++, x: W.partyX - slot * SLOT - 30, y: GROUND, hp: maxHp, maxHp, atkT: U.rand(0, 0.5), ultCd: 2, dead: false, flash: 0, lunge: 0, anim: Math.random() * 10, jump: 0, cast: 0, joined: 1 };
        W.heroes.push(h);
      } else {
        const ratio = h.maxHp > 0 ? h.hp / h.maxHp : 1;
        h.maxHp = maxHp;
        h.hp = heal ? maxHp : Math.max(h.dead ? 0 : 1, maxHp * ratio);
        if (heal) h.dead = false;
      }
      h.slot = slot;
    });
    W.heroes.sort((a, b) => a.slot - b.slot);
  };
  KK.on('dirty', () => { if (W.heroes.length) W.syncHeroes(false); });

  const alive = (arr) => arr.filter((e) => !e.dead);
  W.frontHero = () => { for (const h of W.heroes) if (!h.dead) return h; return null; };
  W.frontEnemy = () => { let f = null; for (const e of W.enemies) if (!e.dead && e.active && (!f || e.x < f.x)) f = e; return f; };

  // ---------------------------------------------------------------- spawning
  function makeEnemy(key, x, floor, opts = {}) {
    const def = D.MONSTERS[key];
    const isBoss = !!def.boss;
    const hp = F.enemyHp(floor) * def.hp * (isBoss ? 9 : 1) * (opts.hpMult || 1);
    const e = {
      kind: 'enemy', key, def, uid: W.id++, x, y: GROUND - (def.fly ? 9 : 0),
      hp, maxHp: hp, atk: F.enemyAtk(floor) * def.atk * (isBoss ? 2.4 : 1),
      gold: F.enemyGold(floor) * def.gold * (isBoss ? 14 : 1),
      atkT: U.rand(0.6, 1.4), atkSpd: isBoss ? 1.6 : 1.3,
      boss: isBoss, dead: false, active: false, flash: 0, kb: 0, stun: 0, anim: Math.random() * 10, spawnT: 0, lunge: 0, hits: 0,
    };
    W.enemies.push(e);
    return e;
  }

  W.spawnWave = function () {
    const S = KK.S, f = S.floor, b = F.biomeOf(f);
    const x0 = W.partyX + SPAWN_AHEAD;
    if (F.isBossFloor(f) && W.wave === W.waves - 1) {
      const key = F.bossFor(f);
      const boss = makeEnemy(key, x0 + 20, f);
      if (f >= 70 && key !== 'hollow') { boss.def = Object.assign({}, boss.def, { name: 'Hollowed ' + boss.def.name }); boss.hollowed = true; }
      W.boss = boss;
      const minions = Math.min(2, Math.floor(f / 20));
      for (let i = 0; i < minions; i++) makeEnemy(U.pick(b.monsters), x0 - 14 - i * 14, f);
      W.bossIntro = 2.2;
      KK.emit('bossSpawn', { boss });
    } else {
      const depth = f - b.from;
      const pool = b.monsters.slice(0, Math.min(b.monsters.length, 1 + Math.floor(depth / 3)));
      const n = 1 + Math.floor(Math.random() * Math.min(3, 1 + f / 7));
      for (let i = 0; i < n; i++) makeEnemy(U.pick(pool), x0 + i * 15 + U.rand(0, 4), f);
    }
    W.wave++;
    KK.emit('wave', { wave: W.wave });
  };

  // ---------------------------------------------------------------- damage
  function heroDamage(h, mult = 1) {
    const S = KK.S, m = KK.mods();
    let dmg = F.heroDmg(h.id, S.heroes[h.id]) * m.dmg * KK.powerMult() * mult;
    if (h.id === 'knight') dmg *= m.knightDmg;
    const crit = Math.random() < m.crit;
    if (crit) dmg *= m.critMult;
    return { dmg, crit };
  }

  W.damageEnemy = function (e, dmg, opts = {}) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.09;
    e.kb = Math.min(4, e.kb + (opts.kb !== undefined ? opts.kb : (opts.crit ? 3 : 1.5)));
    e.hits++;
    if (opts.src) {
      const m = KK.mods();
      if (m.lifesteal > 0 && !opts.src.dead) opts.src.hp = Math.min(opts.src.maxHp, opts.src.hp + dmg * m.lifesteal);
    }
    KK.emit('hit', { e, dmg, crit: opts.crit, ult: opts.ult, src: opts.src });
    if (e.hp <= 0) W.killEnemy(e);
  };

  W.killEnemy = function (e) {
    const S = KK.S, m = KK.mods();
    e.dead = true; e.hp = 0;
    const gold = e.gold * m.gold;
    KK.gainGold(gold, 'kill');
    S.stats.kills++;
    if (e.boss) {
      S.stats.bossKills++;
      W.boss = null;
      S.bossBlock = 0;
      KK.actions.rollRelics();
    }
    KK.emit('kill', { e, gold });
  };

  W.damageHero = function (h, dmg, src) {
    if (h.dead) return;
    h.hp -= dmg;
    h.flash = 0.1;
    KK.emit('heroHit', { h, dmg, src });
    if (h.hp <= 0) {
      h.hp = 0; h.dead = true;
      KK.emit('heroDown', { h });
      if (!W.heroes.some((x) => !x.dead)) W.wipe();
    }
  };

  W.healHero = function (h, amt, src) {
    if (h.dead) return;
    const before = h.hp;
    h.hp = Math.min(h.maxHp, h.hp + amt);
    if (h.hp > before) KK.emit('heal', { h, amt: h.hp - before, src });
  };

  W.wipe = function () {
    if (W.wipeT > 0) return;
    const S = KK.S;
    W.wipeT = 2.4;
    S.stats.wipes++;
    if (F.isBossFloor(S.floor)) S.bossBlock = S.floor;
    KK.emit('wipe', { floor: S.floor });
  };

  // ---------------------------------------------------------------- ultimates
  W.ultTurn = 'knight';
  W.passUlt = function () {
    const ids = W.heroes.map((h) => h.id);
    if (!ids.length) return;
    const i = ids.indexOf(W.ultTurn);
    W.ultTurn = ids[(i + 1) % ids.length];
  };
  W.castUlt = function (h, free) {
    const S = KK.S, m = KK.mods();
    const def = D.HEROES[h.id];
    if (!free) {
      const cost = Math.ceil(def.ult.cost * m.ultCost);
      S.sparks -= cost;
      S.embers = (S.embers || 0) + cost * 0.25; // every 4 Sparks spent bank 1 permanent Ember (Workshop currency)
      h.ultCd = def.ult.cd;
      W.ultGap = 1.1;
    }
    S.stats.ults++;
    const cast = () => {
      const pow = m.ultPow;
      const targets = alive(W.enemies).filter((e) => e.active);
      if (h.id === 'knight') {
        h.jump = 0.55;
        W.shots.push({ type: 'slam', x: h.x + 10, y: GROUND, t: 0.5, src: h, pow });
      } else if (h.id === 'archer') {
        for (let i = 0; i < 8; i++) {
          const tgt = targets.length ? U.pick(targets) : null;
          const tx = tgt ? tgt.x + U.rand(-3, 3) : h.x + U.rand(40, 90);
          W.shots.push({ type: 'skyarrow', x: tx - 30, y: -10, tx, ty: GROUND - 4, delay: i * 0.09, speed: 260, src: h, pow, mult: 1.5 });
        }
      } else if (h.id === 'mage') {
        let best = targets[0], bestN = -1;
        for (const t of targets) { const n = targets.filter((o) => Math.abs(o.x - t.x) < 30).length; if (n > bestN) { bestN = n; best = t; } }
        const tx = best ? best.x : h.x + 80;
        W.shots.push({ type: 'meteor', x: tx + 70, y: -30, tx, ty: GROUND - 3, delay: 0.25, speed: 170, src: h, pow, mult: 8 });
      } else if (h.id === 'cleric') {
        for (const o of W.heroes) {
          if (o.dead) { o.dead = false; o.hp = o.maxHp * 0.6; KK.emit('revive', { h: o }); }
          else W.healHero(o, o.maxHp, h);
        }
      }
      h.cast = 0.4;
      KK.emit('ult', { h, id: h.id });
    };
    cast();
    if (Math.random() < m.echo) {
      W.shots.push({ type: 'echo', t: 0.7, fn: cast });
      KK.emit('echo', { h });
    }
  };

  KK.on('hotkey', () => {
    const living = W.heroes.filter((h) => !h.dead);
    if (living.length && W.enemies.some((e) => !e.dead && e.active)) W.castUlt(U.pick(living), true);
  });

  // ---------------------------------------------------------------- main update
  W.update = function (dt) {
    const S = KK.S, m = KK.mods();
    W.t += dt;
    KK.simTime = (KK.simTime || 0) + dt;
    S.stats.playTime += dt;
    KK.tickFervor(dt);
    W.secAcc += dt;
    while (W.secAcc >= 1) { W.secAcc -= 1; KK.tickIncome(); }
    if (m.auto) { W.autoAcc += dt; if (W.autoAcc > 0.5) { W.autoAcc = 0; autoBuy(); } }

    const pm = KK.powerMult();
    const speedMult = 1 + (pm - 1) * 0.5;
    W.ultGap = Math.max(0, W.ultGap - dt);
    if (W.bossIntro > 0) W.bossIntro -= dt;

    // golden rat event
    W.nextRat -= dt;
    if (W.nextRat <= 0 && !W.rat) { W.spawnRat(); W.nextRat = U.rand(180, 340); }
    if (W.rat) {
      W.rat.x -= W.rat.speed * dt; W.rat.t += dt;
      if (W.rat.t > W.rat.life) W.rat = null;
    }

    // floor transition / wipe states
    if (W.trans > 0) {
      W.trans -= dt;
      if (W.trans <= 0.45 && !W.transFloorDone) { W.transFloorDone = true; W.nextFloor(); }
      walkParty(dt, speedMult * 0.8, true);
      updateHeroAnims(dt);
      return;
    }
    if (W.wipeT > 0) {
      W.wipeT -= dt;
      updateHeroAnims(dt);
      updateEnemies(dt, true);
      if (W.wipeT <= 0) W.recover();
      return;
    }

    const front = W.frontHero();
    const fe = W.frontEnemy();

    // activate enemies the party can "see"
    for (const e of W.enemies) {
      if (!e.dead && !e.active && e.x - W.partyX < SPAWN_AHEAD + 30) { e.active = true; }
      if (e.spawnT < 1) e.spawnT += dt * 2.5;
    }

    // movement
    let engaged = false;
    if (fe && front) {
      const frontOffset = front.slot * SLOT;
      const stopAt = fe.x - fe.def.w / 2 - 7 + frontOffset;
      if (W.partyX < stopAt) walkParty(dt, speedMult, false, stopAt);
      else engaged = true;
    } else if (W.chest && !W.chest.opened) {
      const stopAt = W.chest.x - 12;
      if (W.partyX < stopAt) walkParty(dt, speedMult, false, stopAt);
      else { W.chest.openT += dt; if (W.chest.openT > 0.5) openChest(); }
    } else if (W.door) {
      walkParty(dt, speedMult);
      if (W.partyX >= W.door.x - 4) { W.trans = 0.9; W.transFloorDone = false; KK.emit('door'); }
    } else if (!W.enemies.some((e) => !e.dead)) {
      // between waves
      W.enemies = W.enemies.filter((e) => !e.dead || e.deathT < 1);
      if (W.wave < W.waves) {
        if (W.wave > 0 && !W.chestRolled && !F.isBossFloor(S.floor) && Math.random() < m.chest) {
          W.chest = { x: W.partyX + 60, opened: false, openT: 0, t: 0 };
          W.props.push(W.chest);
        }
        W.chestRolled = true;
        if (!W.chest || W.chest.opened) { W.spawnWave(); W.chestRolled = false; }
      } else {
        W.door = { x: W.partyX + 85, t: 0 };
        KK.emit('floorClear', { floor: S.floor });
      }
      walkParty(dt, speedMult);
    } else {
      walkParty(dt, speedMult);
    }

    // heroes
    const turnHolder = W.heroes.find((h) => h.id === W.ultTurn);
    if (!turnHolder || turnHolder.dead) W.passUlt();
    for (const h of W.heroes) {
      if (h.dead) continue;
      const def = D.HEROES[h.id];
      h.ultCd = Math.max(0, h.ultCd - dt);
      // regen when out of combat
      if (!engaged && !fe) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.06 * dt);

      // ultimates (fueled by sparks), taken in turns so the cheap Earthshatter can't starve
      // Meteor and Sanctuary: the hero whose turn it is saves up; a hero with nothing to do passes.
      if (W.ultGap <= 0 && W.ultTurn === h.id) {
        const cost = Math.ceil(def.ult.cost * m.ultCost);
        let want = false;
        if (h.id === 'cleric') want = W.heroes.some((o) => o.dead || o.hp / o.maxHp < 0.55);
        else want = W.enemies.some((e) => !e.dead && e.active && e.x - h.x <= Math.max(def.range, 60));
        if (!want || h.ultCd > 0) W.passUlt();
        else if (S.sparks >= cost) { W.castUlt(h); W.passUlt(); }
      }

      h.atkT -= dt * m.aspd * speedMult;
      if (h.atkT > 0) continue;
      if (def.role === 'healer') {
        let low = null;
        for (const o of W.heroes) if (!o.dead && o.hp / o.maxHp < 0.92 && (!low || o.hp / o.maxHp < low.hp / low.maxHp)) low = o;
        if (low) {
          const amt = F.heroDmg('cleric', S.heroes.cleric) * 3.2 * m.dmg * pm;
          W.healHero(low, amt, h);
          h.cast = 0.3;
          KK.emit('healBeam', { from: h, to: low });
          h.atkT = def.spd;
          continue;
        }
      }
      const tgt = targetInRange(h.x, def.range + (def.role === 'melee' ? 0 : 0));
      if (!tgt) { h.atkT = 0; continue; }
      const { dmg, crit } = heroDamage(h);
      if (def.role === 'melee') {
        h.lunge = 0.15;
        W.damageEnemy(tgt, dmg, { crit, src: h });
        KK.emit('swing', { h, crit });
      } else if (def.role === 'ranged') {
        W.shots.push({ type: 'arrow', x: h.x + 6, y: GROUND - 9, target: tgt, dmg, crit, speed: 210, src: h });
        h.cast = 0.15;
        KK.emit('shoot', { h });
      } else if (def.role === 'caster') {
        W.shots.push({ type: 'fireball', x: h.x + 8, y: GROUND - 14, target: tgt, dmg, crit, speed: 120, src: h, splash: def.splash });
        h.cast = 0.3;
        KK.emit('cast', { h });
      } else if (def.role === 'healer') {
        W.shots.push({ type: 'holy', x: h.x + 6, y: GROUND - 10, target: tgt, dmg, crit, speed: 150, src: h });
        h.cast = 0.2;
      }
      h.atkT = def.spd;
    }

    updateEnemies(dt, false);
    updateShots(dt);
    updateHeroAnims(dt);
    for (const p of W.props) p.t = (p.t || 0) + dt;
    W.props = W.props.filter((p) => p.x > W.partyX - 400);
  };

  function targetInRange(x, range) {
    let best = null;
    for (const e of W.enemies) {
      if (e.dead || !e.active) continue;
      const d = e.x - e.def.w / 2 - x;
      if (d <= range && d > -20 && (!best || e.x < best.x)) best = e;
    }
    return best;
  }

  function walkParty(dt, speedMult, free, stopAt) {
    const m = KK.mods();
    const v = 24 * m.walk * speedMult;
    let nx = W.partyX + v * dt;
    if (stopAt !== undefined && nx > stopAt) nx = Math.max(W.partyX, stopAt);
    W.walking = nx > W.partyX + 0.0001;
    W.partyX = nx;
  }

  function updateHeroAnims(dt) {
    for (const h of W.heroes) {
      const target = W.partyX - h.slot * SLOT;
      h.x += (target - h.x) * Math.min(1, dt * 6);
      if (W.walking && !h.dead) h.anim += dt * 7;
      h.flash = Math.max(0, h.flash - dt);
      h.lunge = Math.max(0, h.lunge - dt);
      h.cast = Math.max(0, h.cast - dt);
      if (h.jump > 0) h.jump -= dt;
      if (h.joined > 0) h.joined -= dt;
    }
  }

  function updateEnemies(dt, frozen) {
    const front = W.frontHero();
    const act = W.enemies.filter((e) => !e.dead && e.active).sort((a, b) => a.x - b.x);
    let prevX = -Infinity;
    for (const e of act) {
      e.anim += dt * (e.def.fly ? 9 : 5);
      e.flash = Math.max(0, e.flash - dt);
      e.lunge = Math.max(0, e.lunge - dt);
      if (e.kb > 0) { e.x += e.kb * 6 * dt * 4; e.kb = Math.max(0, e.kb - dt * 16); }
      if (e.stun > 0) { e.stun -= dt; prevX = e.x; continue; }
      if (frozen || !front) { prevX = e.x; continue; }
      const reach = front.x + e.def.w / 2 + e.def.range;
      const limit = Math.max(reach, prevX + 12);
      if (e.x > limit) { e.x = Math.max(limit, e.x - e.def.speed * dt); e.moving = true; }
      else e.moving = false;
      prevX = e.x;
      e.atkT -= dt;
      if (e.atkT <= 0 && e.x - front.x <= e.def.w / 2 + e.def.range + 3) {
        e.atkT = e.atkSpd * U.rand(0.9, 1.1);
        if (e.def.ranged) {
          W.shots.push({ type: e.def.ranged === 'beam' ? 'ebeam' : 'efire', x: e.x - 6, y: e.y - 6, target: front, dmg: e.atk, speed: 110, src: e, enemy: true });
        } else {
          e.lunge = 0.15;
          // bosses slam the whole party every 4th attack
          e.swings = (e.swings || 0) + 1;
          if (e.boss && e.swings % 4 === 0) {
            for (const h of W.heroes) if (!h.dead) W.damageHero(h, e.atk * 0.6, e);
            KK.emit('bossSlam', { e });
          } else {
            W.damageHero(front, e.atk, e);
          }
        }
      }
    }
    for (const e of W.enemies) if (e.dead) e.deathT = (e.deathT || 0) + dt;
  }

  function updateShots(dt) {
    const out = [];
    for (const s of W.shots) {
      if (s.delay > 0) { s.delay -= dt; out.push(s); continue; }
      if (s.type === 'echo') { s.t -= dt; if (s.t <= 0) s.fn(); else out.push(s); continue; }
      if (s.type === 'slam') {
        s.t -= dt;
        if (s.t <= 0) {
          for (const e of W.enemies) if (!e.dead && e.active && Math.abs(e.x - s.x) < 70) {
            const { dmg, crit } = heroDamage(s.src, 4 * s.pow);
            e.stun = 1.0;
            W.damageEnemy(e, dmg, { crit, ult: true, src: s.src, kb: 4 });
          }
          KK.emit('slamLand', { x: s.x });
        } else out.push(s);
        continue;
      }
      if (s.type === 'skyarrow' || s.type === 'meteor') {
        const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
        const step = s.speed * dt;
        if (d <= step) {
          const radius = s.type === 'meteor' ? 38 : 8;
          for (const e of W.enemies) if (!e.dead && e.active && Math.abs(e.x - s.tx) < radius + e.def.w / 2) {
            const { dmg, crit } = heroDamage(s.src, s.mult * s.pow);
            W.damageEnemy(e, dmg, { crit, ult: true, src: s.src, kb: s.type === 'meteor' ? 4 : 1 });
          }
          KK.emit(s.type === 'meteor' ? 'meteorLand' : 'skyarrowLand', { x: s.tx, y: s.ty });
        } else { s.x += (dx / d) * step; s.y += (dy / d) * step; out.push(s); }
        continue;
      }
      // homing projectiles
      const t = s.target;
      if (!t || t.dead) { KK.emit('fizzle', { s }); continue; }
      const tx = t.x, ty = (t.y || GROUND) - (t.kind === 'hero' ? 8 : (t.def.h / 2));
      const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
      const step = s.speed * dt;
      if (d <= step + 2) {
        if (s.enemy) W.damageHero(t, s.dmg, s.src);
        else {
          W.damageEnemy(t, s.dmg, { crit: s.crit, src: s.src });
          if (s.splash) {
            for (const e of W.enemies) if (e !== t && !e.dead && e.active && Math.abs(e.x - t.x) < 22) W.damageEnemy(e, s.dmg * s.splash, { src: s.src, kb: 1 });
            KK.emit('explode', { x: t.x, y: ty });
          }
        }
      } else { s.x += (dx / d) * step; s.y += (dy / d) * step; s.vx = dx / d; s.vy = dy / d; out.push(s); }
    }
    W.shots = out;
  }

  function openChest() {
    const S = KK.S, m = KK.mods();
    W.chest.opened = true;
    const gold = F.enemyGold(S.floor) * 10 * m.gold;
    KK.gainGold(gold, 'chest');
    S.stats.chests++;
    KK.emit('chest', { x: W.chest.x, gold });
    W.chest = null;
  }

  W.nextFloor = function () {
    const S = KK.S;
    S.floor++;
    if (S.floor > S.maxFloorRun) S.maxFloorRun = S.floor;
    if (S.floor > S.maxFloorEver) S.maxFloorEver = S.floor;
    W.wave = 0; W.door = null; W.chest = null; W.chestRolled = false;
    W.enemies = []; W.shots = [];
    for (const h of W.heroes) if (h.dead) { h.dead = false; h.hp = h.maxHp * 0.5; }
    KK.emit('floor', { floor: S.floor, biomeChange: F.biomeOf(S.floor) !== F.biomeOf(S.floor - 1), boss: F.isBossFloor(S.floor) });
  };

  // a Head Start bought at the very start of a delve moves the party down right away
  KK.on('jumpFloor', ({ floor }) => {
    W.wave = 0; W.door = null; W.chest = null; W.chestRolled = false; W.boss = null;
    W.enemies = []; W.shots = [];
    KK.emit('floor', { floor, biomeChange: true, boss: F.isBossFloor(floor) });
  });

  W.recover = function () {
    const S = KK.S;
    S.floor = Math.max(1, S.floor - 1);
    W.wave = 0; W.door = null; W.chest = null; W.boss = null; W.chestRolled = false;
    W.enemies = []; W.shots = [];
    for (const h of W.heroes) { h.dead = false; h.hp = h.maxHp; }
    KK.emit('recovered', { floor: S.floor });
  };

  W.spawnRat = function () {
    const view = KK.view ? KK.view : { left: W.partyX - 200, right: W.partyX + 400 };
    W.rat = { x: view.right + 20, y: GROUND + 2, speed: 28, t: 0, life: ((view.right - view.left) + 60) / 28 };
    KK.emit('ratSpawn');
  };
  W.catchRat = function () {
    if (!W.rat) return false;
    const S = KK.S, m = KK.mods();
    const gold = Math.max(S.incomeRate * 75, F.enemyGold(S.floor) * 25 * m.gold);
    const sparks = Math.min(m.sparkCap - S.sparks, 60);
    KK.gainGold(gold, 'rat');
    S.sparks += Math.max(0, sparks);
    S.stats.rats++;
    KK.emit('ratCaught', { x: W.rat.x, y: W.rat.y, gold, sparks });
    W.rat = null;
    return true;
  };

  /** Click/tap on an enemy: a small poke so clicks feel physical. */
  W.poke = function (wx, wy) {
    for (const e of W.enemies) {
      if (e.dead || !e.active) continue;
      if (Math.abs(wx - e.x) < e.def.w / 2 + 2 && wy > e.y - e.def.h - 2 && wy < e.y + 3) {
        const h = W.frontHero();
        if (!h) return false;
        const { dmg, crit } = heroDamage(h, 0.6);
        W.damageEnemy(e, dmg, { crit, kb: 2 });
        KK.emit('poke', { e });
        return true;
      }
    }
    return false;
  };

  function autoBuy() {
    const S = KK.S, A = KK.actions;
    if (S.settings.autoLevel === false) return;
    // saving up for a hero you can already recruit? leave the gold alone
    if (D.PARTY_ORDER.some((id) => A.canRecruit(id) && S.gold < A.recruitCost(id))) return;
    // frugal: only levels that cost at most 10% of current gold, cheapest first
    for (let i = 0; i < 20; i++) {
      let best = null, bestC = Infinity;
      for (const id of D.PARTY_ORDER) {
        if (!S.heroes[id]) continue;
        const c = F.levelCost(id, S.heroes[id]);
        if (c < bestC) { bestC = c; best = id; }
      }
      if (!best || bestC > S.gold * 0.1) break;
      A.levelHero(best, 1);
    }
  }
})();
