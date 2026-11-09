// Round 10 auditor probe: the R9 harness (round-06/r6lib via round-08/r8load = js/ + fx.js on sim time)
// plus R10 telemetry for the Heartroot / Echoed Depths (51310be): biome time share, first sightings,
// Heart Warden guard, Spore Bloat split, Root Lasher roots, Overgrowth, Lockdown, Root Ward, Hollowed
// rotation by floor, Codex. Read-only: nothing in js/ is touched. KK_SRC=<dir> runs another js/ copy.
// node r10probe.js --profile typist --min 2400 --seed 1 [--demo] [--day 8] [--quiet] [--json f]
const Module = require('module'); const origLoad = Module._load;
Module._load = function (req) { if (/headless_src$/.test(req)) return require('../round-08/r8load'); return origLoad.apply(this, arguments); };
const { run, med } = require('../round-06/r6lib');
const { summary } = require('../round-07/r7summary');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[k] = true; else { args[k] = v; i++; } } }
const o = { profile: args.profile || 'typist', min: +args.min || 480, seed: +args.seed || 1, retire: args.retire || 'nudge', omen: args.omen || 'random', demo: !!args.demo };
o.sigEvents = ['royalSummons', 'webShot', 'magmaShell', 'shellCrack', 'lavaRain', 'voidSlam', 'overgrowth', 'lockdown', 'warded'];
const T = {};
o.patch = (KK, hooks) => telemetry(KK, hooks);
const R = run(o);
const L = summary(R, o, args);
L.push(...T.lines(R));
console.log(L.join('\n'));
if (args.json) {
  const nov = R.nov.map((n) => ({ t: Math.round(n.t), k: n.kind, l: n.label }));
  require('fs').writeFileSync(args.json, JSON.stringify({ profile: o.profile, seed: o.seed, demo: o.demo, min: o.min, r10: T.data, end: R.end, ach: R.ach, codex: R.codex.map((c) => [Math.round(c.t), c.name, c.rank]), nov, boss: R.boss.map((f) => ({ k: f.key, h: f.hollowed, heart: f.heart, f: f.floor, how: f.how, t: Math.round(f.t0), adur: +f.adur.toFixed(1), sig: f.sig })) }));
}

