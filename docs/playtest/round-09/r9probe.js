// Round 09 auditor probe: the R8 probe (round-08/r8probe.js telemetry via r8load = js/ + fx.js on sim time)
// plus R9 checks: Glimpse staging geometry, peek guard, Rat King summons per lap, achievement progress
// counters vs their real triggers, content coverage. Read-only: nothing in js/ is touched.
// node r9probe.js [--profile typist|idle|burst|light|heavy] [--min 480] [--seed 1] [--demo] [--day 8] [--quiet] [--json f]
const Module = require('module'); const origLoad = Module._load;
Module._load = function (req) { if (/headless_src$/.test(req)) return require('../round-08/r8load'); return origLoad.apply(this, arguments); };
const { run, med } = require('../round-06/r6lib');
const { summary } = require('../round-07/r7summary');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[k] = true; else { args[k] = v; i++; } } }
const o = { profile: args.profile || 'typist', min: +args.min || 480, seed: +args.seed || 1, retire: args.retire || 'nudge', omen: args.omen || 'random', demo: !!args.demo };
o.sigEvents = ['royalSummons', 'webShot', 'webbed', 'webTorn', 'magmaShell', 'shellCrack', 'lavaRain', 'regroup', 'seal', 'voidWarn', 'voidSlam'];
const T = {};
o.patch = (KK, hooks) => telemetry(KK, hooks);
const R = run(o);
const L = summary(R, o, args);
L.push(...T.lines(R));
console.log(L.join('\n'));
if (args.json) { const out = { profile: o.profile, seed: o.seed, demo: o.demo, min: o.min, r9: T.data, end: R.end, ach: R.ach }; require('fs').writeFileSync(args.json, JSON.stringify(out)); }

