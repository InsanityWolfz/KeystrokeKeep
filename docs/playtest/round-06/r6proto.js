// Round 06 auditor: in-memory prototypes (monkey-patches on the private headless KK; js/ is never touched).
//   enrage  : fix the dead 3-min enrage (W.wipeT ends slightly negative after the first wipe, so !W.wipeT is false forever)
//   reass   : Bone King bone pile is untargetable for its 1.5 s (as designed in R5), so the rise is actually seen
//   rat     : Rat King  Royal Summons  (first 1.0 s, every 9 s, 2 rats hp x0.35 atk x0.6 gold x0.5, max 4 alive)
//   web     : Brood Mother Web Shot   (first 1.5 s, every 7 s, back-most hero, 0.3x atk, webbed 2.5 s: no attacks/heals)
//   shell   : Ember Colossus Magma Shell (first 1.0 s, every 12 s, normal hits x0.3 for up to 5 s, any ult cracks: stun 1 s)
//   lava    : Magma Lord Lava Rain    (first 1.0 s, every 8 s, 3 marks on random heroes, 0.9 s warning, 0.8x atk each)
//   sig     : rat+web+shell+lava
//   omen    : Omen of the Day (one star omen per day; reach record-15 under it: +10 Renown + a Seal; free daily re-delve when walled)
//   lantern : Void Lantern (Workshop: -8% void slam damage per level, max 5, 4000 x 1.8^l Embers)
//   tro     : depth trophies every 10 floors past 150 (160..200), x1.05 like the others
//   fixes   : enrage+reass ; week2 : omen+lantern+tro ; all : everything
// Numbers can be overridden with --bal-style args: --shellMult 0.3 --shellDur 5 --lavaMult 0.8 --webDur 2.5 --day 8 --sealGap 15
function expand(list) {
  const out = new Set();
  for (const x of list) {
    if (x === 'sig') ['rat', 'web', 'shell', 'lava'].forEach((y) => out.add(y));
    else if (x === 'fixes2') ['enrage2', 'reass'].forEach((y) => out.add(y));
    else if (x === 'fixes') ['enrage', 'reass'].forEach((y) => out.add(y));
    else if (x === 'week2') ['omen', 'lantern', 'tro'].forEach((y) => out.add(y));
    else if (x === 'all') ['enrage', 'reass', 'rat', 'web', 'shell', 'lava', 'omen', 'lantern', 'tro'].forEach((y) => out.add(y));
    else out.add(x);
  }
  return out;
}

function options(list, args = {}) {
  const on = expand(list);
  const N = {
    ratFirst: +args.ratFirst || 0.8, ratMode: args.ratMode || 'timer', ratTh: [0.6, 0.3], ratEvery: 9, ratHp: 0.35, ratAtk: 0.6, ratGold: 0.5, ratMax: 4,
    webFirst: +args.webFirst || 1.0, webEvery: 7, webAtk: 0.3, webDur: +args.webDur || 2.5, webFly: 0.5,
    shellFirst: args.shellFirst !== undefined ? +args.shellFirst : 0.01, shellEvery: 12, shellMult: args.shellMult !== undefined ? +args.shellMult : 0.3, shellDur: +args.shellDur || 5, crackStun: 1.0,
    lavaFirst: +args.lavaFirst || 1.0, lavaEvery: 8, lavaN: 3, lavaWarn: 0.9, lavaMult: args.lavaMult !== undefined ? +args.lavaMult : 0.8,
    day: (+args.day || 8) * 3600, sealGap: +args.sealGap || 15, sealRenown: 10,
    lanternStep: 0.08, dodge: !!args.dodge, enrHp: args.enrHp !== undefined ? +args.enrHp : 0.5, enrCap: +args.enrCap || 420,
  };
  return { sigEvents: ['royalSummons', 'webShot', 'webbed', 'shellUp', 'shellCrack', 'lavaWarn', 'lavaLand', 'seal', 'dailyRedelve', 'sigCollide'], patch: (KK, hooks) => patch(KK, hooks, on, N) };
}

