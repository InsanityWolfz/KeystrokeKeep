// prints the qmlong / demohint / sealfarm tables. node aggmisc.js
const fs = require('fs'); const rd = (f) => fs.readFileSync(require('path').join(__dirname, 'out', f), 'utf8').trim().split('\n').map(JSON.parse);
const av = (a) => { a = a.filter((x) => x != null); return a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-'; };
console.log('--- Quartermaster, full game, 8 h (6 seeds) ---');
let R = rd('qmlong.jsonl');
for (const p of ['idle', 'typist']) for (const c of ['manual', 'qm', 'qm5', 'manual60', 'qm60', 'qm5_60']) { const X = R.filter((r) => r.cfg === c && r.prof === p); console.log(p.padEnd(7), c.padEnd(9), 'max floor @1/2/4/8h', [1, 2, 4, 8].map((h) => av(X.map((r) => r.cps[h]))).join(' / '), ' renown', av(X.map((r) => r.renown)), ' wipes', av(X.map((r) => r.wipes)), ' QM bought at', av(X.map((r) => r.qmAt)), 'h'); }
console.log('--- demo hint follower, 180 min (10 seeds) ---');
R = rd('demohint.jsonl');
for (const p of ['idle', 'burst']) for (const c of ['h25g60', 'h10g60', 'h10n40g60', 'offg60', 'h25g300', 'h10g300', 'h10n40g300', 'offg300']) { const X = R.filter((r) => r.cfg === c && r.prof === p); console.log(p.padEnd(6), c.padEnd(11), 'glimpse', av(X.map((r) => r.glimpse)), `(${X.filter((r) => r.glimpse != null).length}/${X.length})`, ' early retires', av(X.map((r) => r.nEarly)), ' renown@180', av(X.map((r) => r.renown)), ' e.g.', X[0].early.slice(0, 40)); }
console.log('--- Seal farming, 8 h after an honest day 1 (6 seeds) ---');
R = rd('sealfarm.jsonl');
for (const c of ['honest', 'farm', 'farm_gap', 'farm_gap2h']) for (const p of ['typist', 'idle']) { const X = R.filter((r) => r.cfg === c && r.prof === p); console.log(c.padEnd(11), p.padEnd(7), 'renown', av(X.map((r) => r.renown)), ' max floor', av(X.map((r) => r.floor)), ' seals', av(X.map((r) => r.seals)), ' seal renown', av(X.map((r) => r.sealVal)), ' Devout', X.filter((r) => r.achSeals.includes('seals30')).length + '/' + X.length); }
const S = R.filter((r) => r.cfg === 'stale'); console.log('stale star: delves flipped', S.filter((r) => r.flipped).length, '/', S.length, ' reached Seal floor', S.filter((r) => r.reachedSealFloor).length, ' paid in stale delve', S.reduce((a, r) => a + r.claimedAfterFlip, 0), ' stale claims total', S.reduce((a, r) => a + r.staleClaims, 0));
