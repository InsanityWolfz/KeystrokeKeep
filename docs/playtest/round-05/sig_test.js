// Round 05 auditor: in-memory prototype of one signature move per early boss (no game file touched).
// Each move: an opener shortly after the boss engages (so even a 2-second fight shows it), then a timer.
// node docs/playtest/round-05/sig_test.js [--only warlord,boneking,...] > out/sig_test.txt
const { run, med } = require('./r5lib');
const args = process.argv.slice(2);
const onlyArg = args.indexOf('--only') >= 0 ? args[args.indexOf('--only') + 1].split(',') : null;

// --- the proposed numbers (mirrors the data rows in the report)
const SIG = {
  ratking: { first: 1.0, every: 9, n: 2, hp: 0.35, atk: 0.6, max: 4 },              // Royal Summons
  boneking: { risePct: +(process.env.RISE || 0.4), risePctHollowed: 0.25, pile: 1.5 },                       // Reassemble (once, on death)
  broodmother: { first: 1.5, every: 7, web: 2.5, dmg: 0.3 },                          // Web Shot at the back hero
  warlord: { first: 1.5, every: 10, back: 30, wind: 1.0, speed: 120, dmg: 2.0, push: 16, stun: 0.8 }, // War Charge
  embergolem: { every: 12, shell: 0.3, crackStun: 1.0, maxShell: +(process.env.SHELLMAX || 99) },                              // Magma Shell
  magmalord: { first: 1.0, every: 8, drops: 3, warn: 0.9, dmg: 0.9 },                 // Lava Rain
};

function patch(on) {
  return (KK, hooks) => {
    const W = KK.world, F = KK.F, D = KK.DATA;
    const tel = KK.__sig = { casts: {} };
    const cast = (k) => (tel.casts[k] = (tel.casts[k] || 0) + 1);
    const useOn = (k) => on.includes(k);
    // Bone King: Reassemble
    const origKill = W.killEnemy;
    W.killEnemy = function (e) {
      if (useOn('boneking') && e.boss && e.key === 'boneking' && !e.rose) {
        e.rose = true; e.dead = false; e.hp = e.maxHp * (e.hollowed ? SIG.boneking.risePctHollowed : SIG.boneking.risePct); e.stun = SIG.boneking.pile; cast('boneking');
        return;
      }
      return origKill.call(this, e);
    };
    // Ember Colossus: Magma Shell (normal hits x0.3 while shelled; any ultimate cracks it)
    const origDmg = W.damageEnemy;
    W.damageEnemy = function (e, dmg, opts = {}) {
      if (useOn('embergolem') && e.key === 'embergolem' && e.shell) {
        if (opts.ult) { e.shell = false; e.stun = Math.max(e.stun || 0, SIG.embergolem.crackStun); cast('embergolem_crack'); }
        else dmg *= SIG.embergolem.shell;
      }
      return origDmg.call(this, e, dmg, opts);
    };
    hooks.tick.push((dt) => {
      const e = W.boss;
      if (!e || e.dead || !e.active) return;
      const front = W.frontHero();
      if (!front) return;
      e.sigClock = (e.sigClock || 0) + dt;
      const S = KK.S;
      if (useOn('ratking') && e.key === 'ratking') {
        const s = SIG.ratking;
        e.sigT = (e.sigT === undefined ? s.first : e.sigT) - dt;
        if (e.sigT <= 0) {
          e.sigT = s.every;
          const live = W.enemies.filter((x) => !x.dead && x.minion).length;
          for (let i = 0; i < Math.min(s.n, s.max - live); i++) {
            const def = D.MONSTERS.rat, hp = F.enemyHp(S.floor) * def.hp * s.hp * KK.mods().eHp;
            W.enemies.push({ kind: 'enemy', key: 'rat', def, uid: W.id++, x: e.x - 16 - i * 12, y: W.GROUND, hp, maxHp: hp, atk: F.enemyAtk(S.floor) * def.atk * s.atk * KK.mods().eAtk, gold: 0, atkT: 0.8, atkSpd: 1.3, boss: false, dead: false, active: true, flash: 0, kb: 0, stun: 0, anim: 0, spawnT: 0, lunge: 0, hits: 0, minion: true });
          }
          cast('ratking');
        }
      }
      if (useOn('broodmother') && e.key === 'broodmother') {
        const s = SIG.broodmother;
        e.sigT = (e.sigT === undefined ? s.first : e.sigT) - dt;
        if (e.sigT <= 0) {
          e.sigT = s.every;
          const back = W.heroes.filter((h) => !h.dead).sort((a, b) => b.slot - a.slot)[0];
          if (back) { back.atkT = Math.max(back.atkT, s.web); W.damageHero(back, e.atk * s.dmg, e); cast('broodmother'); }
        }
      }
      if (useOn('warlord') && e.key === 'warlord') {
        const s = SIG.warlord;
        e.sigT = (e.sigT === undefined ? s.first : e.sigT) - dt;
        if (!e.chg && e.sigT <= 0) { e.chg = { ph: 'back', d: 0, t: 0 }; }
        if (e.chg) {
          const c = e.chg;
          e.atkT = Math.max(e.atkT, 0.5); // no normal swings during the charge
          if (c.ph === 'back') { const step = 60 * dt; e.x += step + e.def.speed * dt; c.d += step; if (c.d >= s.back) { c.ph = 'wind'; c.t = s.wind; } }
          else if (c.ph === 'wind') { e.x += e.def.speed * dt; c.t -= dt; if (c.t <= 0) c.ph = 'run'; }
          else if (c.ph === 'run') {
            e.x -= s.speed * dt;
            if (e.x - front.x <= e.def.w / 2 + e.def.range) {
              W.damageHero(front, e.atk * s.dmg, e);
              W.partyX -= s.push;
              if (!front.dead) front.atkT = Math.max(front.atkT, s.stun);
              e.chg = null; e.sigT = s.every; cast('warlord');
            }
          }
        }
      }
      if (useOn('embergolem') && e.key === 'embergolem') {
        const s = SIG.embergolem;
        if (e.shellT === undefined) { e.shellT = s.every; e.shell = true; cast('embergolem'); }
        e.shellT -= dt;
        if (e.shell && s.every - e.shellT >= s.maxShell) e.shell = false;
        if (e.shellT <= 0) { e.shellT = s.every; e.shell = true; cast('embergolem'); }
      }
      if (useOn('magmalord') && e.key === 'magmalord') {
        const s = SIG.magmalord;
        e.sigT = (e.sigT === undefined ? s.first : e.sigT) - dt;
        if (e.sigT <= 0) {
          e.sigT = s.every;
          const alive = W.heroes.filter((h) => !h.dead);
          const targets = []; for (let i = 0; i < s.drops; i++) targets.push(alive[Math.floor(Math.random() * alive.length)]);
          (e.drops = e.drops || []).push({ t: s.warn, targets });
          cast('magmalord');
        }
        if (e.drops) for (const d of e.drops) { d.t -= dt; if (d.t <= 0 && !d.done) { d.done = true; for (const h of d.targets) if (h && !h.dead) W.damageHero(h, e.atk * s.dmg, e); } }
      }
    });
  };
}

