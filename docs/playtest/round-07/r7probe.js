// Round 07 auditor: R6 harness (../round-06/r6lib.js, which loads the CURRENT js/) + telemetry for the
// six signature moves as implemented in R6, plus optional in-memory week-2 prototypes (r7proto.js).
// node docs/playtest/round-07/r7probe.js [--profile typist|idle|burst|heavy|light] [--min 480] [--seed 1] [--demo] [--quiet] [--proto omen,lantern,tro,...] [--json f]
const { run, fmtT, buckets, gap, med } = require('../round-06/r6lib');
const { summary } = require('./r7summary');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[k] = true; else { args[k] = v; i++; } } }
const o = { profile: args.profile || 'typist', min: +args.min || 480, seed: +args.seed || 1, retire: args.retire || 'nudge', omen: args.omen || 'random', demo: !!args.demo };
const SIG = ['royalSummons', 'webShot', 'webbed', 'webTorn', 'magmaShell', 'shellCrack', 'lavaRain', 'lavaLand', 'regroup', 'seal', 'lantern'];
const ALERTS = ['royalSummons', 'webShot', 'magmaShell', 'shellCrack', 'lavaRain', 'chargeWarn', 'reassemble', 'bossEnrage', 'regroup'];
const protos = args.proto ? String(args.proto).split(',') : [];
o.sigEvents = SIG;
o.patch = (KK, hooks) => {
  telemetry(KK, hooks);
  if (protos.length) require('./r7proto').patch(KK, hooks, protos, args);
};
const R = run(o);
const L = summary(R, o, args);
L.push(...R.t7);
console.log(L.join('\n'));
if (args.json) { const out = Object.assign({}, R); delete out.KK; require('fs').writeFileSync(args.json, JSON.stringify(out)); }

