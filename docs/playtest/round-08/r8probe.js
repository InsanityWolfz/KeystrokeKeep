// Round 08 auditor probe: R6/R7 harness (../round-06/r6lib.js) on the CURRENT js/, but with js/fx.js loaded
// (r8load.js: banners, alerts, setTimeout and performance.now on sim time), so banner-gated moves and the
// demo Glimpse alert behave like the real game. Read-only: nothing in js/ is touched.
// node r8probe.js [--profile typist|idle|burst|light|heavy] [--min 480] [--seed 1] [--demo] [--day 8] [--quiet] [--json f]
//   --day H   : one calendar day = H hours of play (KK.today patched to sim time; the game uses the wall clock)
//   --walled M: the scripted player takes the free daily re-delve after M min without a record (default 30)
const Module = require('module'); const origLoad = Module._load;
Module._load = function (req) { if (/headless_src$/.test(req)) return require('./r8load'); return origLoad.apply(this, arguments); };
const { run, fmtT, buckets, gap, med } = require('../round-06/r6lib');
const { summary } = require('../round-07/r7summary');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[k] = true; else { args[k] = v; i++; } } }
const o = { profile: args.profile || 'typist', min: +args.min || 480, seed: +args.seed || 1, retire: args.retire || 'nudge', omen: args.omen || 'random', demo: !!args.demo };
const SIG = ['royalSummons', 'webShot', 'webbed', 'webTorn', 'magmaShell', 'shellCrack', 'lavaRain', 'regroup', 'seal', 'voidWarn', 'voidSlam'];
o.sigEvents = SIG;
const T = {}; // r8 telemetry
o.patch = (KK, hooks) => { telemetry(KK, hooks); };
const R = run(o);
const L = summary(R, o, args);
L.push(...T.lines());
console.log(L.join('\n'));
if (args.json) { const out = Object.assign({}, R, { r8: T.data }); delete out.KK; require('fs').writeFileSync(args.json, JSON.stringify(out)); }