function summarize(R) {
  const by = {};
  for (const f of R.boss) { const k = (f.hollowed ? 'H-' : '') + f.key; (by[k] = by[k] || []).push(f); }
  const out = {};
  for (const [k, fs] of Object.entries(by)) out[k] = { n: fs.length, wipes: fs.filter((f) => f.how === 'wipe').length, dur: med(fs.filter((f) => f.how === 'kill').map((f) => f.dur)) };
  return out;
}

const KEYS = Object.keys(SIG);
const variants = onlyArg ? [['base', []], ...onlyArg.map((k) => [k, [k]])] : [['base', []], ['all6', KEYS]];
const configs = process.env.CFG === 'weak' ? [{ profile: 'idle', seed: 1, min: 480 }, { profile: 'burst', seed: 1, min: 480 }, { profile: 'idle', seed: 1, min: 180, demo: true }, { profile: 'burst', seed: 1, min: 180, demo: true }] : [
  { profile: 'typist', seed: 1, min: 480 }, { profile: 'typist', seed: 2, min: 480 }, { profile: 'idle', seed: 1, min: 480 }, { profile: 'burst', seed: 1, min: 480 },
  { profile: 'typist', seed: 1, min: 180, demo: true }, { profile: 'idle', seed: 1, min: 180, demo: true },
];
const L = [];
for (const c of configs) {
  const res = {};
  for (const [name, on] of variants) {
    const R = run(Object.assign({ retire: 'nudge', omen: 'random', patch: patch(on) }, c));
    res[name] = { R, sum: summarize(R), casts: R.KK.__sig.casts };
  }
  L.push(`=== ${c.profile} s${c.seed} ${c.min}m${c.demo ? ' DEMO' : ''}`);
  for (const [name] of variants) {
    const r = res[name], E = r.R.end;
    L.push(`  ${name.padEnd(12)} maxEver ${E.maxEver}, retires ${E.retires}, renown ${E.renownLife}, ach ${E.achN}, sanct casts ${r.R.sanct.casts}, wipes(boss) ${r.R.boss.filter((f) => f.how === 'wipe').length}${c.demo ? `, best f40 ${(E.bestCapTime / 60).toFixed(1)}m laps ${E.demoLaps}` : ''}; sig casts ${JSON.stringify(r.casts)}`);
  }
  const keys = [...new Set(variants.flatMap(([n]) => Object.keys(res[n].sum)))].sort();
  L.push('    boss            ' + variants.map(([n]) => `${n}: n/wipes/median s`.padEnd(30)).join(''));
  for (const k of keys) L.push('    ' + k.padEnd(16) + variants.map(([n]) => { const s = res[n].sum[k]; return (s ? `${s.n}/${s.wipes}/${isNaN(s.dur) ? '-' : s.dur.toFixed(1)}` : '-').padEnd(30); }).join(''));
}
console.log(L.join('\n'));
