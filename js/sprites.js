/* Keystroke Keep — all pixel art, authored as text and baked to canvases at boot.
   '.' = transparent. Letters map to the palette below. Heroes face right, monsters face left. */
(function () {
  'use strict';
  const KK = window.KK;

  const PAL = {
    k: '#1b1424', K: '#2e2440',
    w: '#f4f1ea', g: '#b4bccb', G: '#6b7487', d: '#454c5e',
    s: '#f4c79e', S: '#c98d6a',
    r: '#e04848', R: '#922a3a',
    b: '#4a86e0', B: '#28468f',
    y: '#fbd14b', Y: '#c08a2a',
    n: '#9a6238', N: '#5e3a24',
    e: '#6cd05a', E: '#2e7d3e',
    p: '#a865e8', P: '#5d2f99',
    o: '#f59a3a', O: '#b4521e',
    c: '#7ee8f6', C: '#2f9cb8',
    m: '#f27cc0',
    l: '#ece0c0', L: '#b3a37f',
    v: '#3b2a57',
    z: '#ff5a2e', Z: '#ffe08a',
  };
  KK.PAL = PAL;

  // ---------------------------------------------------------------- heroes
  const KNIGHT = [
    '......rrr.......',
    '.....krrrk......',
    '....kgggggk.....',
    '...kgwggggGk....',
    '...kgwgkkkkk....',
    '...kgggkcckk..k.',
    '...kgggggGGk.kwk',
    '....kGGGGGk.kwk.',
    '..kkkbbybbkkwk..',
    '.kgggkbyybkskk..',
    '.kgyGkbbybkkk...',
    '.kgggkbbbbbk....',
    '..kgkkBBBBBk....',
    '...k.kGGkGGk....',
    '.....kGk.kGk....',
    '.....kkk.kkk....',
  ];
  const KNIGHT_LEGS = [
    '...k.kGGkGGk....',
    '....kGk...kGk...',
    '....kkk...kkk...',
  ];
  const ARCHER = [
    '................',
    '......kkkk...k..',
    '.....kEEEEk..wN.',
    '....kEeeeeEk.w.N',
    '....kEesskEk.w.N',
    '....kEsssskk.w.N',
    '.....kSSSk...w.N',
    '....kkEEEEkskw.N',
    '...kEkeeeek..w.N',
    '...knkeyeek..w.N',
    '...knkeeeek..wN.',
    '....kkEEEEk..wN.',
    '.....kNNkNNk.k..',
    '.....kNNkNNk....',
    '.....knk.knk....',
    '.....kkk.kkk....',
  ];
  const ARCHER_LEGS = [
    '....kNNk..kNNk..',
    '....knk....knk..',
    '....kkk....kkk..',
  ];
  const MAGE = [
    '........k....kk.',
    '.......kpk..kcck',
    '......kpPpk.kcwk',
    '.....kpppPPk.kkk',
    '...kPPPPPPPPk.n.',
    '....kgssksk...n.',
    '....kwwwwwk..sn.',
    '...kpkwwwkpkksn.',
    '...kppkwkppppkn.',
    '...kpppyppppk.n.',
    '...kppppPPPPk.n.',
    '..kppppPPPPPPkn.',
    '..kPPPPPPPPPPkn.',
    '..kkkkkkkkkkkkn.',
    '....kNk..kNk..n.',
    '....kkk..kkk..n.',
  ];
  const MAGE_LEGS = [
    '...kNk....kNk.n.',
    '...kkk....kkk.n.',
  ];
  const CLERIC = [
    '......kyk.......',
    '.....kwywk......',
    '.....kwywk......',
    '....kwwywwk.....',
    '....kyyyyyk.....',
    '....ksssksk.....',
    '.....kSSSk...kk.',
    '....kwwwwwk.kyyk',
    '...kwkwywwkkskk.',
    '...kwwwywwwk.n..',
    '...kwwwywwwk.n..',
    '...kgwwywwgk.n..',
    '...kgggyggGk....',
    '....kkkkkkk.....',
    '.....knk.knk....',
    '.....kkk.kkk....',
  ];
  const CLERIC_LEGS = [
    '....knk...knk...',
    '....kkk...kkk...',
  ];

  // ---------------------------------------------------------------- monsters (face left)
  const RAT = [
    '...kk...........',
    '..kGgk.kkkkk....',
    '.kGGGGkGGGGGk...',
    'kGkGGGGGGGGGGk..',
    'mGGGGGGGGGGGGGkk',
    'kkGGGGgggGGGGkmk',
    '.kkGkkkkkkGkk.mk',
    '..kk......kk..k.',
  ];
  const RAT_B = [
    '................',
    '...kk...........',
    '..kGgk.kkkkk....',
    '.kGGGGkGGGGGk...',
    'kGkGGGGGGGGGGkkk',
    'mGGGGGGGGGGGGkmk',
    'kkGGGgggGGGGGk.k',
    '.kkk.kk..kkkk...',
  ];
  const SKELETON = [
    '....kkkkk...',
    '...klllllk..',
    '..kkklllLk..',
    '..kkklllLk..',
    '..klllllLk..',
    '...klkLkk...',
    '....kllk....',
    '.k.kklllkk..',
    'kgklkLlLklk.',
    '.kgklLlLkllk',
    '..klklLlk.lk',
    '...k.klk..kk',
    '....kLlLk...',
    '....kl.lk...',
    '....kl.lk...',
    '...kkk.kkk..',
  ];
  const SKELETON_B = SKELETON.slice(0, 12).concat([
    '....kLlLk...',
    '...kl..lk...',
    '...kl...lk..',
    '..kkk...kkk.',
  ]);
  const BAT = [
    'k............k',
    'kk..k....k..kk',
    'kPk.kkkkkk.kPk',
    'kPPkkPPPPkkPPk',
    '.kPPkPrPrkPPk.',
    '..kkkPPPPkkk..',
    '.....kkkk.....',
    '..............',
  ];
  const BAT_B = [
    '..............',
    '....k....k....',
    '....kkkkkk....',
    '...kkPPPPkk...',
    '.kkPkPrPrkPkk.',
    'kPPPkPPPPkPPPk',
    'kPk.kkkkkk.kPk',
    'kk..........kk',
  ];
  const SLIME = [
    '......kk......',
    '....kkeekk....',
    '...keeewwek...',
    '..keeeeewwek..',
    '.keekeeekeeek.',
    '.keekeeekeeek.',
    'keeeeeeeeeeeek',
    'keEeeeeeeeeeEk',
    'kEEEEEEEEEEEEk',
    '.kkkkkkkkkkkk.',
  ];
  const SLIME_B = [
    '..............',
    '......kk......',
    '....kkeewk....',
    '..kkeeeeewkk..',
    '.keekeeekeeek.',
    'keeekeeekeeeek',
    'keeeeeeeeeeeek',
    'keEeeeeeeeeeEk',
    'kEEEEEEEEEEEEk',
    'kkkkkkkkkkkkkk',
  ];
  const SPIDER = [
    '......kkkk......',
    '....kkPPPPkk....',
    '...kPPPPPPPPk...',
    'k.kPrPrPPPPPPk.k',
    '.kkrPrPPPPPPPkk.',
    'k.kPPPPPPPPPPk.k',
    '.k.kkPkPkkPkk.k.',
    'k.k.k.k..k.k.k.k',
  ];
  const SPIDER_B = [
    '......kkkk......',
    '....kkPPPPkk....',
    '...kPPPPPPPPk...',
    '.kkPrPrPPPPPPkk.',
    'k.krPrPPPPPPPk.k',
    '.kkPPPPPPPPPPkk.',
    'k..kkPkPkkPkk..k',
    '.k.k..k..k..k.k.',
  ];
  const GOBLIN = [
    '....kkkk....',
    'kk.keeeek.kk',
    'keeeyeeyeeek',
    '.kkeeeeeekk.',
    '...kekkkek..',
    '....keeek...',
    '..knnnnnnk..',
    '.kgknnnnnnk.',
    'kgkeknnnnke.',
    '.k.knnynnk..',
    '...knnnnnk..',
    '...kek.kek..',
    '...kek.kek..',
    '..kkk.kkk...',
  ];
  const GOBLIN_B = GOBLIN.slice(0, 11).concat([
    '..kek...kek.',
    '..kek...kek.',
    '.kkk...kkk..',
  ]);
  const IMP = [
    '..k....k....',
    '..kk..kk....',
    '..krrrrk....',
    '.kyrrryrk...',
    '.krrrrrrk...',
    '..kRkkRk....',
    'kk.krrk..kk.',
    'kRkrrrrkkRRk',
    '.kRrrrrrkRk.',
    '..krRRrk.k..',
    '...kr.rk....',
    '...kk.kk....',
  ];
  const IMP_B = [
    '..k....k....',
    '..kk..kk....',
    '..krrrrk....',
    '.kyrrryrk...',
    '.krrrrrrk...',
    '..kRkkRk.kk.',
    '...krrk.kRRk',
    '.kkrrrrkkRk.',
    'kRRrrrrrkk..',
    'kRkrRRrk....',
    '.k.kr.rk....',
    '...kk.kk....',
  ];
  const GOLEM = [
    '....kkkkkk....',
    '...kddGGGdk...',
    '...kdzddzdk...',
    '...kddddddk...',
    '.kkkkdoodkkkk.',
    'kddGdkddkdGddk',
    'kdGddddoddddGk',
    'kddkddoddddkdk',
    'kddkddddoddkdk',
    'kddkdddddddkdk',
    '.kkkdddoddddkk',
    '...kddddddk...',
    '...kddkkddk...',
    '..kddk..kddk..',
    '..kddk..kddk..',
    '..kkkk..kkkk..',
  ];
  const EYE = [
    '...kkkkkk...',
    '..kppppppk..',
    '.kpwwwwwwpk.',
    'kpwwccwwwwpk',
    'kpwckkcwwwpk',
    'kpwckkcwwwpk',
    'kpwwccwwwwpk',
    '.kpwwwwwwpk.',
    '..kppppppk..',
    '...kpkkpk...',
    '..kp.kp.kp..',
    '..k..k...k..',
  ];
  const EYE_B = EYE.slice(0, 9).concat([
    '...kpkkpk...',
    '...kp.kp.kp.',
    '...k..k..k..',
  ]);
  const WRAITH = [
    '....kkkk....',
    '...kvvvvk...',
    '..kvkkkkvk..',
    '..kvkckckk..',
    '..kvkkkkvk..',
    '.kvvvvvvvvk.',
    'kpkvvvvvvkpk',
    'kpkvvpvvvkpk',
    '.kkvvvvpvvk.',
    '..kvpvvvvk..',
    '..kvvvpvvk..',
    '..kpvkvpvk..',
    '...kp.kp.k..',
    '...k...k....',
  ];
  const WRAITH_B = WRAITH.slice(0, 11).concat([
    '..kvpkvpk...',
    '..kp.kp.k...',
    '..k...k.....',
  ]);
  // the Heartroot
  const LASHER = [
    '....kkk.....',
    '...kRrRk....',
    '..kRrZrRk...',
    '..kRrrrRk...',
    '...kRRRk.kk.',
    '..k.kEk.kEEk',
    '.kEk.kEkEk..',
    'kEk..kEEk...',
    '.k...kEk....',
    '.....kEk....',
    '....kEEk....',
    '....kEk.....',
    '...kNEk.....',
    '..kNNNk.....',
    '.kNNnNNk....',
    'kkkkkkkkk...',
  ];
  const LASHER_B = LASHER.slice(0, 4).concat([
    '...kRRRk....',
    '.kk.kEk.....',
    'kEEkkEk.k...',
    '...kEEkkEk..',
    '....kEk..kEk',
  ], LASHER.slice(9));
  const BLOAT = [
    '....kkkkkk....',
    '..kkmmmmmmkk..',
    '.kmmwmmmmZmmk.',
    'kmmmmmmmmmmmmk',
    'kmZmmmmmwmmmmk',
    'kmmmmkmmkmmZmk',
    'kmmmmmmmmmmmmk',
    '.kmmmkkkkmmmk.',
    '..kRmmmmmmRk..',
    '...kRRRRRRk...',
    '...kNk..kNk...',
    '...kk....kk...',
  ];
  const BLOAT_B = ['..............'].concat(BLOAT.slice(0, 3), BLOAT.slice(4, 9), ['..kRRRRRRRRk..', '..kNk....kNk..', '..kk......kk..']);
  const SPORELING = [
    '..kkkk..',
    '.kmmZmk.',
    'kmmmmmmk',
    'kmkmmkmk',
    '.kmmmmk.',
    '.kk..kk.',
  ];
  const SPORELING_B = ['........', '..kkkk..', '.kmmZmk.', 'kmkmmkmk', '.kmmmmk.', 'kk....kk'];
  const WARDEN = [
    '....kkkkkk....',
    '...kNnnnnNk...',
    '...knkZZknk...',
    '...kNnnnnNk...',
    '.kkkkNnnNkkkk.',
    'kEEnkNNNNknEEk',
    'kEnnkNrrNknnEk',
    'kEnnkrmmrknnEk',
    'kNnnkNrrNknnNk',
    'kNnnkNNNNknnNk',
    '.kkkNnnnnNkkk.',
    '...kNnnnnNk...',
    '...kNNkkNNk...',
    '..kNnk..kNnk..',
    '..kNnk..kNnk..',
    '..kkkk..kkkk..',
  ];
  const WARDEN_B = WARDEN.slice(0, 12).concat(['...kNNkkNNk...', '.kNnk....kNnk.', '.kNnk....kNnk.', '.kkkk....kkkk.']);
  const KEEPER = [
    '....kkkk.....',
    '...kPPPPk....',
    '..kPvvvvPk...',
    '..kPkZkZPk...',
    '..kPvvvvPk.k.',
    '...kPPPPk.kyk',
    '..kPPPPPPkkyk',
    '.kPPvPPvPPkyk',
    'kPPvvPPvvPkyk',
    'kPvvPyyPvvkyk',
    'kPvvPyyPvvkyk',
    'kPPvvPPvvPkyk',
    '.kPvvvvvvPkyk',
    '.kPvvvvvvPkk.',
    '.kPPvvvvPPk..',
    'kPPPvvvvPPPk.',
    'kPPPPPPPPPPk.',
    'kkkkkkkkkkkk.',
  ];
  const KEEPER_B = KEEPER.slice(0, 14).concat(['.kPPvvvvPPk..', '.kPPvvvvPPPk.', 'kPPPPPPPPPPk.', 'kkkkkkkkkkkk.']);
  const CROWN = [
    '.k.k.k.',
    'kykykyk',
    'kyyyyyk',
    'kryyyrk',
    'kkkkkkk',
  ];

  // ---------------------------------------------------------------- props & icons
  const CHEST = [
    '.kkkkkkkkkk.',
    'knnnnnnnnnnk',
    'kyNNNNNNNNyk',
    'kkkkkkkkkkkk',
    'kynnkyykknyk',
    'knnnkYYknnnk',
    'knnnnkknnnnk',
    'kynnnnnnnnyk',
    'kNNNNNNNNNNk',
    'kkkkkkkkkkkk',
  ];
  const CHEST_OPEN = [
    '.kkkkkkkkkk.',
    'knNNNNNNNNnk',
    '.kkkkkkkkkk.',
    'kyyZyyZyyZyk',
    'kynnkyykknyk',
    'knnnkYYknnnk',
    'knnnnkknnnnk',
    'kynnnnnnnnyk',
    'kNNNNNNNNNNk',
    'kkkkkkkkkkkk',
  ];
  const ICONS = {
    coin: ['..kkkk..', '.kyyyyk.', 'kyywyyYk', 'kyyyyyYk', 'kyyyyyYk', 'kyyyyYYk', '.kYYYYk.', '..kkkk..'],
    spark: ['....kkkk', '...kcwck', '..kcwck.', '.kccccck', 'kkkkcck.', '...kcck.', '..kcck..', '..kkk...'],
    sword: ['......kk', '.....kwk', '....kwk.', 'k..kwk..', 'kykwk...', '.kyk....', 'kNkyk...', 'kk.kk...'],
    hammer: ['.kkkkk..', 'kgggggk.', 'kgwgggk.', '.kkNkk..', '...kNk..', '...kNk..', '...kNk..', '...kkk..'],
    gem: ['..kkkk..', '.kcwcck.', 'kcwccCCk', 'kccccCCk', '.kcccCk.', '..kcCk..', '...kk...', '........'],
    crown: ['........', '.k.k.k..', 'kykykyk.', 'kyyyyyk.', 'kryyyrk.', 'kkkkkkk.', '........', '........'],
    gear: ['...kk...', '.k.gg.k.', '.kgggGk.', 'kgGkkgGk', 'kgGkkgGk', '.kgggGk.', '.k.GG.k.', '...kk...'],
    shield: ['kkkkkkkk', 'kbbybbBk', 'kbbybbBk', 'kyyyyyyk', 'kbbybbBk', '.kbybBk.', '..kyBk..', '...kk...'],
    boots: ['..kkk...', '..knk...', '..knk...', '..knk...', '..knnkk.', '.knnnnnk', '.kNNNNNk', '.kkkkkkk'],
    mug: ['.w.w....', 'kkkkkk..', 'kwnnnkkk', 'knnnnk.k', 'knnnnk.k', 'knnnnkkk', 'kNNNNk..', '.kkkk...'],
    belt: ['........', 'kkkkkkkk', 'nnkyyknn', 'NNkykkNN', 'nnkyyknn', 'kkkkkkkk', '........', '........'],
    keycap: ['........', '.kkkkkk.', 'kwwwwwwk', 'kwgkkgwk', 'kwggggwk', 'kgggggGk', 'kGGGGGGk', '.kkkkkk.'],
    amulet: ['k.....k.', '.k...k..', '..k.k...', '..kyk...', '.kycyk..', 'kycwcyk.', '.kycyk..', '..kyk...'],
    fang: ['kkkkkkk.', 'kwwwwwk.', '.kwwwk..', '.kwwwk..', '..kwk...', '..kwk...', '...k....', '........'],
    candle: ['...z....', '..zZz...', '...k....', '..kwk...', '..kwk...', '..kwk...', '.kkkkk..', 'kYYYYYk.'],
    map: ['kkkkkkkk', 'klLllLlk', 'kllllrLk', 'klLlrllk', 'kllrllLk', 'kLllllLk', 'kkkkkkkk', '........'],
    lens: ['.kkkk...', 'kcwcck..', 'kwcccck.', 'kccccck.', '.kkkkkk.', '....kNk.', '.....kNk', '......kk'],
    rune: ['.kkkkkk.', 'kGggggGk', 'kgpgpggk', 'kggpgggk', 'kgpgpggk', 'kGggggGk', 'kGGGGGGk', '.kkkkkk.'],
    pendant: ['k......k', '.k....k.', '..k..k..', '...kk...', '..kyyk..', '.kyZZyk.', '.kyZZyk.', '..kkkk..'],
    ring: ['...kk...', '..kmmk..', '...kk...', '..kyyk..', '.ky..yk.', '.ky..yk.', '..kyyk..', '...kk...'],
    whetstone: ['........', '......kk', '....kkgk', '..kkggGk', 'kkgggGk.', 'kggGGk..', 'kkkkk...', '........'],
    skull: ['.kkkkk..', 'klllllk.', 'kkllkkk.', 'kkllkkk.', 'klllllk.', '.klklk..', '.kkkkk..', '........'],
    root: ['...kk...', '..kemk..', '..kek...', '.kNNk...', 'kNnNNk..', 'kNk.kNk.', 'k..k.kNk', '...k..k.'],
    heart: ['.kk.kk..', 'krrkrrk.', 'krwrrrk.', 'krrrrrk.', '.krrrk..', '..krk...', '...k....', '........'],
    clock: ['..kkkk..', '.kwwwwk.', 'kwwkwwwk', 'kwwkwwwk', 'kwwwkkwk', 'kwwwwwwk', '.kwwwwk.', '..kkkk..'],
    chest: CHEST,
  };

  // ---------------------------------------------------------------- baking
  const hasDOM = typeof document !== 'undefined';
  // baked-once canvases stay in CPU memory (willReadFrequently): GPU-backed ones can be wiped by a
  // context loss (e.g. low-GPU mode), which would leave every sprite blank
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d', { willReadFrequently: true }); return c; }

  function bake(rows, swap, flip) {
    const h = rows.length;
    const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const c = canvas(w, h);
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        let ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        if (swap && swap[ch]) ch = swap[ch];
        const col = PAL[ch];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(flip ? w - 1 - x : x, y, 1, 1);
      }
    }
    return finalize(c);
  }

  /** Adds a white silhouette (hit flash), a gold silhouette (aura) and pixel list (death debris). */
  function finalize(c) {
    const w = c.width, h = c.height;
    const data = c.getContext('2d').getImageData(0, 0, w, h).data;
    const px = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] > 0) px.push({ x, y, col: `rgb(${data[i]},${data[i + 1]},${data[i + 2]})` });
    }
    const tint = (color) => {
      const t = canvas(w, h), tg = t.getContext('2d');
      tg.drawImage(c, 0, 0);
      tg.globalCompositeOperation = 'source-in';
      tg.fillStyle = color; tg.fillRect(0, 0, w, h);
      return t;
    };
    return { c, w, h, px, white: tint('#ffffff'), gold: tint('#ffd76a'), dark: tint('#000000') };
  }

  function scaled(spr, s) {
    const c = canvas(spr.w * s, spr.h * s);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(spr.c, 0, 0, spr.w * s, spr.h * s);
    return c;
  }

  function bossOf(rows, swap, crown, s = 2, flip = false) {
    const base = bake(rows, swap, flip);
    const crownSpr = crown ? bake(CROWN, crown === true ? null : crown) : null;
    const extra = crownSpr ? crownSpr.h * s - 2 : 0;
    const c = canvas(base.w * s, base.h * s + extra);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(scaled(base, s), 0, extra);
    if (crownSpr) {
      // crown sits on the top-most pixels of the head
      let topX = 0, topY = 999;
      for (const p of base.px) if (p.y < topY || (p.y === topY && p.x < topX)) { topY = p.y; topX = p.x; }
      const headCenter = base.px.filter((p) => p.y <= topY + 1).reduce((a, p) => a + p.x, 0) / base.px.filter((p) => p.y <= topY + 1).length;
      g.drawImage(scaled(crownSpr, s), Math.round((headCenter + 0.5) * s - (crownSpr.w * s) / 2), topY * s + extra - crownSpr.h * s + 2);
    }
    return finalize(c);
  }

  function hero(rows, legs) {
    const b = rows.slice(0, rows.length - legs.length).concat(legs);
    return [bake(rows), bake(b)];
  }

  const S = KK.SPR = { frames: {}, icons: {}, iconURL: {}, bake, scaled };

  if (hasDOM) {
    S.frames.knight = hero(KNIGHT, KNIGHT_LEGS);
    S.frames.archer = hero(ARCHER, ARCHER_LEGS);
    S.frames.mage = hero(MAGE, MAGE_LEGS);
    S.frames.cleric = hero(CLERIC, CLERIC_LEGS);

    S.frames.rat = [bake(RAT), bake(RAT_B)];
    S.frames.goldrat = [bake(RAT, { G: 'y', g: 'Z', m: 'w' }), bake(RAT_B, { G: 'y', g: 'Z', m: 'w' })];
    S.frames.skeleton = [bake(SKELETON), bake(SKELETON_B)];
    S.frames.bat = [bake(BAT), bake(BAT_B)];
    S.frames.slime = [bake(SLIME), bake(SLIME_B)];
    S.frames.spider = [bake(SPIDER), bake(SPIDER_B)];
    S.frames.goblin = [bake(GOBLIN), bake(GOBLIN_B)];
    S.frames.imp = [bake(IMP), bake(IMP_B)];
    S.frames.golem = [bake(GOLEM), bake(GOLEM)];
    const mag = { e: 'o', E: 'O', w: 'Z' };
    S.frames.magslime = [bake(SLIME, mag), bake(SLIME_B, mag)];
    S.frames.eye = [bake(EYE), bake(EYE_B)];
    S.frames.wraith = [bake(WRAITH), bake(WRAITH_B)];
    const vk = { g: 'v', w: 'p', G: 'P', b: 'P', B: 'v', y: 'c', r: 'm', c: 'm', s: 'p', S: 'P' };
    S.frames.voidknight = [bake(KNIGHT, vk, true), bake(KNIGHT.slice(0, 13).concat(KNIGHT_LEGS), vk, true)];

    const ls = { E: 'e' };
    S.frames.lasher = [bake(LASHER, ls), bake(LASHER_B, ls)];
    S.frames.bloat = [bake(BLOAT), bake(BLOAT_B)];
    S.frames.sporeling = [bake(SPORELING), bake(SPORELING_B)];
    S.frames.warden = [bake(WARDEN), bake(WARDEN_B)];

    // bosses
    S.frames.ratking = [bossOf(RAT, { G: 'n', g: 'l' }, true), bossOf(RAT_B, { G: 'n', g: 'l' }, true)];
    S.frames.boneking = [bossOf(SKELETON, { k: 'k', l: 'l' }, true), bossOf(SKELETON_B, null, true)];
    S.frames.broodmother = [bossOf(SPIDER, { P: 'R', r: 'y' }, false), bossOf(SPIDER_B, { P: 'R', r: 'y' }, false)];
    S.frames.warlord = [bossOf(GOBLIN, { n: 'R', N: 'R' }, true), bossOf(GOBLIN_B, { n: 'R' }, true)];
    const ember = { d: 'R', G: 'O', o: 'Z', z: 'Z' };
    S.frames.embergolem = [bossOf(GOLEM, ember, false), bossOf(GOLEM, ember, false)];
    S.frames.magmalord = [bossOf(IMP, { r: 'o', R: 'O' }, true), bossOf(IMP_B, { r: 'o', R: 'O' }, true)];
    const hol = { p: 'v', w: 'P', c: 'm', k: 'k' };
    S.frames.hollow = [bossOf(EYE, hol, { y: 'p', Y: 'P', r: 'm' }), bossOf(EYE_B, hol, { y: 'p', Y: 'P', r: 'm' })];

    const rm = { R: 'E', r: 'e', Z: 'm', E: 'R', N: 'E', n: 'e' };
    S.frames.rootmother = [bossOf(LASHER, rm, { y: 'm', Y: 'R', r: 'e' }), bossOf(LASHER_B, rm, { y: 'm', Y: 'R', r: 'e' })];
    const kp = { P: 'N', v: 'R' };
    S.frames.keeper = [bossOf(KEEPER, kp, { y: 'Z', Y: 'y', r: 'm' }), bossOf(KEEPER_B, kp, { y: 'Z', Y: 'y', r: 'm' })];

    S.chest = bake(CHEST);
    S.chestOpen = bake(CHEST_OPEN);

    for (const k in ICONS) {
      S.icons[k] = bake(ICONS[k]);
      S.iconURL[k] = scaled(S.icons[k], 4).toDataURL();
    }
    // epic relic gem tint + portraits
    S.iconURL.gemEpic = scaled(bake(ICONS.gem, { c: 'p', C: 'P', w: 'm' }), 4).toDataURL();
    S.portraitURL = {};
    for (const id of ['knight', 'archer', 'mage', 'cleric']) S.portraitURL[id] = scaled(S.frames[id][0], 3).toDataURL();
  }

  S.frame = (key, i) => { const f = S.frames[key]; return f ? f[i % f.length] : null; };
})();