function telemetry(KK, hooks) {
  const W = KK.world, D = KK.DATA, A = KK.actions, S = () => KK.S, now = () => hooks.time(), FX = () => KK.fx;
  const H = 3600, DAY = (+args.day || 8) * H, WALLED = (+args.walled || 30) * 60;
  // sim clock + fx before every world step (the real main loop calls FX.update then W.update)
  const ou = W.update; W.update = function (dt) { KK.__pre(dt); return ou.call(this, dt); };
  const P = T.data = {
    seals: [], starOffered: 0, starTaken: 0, redelves: 0, lantern: [], lanternBlocked: 0, firstF70: null,
    sigBanner: {}, sigTotal: {}, fightsSig: {}, alertsUnderBanner: 0, alerts: 0,
    web: { shot: 0, webbed: 0, ult: 0, key: 0, expired: 0, ko: 0, floor: 0, secs: [] },
    voidGap: {}, chargeTicks: 0, chargeVoidFrozen: 0,
    rekill: 0, bossKillsAll: 0,
    glimpse: null, peekAt: null, cardAt: null, cardPeekAt: null, magmaAch: null,
  };
  // ---- calendar day = sim day
  KK.today = () => 'd' + Math.floor(now() / DAY);
  // ---- UI fidelity: the Lantern card is hidden below floor 70 (ui.js workshopHTML)
  const ob = A.buyWorkshop;
  A.buyWorkshop = (id) => { const d = D.WORKSHOP.find((x) => x.id === id); if (d && d.minFloor && S().maxFloorEver < d.minFloor) { if (KK.F.upCost(d, S().workshop[id] || 0) <= S().embers) P.lanternBlocked++; return false; } return ob(id); };
  KK.on('upgrade', ({ store, id, lvl }) => { if (store === 'workshop' && id === 'lantern') { P.lantern.push({ t: now(), lvl }); hooks.beat('LANTERN', 'lantern L' + lvl); } });
  KK.on('floor', ({ floor }) => { if (floor >= 70 && P.firstF70 === null && !S().glimpse) P.firstF70 = { t: now(), embers: S().embers }; });
  // ---- Omen of the Day: the player takes the star; free daily re-delve when walled
  hooks.pickOmen = (offer) => { const s = S(); if (s.omenStar && offer.includes(s.omenStar) && A.dailyOpen()) { P.starTaken++; return s.omenStar; } return undefined; };
  KK.on('retired', () => { if (S().omenStar) P.starOffered++; });
  KK.on('seal', ({ n }) => { const s = S(); P.seals.push({ t: now(), n, floor: s.floor, runT: s.runTime || 0, rec: s.renownFloor }); hooks.beat('SEAL', 'seal #' + n + ' f' + s.floor); });
  let lastRec = 0, lastRecT = 0;
  hooks.glance.push((t) => {
    const s = S();
    if (s.maxFloorRun > lastRec) { lastRec = s.maxFloorRun; lastRecT = t; }
    if (!KK.DEMO_CAP && A.renownGain() <= 0 && A.canRedelve() && !(s.omen && s.omen === s.omenStar) && t - lastRecT > WALLED) {
      const r = A.retire();
      if (r) { W.reset(); P.redelves++; lastRec = 0; lastRecT = t; if (s.omenOffer) { const id = hooks.pickOmen(s.omenOffer); A.pickOmen(id !== undefined ? id : s.omenOffer[0]); } }
    }
  });
  // ---- signature moves vs banners (the game now delays sig moves while a banner shows)
  for (const ev of ['royalSummons', 'webShot', 'magmaShell', 'lavaRain', 'chargeWarn', 'reassemble']) KK.on(ev, () => {
    P.sigTotal[ev] = (P.sigTotal[ev] || 0) + 1;
    if (FX().banners.length) P.sigBanner[ev] = (P.sigBanner[ev] || 0) + 1;
  });
  const oa = KK.fx.alert; KK.fx.alert = function (str) { P.alerts++; if (KK.fx.banners.length) P.alertsUnderBanner++; return oa.apply(this, arguments); };
  // per-fight: did the player get to see the boss's own move at all?
  let fight = null;
  const SIGOF = { ratking: 'royalSummons', broodmother: 'webShot', embergolem: 'magmaShell', magmalord: 'lavaRain', warlord: 'chargeWarn', boneking: 'reassemble' };
  const endF = (how) => { if (!fight) return; const k = (fight.h ? 'H-' : '') + fight.key; const r = P.fightsSig[k] = P.fightsSig[k] || { n: 0, seen: 0, kills: 0, killNoSig: 0, sigAfterBanner: [] }; r.n++; if (fight.sig) r.seen++; if (how === 'kill') { r.kills++; if (!fight.sig) r.killNoSig++; } (P.fl = P.fl || []).push({ k, t: Math.round(fight.t0), sig: fight.sig, how, dur: +(now() - fight.t0).toFixed(1) }); fight = null; };
  KK.on('bossSpawn', ({ boss }) => { endF('replaced'); fight = { uid: boss.uid, key: boss.key, h: !!(boss.hollowed), sig: 0, t0: now() }; });
  for (const [key, ev] of Object.entries(SIGOF)) KK.on(ev, ({ e }) => { if (fight && e && e.uid === fight.uid) { if (!fight.sig) { const r = P.fightsSig[(fight.h ? 'H-' : '') + key] = P.fightsSig[(fight.h ? 'H-' : '') + key] || { n: 0, seen: 0, kills: 0, killNoSig: 0, sigAfterBanner: [] }; r.sigAfterBanner.push(now() - fight.t0); } fight.sig++; } });
  KK.on('kill', ({ e }) => { if (fight && e.uid === fight.uid) endF('kill'); });
  KK.on('wipe', () => endF('wipe')); KK.on('retired', () => endF('retire'));
  // ---- webs: who tears them
  let tearSrc = null;
  const oc = W.castUlt; W.castUlt = function () { tearSrc = 'ult'; try { return oc.apply(this, arguments); } finally { tearSrc = null; } };
  const oact = KK.addActivity; KK.addActivity = function () { tearSrc = 'key'; try { return oact.apply(this, arguments); } finally { tearSrc = null; } };
  const webStart = new Map();
  KK.on('webShot', () => P.web.shot++);
  KK.on('webbed', ({ h }) => { P.web.webbed++; webStart.set(h.uid, now()); });
  KK.on('webTorn', ({ h }) => { if (tearSrc === 'ult') P.web.ult++; else if (tearSrc === 'key') P.web.key++; else P.web.floor++; if (webStart.has(h.uid)) { P.web.secs.push(now() - webStart.get(h.uid)); webStart.delete(h.uid); } });
  KK.on('heroDown', ({ h }) => { if (webStart.has(h.uid)) { P.web.ko++; webStart.delete(h.uid); } });
  hooks.tick.push(() => {
    for (const [uid, t0] of webStart) { const h = W.heroes.find((x) => x.uid === uid); if (!h || h.webbed <= 0) { P.web.expired++; P.web.secs.push(now() - t0); webStart.delete(uid); } }
    const b = W.boss;
    if (b && (b.hollowed || b.key === 'hollow') && b.chPhase) { P.chargeTicks++; if (b._lv === b.voidT) P.chargeVoidFrozen++; }
    if (b) b._lv = b.voidT;
  });
  // void slam cadence per boss
  const lastVoid = new Map();
  KK.on('voidSlam', ({ e }) => { const k = e.hollowed ? 'H-' + e.key : e.key; if (lastVoid.has(e.uid)) (P.voidGap[k] = P.voidGap[k] || []).push(now() - lastVoid.get(e.uid)); lastVoid.set(e.uid, now()); });
  // ---- boss re-kills inside one delve (S.slain)
  let beaten = new Set();
  KK.on('kill', ({ e }) => { if (!e.boss) return; P.bossKillsAll++; const f = S().floor; if (beaten.has(f) && !(KK.DEMO_CAP && f === 40)) P.rekill++; beaten.add(f); });
  KK.on('retired', () => { beaten = new Set(); });
  // ---- demo: Glimpse of the Depths
  let G = null;
  const WDS = [683, 960, 1280];
  KK.on('glimpse', () => { G = P.glimpse = { t: now(), runT: S().runTime, startX: null, sealedX: null, doorX: null, passT: null, leaveT: null, alertT: null, alertOnFloor: null, kos: 0, wipes: 0, chest: 0, enemies: 0, vis: WDS.map(() => 0), banners: [], maxRun: null, maxEver: null, laps: null }; });
  KK.on('floor', ({ floor }) => { if (G && S().glimpse && G.startX === null) { G.startX = W.partyX; G.sealedX = W.sealedX; G.floor = floor; } });
  KK.on('floorClear', () => { if (G && S().glimpse && G.doorX === null) G.doorX = W.door && W.door.x; });
  KK.on('heroDown', () => { if (G && S().glimpse) G.kos++; });
  KK.on('wipe', () => { if (G && S().glimpse) G.wipes++; });
  KK.on('chest', () => { if (G && S().glimpse) G.chest++; });
  KK.on('wave', () => { if (G && S().glimpse) G.enemies = W.enemies.filter((e) => !e.dead).length + (G.enemies || 0); });
  KK.on('achievement', ({ id }) => { if (id === 'magma' && KK.DEMO_CAP) P.magmaAch = { t: now(), glimpse: !!S().glimpse }; });
  KK.on('demoComplete', (ev) => { if (ev && ev.peek) P.cardPeekAt = now(); else { P.cardAt = now(); if (G && G.leaveT === null) { G.leaveT = now(); G.maxRun = S().maxFloorRun; G.maxEver = S().maxFloorEver; G.laps = S().demoLaps; G.best = S().bestCapTime; } } });
  hooks.tick.push((dt) => {
    const s = S();
    // ui.js slowUpdate: the 40-min "what waits below" card (modal check ignored)
    if (KK.DEMO_CAP && !s.demoDone && !s.demoPeek && s.stats.playTime >= 2400 && P.peekAt === null) P.peekAt = now();
    if (G && s.glimpse) {
      if (G.passT === null && W.partyX > W.sealedX - 6) G.passT = now();
      WDS.forEach((wd, i) => { const camX = W.partyX - wd * 0.38; if (W.sealedX >= camX - 20 && W.sealedX <= camX + wd + 20) G.vis[i] += dt; });
      if (KK.fx.banners.length) { const b = KK.fx.banners[0].text; if (G.banners[G.banners.length - 1] !== b) G.banners.push(b); }
    }
    if (G && G.alertT === null) { const a = KK.fx.alerts.find((x) => /MAGMA DEPTHS/.test(x.str)); if (a) { G.alertT = now(); G.alertOnFloor = !!s.glimpse; } }
  });

  T.lines = () => {
    const out = [];
    const r = (x) => (x === null || x === undefined ? '-' : (x / 60).toFixed(1) + 'm');
    out.push(`R8 SEALS ${P.seals.length} (star offered ${P.starOffered}, taken ${P.starTaken}, free re-delves ${P.redelves}): ${P.seals.map((x) => (x.t / H).toFixed(1) + 'h f' + x.floor + '/rec' + x.rec + ' ' + (x.runT / 60).toFixed(0) + 'min').join(', ')}`);
    out.push(`R8 LANTERN ${P.lantern.map((x) => 'L' + x.lvl + '@' + (x.t / H).toFixed(1) + 'h').join(' ') || 'never'} | first f70 ${P.firstF70 ? (P.firstF70.t / H).toFixed(1) + 'h (' + Math.round(P.firstF70.embers) + ' embers)' : '-'} | blocked-but-affordable glances (badge shows, card hidden) ${P.lanternBlocked}`);
    out.push(`R8 SIG under banner: ${Object.keys(P.sigTotal).map((k) => k + ' ' + (P.sigBanner[k] || 0) + '/' + P.sigTotal[k]).join(', ')} | alerts ${P.alerts}, while a banner shows ${P.alertsUnderBanner}`);
    out.push('R8 FIGHTS (key: fights | saw own move | kills | kills with NO move | med s from spawn to first move): ' + Object.entries(P.fightsSig).map(([k, v]) => `${k} ${v.n}|${(100 * v.seen / v.n).toFixed(0)}%|${v.kills}|${v.killNoSig}|${med(v.sigAfterBanner).toFixed(1)}`).join('  '));
    const w = P.web; out.push(`R8 WEB shots ${w.shot} webbed ${w.webbed}: torn by ult ${w.ult}, by keys ${w.key}, other ${w.floor}, expired ${w.expired}, KO ${w.ko}; med web ${med(w.secs).toFixed(2)}s`);
    out.push(`R8 VOID gaps med s: ${Object.entries(P.voidGap).map(([k, v]) => k + ' ' + med(v).toFixed(1) + ' (n' + v.length + ')').join(', ')} | Hollowed charge ticks ${P.chargeTicks}, voidT frozen ${P.chargeVoidFrozen}`);
    { const firsts = {}; for (const f of P.fl || []) { (firsts[f.k] = firsts[f.k] || []).push(f); } out.push('R8 FIRST3 (own move seen in the first 3 fights of each boss; spawn->end s): ' + Object.entries(firsts).filter(([k]) => k !== 'hollow').map(([k, v]) => k + ' ' + v.slice(0, 3).map((f) => (f.sig ? 'Y' : 'n') + f.dur).join(',')).join('  ')); }
    out.push(`R8 REKILL boss kills ${P.bossKillsAll}, re-kills of a floor beaten this delve ${P.rekill}`);
    if (KK.DEMO_CAP) {
      const g = P.glimpse;
      out.push(`R8 DEMO glimpse ${g ? r(g.t) + ' (run ' + r(g.runT) + ')' : 'NEVER'} | peek card ${r(P.peekAt)} | full card ${r(P.cardAt)} | magma ach ${P.magmaAch ? r(P.magmaAch.t) + (P.magmaAch.glimpse ? ' DURING GLIMPSE' : '') : '-'}`);
      if (g) out.push(`R8 GLIMPSE floor ${g.floor} for ${g.leaveT ? (g.leaveT - g.t).toFixed(1) + 's' : '?'}; statue at +${Math.round(g.sealedX - g.startX)}, door at +${g.doorX ? Math.round(g.doorX - g.startX) : '?'} -> party walks past statue after ${g.passT ? (g.passT - g.t).toFixed(1) + 's' : 'never'}; statue on screen (Wd 683/960/1280) ${g.vis.map((x) => x.toFixed(1)).join('/')}s; alert at +${g.alertT ? (g.alertT - g.t).toFixed(1) : '-'}s on floor? ${g.alertOnFloor}; banners ${g.banners.join(' > ')}; KOs ${g.kos} wipes ${g.wipes} chests ${g.chest}; after: maxRun ${g.maxRun} maxEver ${g.maxEver} laps ${g.laps} best ${g.best ? (g.best / 60).toFixed(1) + 'm' : '-'}`);
    }
    return out;
  };
}
