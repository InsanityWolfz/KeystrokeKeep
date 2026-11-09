// Round 07 auditor: in-memory prototypes of the week-2 layer against the CURRENT js/ (nothing in js/ is touched).
// Each block mirrors the exact code proposed in round-07/auditor.md, so the measured numbers are the spec's numbers.
//   omen    : Omen of the Day (S.seals/sealDay/omenStar/freeDelveDay, A.dailyOpen/starOmen/claimSeal, seal in nextFloor,
//             free daily re-delve when nothing can be earned). One "day" = --day hours of play (default 8).
//   lantern : Void Lantern (Workshop, base --lBase 4000, growth 1.8, max 5, -8% void slam damage per level; card from maxFloorEver >= 70).
//             --lanternFirst: the scripted buyer checks it before the other Workshop rows (a player who wants it).
//   tro     : depth trophies 160, 170, 180, 190, 200 (x1.05 like the others).
//   ach2    : the two Seal achievements (seals7 Faithful, seals30 Devout) + f150 / f200 depth achievements as beats.
//   week2   : omen+lantern+tro+ach2
function expand(list) {
  const out = new Set();
  for (const x of list) { if (x === 'week2') ['omen', 'lantern', 'tro', 'ach2'].forEach((y) => out.add(y)); else out.add(x); }
  return out;
}
function patch(KK, hooks, list, args = {}) {
  const on = expand(list);
  const W = KK.world, D = KK.DATA, A = KK.actions;
  const S = () => KK.S, now = () => hooks.time();
  const N = { day: (+args.day || 8) * 3600, gap: args.sealGap !== undefined ? +args.sealGap : 15, minFloor: +args.sealMin || 40, renown: +args.sealRenown || 10, lBase: +args.lBase || 4000, lGrowth: +args.lGrowth || 1.8, lStep: +args.lStep || 0.08, walledMin: +args.walledMin || 30 };
  const P = { seals: [], redelves: 0, lantern: [], voidSaved: 0, starOffered: 0, starTaken: 0, idleEmbersAt70: null };

  // webAll: a paid ultimate from ANY hero tears every web (world.js castUlt, first line)
  if (on.has('webAll')) { const o = W.castUlt; W.castUlt = function (h, free) { if (!free) for (const x of W.heroes) if (x !== h && x.webbed > 0) { x.webbed = 0; KK.emit('webTorn', { h: x }); } return o.call(this, h, free); }; }
  // webTurn: Web Shot targets the hero whose ultimate is next (W.ultTurn), so the next paid ultimate tears it
  if (on.has('webTurn')) KK.on('webShot', () => { const s = W.shots[W.shots.length - 1]; const h = W.heroes.find((x) => x.id === W.ultTurn && !x.dead); if (s && s.type === 'web' && h) s.target = h; });
  // webKeys: every keystroke/click shaves 0.25 s off each web (typing tears it), world.js KK.on('activity')
  if (on.has('webKeys')) KK.on('activity', () => { for (const h of W.heroes) if (h.webbed > 0) { h.webbed -= 0.25; if (h.webbed <= 0) { h.webbed = 0; KK.emit('webTorn', { h }); } } });
  if (on.has('tro')) for (const f of [160, 170, 180, 190, 200]) D.TROPHIES.push(f);

  if (on.has('lantern')) {
    // data.js WORKSHOP (append):
    D.WORKSHOP.push({ id: 'lantern', name: 'Void Lantern', icon: 'candle', base: N.lBase, growth: N.lGrowth, max: 5, desc: (l) => `Void slams deal ${8 * l}% less damage (now -${8 * l}%)`, apply: (m, l) => { m.voidDmg = (m.voidDmg || 1) * (1 - N.lStep * l); } });
    if (args.lanternFirst || args.lanternSave) D.WORKSHOP.unshift(D.WORKSHOP.pop());
    const origBuy = A.buyWorkshop;
    A.buyWorkshop = (id) => {
      const s = S(), l = s.workshop.lantern || 0, open = s.maxFloorEver >= 70 && l < 5;
      if (id === 'lantern') return open ? origBuy(id) : false; // ui: card hidden until floor 70
      // --lanternSave: a player who wants the Lantern saves Embers for it instead of buying other rows
      if (args.lanternSave && open && s.embers < KK.F.upCost(D.WORKSHOP.find((d) => d.id === 'lantern'), l)) return false;
      return origBuy(id);
    };
    // world.js void slam: h.maxHp * 0.55 * KK.mods().voidDmg
    const origDH = W.damageHero;
    W.damageHero = function (h, dmg, src) {
      if (src && src.boss && !h.dead && Math.abs(dmg - h.maxHp * 0.55) < 1e-6) { const m = KK.mods().voidDmg || 1; P.voidSaved += dmg * (1 - m); dmg *= m; }
      return origDH.call(this, h, dmg, src);
    };
    KK.on('upgrade', ({ store, id, lvl }) => { if (store === 'workshop' && id === 'lantern') { P.lantern.push({ t: now(), lvl }); hooks.beat('LANTERN', 'void lantern L' + lvl); } });
    KK.on('floor', ({ floor }) => { if (floor >= 70 && P.idleEmbersAt70 === null) P.idleEmbersAt70 = { t: now(), embers: S().embers }; });
  }

  if (on.has('omen')) {
    // state.js
    const today = () => 'd' + Math.floor(now() / N.day); // KK.today(): local Y-M-D in the game
    const starOmen = () => { let h = 0; for (const c of today()) h = (h * 31 + c.charCodeAt(0)) >>> 0; return D.OMENS[h % D.OMENS.length].id; };
    const dailyOpen = () => !KK.DEMO_CAP && S().retires >= 2 && S().sealDay !== today();
    const claimSeal = () => { const s = S(); s.sealDay = today(); s.seals = (s.seals || 0) + 1; s.renown += N.renown; s.renownLifetime += N.renown; KK.dirty(); KK.emit('seal', { n: s.seals }); };
    const origRetire = A.retire;
    A.retire = function () {
      const gain = A.renownGain();
      const r = origRetire.apply(this, arguments);
      if (!r) return r;
      const s = S();
      s.omenStar = null;
      if (s.omenOffer && dailyOpen()) { const st = starOmen(); if (!s.omenOffer.includes(st)) s.omenOffer[0] = st; s.omenStar = st; P.starOffered++; }
      if (gain <= 0 && !KK.DEMO_CAP) s.freeDelveDay = today();
      return r;
    };
    const origCanRedelve = A.canRedelve;
    A.canRedelve = () => origCanRedelve() || (dailyOpen() && S().freeDelveDay !== today() && A.renownGain() <= 0);
    // world.js nextFloor, after the maxFloorRun line
    KK.on('floor', () => { const s = S(); if (s.omen && s.omen === s.omenStar && dailyOpen() && s.floor >= Math.max(N.minFloor, (s.renownFloor || 0) - N.gap)) { claimSeal(); P.seals.push({ t: now(), floor: s.floor, runT: s.runTime || 0, rec: s.renownFloor }); hooks.beat('SEAL', 'seal #' + s.seals + ' f' + s.floor + ' (' + ((s.runTime || 0) / 60).toFixed(0) + ' min into the delve)'); } });
    // the scripted player takes the starred omen while today's Seal is open
    hooks.pickOmen = (offer) => { const s = S(); if (s.omenStar && offer.includes(s.omenStar) && dailyOpen()) { P.starTaken++; return s.omenStar; } return undefined; };
    // walled (nothing to earn) for 30+ min with today's Seal open and not under the star: take the free daily re-delve
    let lastRec = 0, lastRecT = 0;
    hooks.glance.push((t) => {
      const s = S();
      if (s.maxFloorRun > lastRec) { lastRec = s.maxFloorRun; lastRecT = t; }
      if (A.renownGain() <= 0 && dailyOpen() && !(s.omen && s.omen === s.omenStar) && t - lastRecT > N.walledMin * 60 && A.canRedelve()) {
        const r = A.retire();
        if (r) { W.reset(); P.redelves++; hooks.beat('REDELVE', 'free daily re-delve'); lastRec = 0; lastRecT = t; if (s.omenOffer) { const id = hooks.pickOmen(s.omenOffer); A.pickOmen(id !== undefined ? id : s.omenOffer[0]); } }
      }
    });
    if (on.has('ach2')) KK.on('seal', ({ n }) => { if (n === 7) hooks.beat('ACH', 'ach seals7'); if (n === 30) hooks.beat('ACH', 'ach seals30'); });
  }
  if (on.has('ach2')) { const got = new Set(); KK.on('floor', ({ floor }) => { if ((floor === 150 || floor === 200) && !got.has(floor) && floor >= S().maxFloorEver) { got.add(floor); hooks.beat('ACH', 'ach f' + floor); } }); }

  hooks.end.push((R) => {
    const L = R.t7 || (R.t7 = []);
    const H = 3600;
    L.push(`PROTO on=${[...on].join(',')} N=${JSON.stringify(N)}${args.lanternFirst ? ' lanternFirst' : ''}`);
    if (on.has('omen')) L.push(`SEALS ${P.seals.length} (star offered ${P.starOffered}, taken ${P.starTaken}, free re-delves ${P.redelves}): ${P.seals.map((x) => (x.t / H).toFixed(1) + 'h f' + x.floor + '/rec' + x.rec + ' ' + (x.runT / 60).toFixed(0) + 'min').join(', ')}`);
    if (on.has('lantern')) L.push(`LANTERN ${P.lantern.map((x) => 'L' + x.lvl + '@' + (x.t / H).toFixed(1) + 'h').join(' ') || 'never bought'} | void dmg prevented ${KK.U.fmt(P.voidSaved)} | first f70 at ${P.idleEmbersAt70 ? (P.idleEmbersAt70.t / H).toFixed(1) + 'h with ' + Math.round(P.idleEmbersAt70.embers) + ' embers' : '-'}`);
  });
}
module.exports = { patch };
