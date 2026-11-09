// Named in-memory variants for r7patch.apply (round 07, T1 economist)
module.exports = {
  base: {},
  // onboarding grace
  grace20: { grace: 1200 }, grace15: { grace: 900 }, graceBoss: { graceBossOnly: true },
  // normal-floor camp rule
  camp8lv: { campLv: 8 }, camp12lv: { campLv: 12 }, camp8lv12m: { campLv: 8, campMin: 12 }, camp20lv: { campLv: 20, campMin: 15 },
  // caution: replay a normal floor that took the party below x of its total HP
  caut30: { caution: 0.3 }, caut40: { caution: 0.4 }, caut50: { caution: 0.5 }, caut60: { caution: 0.6 },
  caut40u40: { caution: 0.4, cautionUntil: 41 }, caut50u40: { caution: 0.5, cautionUntil: 41 },
  // early enemy curve
  atk70u30: { eAtkEarly: [0.7, 30] }, atk60u40: { eAtkEarly: [0.6, 40] }, atk50u40: { eAtkEarly: [0.5, 40] }, atk70u40: { eAtkEarly: [0.7, 40] },
  hp80u30: { eHpEarly: [0.8, 30] },
  // hero HP / armor / QM
  hhp125: { heroHp: 1.25 }, hhp150: { heroHp: 1.5 }, hhp200: { heroHp: 2 },
  armor60: { armor: [60, 1.55] }, armor40: { armor: [40, 1.5] }, armor20pct: { armor: [100, 1.65, 0.2] },
  qm: { qmFree: true },
  // recruit costs / player that saves for recruits
  cler2k: { recruit: { cleric: 2000 } }, cler1k: { recruit: { cleric: 1000 } }, cler15: { recruit: { cleric: 1500, mage: 800 } },
  saver: { saver: true }, saverC50: { saver: true, caution: 0.5 },
  br1: { bossRegroup: 1 }, br2: { bossRegroup: 2 },
  c50br2: { caution: 0.5, bossRegroup: 2 }, c50cler2k: { caution: 0.5, recruit: { cleric: 2000 } }, c50hhp125: { caution: 0.5, heroHp: 1.25 },
  c40hhp125: { caution: 0.4, heroHp: 1.25 }, c50qm: { caution: 0.5, qmFree: true }, c50g20: { caution: 0.5, grace: 1200 },
  c45: { caution: 0.45 }, c55: { caution: 0.55 },
  c50br1: { caution: 0.5, bossRegroup: 1 }, c55br1: { caution: 0.55, bossRegroup: 1 }, c50h125br1: { caution: 0.5, heroHp: 1.25, bossRegroup: 1 },
  c55hhp125: { caution: 0.55, heroHp: 1.25 }, c60hhp125: { caution: 0.6, heroHp: 1.25 }, c50hhp150: { caution: 0.5, heroHp: 1.5 },
  c50knight150: { caution: 0.5, knightHp: 1.5 }, c50h125g15: { caution: 0.5, heroHp: 1.25, grace: 900 },
  c55h125qm: { caution: 0.55, heroHp: 1.25, qmFree: true }, c50qmS: { caution: 0.5, qmFree: true },
  c50b30: { caution: 0.5, cautionBack: 0.3 }, c60b35: { caution: 0.6, cautionBack: 0.35 }, c50pb75: { caution: 0.5, preBoss: 0.75 }, c50pb85: { caution: 0.5, preBoss: 0.85 },
  c60b35pb85: { caution: 0.6, cautionBack: 0.35, preBoss: 0.85 }, c60b35h125: { caution: 0.6, cautionBack: 0.35, heroHp: 1.25 }, c50pb75br1: { caution: 0.5, preBoss: 0.75, bossRegroup: 1 },
  c60b35pb85br1: { caution: 0.6, cautionBack: 0.35, preBoss: 0.85, bossRegroup: 1 }, c50h125pb85: { caution: 0.5, heroHp: 1.25, preBoss: 0.85 },
  pb85: { caution: 0.0001, preBoss: 0.85 }, c60pb85: { caution: 0.6, preBoss: 0.85 }, c60b35pb85h125: { caution: 0.6, cautionBack: 0.35, preBoss: 0.85, heroHp: 1.25 }, c50b30pb85: { caution: 0.5, cautionBack: 0.3, preBoss: 0.85 },
  c60b35pb90: { caution: 0.6, cautionBack: 0.35, preBoss: 0.9 },
  qm2: { qm2: { recruit: true, saveWindow: 120 } }, qm2nr: { qm2: { recruit: false, saveWindow: 120 } }, qm2c60b35pb85: { qm2: { recruit: true, saveWindow: 120 }, caution: 0.6, cautionBack: 0.35, preBoss: 0.85 },
  qm2c50pb85: { qm2: { recruit: true, saveWindow: 120 }, caution: 0.5, preBoss: 0.85 }, qm2f30: { qm2: { recruit: true, saveWindow: 120, frac: 0.3 } },
  c60b35pb85u61: { caution: 0.6, cautionBack: 0.35, preBoss: 0.85, cautionUntil: 61 }, c60b35pb85u41: { caution: 0.6, cautionBack: 0.35, preBoss: 0.85, cautionUntil: 41 },
  c50pb85u61: { caution: 0.5, preBoss: 0.85, cautionUntil: 61 },
  c60b35pb85i30: { caution: 0.6, cautionBack: 0.35, preBoss: 0.85, cautionIdle: 30 }, c60b35pb85i60: { caution: 0.6, cautionBack: 0.35, preBoss: 0.85, cautionIdle: 60 },
  dyn6: { dynMax: 6 }, dyn6c: { dynMax: 6, caution: 0.6, cautionBack: 0.35, preBoss: 0.85, cautionIdle: 30 },
  // signature moves
  noSig: { noSig: ['royalSummons', 'webShot', 'magmaShell', 'lavaRain', 'warCharge', 'reassemble'] },
  noWeb: { noSig: ['webShot'] }, noShell: { noSig: ['magmaShell'] }, noLava: { noSig: ['lavaRain'] }, noSummons: { noSig: ['royalSummons'] },
  noCharge: { noSig: ['warCharge'] }, noReass: { noSig: ['reassemble'] },
  webNoTear: { webNoTear: true }, shellNoCrack: { shellNoCrack: true }, noUltBreak: { webNoTear: true, shellNoCrack: true },
};
