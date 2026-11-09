// Round 07 debug: are keystrokes landing while a hero is webbed? node dbg_webkeys.js <profile> [webKeys]
const { run } = require('../round-06/r6lib');
let act = 0, actWeb = 0, webbedEv = 0, torn = 0;
run({ profile: process.argv[2] || 'typist', seed: 1, min: 480, patch: (KK) => {
  const W = KK.world;
  KK.on('activity', () => { act++; if (W.heroes.some((h) => h.webbed > 0)) actWeb++; });
  KK.on('webbed', () => webbedEv++);
  KK.on('webTorn', () => torn++);
  if (process.argv[3]) KK.on('activity', () => { for (const h of W.heroes) if (h.webbed > 0) { h.webbed -= 0.25; if (h.webbed <= 0) { h.webbed = 0; KK.emit('webTorn', { h }); } } });
} });
console.log({ act, actWeb, webbedEv, torn, keysPerWeb: (actWeb / webbedEv).toFixed(2) });
