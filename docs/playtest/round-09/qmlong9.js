// T1 economist, round 09: Quartermaster for a hands-off full-game player over 8 h.
// manual: econ6lib smart spender. qm: spends manually only until Quartermaster is owned, then only picks relics,
// catches rats, buys Legacy/Workshop and retires (nudge); Quartermaster spends all gold.
// node qmlong9.js --profile idle --seed 1 --mode qm|manual [--hours 8 --glance 300]
const { load, makePlayer } = require('../round-06/econ6lib');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = v; i++; } } }
const PROF = args.profile || 'idle', SEED = +(args.seed || 1), MODE = args.mode || 'qm', H = +(args.hours || 8);
const KK = load({ seed: SEED });
const A = KK.actions, D = KK.DATA, W = KK.world;
KK.today = () => 'd' + Math.floor(KK.S.stats.playTime / (8 * 3600));
const P = makePlayer(KK, { profile: PROF, retire: 'nudge', omen: 'random', glance: +(args.glance || 300) });
const sp = P.spend; let qmAt = null;
P.spend = () => {
  const s = KK.S;
  if (!MODE.startsWith('qm') || !s.legacy.quartermaster) return sp();
  if (qmAt === null) qmAt = +(P.t / 3600).toFixed(2);
  P.pickRelic(); if (W.rat) W.catchRat();
  let ch = true; while (ch) { ch = false; for (const d of D.LEGACY) if (A.buyLegacy(d.id)) ch = true; }
  for (let k = 0; k < 50; k++) { let did = false; for (const d of D.WORKSHOP) if (A.buyWorkshop(d.id)) did = true; if (!did) break; }
};
if (MODE === 'qm5' || MODE === 'qm5f') {
  // variant: Quartermaster also keeps Swift Boots and Keen Edge (max 10) bought at <= 25% of gold, every 0.5 s like autoBuy
  const ou = W.update; let acc = 0;
  W.update = function (dt) { const r = ou.call(this, dt); acc += dt; const s = KK.S; if (acc > 0.5 && s.legacy.quartermaster) { acc = 0; for (const id of ['swift', 'keen']) { const d = D.FORGE.find((x) => x.id === id); if ((s.forge[id] || 0) < d.max && KK.F.upCost(d, s.forge[id] || 0) <= s.gold * 0.25) A.buyForge(id); } } return r; };
}
W.reset();
const cps = {}; const want = [1, 2, 4, 8].map((h) => h * 3600);
while (P.t < H * 3600) { P.step(1 / 30); while (want.length && P.t >= want[0]) { cps[want.shift() / 3600] = KK.S.maxFloorEver; } }
const S = KK.S;
let gold = 0; // unspent gold at the end, in cheapest levels
console.log(JSON.stringify({ prof: PROF, seed: SEED, mode: MODE, qmAt, cps, renown: S.renownLifetime, wipes: S.stats.wipes, retires: S.retires, forge: S.forge }));