function patch(KK, hooks, on, N) {
  const W = KK.world, D = KK.DATA, F = KK.F, U = KK.U, A = KK.actions;
  const S = () => KK.S;
  const P = { summons: 0, summonKills: 0, webs: 0, webbedT: 0, shells: 0, cracks: 0, shellTimeouts: 0, lavaDrops: 0, lavaDmg: 0, collide: 0, sigWarns: 0, seals: [], redelves: 0, lantern: [], voidDmgSaved: 0, sealTimes: [] };
  const GROUND = W.GROUND;
  let lastVoidWarn = -99, lastSigWarn = -99;
  const now = () => hooks.time();
  KK.on('voidWarn', () => { lastVoidWarn = now(); if (now() - lastSigWarn < 1.2) { P.collide++; KK.emit('sigCollide'); } });
  const sigWarn = (name, data) => { lastSigWarn = now(); P.sigWarns++; if (now() - lastVoidWarn < 1.2) { P.collide++; KK.emit('sigCollide'); } KK.emit(name, data); };

  // ---------------- fixes
  if (on.has('enrage')) hooks.tick.push(() => { if (W.wipeT < 0) W.wipeT = 0; });
  // enrage2: the bug fix plus a softer rule: at 180 s retreat only if the boss still has > enrHp of its HP; always at enrCap s
  if (on.has('enrage2')) hooks.tick.push((dt) => {
    if (W.wipeT < 0) W.wipeT = 0;
    const e = W.boss;
    if (!e || e.dead || !e.active || W.wipeT > 0 || W.trans > 0) return;
    e.fightT = 0; // keep the native 180 s check from firing
    e.myFight = (e.myFight || 0) + dt;
    if ((e.myFight > 180 && e.hp / e.maxHp > N.enrHp) || e.myFight > N.enrCap) { KK.emit('bossEnrage', { e }); W.wipe(); }
  });
  if (on.has('reass')) {
    KK.on('reassemble', ({ e }) => { e.pile = 1.5; });
    hooks.tick.push((dt) => { for (const e of W.enemies) if (e.pile > 0) e.pile -= dt; });
  }
  const origDE = W.damageEnemy;
  W.damageEnemy = function (e, dmg, opts = {}) {
    if (e.pile > 0) return; // bone pile: untargetable
    if (e.shell > 0) {
      if (opts.ult) { e.shell = 0; e.stun = Math.max(e.stun || 0, N.crackStun); P.cracks++; KK.emit('shellCrack', { e }); }
      else dmg *= N.shellMult;
    }
    return origDE.call(this, e, dmg, opts);
  };

  // ---------------- signature engine (runs after each W.update; mirrors the War Charge timer: counts only while engaged & not stunned)
  const SIG = {};
  if (on.has('rat')) SIG.ratking = { first: N.ratFirst, every: N.ratEvery, fire: summons };
  if (on.has('web')) SIG.broodmother = { first: N.webFirst, every: N.webEvery, fire: webShot };
  if (on.has('shell')) SIG.embergolem = { first: N.shellFirst, every: N.shellEvery, fire: shellUp };
  if (on.has('lava')) SIG.magmalord = { first: N.lavaFirst, every: N.lavaEvery, fire: lavaRain };
  const pend = []; // {t, fn}
  hooks.tick.push((dt) => {
    const e = W.boss;
    for (let i = pend.length - 1; i >= 0; i--) { pend[i].t -= dt; if (pend[i].t <= 0) { const p = pend.splice(i, 1)[0]; if (p.e && !p.e.dead && W.wipeT <= 0 && W.trans <= 0) p.fn(); } }
    for (const h of W.heroes) if (h.webbed > 0) { h.webbed -= dt; if (!h.dead) { h.atkT = Math.max(h.atkT, 0.2); P.webbedT += dt; } }
    for (const x of W.enemies) if (x.shell > 0) { x.shell -= dt; if (x.shell <= 0) P.shellTimeouts++; }
    if (!e || e.dead || !e.active || W.wipeT > 0 || W.trans > 0) return;
    const sig = SIG[e.key];
    if (!sig) return;
    const front = W.frontHero();
    if (!front) return;
    if (e.stun > 0 || e.pile > 0) return;
    // timers run from activation (boss on screen), so a 2-second typist fight still sees the opener
    // Rat King (ratMode=hp): opener, then one wave at each HP threshold (bounded: fights can't spiral)
    if (e.key === 'ratking' && N.ratMode === 'hp') {
      if (e.sgT === undefined) e.sgT = sig.first;
      if (e.sgT > 0) { e.sgT -= dt; if (e.sgT <= 0) sig.fire(e); return; }
      e.ratTh = e.ratTh || 0;
      if (e.ratTh < N.ratTh.length && e.hp / e.maxHp <= N.ratTh[e.ratTh]) { e.ratTh++; sig.fire(e); }
      return;
    }
    e.sgT = (e.sgT === undefined ? sig.first : e.sgT) - dt;
    // dodge: never land a move inside the void slam's warning window (Hollowed fights run both timers)
    if (N.dodge && e.voidT !== undefined && e.sgT <= 0 && e.voidT < 1.6) { e.sgT = e.voidT + 1.2; return; }
    if (e.sgT <= 0) { e.sgT = sig.every; sig.fire(e); }
  });

  function makeSummon(boss, x) {
    const def = D.MONSTERS.rat, em = KK.mods(), f = S().floor;
    const hp = F.enemyHp(f) * def.hp * em.eHp * N.ratHp;
    const r = { kind: 'enemy', key: 'rat', def, uid: W.id++, x, y: GROUND, hp, maxHp: hp, atk: F.enemyAtk(f) * def.atk * em.eAtk * N.ratAtk, gold: F.enemyGold(f) * def.gold * N.ratGold, atkT: U.rand(0.6, 1.4), atkSpd: 1.3, boss: false, dead: false, active: true, flash: 0, kb: 0, stun: 0, anim: Math.random() * 10, spawnT: 0, lunge: 0, hits: 0, summon: true };
    W.enemies.push(r);
    P.summons++;
  }
  KK.on('kill', ({ e }) => { if (e.summon) P.summonKills++; });
  function summons(e) {
    const alive = W.enemies.filter((x) => x.summon && !x.dead).length;
    const n = Math.min(2, N.ratMax - alive);
    if (n <= 0) return;
    sigWarn('royalSummons', { e });
    for (let i = 0; i < n; i++) makeSummon(e, e.x - 12 - i * 12);
  }
  function webShot(e) {
    const back = W.heroes.filter((h) => !h.dead).sort((a, b) => b.slot - a.slot)[0];
    if (!back) return;
    sigWarn('webShot', { e, h: back });
    P.webs++;
    pend.push({ e, t: N.webFly, fn: () => { if (back.dead) return; W.damageHero(back, e.atk * N.webAtk, e); back.webbed = N.webDur; KK.emit('webbed', { h: back }); } });
  }
  function shellUp(e) { sigWarn('shellUp', { e }); e.shell = N.shellDur; P.shells++; }
  function lavaRain(e) {
    const living = W.heroes.filter((h) => !h.dead);
    if (!living.length) return;
    sigWarn('lavaWarn', { e });
    for (let i = 0; i < N.lavaN; i++) {
      const h = living[Math.floor(Math.random() * living.length)];
      pend.push({ e, t: N.lavaWarn + i * 0.12, fn: () => { if (h.dead) return; const d = e.atk * N.lavaMult; W.damageHero(h, d, e); P.lavaDrops++; P.lavaDmg += d; KK.emit('lavaLand', { h }); } });
    }
  }

  // ---------------- Void Lantern
  if (on.has('lantern')) {
    D.WORKSHOP.push({ id: 'lantern', name: 'Void Lantern', icon: 'candle', base: 4000, growth: 1.8, max: 5, desc: (l) => `Void slams deal ${8 * l}% less damage`, apply: (m, l) => { m.voidDmg = (m.voidDmg || 1) * (1 - N.lanternStep * l); } });
    const origDH = W.damageHero;
    W.damageHero = function (h, dmg, src) {
      if (src && src.boss && dmg === h.maxHp * 0.55) { const m = KK.mods().voidDmg || 1; P.voidDmgSaved += dmg * (1 - m); dmg *= m; }
      return origDH.call(this, h, dmg, src);
    };
    KK.on('upgrade', ({ store, id, lvl }) => { if (store === 'workshop' && id === 'lantern') { P.lantern.push({ t: now(), lvl }); hooks.beat('LANTERN', 'void lantern ' + lvl); } });
  }

  // ---------------- trophies past 150
  if (on.has('tro')) {
    for (const f of [160, 170, 180, 190, 200]) D.TROPHIES.push(f);
    KK.on('trophy', ({ floor }) => { if (floor > 150) hooks.beat('TROPHY2', 'trophy f' + floor); });
  }

  // ---------------- Omen of the Day
  if (on.has('omen')) {
    const day = () => Math.floor(now() / N.day);
    const starOf = (d) => D.OMENS[((d * 2654435761) >>> 0) % D.OMENS.length].id; // stand-in for a hash of the local date
    const target = () => Math.max(40, (S().renownFloor || 0) - N.sealGap);
    const unclaimed = () => S().sealDay !== day();
    const origRetire = A.retire;
    A.retire = function () {
      const r = origRetire.apply(this, arguments);
      const s = S();
      if (r && s.omenOffer && unclaimed()) {
        const star = starOf(day());
        if (!s.omenOffer.includes(star)) s.omenOffer[0] = star;
        s.omenStar = star; s.starDay = day();
      }
      return r;
    };
    // free re-delve once a day when walled: the player can take today's star omen without a record
    const origCanRedelve = A.canRedelve;
    A.canRedelve = () => origCanRedelve() || (!KK.DEMO_CAP && S().retires >= 2 && unclaimed() && A.renownGain() <= 0);
    hooks.pickOmen = (offer) => (S().omenStar && offer.includes(S().omenStar) && unclaimed() ? S().omenStar : undefined);
    let lastRec = 0, lastRecT = 0;
    hooks.glance.push((t) => {
      const s = S();
      if (s.maxFloorRun > lastRec) { lastRec = s.maxFloorRun; lastRecT = t; }
      // walled (no Renown to earn) for 30+ min, today's seal not claimed and not already under the star: take the free re-delve
      if (A.renownGain() <= 0 && unclaimed() && s.retires >= 2 && !(s.omen && s.omen === s.omenStar && s.starDay === day()) && t - lastRecT > 1800) {
        const r = A.retire();
        if (r) { W.reset(); P.redelves++; KK.emit('dailyRedelve'); lastRec = 0; lastRecT = t; if (s.omenOffer) { const id = hooks.pickOmen(s.omenOffer); A.pickOmen(id !== undefined ? id : s.omenOffer[0]); } }
      }
    });
    KK.on('floor', ({ floor }) => {
      const s = S();
      if (s.omen && s.omen === s.omenStar && s.starDay === day() && unclaimed() && floor >= target()) {
        s.sealDay = day(); s.seals = (s.seals || 0) + 1;
        s.renown += N.sealRenown; s.renownLifetime += N.sealRenown; KK.dirty();
        P.seals.push({ t: now(), floor, runT: s.runTime || 0 });
        hooks.beat('SEAL', 'omen of the day seal #' + s.seals + ' (f' + floor + ', ' + ((s.runTime || 0) / 60).toFixed(0) + ' min into the delve)');
        KK.emit('seal');
      }
    });
  }

  hooks.end.push((R) => {
    const H = 3600, f1 = (x) => x.toFixed(1);
    R.proto.push(`on: ${[...on].join(',')}  N=${JSON.stringify(N)}`);
    if (on.has('rat')) R.proto.push(`rat summons ${P.summons} spawned, ${P.summonKills} killed`);
    if (on.has('web')) R.proto.push(`webs ${P.webs}, hero-seconds webbed ${f1(P.webbedT)}`);
    if (on.has('shell')) R.proto.push(`shells ${P.shells}, cracked by ults ${P.cracks} (${(100 * P.cracks / Math.max(1, P.shells)).toFixed(0)}%), timed out ${P.shellTimeouts}`);
    if (on.has('lava')) R.proto.push(`lava drops landed ${P.lavaDrops}`);
    R.proto.push(`sig warnings ${P.sigWarns}, colliding with a void warning (<1.2 s) ${P.collide}`);
    if (on.has('omen')) R.proto.push(`SEALS ${P.seals.length}: ${P.seals.map((x) => (x.t / H).toFixed(1) + 'h f' + x.floor + ' after ' + (x.runT / 60).toFixed(0) + 'min').join(', ')} | daily re-delves ${P.redelves}`);
    if (on.has('lantern')) R.proto.push(`LANTERN buys: ${P.lantern.map((x) => 'L' + x.lvl + '@' + (x.t / H).toFixed(1) + 'h').join(' ')} | void dmg prevented ${KK.U.fmt(P.voidDmgSaved)}`);
  });
}
module.exports = { options };