function telemetry(KK, hooks) {
  const W = KK.world, D = KK.DATA, A = KK.actions, F = KK.F, S = () => KK.S, now = () => hooks.time();
  const H = 3600, DAY = (+args.day || 8) * H, WALLED = (+args.walled || 30) * 60;
  const ou = W.update; W.update = function (dt) { KK.__pre(dt); return ou.call(this, dt); };
  KK.today = () => 'd' + Math.floor(now() / DAY);
  // main.js runs KK.dayTick once a minute; the headless sim does not, so daysPlayed (Hollowed pool) would stay 1
  let dayAcc = 60; hooks.tick.push((dt) => { if (args.noday) return; if ((dayAcc += dt) >= 60) { dayAcc = 0; KK.dayTick(); } });
  const P = T.data = { biome: {}, biomeW: { a: {}, b: {} }, pal: { a: {}, b: {} }, firstSeen: {}, firstBiome: {}, offered: {}, picked: {}, pickFloor: {}, wardens: [], spore: [], roots: { n: 0, ward: 0, dur: [], keys: 0, ult: 0, exp: 0, rootedS: 0, heartS: 0 }, og: [], lock: [], ward: { calls: 0, blocks: 0, byCtx: {} }, hollowByFloor: {}, sealN: 0, redelves: 0, banners: {} };
  // UI fidelity (as R9): Lantern hidden below f70; starred omen taken while the Seal is open; walled re-delve
  const ob = A.buyWorkshop;
  A.buyWorkshop = (id) => { const d = D.WORKSHOP.find((x) => x.id === id); if (d && d.minFloor && S().maxFloorEver < d.minFloor) return false; return ob(id); };
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
  // ---- biome time share + banners + first sight of each biome name
  KK.on('floor', ({ floor, biomeChange }) => {
    const b = F.biomeOf(floor);
    if (!P.firstBiome[b.name]) { P.firstBiome[b.name] = now(); if (b.echo) hooks.beat('MAJOR', 'biome ' + b.name + ' (f' + floor + ')'); }
    if (biomeChange) P.banners[b.name] = (P.banners[b.name] || 0) + 1;
  });
  hooks.tick.push((dt, t) => {
    const s = S(); if (s.glimpse) return;
    const b = F.biomeOf(s.floor), w = t < 8 * H ? 'a' : 'b';
    P.biome[b.name] = (P.biome[b.name] || 0) + dt;
    P.biomeW[w][b.name] = (P.biomeW[w][b.name] || 0) + dt;
    P.pal[w][b.id] = (P.pal[w][b.id] || 0) + dt;
  });
  // ---- first sighting of each creature (active on screen), split plain / echo-tinted / hollowed
  hooks.tick.push(() => {
    for (const e of W.enemies) {
      if (!e.active) continue;
      const k = e.heart ? 'HEART' : (e.hollowed ? 'H-' : e.echo ? 'E-' : '') + e.key;
      if (P.firstSeen[k] === undefined) { P.firstSeen[k] = now(); if (!e.hollowed && !e.echo && !e.heart && !/^MAJ/.test(k) && D.MONSTERS[e.key] && !D.MONSTERS[e.key].boss) hooks.beat('MAJOR', 'monster ' + e.def.name); }
    }
  });
  KK.on('relicOffer', ({ ids }) => { for (const id of ids) P.offered[id] = (P.offered[id] || 0) + 1; });
  KK.on('relicPicked', ({ id }) => { P.picked[id] = (P.picked[id] || 0) + 1; (P.pickFloor[id] = P.pickFloor[id] || []).push(S().floor); });
  // Root Ward: what it is worth for the rest of the delve it was picked in (time on floors where a web/root can happen)
  let wardRun = null; P.wardRuns = [];
  KK.on('relicPicked', ({ id }) => { if (id === 'rootward') wardRun = { f: S().floor, t: now(), useS: 0, totS: 0, blocks: 0 }; });
  KK.on('retired', () => { if (wardRun) { P.wardRuns.push(wardRun); wardRun = null; } });
  hooks.tick.push((dt) => {
    if (!wardRun) return;
    const s = S(), b = F.biomeOf(s.floor);
    wardRun.totS += dt;
    const brood = W.boss && W.boss.key === 'broodmother';
    if (b.id === 'root' || brood || (W.boss && W.boss.key === 'rootmother')) wardRun.useS += dt;
  });
  // ---- Root Ward calls (wrapped; world.js calls W.wardBlocks())
  if (W.wardBlocks) {
    const owb = W.wardBlocks;
    W.wardBlocks = function () {
      const r = owb.apply(this, arguments);
      P.ward.calls++;
      if (r) {
        P.ward.blocks++; if (wardRun) wardRun.blocks++;
        const ctx = W.boss && W.boss.key === 'rootmother' && W.boss.sigT === 9 ? 'overgrowth' : W.boss && W.boss.key === 'broodmother' ? 'webshot?' : 'lasher';
        P.ward.byCtx[ctx] = (P.ward.byCtx[ctx] || 0) + 1;
      }
      return r;
    };
  }
  // ---- Heart Warden guard
  const wd = new Map();
  hooks.tick.push(() => {
    for (const e of W.enemies) if (e.key === 'warden' && !wd.has(e.uid)) wd.set(e.uid, { t0: now(), act: e.active ? now() : null, hit1: null, guardAtHit1: null, end: null, why: null, die: null, hitsG: 0, hits: 0, e });
    for (const w of wd.values()) if (w.act === null && w.e.active) w.act = now();
  });
  KK.on('hit', ({ e, ult }) => {
    if (e.key !== 'warden') return; const w = wd.get(e.uid); if (!w) return;
    if (w.hit1 === null) { w.hit1 = now(); w.guardAtHit1 = e.guard ? e.guardT : 0; }
    w.hits++; if (e.guard) w.hitsG++;
  });
  KK.on('guardBreak', ({ e, worn }) => { const w = wd.get(e.uid); if (w && w.end === null) { w.end = now(); w.why = worn ? 'timer' : 'ult'; } });
  KK.on('kill', ({ e }) => {
    if (e.key === 'warden') { const w = wd.get(e.uid); if (w) { w.die = now(); if (w.end === null) w.why = 'diedGuarded'; delete w.e; P.wardens.push(w); wd.delete(e.uid); } }
  });
  KK.on('floor', () => { for (const [k, w] of wd) { delete w.e; w.why = w.why || 'leftFloor'; P.wardens.push(w); wd.delete(k); } });
  // ---- Spore Bloat: how long do the two Sporelings live?
  const burst = new Map();
  KK.on('bloatBurst', ({ e }) => burst.set(e.uid, now()));
  KK.on('kill', ({ e }) => {
    if (e.key !== 'sporeling') return;
    const t0 = burst.has(e.uid - 1) ? burst.get(e.uid - 1) : burst.has(e.uid - 2) ? burst.get(e.uid - 2) : null;
    P.spore.push({ life: t0 === null ? null : +(now() - t0).toFixed(3), sameFrame: (e.spawnT || 0) === 0 });
  });
  // ---- roots (Lasher, Overgrowth) and their cause of release
  let inUlt = false;
  const oc = W.castUlt; W.castUlt = function () { inUlt = true; try { return oc.apply(this, arguments); } finally { inUlt = false; } };
  const tornBy = new Map();
  KK.on('webTorn', ({ h }) => tornBy.set(h, inUlt ? 'ult' : 'keys'));
  const rootSt = new Map();
  KK.on('webbed', ({ h, root }) => { if (!root) return; P.roots.n++; rootSt.set(h, { t: now(), kind: 'lasher' }); });
  let og = null;
  KK.on('overgrowth', () => { og = { t: now(), freedAt: null, by: null, n: W.heroes.filter((h) => !h.dead).length, typing: KK.lastKeyAgo ? KK.lastKeyAgo() < 1 : null }; P.og.push(og); for (const h of W.heroes) if (!h.dead) rootSt.set(h, { t: now(), kind: 'og' }); });
  hooks.tick.push((dt) => {
    const s = S(), b = F.biomeOf(s.floor);
    if (b.id === 'root' && !b.echo) P.roots.heartS += dt;
    let rooted = false;
    for (const h of W.heroes) {
      const st = rootSt.get(h);
      if (h.webbed > 0 && h.webKind === 'root') rooted = true;
      if (st && !(h.webbed > 0)) {
        const by = tornBy.get(h) || 'expired';
        if (st.kind === 'lasher') { P.roots.dur.push(+(now() - st.t).toFixed(2)); P.roots[by === 'ult' ? 'ult' : by === 'keys' ? 'keys' : 'exp']++; }
        rootSt.delete(h); tornBy.delete(h);
        if (st.kind === 'og' && og && og.freedAt === null && ![...rootSt.values()].some((x) => x.kind === 'og')) { og.freedAt = +(now() - og.t).toFixed(2); og.by = by; }
      }
    }
    if (rooted && b.id === 'root' && !b.echo) P.roots.rootedS += dt;
  });
  // ---- Lockdown: did it change anything? snapshot of the previous frame
  let snap = null;
  const ultLog = []; KK.on('ult', ({ id }) => { if (id !== 'cleric') ultLog.push({ t: now(), id }); });
  hooks.tick.push(() => { const s = S(); snap = { sparks: s.sparks, turn: W.ultTurn, cd: Object.fromEntries(W.heroes.map((h) => [h.id, h.ultCd])) }; });
  KK.on('lockdown', ({ h }) => {
    const m = KK.mods(), cost = Math.ceil(D.HEROES[h.id].ult.cost * m.ultCost);
    const x = { t: now(), id: h.id, wasTurn: snap ? snap.turn === h.id : null, cdBefore: snap ? +(snap.cd[h.id] || 0).toFixed(1) : null, sparks: snap ? Math.floor(snap.sparks) : null, cost, before: ultLog.filter((u) => u.t > now() - 6).length };
    P.lock.push(x);
    setTimeoutSim(6, () => { x.after = ultLog.filter((u) => u.t > x.t && u.t <= x.t + 6).length; x.afterSelf = ultLog.filter((u) => u.t > x.t && u.t <= x.t + 6 && u.id === h.id).length; x.selfNext = (ultLog.find((u) => u.t > x.t && u.id === h.id) || {}).t; });
  });
  const pend = [];
  function setTimeoutSim(s, fn) { pend.push({ at: now() + s, fn }); }
  hooks.tick.push(() => { for (let i = 0; i < pend.length; i++) if (pend[i].at <= now()) { pend.splice(i--, 1)[0].fn(); } });
  // per keeper / rootmother / hollowed-at-same-depth fight: ults cast per active minute
  let bf = null; P.bossUlt = {};
  KK.on('bossSpawn', ({ boss }) => { bf = { uid: boss.uid, k: boss.hollowed ? 'H' : boss.key, f: S().floor, t0: null, ults: 0 }; const k = (boss.heart ? 'HEART' : boss.hollowed ? 'H-' + boss.key : boss.key); (P.hollowByFloor[S().floor] = P.hollowByFloor[S().floor] || {})[k] = (P.hollowByFloor[S().floor][k] || 0) + 1; });
  KK.on('ult', ({ id }) => { if (bf && bf.t0 !== null && id !== 'cleric') bf.ults++; });
  hooks.tick.push(() => { if (bf && bf.t0 === null && W.boss && W.boss.uid === bf.uid && W.boss.active) bf.t0 = now(); });
  const endBf = (how) => { if (!bf || bf.t0 === null || bf.f < 110) { bf = null; return; } const k = bf.k === 'H' ? 'hollowed' : bf.k; const d = now() - bf.t0; const r = (P.bossUlt[k] = P.bossUlt[k] || { n: 0, s: 0, ults: 0, kills: 0 }); r.n++; r.s += d; r.ults += bf.ults; if (how === 'kill') r.kills++; bf = null; };
  KK.on('kill', ({ e }) => { if (bf && e.uid === bf.uid) endBf('kill'); });
  KK.on('wipe', () => endBf('wipe'));
  KK.on('retired', () => endBf('retire'));

  T.lines = () => {
    const out = [], hh = (x) => (x === undefined || x === null ? 'NEVER' : (x / H).toFixed(2) + 'h');
    const pct = (m) => { const s = Object.values(m).reduce((a, b) => a + b, 0); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + (100 * v / s).toFixed(1) + '%').join(', '); };
    out.push(`R10 BIOME first 8h: ${pct(P.biomeW.a)}`);
    out.push(`R10 BIOME after 8h: ${Object.keys(P.biomeW.b).length ? pct(P.biomeW.b) : '-'} | palettes after 8h: ${Object.keys(P.pal.b).length ? pct(P.pal.b) : '-'}`);
    out.push(`R10 BIOME first: ${Object.entries(P.firstBiome).map(([k, v]) => k + '@' + hh(v)).join(' ')} | banners ${JSON.stringify(P.banners)}`);
    const NEW = ['lasher', 'bloat', 'sporeling', 'warden', 'rootmother', 'keeper', 'E-rat', 'E-lasher', 'H-ratking', 'H-boneking', 'H-broodmother', 'H-warlord', 'H-embergolem', 'H-magmalord', 'hollow', 'HEART'];
    out.push(`R10 FIRST SEEN: ${NEW.map((k) => k + '@' + hh(P.firstSeen[k])).join(' ')} | echo kinds seen ${Object.keys(P.firstSeen).filter((k) => k.startsWith('E-')).length}`);
    out.push(`R10 ACH new: ${['heartroot', 'rootmother', 'keeper', 'f125', 'f150', 'echo175', 'hollowed6', 'codex28'].map((k) => k + '@' + hh(R.ach[k])).join(' ')}`);
    const w = P.wardens;
    if (w.length) {
      const c = (why) => w.filter((x) => x.why === why).length;
      const contact = w.filter((x) => x.hit1 !== null);
      const pre = contact.map((x) => x.hit1 - x.t0), left = contact.map((x) => x.guardAtHit1);
      const tm = w.filter((x) => x.why === 'timer' && x.hit1 !== null);
      out.push(`R10 WARDEN n ${w.length}: died guarded ${c('diedGuarded')}, ult break ${c('ult')}, timer break ${c('timer')}, left floor ${c('leftFloor')} | spawn->first hit med ${med(pre).toFixed(1)}s, guard left at first hit med ${med(left).toFixed(1)}s (0 at contact: ${left.filter((x) => x <= 0).length}) | timer breaks after first hit med ${med(tm.map((x) => x.end - x.hit1)).toFixed(1)}s | ult-broken then dead <0.5s ${w.filter((x) => x.why === 'ult' && x.die !== null && x.die - x.end < 0.5).length}/${c('ult')} | hits guarded ${Math.round(100 * w.reduce((a, x) => a + x.hitsG, 0) / Math.max(1, w.reduce((a, x) => a + x.hits, 0)))}% | life med ${med(w.filter((x) => x.die !== null && x.hit1 !== null).map((x) => x.die - x.hit1)).toFixed(1)}s`);
    }
    if (P.spore.length) { const l = P.spore.filter((x) => x.life !== null).map((x) => x.life); out.push(`R10 SPORELING n ${P.spore.length}: same-frame deaths ${P.spore.filter((x) => x.sameFrame).length} (${Math.round(100 * P.spore.filter((x) => x.sameFrame).length / P.spore.length)}%), life <0.5s ${l.filter((x) => x < 0.5).length}, med life ${med(l).toFixed(2)}s`); }
    const r = P.roots;
    out.push(`R10 LASHER roots ${r.n}: torn by keys ${r.keys}, by ult ${r.ult}, expired ${r.exp}; med rooted ${med(r.dur).toFixed(2)}s; any hero rooted ${(100 * r.rootedS / Math.max(1, r.heartS)).toFixed(1)}% of Heartroot time (${(r.heartS / H).toFixed(1)} h)`);
    if (P.og.length) out.push(`R10 OVERGROWTH n ${P.og.length}: freed med ${med(P.og.filter((x) => x.freedAt !== null).map((x) => x.freedAt)).toFixed(2)}s, by keys ${P.og.filter((x) => x.by === 'keys').length} ult ${P.og.filter((x) => x.by === 'ult').length} expired ${P.og.filter((x) => x.by === 'expired').length}`);
    if (P.lock.length) {
      const L2 = P.lock.filter((x) => x.after !== undefined);
      out.push(`R10 LOCKDOWN n ${P.lock.length}: sealed hero ${JSON.stringify(P.lock.reduce((a, x) => (a[x.id] = (a[x.id] || 0) + 1, a), {}))}; was on cooldown already ${P.lock.filter((x) => x.cdBefore > 0.2).length}, cd>=6 already ${P.lock.filter((x) => x.cdBefore >= 6).length}; sparks < its cost ${P.lock.filter((x) => x.sparks < x.cost).length}; ults by anyone in the 6 s after med ${med(L2.map((x) => x.after))} vs 6 s before med ${med(L2.map((x) => x.before))}; windows with 0 ults after ${L2.filter((x) => x.after === 0).length}/${L2.length}`);
    }
    out.push(`R10 BOSS ults per active min (f110+): ${Object.entries(P.bossUlt).map(([k, v]) => `${k} n${v.n} kills ${v.kills} ${(v.ults / Math.max(1, v.s / 60)).toFixed(1)}/min med ${(v.s / v.n).toFixed(0)}s`).join(' | ')}`);
    out.push(`R10 WARD offered/picked ${P.offered.rootward || 0}/${P.picked.rootward || 0} picked at floors [${(P.pickFloor.rootward || []).join(',')}] | calls ${P.ward.calls} blocks ${P.ward.blocks} ${JSON.stringify(P.ward.byCtx)} | per pick: useful-floor share ${P.wardRuns.map((x) => Math.round(100 * x.useS / Math.max(1, x.totS)) + '%/' + x.blocks + 'b').join(' ')}`);
    const hb = Object.entries(P.hollowByFloor).filter(([f]) => +f >= 80).sort((a, b) => a[0] - b[0]).map(([f, m]) => f + ':' + Object.entries(m).map(([k, v]) => k.replace('H-', '') + v).join('/'));
    out.push(`R10 BOSS by floor: ${hb.join(' ')}`);
    out.push(`R10 RELICS offered/picked: ${D.RELICS.map((x) => x.id + ' ' + (P.offered[x.id] || 0) + '/' + (P.picked[x.id] || 0)).join(', ')} | seals ${P.sealN} redelves ${P.redelves}`);
    return out;
  };
}