function telemetry(KK, hooks) {
  const W = KK.world, D = KK.DATA, A = KK.actions, S = () => KK.S, now = () => hooks.time(), FX = () => KK.fx;
  const H = 3600, DAY = (+args.day || 8) * H, WALLED = (+args.walled || 30) * 60;
  const ou = W.update; W.update = function (dt) { KK.__pre(dt); return ou.call(this, dt); };
  const P = T.data = { glimpse: null, peekAt: null, peekOld: null, rk: [], ach: {}, achBad: [], achNext: [], seen: {}, offered: {}, picked: {}, omens: {}, lantern: [], sealN: 0, redelves: 0, magma: null };
  KK.today = () => 'd' + Math.floor(now() / DAY);
  // UI fidelity: Lantern hidden below f70 (ui.js workshopHTML)
  const ob = A.buyWorkshop;
  A.buyWorkshop = (id) => { const d = D.WORKSHOP.find((x) => x.id === id); if (d && d.minFloor && S().maxFloorEver < d.minFloor) return false; return ob(id); };
  KK.on('upgrade', ({ store, id, lvl }) => { if (store === 'workshop' && id === 'lantern') P.lantern.push({ t: now(), lvl }); });
  hooks.pickOmen = (offer) => { const s = S(); if (s.omenStar && offer.includes(s.omenStar) && A.dailyOpen()) return s.omenStar; return undefined; };
  KK.on('seal', () => P.sealN++);
  let lastRec = 0, lastRecT = 0;
  hooks.glance.push((t) => {
    const s = S();
    if (s.maxFloorRun > lastRec) { lastRec = s.maxFloorRun; lastRecT = t; }
    if (!KK.DEMO_CAP && A.renownGain() <= 0 && A.canRedelve() && !(s.omen && s.omen === s.omenStar) && t - lastRecT > WALLED) {
      const r = A.retire();
      if (r) { W.reset(); P.redelves++; lastRec = 0; lastRecT = t; if (s.omenOffer) { const id = hooks.pickOmen(s.omenOffer); A.pickOmen(id !== undefined ? id : s.omenOffer[0]); } }
    }
  });
  // ---- coverage
  KK.on('kill', ({ e }) => { const k = e.heart ? 'HEART' : e.hollowed ? 'H-' + e.key : e.key; if (!S().glimpse || !KK.DEMO_CAP) P.seen[k] = P.seen[k] || now(); });
  KK.on('relicOffer', ({ ids }) => { for (const id of ids) P.offered[id] = (P.offered[id] || 0) + 1; });
  KK.on('relicPicked', ({ id }) => { P.picked[id] = (P.picked[id] || 0) + 1; });
  KK.on('omenPicked', ({ id }) => { if (id) P.omens[id] = (P.omens[id] || 0) + 1; });
  // ---- Rat King: summons per fight (incl. lap number in the demo)
  let rk = null;
  KK.on('bossSpawn', ({ boss }) => { if (boss.key === 'ratking') rk = { t0: now(), uid: boss.uid, waves: 0, rats: 0, underBanner: 0, h: !!boss.hollowed, lap: S().demoLaps || 0, firstAt: null, frames: [] }; else rk = null; });
  KK.on('royalSummons', ({ e }) => { if (rk && e.uid === rk.uid) { rk.waves++; if (rk.firstAt === null) rk.firstAt = now() - rk.t0; rk.frames.push(+(now() - rk.t0).toFixed(2)); if (FX().banners.length) rk.underBanner++; } });
  KK.on('kill', ({ e }) => { if (rk && e.uid === rk.uid) { rk.dur = now() - rk.t0; rk.how = 'kill'; P.rk.push(rk); rk = null; } });
  KK.on('wipe', () => { if (rk) { rk.how = 'wipe'; P.rk.push(rk); rk = null; } });
  // ---- Glimpse staging
  let G = null; const HALF = 21; // statue sprite 28 px * 1.5 / 2
  KK.on('glimpse', () => { G = P.glimpse = { t: now(), runT: S().runTime, x0: null, s0: null, s0rel: null, jumps: [], overlapS: 0, passed: false, doorX: null, doorRel: null, atCard: null, holdMin: null, holdS: 0, minGapWaves: Infinity, leaveT: null, vis: [0, 0, 0], visFirst: null, cards: 0, alert: null, kos: 0 }; });
  KK.on('demoComplete', (ev) => {
    if (ev && ev.peek) { P.peekAt = now(); return; }
    if (G && S().glimpse) { G.cards++; G.atCard = { t: now() - G.t, party: W.partyX, statue: W.sealedX, gap: W.sealedX - W.partyX, door: W.door ? W.door.x - W.partyX : null, atStatue: !!(ev && ev.atStatue) }; }
    else if (G && G.leaveT === null) G.cardAfterLeave = now() - G.t;
  });
  KK.on('heroDown', () => { if (G && S().glimpse) G.kos++; });
  let lastS = 0;
  hooks.tick.push((dt) => {
    const s = S();
    // peek: the current ui.js guard vs the R8 guard
    if (KK.DEMO_CAP && !s.demoDone && !s.demoPeek && !s.glimpseDone && s.maxFloorRun < 36 && s.stats.playTime >= 2400 && P.peekAt === null) { P.peekAt = now(); P.peekFloor = s.maxFloorRun; s.demoPeek = true; }
    if (KK.DEMO_CAP && !s.demoDone && s.stats.playTime >= 2400 && P.peekOld === null) { P.peekOld = now(); P.peekOldFloor = s.maxFloorRun; P.peekOldGlimpse = s.glimpse; }
    if (G && s.glimpse) {
      if (G.x0 === null) G.x0 = W.partyX;
      if (W.sealedX && G.s0 === null) { G.s0 = W.sealedX; G.s0rel = W.sealedX - W.partyX; G.s0t = now() - G.t; }
      if (W.sealedX && lastS && W.sealedX !== lastS) G.jumps.push(Math.round(W.sealedX - lastS));
      lastS = W.sealedX || 0;
      if (W.sealedX) {
        const gapX = W.sealedX - W.partyX;
        if (Math.abs(gapX) < HALF + 4) G.overlapS += dt;
        if (gapX < 0) G.passed = true;
        if (!W.door) G.minGapWaves = Math.min(G.minGapWaves, gapX);
        [640, 960, 1280].forEach((wd, i) => { const cam = W.partyX - wd * 0.38; if (W.sealedX + HALF >= cam && W.sealedX - HALF <= cam + wd) { G.vis[i] += dt; if (i === 0 && G.visFirst === null) G.visFirst = now() - G.t; } });
      }
      if (W.door && G.doorX === null) { G.doorX = W.door.x; G.doorRel = W.door.x - G.x0; }
      if (W.door && W.glimpseHold !== undefined) { G.holdS += dt; const gp = W.sealedX - W.partyX; G.holdMin = G.holdMin === null ? gp : Math.min(G.holdMin, gp); G.holdDoorGap = W.door.x - W.partyX; }
      if (G.alert === null) { const a = FX().alerts.find((x) => /SEALED|MAGMA/.test(x.str)); if (a) G.alert = { t: now() - G.t, str: a.str }; }
    }
    if (G && !s.glimpse && G.leaveT === null && G.x0 !== null) { G.leaveT = now() - G.t; G.after = { floor: s.floor, maxRun: s.maxFloorRun, maxEver: s.maxFloorEver, demoDone: s.demoDone, laps: s.demoLaps }; }
  });
  KK.on('achievement', ({ id }) => { if (id === 'magma' && KK.DEMO_CAP) P.magma = { t: now(), glimpse: !!S().glimpse }; });
  // ---- achievement counters: value of cur at unlock, cur>=goal without unlock, decreasing counters
  const CNT = KK.ach.LIST.filter((d) => d.goal && d.cur);
  P.counters = CNT.map((d) => d.id);
  const lastCur = {};
  KK.on('achievement', ({ id }) => {
    const d = CNT.find((x) => x.id === id); if (!d) return;
    let cur; try { cur = d.cur(S(), S().achP || {}); } catch (e) { cur = 'ERR'; }
    P.ach[id] = { t: now(), cur, goal: d.goal };
    if (cur !== 'ERR' && cur < d.goal) P.achBad.push(`${id} unlocked at cur ${cur} < goal ${d.goal}`);
  });
  let achAcc = 0;
  hooks.tick.push((dt) => {
    if ((achAcc += dt) < 60) return; achAcc = 0;
    const s = S();
    for (const d of CNT) {
      if (s.ach[d.id]) continue;
      let cur; try { cur = d.cur(s, s.achP || {}); } catch (e) { P.achBad.push(`${d.id} cur threw ${e.message}`); continue; }
      if (lastCur[d.id] !== undefined && cur < lastCur[d.id]) { const k = 'dec:' + d.id; P[k] = (P[k] || 0) + 1; }
      lastCur[d.id] = cur;
      if (cur > d.goal) { const k = 'over:' + d.id; if (!P[k]) P.achBad.push(`${d.id} cur ${cur} > goal ${d.goal} without unlock @${(now() / H).toFixed(2)}h`); P[k] = (P[k] || 0) + 1; }
      const p = KK.ach.progress(d); // the Legacy panel calls this; it should unlock on sight
      if (!p && cur >= d.goal && !s.ach[d.id]) { const k = 'stuck:' + d.id; if (!P[k]) P.achBad.push(`${d.id} cur ${cur} >= goal ${d.goal}, progress() hid it but no unlock @${(now() / H).toFixed(2)}h`); P[k] = (P[k] || 0) + 1; }
      if (p && (p.pct < 0 || p.pct >= 100)) P.achBad.push(`${d.id} pct ${p.pct}`);
    }
    const nx = KK.ach.next();
    const lbl = nx ? nx.def.id + ' ' + nx.txt : '-';
    if (!P.achNext.length || P.achNext[P.achNext.length - 1].lbl !== lbl.split(' ')[0]) P.achNext.push({ t: now(), lbl: lbl.split(' ')[0], txt: lbl });
  });

  T.lines = () => {
    const out = [], m = (x) => (x === null || x === undefined ? '-' : (x / 60).toFixed(1) + 'm');
    const g = P.glimpse;
    if (KK.DEMO_CAP) {
      out.push(`R9 DEMO glimpse ${g ? m(g.t) : 'NEVER'} | peek (new guard) ${m(P.peekAt)}${P.peekFloor ? ' at f' + P.peekFloor : ''} | old guard would fire ${m(P.peekOld)}${P.peekOldFloor ? ' f' + P.peekOldFloor : ''}${P.peekOldGlimpse ? ' DURING GLIMPSE' : ''} | magma ach ${P.magma ? m(P.magma.t) + (P.magma.glimpse ? ' DURING GLIMPSE' : '') : '-'}`);
      if (g) out.push(`R9 GLIMPSE statue set +${g.s0t !== undefined ? g.s0t.toFixed(1) : '?'}s at party+${Math.round(g.s0rel)}, jumps [${g.jumps.join(',')}], min statue-party gap during waves ${Math.round(g.minGapWaves)}, overlap ${g.overlapS.toFixed(1)}s, passed ${g.passed}; door at start+${Math.round(g.doorRel)}; card ${g.atCard ? '+' + g.atCard.t.toFixed(1) + 's gap ' + Math.round(g.atCard.gap) + ' door ' + Math.round(g.atCard.door) + ' atStatue ' + g.atCard.atStatue : 'none'}; hold ${g.holdS.toFixed(1)}s min gap ${g.holdMin === null ? '-' : Math.round(g.holdMin)} (door gap ${Math.round(g.holdDoorGap)}); on screen 640/960/1280 ${g.vis.map((x) => x.toFixed(1)).join('/')}s first +${g.visFirst === null ? '-' : g.visFirst.toFixed(1)}; alert ${g.alert ? '+' + g.alert.t.toFixed(1) + ' ' + g.alert.str : '-'}; floor lasted ${g.leaveT === null ? '-' : g.leaveT.toFixed(1)}s; cards on floor ${g.cards}; KOs ${g.kos}; after ${JSON.stringify(g.after)}`);
    }
    const rkLaps = P.rk.filter((r) => !r.h);
    if (rkLaps.length) {
      const pct = (a) => (a.length ? Math.round((100 * a.filter((r) => r.waves > 0).length) / a.length) : 0);
      const after = rkLaps.slice(1);
      out.push(`R9 RATKING fights ${rkLaps.length}, with summons ${pct(rkLaps)}% (laps 2+: ${pct(after)}%), waves med ${med(rkLaps.map((r) => r.waves))}, first at med ${med(rkLaps.filter((r) => r.firstAt !== null).map((r) => r.firstAt)).toFixed(1)}s, kill med ${med(rkLaps.filter((r) => r.dur).map((r) => r.dur)).toFixed(1)}s, waves under banner ${rkLaps.reduce((a, r) => a + r.underBanner, 0)}, double-wave same frame ${rkLaps.filter((r) => r.frames.length >= 2 && r.frames[1] - r.frames[0] < 0.1).length}`);
    }
    const HR = P.rk.filter((r) => r.h); if (HR.length) out.push(`R9 H-RATKING fights ${HR.length}, with summons ${Math.round(100 * HR.filter((r) => r.waves).length / HR.length)}%`);
    out.push(`R9 ACH counters (${P.counters.length}): unlock cur/goal ${Object.entries(P.ach).map(([k, v]) => k + ' ' + v.cur + '/' + v.goal).join(', ') || '-'}`);
    out.push(`R9 ACH problems: ${P.achBad.join(' ; ') || 'none'} | decreasing: ${Object.keys(P).filter((k) => k.startsWith('dec:')).map((k) => k.slice(4) + ' x' + P[k]).join(', ') || 'none'}`);
    out.push(`R9 ACH NEXT line changes: ${P.achNext.slice(0, 14).map((x) => (x.t / H).toFixed(1) + 'h ' + x.txt).join(' > ')}${P.achNext.length > 14 ? ' ... (' + P.achNext.length + ')' : ''}`);
    out.push(`R9 SEEN bosses: ${Object.entries(P.seen).filter(([k]) => D.MONSTERS[k.replace('H-', '')] && D.MONSTERS[k.replace('H-', '')].boss || k === 'HEART').map(([k, v]) => k + '@' + (v / H).toFixed(1) + 'h').join(' ')}`);
    out.push(`R9 SEEN monsters: ${Object.keys(D.MONSTERS).filter((k) => !D.MONSTERS[k].boss).map((k) => k + (P.seen[k] ? '@' + (P.seen[k] / H).toFixed(2) + 'h' : ' NEVER')).join(' ')}`);
    out.push(`R9 RELICS offered/picked: ${D.RELICS.map((r) => r.id + ' ' + (P.offered[r.id] || 0) + '/' + (P.picked[r.id] || 0)).join(', ')}`);
    out.push(`R9 OMENS picked: ${D.OMENS.map((x) => x.id + ' ' + (P.omens[x.id] || 0)).join(', ')} | seals ${P.sealN} | redelves ${P.redelves} | lantern ${P.lantern.map((x) => 'L' + x.lvl + '@' + (x.t / H).toFixed(1) + 'h').join(' ') || 'never'}`);
    const s = S(); out.push(`R9 END workshop ${JSON.stringify(s.workshop)} legacy ${JSON.stringify(s.legacy)} forge(last delve) ${JSON.stringify(s.forge)}`);
    return out;
  };
}
