// T1 economist, round 07: in-memory balance variants for the real sim (never touches js/).
// apply(KK, V) where V is a plain object, e.g. { caution: 0.4, heroHp: 1.2, noSig: ['webShot'] }.
//   grace: seconds of no-KO onboarding (shipped 600, AND first boss kill)   graceBossOnly: true -> only "before first boss"
//   campLv / campMin: normal-floor camp rule (shipped +4 levels / 8 min)
//   caution: x -> if the party's total HP fell below x of max at any point on a normal floor, farm that floor again
//   cautionUntil: only apply caution while maxFloorEver < N (default: always)
//   eAtkEarly / eHpEarly: [mult, untilFloor] -> enemy atk/hp x mult on floor 1, ramping linearly to x1 at untilFloor
//   heroHp: multiplier on every hero's base HP; armor: [base, growth] for Rivet Armor; qmFree: Quartermaster owned from the start
//   noSig: list of 'royalSummons','webShot','magmaShell','lavaRain','warCharge','reassemble'; webNoTear / shellNoCrack: ults don't break them
function apply(KK, V) {
  if (!V) return KK;
  const W = KK.world, D = KK.DATA, F = KK.F;
  if (V.heroHp) for (const id in D.HEROES) D.HEROES[id].hp *= V.heroHp;
  if (V.knightHp) D.HEROES.knight.hp *= V.knightHp;
  if (V.armor) { const a = D.FORGE.find((d) => d.id === 'armor'); a.base = V.armor[0]; a.growth = V.armor[1]; if (V.armor[2]) a.apply = (m, l) => { m.hp *= 1 + V.armor[2] * l; }; }
  const ramp = (spec, f) => { const [mult, until] = spec; return f >= until ? 1 : mult + (1 - mult) * ((f - 1) / (until - 1)); };
  if (V.eAtkEarly) { const o = F.enemyAtk; F.enemyAtk = (f) => o(f) * ramp(V.eAtkEarly, f); }
  if (V.eHpEarly) { const o = F.enemyHp; F.enemyHp = (f) => o(f) * ramp(V.eHpEarly, f); }
  if (V.qmFree) KK.S.legacy.quartermaster = 1;
  if (V.dynMax) D.WORKSHOP.find((d) => d.id === 'dynamo').max = V.dynMax;
  if (V.recruit) for (const id in V.recruit) D.HEROES[id].recruit = V.recruit[id];
  if (V.unlock) for (const id in V.unlock) D.HEROES[id].unlockFloor = V.unlock[id];
  if (V.qm2) { // Quartermaster v2 owned from the start: recruits when affordable; saves for a recruit only if income covers it within saveWindow s
    const A = KK.actions, Q = V.qm2; let acc = 0;
    KK.S.settings.autoLevel = false; // the shipped autoBuy is off; this one runs instead
    const ou = W.update;
    W.update = function (dt) {
      ou.call(this, dt); acc += dt; if (acc < 0.5) return; acc = 0;
      const S = KK.S;
      for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && S.gold >= A.recruitCost(id) && Q.recruit) A.recruit(id);
      if (D.PARTY_ORDER.some((id) => A.canRecruit(id) && S.gold < A.recruitCost(id) && S.gold + S.incomeRate * (Q.saveWindow || 0) >= A.recruitCost(id))) return;
      for (let i = 0; i < 20; i++) {
        let best = null, bestC = Infinity;
        for (const id of D.PARTY_ORDER) { if (!S.heroes[id]) continue; const c = F.levelCost(id, S.heroes[id]); if (c < bestC) { bestC = c; best = id; } }
        if (!best || bestC > S.gold * (Q.frac || 0.1)) break;
        A.levelHero(best, 1);
      }
    };
  }
  if (V.saver) { // player model: holds gold for an unlocked, unaffordable recruit (what Quartermaster's autoBuy does)
    const A = KK.actions, saving = () => D.PARTY_ORDER.some((id) => A.canRecruit(id) && KK.S.gold < A.recruitCost(id));
    const ol = A.levelHero, of = A.buyForge;
    A.levelHero = function () { if (saving()) return false; return ol.apply(this, arguments); };
    A.buyForge = function () { if (saving()) return false; return of.apply(this, arguments); };
  }
  if (V.grace !== undefined || V.graceBossOnly) {
    const G = V.grace !== undefined ? V.grace : 600;
    W.damageHero = function (h, dmg, src) {
      if (h.dead) return;
      h.hp -= dmg;
      const S0 = KK.S;
      const graced = V.graceBossOnly ? S0.stats.bossKills === 0 : (S0.stats.bossKills === 0 || S0.stats.playTime < G);
      if (h.hp <= 0 && graced) h.hp = 1;
      h.flash = 0.1;
      KK.emit('heroHit', { h, dmg, src });
      if (h.hp <= 0) { h.hp = 0; h.dead = true; KK.emit('heroDown', { h }); W.sanctuaryReact(); if (!W.heroes.some((x) => !x.dead)) W.wipe(); }
    };
  }
  if (V.campLv !== undefined || V.campMin !== undefined || V.bossRegroup !== undefined) {
    const LV = V.campLv !== undefined ? V.campLv : 4, MIN = V.campMin !== undefined ? V.campMin : 8, BR = V.bossRegroup || 3;
    W.wipe = function (reason) {
      if (W.wipeT > 0) return;
      const S = KK.S;
      W.wipeT = 2.4;
      if (reason !== 'enrage') S.stats.wipes++;
      if (!F.isBossFloor(S.floor) && reason !== 'enrage') {
        S.campFloor = S.floor; S.campUntil = S.stats.playTime + MIN * 60;
        S.campLevels = D.PARTY_ORDER.reduce((a, id) => a + (S.heroes[id] || 0), 0) + LV;
      }
      if (F.isBossFloor(S.floor)) {
        S.bossBlock = S.floor;
        S.bossLosses = (S.bossLosses || 0) + 1;
        if (S.bossLosses >= BR) { S.bossLosses = 0; S.campUntil = S.stats.playTime + 600; KK.emit('regroup', { floor: S.floor }); }
      }
      KK.emit('wipe', { floor: S.floor, reason });
    };
  }
  if (V.caution) {
    let minFrac = 1;
    const frac = () => { let a = 0, b = 0; for (const h of W.heroes) { b += h.maxHp; if (!h.dead) a += Math.max(0, h.hp); } return b ? a / b : 1; };
    KK.on('heroHit', () => { const f = frac(); if (f < minFrac) minFrac = f; });
    KK.on('heroDown', () => { const f = frac(); if (f < minFrac) minFrac = f; });
    const onx = W.nextFloor;
    W.nextFloor = function () {
      const S = KK.S;
      const until = V.cautionUntil || 1e9;
      // what the game's own camp/regroup rule will do (so we never double-decrement)
      const lv = D.PARTY_ORDER.reduce((a, id) => a + (S.heroes[id] || 0), 0);
      const cleared = S.campFloor && S.campLevels && lv >= S.campLevels;
      const wall = Math.max(S.bossBlock || 0, cleared ? 0 : (S.campFloor || 0));
      const gameHold = !cleared && wall && S.floor + 1 >= wall && (S.campUntil || 0) > S.stats.playTime;
      let dec = 0;
      const ok = !(V.cautionIdle && KK.lastInputAgo() < V.cautionIdle) && !F.isBossFloor(S.floor) && !(KK.DEMO_CAP && S.floor >= KK.DEMO_CAP - 1) && S.maxFloorEver < until;
      if (ok) {
        if (V.cautionBack && minFrac < V.cautionBack && !F.isBossFloor(S.floor - 1)) dec = 2; // never step back onto a boss floor
        else if (minFrac < V.caution) dec = 1;
        else if (V.preBoss && F.isBossFloor(S.floor + 1) && minFrac < V.preBoss) dec = 1;
      }
      if (dec) KK.cautionHolds = (KK.cautionHolds || 0) + 1;
      if (gameHold) dec = Math.max(0, dec - 1);
      dec = Math.min(dec, S.floor - Math.max(1, KK.mods().startFloor) + 1);
      if (dec > 0) S.floor -= dec;
      minFrac = 1;
      return onx.apply(this, arguments);
    };
    KK.on('recovered', () => { minFrac = 1; });
    KK.on('retired', () => { minFrac = 1; });
  }
  if (V.noSig || V.webNoTear || V.shellNoCrack) {
    const no = new Set(V.noSig || []);
    KK.on('bossSpawn', ({ boss }) => {
      const k = boss.key;
      if ((k === 'ratking' && no.has('royalSummons')) || (k === 'broodmother' && no.has('webShot')) || (k === 'embergolem' && no.has('magmaShell')) || (k === 'magmalord' && no.has('lavaRain'))) boss.sigT = 1e12;
      if (k === 'warlord' && no.has('warCharge')) boss.chT = 1e12;
      if (k === 'boneking' && no.has('reassemble')) boss.reassembled = true;
    });
    if (V.webNoTear) { const oc = W.castUlt; W.castUlt = function (h, free) { const w = h.webbed; const r = oc.call(this, h, free); if (w > 0) h.webbed = w; return r; }; }
    if (V.shellNoCrack) { const od = W.damageEnemy; W.damageEnemy = function (e, dmg, opts = {}) { if (e.shell > 0 && opts.ult) { opts = Object.assign({}, opts, { ult: false }); } return od.call(this, e, dmg, opts); }; }
  }
  return KK;
}
module.exports = { apply };
