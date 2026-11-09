// R8 market: what does a player actually see during "Glimpse of the Depths"? Headless trace from a typist demo run.
// node glimpse_trace.js [seed] [typist|idle]
const load = require('../../../../tools/headless');
const seed = +(process.argv[2] || 1), prof = process.argv[3] || 'typist';
const KK = load({ seed, demo: true }); const W = KK.world, S = () => KK.S, A = KK.actions, D = KK.DATA;
W.reset();
let t = 0, g0 = null, trace = [], ev = [];
const Wd = { S: 213, M: 267, L: 320 }; // approx view widths in game px (render.js Wd) - only L used below
KK.on('glimpse', () => { g0 = t; ev.push(['glimpse', t]); });
['floor', 'wave', 'kill', 'door', 'demoComplete', 'floorClear', 'ult', 'heroDown', 'wipe'].forEach((n) => KK.on(n, (p) => { if (g0 !== null && t - g0 < 120) ev.push([n, +(t - g0).toFixed(1), n === 'kill' ? p.e.def.name : n === 'floor' ? p.floor : n === 'ult' ? p.id : '']); }));
const dt = 1 / 30; let nextG = 0, keyAcc = 0;
while (t < 4 * 3600) {
  if (prof === 'typist') { keyAcc += dt * 3.5; while (keyAcc >= 1) { keyAcc--; KK.addActivity('key'); } }
  W.update(dt); t += dt;
  if (t >= nextG) { nextG = t + 60; // glance: buy levels / recruit / relics
    for (let i = 0; i < 50; i++) { let ok = false; for (const id of D.PARTY_ORDER) { if (!S().heroes[id]) { if (A.canRecruit(id) && A.recruit(id)) ok = true; } else if (A.levelHero(id)) ok = true; } if (!ok) break; }
    if (S().relicOffer) A.pickRelic(S().relicOffer[0]);
  }
  if (g0 !== null && Math.abs((t - g0) % 1) < dt) trace.push([+(t - g0).toFixed(0), S().floor, Math.round(W.partyX), Math.round(W.sealedX || 0), W.sealedX ? Math.round(W.sealedX - W.partyX) : '-', W.enemies.filter((e) => !e.dead).map((e) => e.def.name + '@' + Math.round(e.x - W.partyX)).join(','), W.door ? Math.round(W.door.x - W.partyX) : '']);
  if (g0 !== null && t - g0 > 60) break;
}
if (g0 === null) { console.log('no glimpse within 4 h'); process.exit(); }
console.log(`seed ${seed} ${prof}: glimpse at ${(g0 / 60).toFixed(1)} min, floor ${S().floor}`);
console.log('events (s after glimpse):', JSON.stringify(ev));
console.log('t floor partyX sealedX statue-partyX enemies(rel x) door(rel x)');
for (const r of trace) console.log(r.join('  '));