function telemetry(KK, hooks) {
  const W = KK.world, S = () => KK.S, now = () => hooks.time();
  const P = {
    late: 0, lateWounded: 0, lateWoundedHollowed: 0, wounded: 0, enrage: 0, regroup: 0,
    collide: {}, banner: {}, alerts: {},
    shells: 0, shellHitsN: 0, shellHitsU: 0, openerShellHit: 0, openerShells: 0, cracks: 0,
    lavaHits: 0, lavaKO: 0, lavaDmg: 0, heroDmg: 0,
    webbed: 0, torn: 0, webSec: 0, webCarry: 0, webDeadCarry: 0,
    ultOnPile: 0, pileHitsBlocked: 0,
    wlFrozenVoid: 0, wlFrozenAtk: 0, wlChargeSec: 0,
    firstHit: [], openerBeforeHit: { ratking: [0, 0], broodmother: [0, 0], embergolem: [0, 0], magmalord: [0, 0] },
    fightsByKey: {}, summonsRats: 0,
  };
  let lastVoidWarn = -99, lastSpawn = -99, lastLavaHitT = -99;
  KK.on('voidWarn', () => { lastVoidWarn = now(); });
  KK.on('bossSpawn', ({ boss }) => {
    lastSpawn = now();
    const f = S().floor;
    if (boss.wounded) P.wounded++;
    if (f >= 70 && f !== 100 && boss.key !== 'hollow') { P.late++; if (boss.wounded) { P.lateWounded++; if (boss.hollowed) P.lateWoundedHollowed++; } }
  });
  for (const name of ALERTS) KK.on(name, () => {
    P.alerts[name] = (P.alerts[name] || 0) + 1;
    if (now() - lastVoidWarn <= 1.1) P.collide[name] = (P.collide[name] || 0) + 1;
    if (now() - lastSpawn < 2.6) P.banner[name] = (P.banner[name] || 0) + 1;
  });
  KK.on('bossEnrage', () => P.enrage++);
  KK.on('regroup', () => P.regroup++);
  KK.on('magmaShell', ({ e }) => { P.shells++; if (!e._op) { e._op = 1; P.openerShells++; e._opShell = true; } else e._opShell = false; });
  KK.on('shellCrack', () => P.cracks++);
  KK.on('webbed', () => P.webbed++);
  KK.on('webTorn', () => P.torn++);
  KK.on('royalSummons', () => {});
  // first hero hit on the boss vs. when the opener fired
  KK.on('hit', ({ e }) => {
    const fi = hooks.fight();
    if (!fi || e.uid !== fi.uid) return;
    if (fi.firstHit === undefined) { fi.firstHit = now() - (fi.active !== null ? fi.active : fi.t0); P.firstHit.push(fi.firstHit); }
  });
  const origDE = W.damageEnemy;
  W.damageEnemy = function (e, dmg, opts = {}) {
    if (e.pile > 0 && !e.dead) P.pileHitsBlocked++;
    if (e.shell > 0 && !e.dead && !(e.pile > 0)) { if (opts.ult) P.shellHitsU++; else P.shellHitsN++; if (e._opShell && !e._opHit) { e._opHit = 1; P.openerShellHit++; } }
    return origDE.call(this, e, dmg, opts);
  };
  const origDH = W.damageHero;
  W.damageHero = function (h, dmg, src) {
    if (!h.dead) { P.heroDmg += dmg; if (W.boss && W.boss.key === 'magmalord' && !W.boss.dead) P.mlDmg = (P.mlDmg || 0) + dmg; }
    const lava = src && src.key === 'magmalord' && Math.abs(dmg - src.atk * 0.5) < 1e-9;
    if (lava && !h.dead) { P.lavaHits++; P.lavaDmg += dmg; }
    const wasDead = h.dead;
    const r = origDH.call(this, h, dmg, src);
    if (lava && !wasDead && h.dead) P.lavaKO++;
    return r;
  };
  const origUlt = W.castUlt;
  W.castUlt = function (h, free) {
    const b = W.boss;
    if (b && b.pile > 0 && !W.enemies.some((x) => x !== b && !x.dead && x.active)) P.ultOnPile++;
    return origUlt.call(this, h, free);
  };
  const carry = () => { for (const h of W.heroes) if (h.webbed > 0) P.webCarry++; };
  KK.on('floor', carry); KK.on('recovered', carry);
  KK.on('heroDown', ({ h }) => { if (h.webbed > 0) P.webDeadCarry++; });
  hooks.tick.push((dt) => {
    for (const h of W.heroes) if (!h.dead && h.webbed > 0) P.webSec += dt;
    const b = W.boss;
    if (b && !b.dead && b.key === 'warlord' && b.hollowed && b.chPhase && W.wipeT <= 0 && W.trans <= 0) {
      P.wlChargeSec += dt;
      if (b.voidT !== undefined && b._pv === b.voidT) P.wlFrozenVoid += dt;
      if (b._pa === b.atkT) P.wlFrozenAtk += dt;
    }
    if (b) { b._pv = b.voidT; b._pa = b.atkT; }
  });
  hooks.end.push((R) => {
    const L = R.t7 = [];
    const pct = (a, b) => (b ? (100 * a / b).toFixed(0) + '%' : '-');
    // opener before first hit, per key
    const fights = R.boss;
    const keys = ['ratking', 'broodmother', 'embergolem', 'magmalord', 'boneking', 'warlord'];
    const evOf = { ratking: 'royalSummons', broodmother: 'webShot', embergolem: 'magmaShell', magmalord: 'lavaRain', boneking: 'reassemble', warlord: 'chargeWarn' };
    for (const k of keys) {
      for (const hol of [false, true]) {
        const fs = fights.filter((f) => f.key === k && f.hollowed === hol && !f.heart);
        if (!fs.length) continue;
        const ev = evOf[k];
        const seen = fs.filter((f) => f.sig[ev]).length;
        const afterBanner = fs.filter((f) => f.sig[ev] && (f.sigFirst[ev] > 2.6 || (f.sig[ev] || 0) > 1)).length;
        const kills = fs.filter((f) => f.how === 'kill');
        const perFight = med(fs.map((f) => f.sig[ev] || 0));
        const dur = med(kills.map((f) => f.adur));
        const fh = med(fs.filter((f) => f.firstHit !== undefined).map((f) => f.firstHit));
        L.push(`MOVE ${(hol ? 'H-' : '') + k}`.padEnd(20) + ` fights ${fs.length} kills ${kills.length} wipes ${fs.filter((f) => f.how === 'wipe').length} | ${ev} seen ${pct(seen, fs.length)} (a 2nd one or after the 2.6 s boss banner: ${pct(afterBanner, fs.length)}) med/fight ${perFight} | med kill ${isNaN(dur) ? '-' : dur.toFixed(1)} s | first hero hit @${isNaN(fh) ? '-' : fh.toFixed(1)} s`);
      }
    }
    const bk = fights.filter((f) => f.key === 'boneking' && f.how === 'kill' && f.afterReass !== null && f.afterReass !== undefined).map((f) => f.afterReass - 1.5);
    L.push(`REASSEMBLE kills ${bk.length}: standing time after the 1.5 s pile med ${med(bk).toFixed(2)} s, <0.5 s ${bk.filter((x) => x < 0.5).length}, died as pile ${bk.filter((x) => x < 0).length} | hits blocked by the pile ${P.pileHitsBlocked} | ultimates cast at a lone pile ${P.ultOnPile}`);
    L.push(`SHELL ${P.shells} (openers ${P.openerShells}, opener shells that took any hit ${P.openerShellHit} = ${pct(P.openerShellHit, P.openerShells)}), cracked ${P.cracks} = ${pct(P.cracks, P.shells)} | hits on shell normal ${P.shellHitsN} ult ${P.shellHitsU}`);
    L.push(`WEB webbed ${P.webbed}, torn by an ult ${P.torn} = ${pct(P.torn, P.webbed)}, hero-sec webbed ${P.webSec.toFixed(0)}, web carried into a new floor/retreat ${P.webCarry}, webbed heroes knocked out ${P.webDeadCarry}`);
    L.push(`LAVA hits ${P.lavaHits}, KOs ${P.lavaKO}, lava share of all hero damage ${(100 * P.lavaDmg / Math.max(1, P.heroDmg)).toFixed(1)}%, of damage taken in Magma Lord fights ${(100 * P.lavaDmg / Math.max(1, P.mlDmg || 0)).toFixed(1)}%`);
    L.push(`WOUNDS wounded spawns ${P.wounded}; late (f70+, not Hollow/Heart) spawns ${P.late}, wounded ${P.lateWounded}, of which Hollowed ${P.lateWoundedHollowed} | enrages ${P.enrage} regroups ${P.regroup} wipes ${KK.S.stats.wipes}`);
    L.push(`H-WARLORD charging ${P.wlChargeSec.toFixed(0)} s: void timer frozen ${P.wlFrozenVoid.toFixed(0)} s (${pct(P.wlFrozenVoid, P.wlChargeSec)}), attack timer frozen ${P.wlFrozenAtk.toFixed(0)} s`);
    L.push(`ALERTS ${JSON.stringify(P.alerts)} | within 1.1 s after a void warning (replaces it) ${JSON.stringify(P.collide)} | during the 2.6 s boss banner ${JSON.stringify(P.banner)}`);
    L.push(`first hero hit on a boss after activation: med ${med(P.firstHit).toFixed(1)} s`);
  });
}
