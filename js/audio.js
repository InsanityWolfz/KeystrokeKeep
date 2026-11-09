/* Keystroke Keep — procedural WebAudio SFX + adaptive music. No audio files needed. */
(function () {
  'use strict';
  const KK = window.KK, U = KK.U;
  const A = KK.audio = { ctx: null, ready: false, intensity: 0 };
  let master, sfxBus, musicBus, comp, noiseBuf;
  const last = {};

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = A.ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4;
    master = ctx.createGain();
    sfxBus = ctx.createGain(); musicBus = ctx.createGain();
    sfxBus.connect(master); musicBus.connect(master);
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.ready = true;
    A.applySettings();
    startMusic();
  };
  // The audio device is fully suspended whenever we're silent (muted, hidden, screen locked),
  // so the game never keeps Windows awake or burns CPU on inaudible notes.
  A.shouldRun = function () {
    const s = KK.S.settings;
    return s.sound && s.volume > 0 && KK.powerState !== 'off' && !(typeof document !== 'undefined' && document.hidden);
  };
  A.applySettings = function () {
    if (!A.ready) return;
    const s = KK.S.settings;
    const t = A.ctx.currentTime;
    if (A.shouldRun()) { if (A.ctx.state === 'suspended') A.ctx.resume(); }
    else if (A.ctx.state === 'running') A.ctx.suspend();
    master.gain.setTargetAtTime(s.sound ? s.volume * 0.9 : 0, t, 0.05);
    musicBus.gain.setTargetAtTime(s.music ? 0.55 : 0, t, 0.2);
    sfxBus.gain.setTargetAtTime(0.8, t, 0.05);
  };

  function limited(name, ms) {
    const now = performance.now();
    if (last[name] && now - last[name] < ms) return true;
    last[name] = now;
    return false;
  }

  function tone(freq, dur, o = {}) {
    if (!A.ready || A.ctx.state !== 'running') return;
    const ctx = A.ctx, t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const vol = (o.vol || 0.1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
    node.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(dur, o = {}) {
    if (!A.ready || A.ctx.state !== 'running') return;
    const ctx = A.ctx, t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.ftype || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 1200, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    f.Q.value = o.q || 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.1, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  const arp = (notes, step, o) => notes.forEach((n, i) => tone(n, o.dur || 0.12, Object.assign({}, o, { delay: (o.delay || 0) + i * step })));

  const SFX = {
    hit: () => { if (limited('hit', 45)) return; noise(0.05, { freq: 2400, ftype: 'highpass', vol: 0.05 }); tone(U.rand(150, 190), 0.07, { slide: 70, vol: 0.04, type: 'square' }); },
    crit: () => { if (limited('crit', 60)) return; noise(0.09, { freq: 3000, ftype: 'highpass', vol: 0.09 }); tone(880, 0.1, { slide: 1500, vol: 0.05, type: 'square' }); tone(110, 0.12, { slide: 50, vol: 0.08, type: 'triangle' }); },
    shoot: () => { if (limited('shoot', 60)) return; tone(700, 0.06, { slide: 320, vol: 0.025, type: 'triangle' }); noise(0.04, { freq: 4000, ftype: 'bandpass', vol: 0.03 }); },
    cast: () => { if (limited('cast', 80)) return; noise(0.25, { freq: 600, sweep: 2400, vol: 0.05, ftype: 'bandpass', q: 2 }); },
    explode: () => { if (limited('explode', 70)) return; noise(0.3, { freq: 1200, sweep: 200, vol: 0.09 }); tone(90, 0.25, { slide: 40, vol: 0.07, type: 'triangle' }); },
    coin: () => { if (limited('coin', 55)) return; const b = U.pick([1320, 1480, 1568]); tone(b, 0.05, { vol: 0.025, type: 'square' }); tone(b * 1.335, 0.09, { vol: 0.025, type: 'square', delay: 0.045 }); },
    spark: () => { if (limited('spark', 70)) return; tone(U.rand(1900, 2600), 0.035, { vol: 0.01, type: 'sine' }); },
    die: () => { if (limited('die', 60)) return; noise(0.14, { freq: 900, sweep: 150, vol: 0.07 }); tone(320, 0.12, { slide: 60, vol: 0.04, type: 'square' }); },
    hurt: () => { if (limited('hurt', 90)) return; tone(230, 0.1, { slide: 110, vol: 0.035, type: 'sawtooth', lp: 1400 }); },
    heal: () => { if (limited('heal', 200)) return; arp([784, 988], 0.05, { dur: 0.12, vol: 0.02, type: 'sine' }); },
    levelup: () => { if (limited('lvl', 90)) return; arp([523, 659, 784, 1047], 0.05, { dur: 0.1, vol: 0.04, type: 'square', lp: 4000 }); },
    milestone: () => { arp([523, 659, 784, 1047, 1319, 1568], 0.06, { dur: 0.18, vol: 0.05, type: 'square', lp: 5000 }); tone(262, 0.6, { vol: 0.05, type: 'triangle', delay: 0.05 }); },
    recruit: () => { arp([392, 523, 659, 784, 1047], 0.08, { dur: 0.25, vol: 0.05, type: 'square', lp: 4000 }); [523, 659, 784].forEach((f) => tone(f, 0.9, { vol: 0.03, type: 'triangle', delay: 0.4 })); },
    ultKnight: () => { tone(160, 0.12, { slide: 400, vol: 0.05, type: 'square', lp: 2000 }); tone(80, 0.5, { slide: 35, vol: 0.18, type: 'sine', delay: 0.45 }); noise(0.45, { freq: 500, sweep: 80, vol: 0.18, delay: 0.45 }); },
    ultArcher: () => { for (let i = 0; i < 8; i++) noise(0.08, { freq: 3000 + i * 200, ftype: 'bandpass', q: 3, vol: 0.04, delay: i * 0.09 }); tone(600, 0.3, { slide: 1200, vol: 0.03, type: 'triangle' }); },
    ultMage: () => { noise(0.6, { freq: 300, sweep: 3000, vol: 0.06, ftype: 'bandpass', q: 1.5 }); tone(200, 0.6, { slide: 900, vol: 0.03, type: 'sawtooth', lp: 1500 }); },
    meteor: () => { noise(0.8, { freq: 1600, sweep: 60, vol: 0.25 }); tone(70, 0.7, { slide: 28, vol: 0.22, type: 'sine' }); tone(140, 0.3, { slide: 50, vol: 0.06, type: 'square', lp: 600 }); },
    ultCleric: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 1.2, { vol: 0.03, type: 'sine', attack: 0.15, delay: i * 0.04, detune: U.rand(-8, 8) })); arp([1568, 2093, 2637], 0.07, { dur: 0.3, vol: 0.015, type: 'sine', delay: 0.2 }); },
    bossIntro: () => { tone(55, 2.0, { vol: 0.12, type: 'sawtooth', lp: 300, attack: 0.3 }); tone(82, 2.0, { vol: 0.06, type: 'sawtooth', lp: 260, attack: 0.5, detune: 7 }); noise(1.6, { freq: 200, vol: 0.06, attack: 0.4 }); tone(110, 1.2, { vol: 0.08, type: 'triangle', delay: 1.0, slide: 55 }); },
    bossKill: () => { noise(1.0, { freq: 2000, sweep: 60, vol: 0.25 }); tone(60, 0.9, { slide: 25, vol: 0.2, type: 'sine' }); arp([523, 659, 784, 1047, 784, 1047, 1319], 0.09, { dur: 0.25, vol: 0.05, type: 'square', lp: 5000, delay: 0.5 }); },
    chest: () => { tone(200, 0.15, { slide: 320, vol: 0.04, type: 'sawtooth', lp: 900 }); arp([1047, 1319, 1568, 2093], 0.06, { dur: 0.15, vol: 0.035, type: 'square', delay: 0.15 }); },
    flow: () => { arp([440, 554, 659, 880, 1109, 1319, 1760], 0.045, { dur: 0.25, vol: 0.04, type: 'square', lp: 5000 }); noise(0.7, { freq: 400, sweep: 6000, vol: 0.05, ftype: 'bandpass', q: 1 }); },
    zone: () => { arp([440, 659, 880], 0.06, { dur: 0.15, vol: 0.03, type: 'triangle' }); },
    wipe: () => { arp([392, 330, 262, 196], 0.18, { dur: 0.3, vol: 0.05, type: 'triangle' }); },
    door: () => { noise(0.4, { freq: 300, sweep: 120, vol: 0.06 }); arp([330, 262], 0.12, { dur: 0.15, vol: 0.02, type: 'triangle' }); },
    relic: () => { arp([659, 831, 988, 1319, 1661, 1976], 0.06, { dur: 0.3, vol: 0.04, type: 'sine' }); tone(330, 1.0, { vol: 0.04, type: 'triangle', attack: 0.1 }); },
    offer: () => { arp([988, 1319, 1661], 0.1, { dur: 0.4, vol: 0.03, type: 'sine' }); },
    rat: () => { arp([2200, 2600, 2200, 2800], 0.05, { dur: 0.05, vol: 0.02, type: 'square' }); },
    ratCaught: () => { arp([1047, 1319, 1568, 2093, 2637], 0.04, { dur: 0.12, vol: 0.05, type: 'square' }); noise(0.3, { freq: 5000, ftype: 'highpass', vol: 0.04 }); },
    ui: () => { if (limited('ui', 40)) return; tone(900, 0.03, { vol: 0.03, type: 'triangle' }); },
    buy: () => { if (limited('buy', 40)) return; tone(660, 0.05, { vol: 0.035, type: 'square', lp: 3000 }); tone(990, 0.07, { vol: 0.03, type: 'square', lp: 3000, delay: 0.04 }); },
    deny: () => { if (limited('deny', 120)) return; tone(160, 0.12, { vol: 0.04, type: 'square', lp: 800 }); },
    retire: () => { arp([262, 330, 392, 523, 659, 784, 1047], 0.12, { dur: 0.6, vol: 0.04, type: 'triangle' }); },
    slam: () => { tone(70, 0.35, { slide: 30, vol: 0.12, type: 'sine' }); noise(0.3, { freq: 400, sweep: 80, vol: 0.1 }); },
  };
  A.play = (name) => { if (A.ready && A.ctx.state === 'running' && SFX[name]) SFX[name](); };

  // ---------------------------------------------------------------- music
  // A-minor dungeon loop: Am - F - C - G, 8th-note arpeggio, layers react to Fervor.
  const BPM = 80, STEP = 60 / BPM / 2;
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const PATTERN = [0, 1, 2, 1, 3, 2, 1, 2];
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  let step = 0, nextT = 0, timer = null;
  function startMusic() {
    nextT = A.ctx.currentTime + 0.1;
    // the scheduler only runs while music is actually audible
    setInterval(() => {
      const want = A.ready && A.ctx.state === 'running' && KK.S.settings.music;
      if (want && !timer) { nextT = A.ctx.currentTime + 0.1; timer = setInterval(schedule, 60); }
      if (!want && timer) { clearInterval(timer); timer = null; }
    }, 1000);
  }
  function schedule() {
    if (!A.ready) return;
    const ctx = A.ctx;
    if (ctx.state !== 'running' || !KK.S.settings.music) { nextT = ctx.currentTime + 0.1; return; }
    while (nextT < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % 4, beat = step % 8;
      const ch = CHORDS[bar];
      const pat = PATTERN[beat];
      const note = pat === 3 ? ch[0] + 12 : ch[pat];
      const delay = nextT - ctx.currentTime;
      const I = A.intensity;
      tone(midi(note + 12), STEP * 1.6, { vol: 0.03, type: 'triangle', lp: 1800 + I * 900, delay, bus: musicBus });
      if (I >= 3 && beat % 2 === 1) tone(midi(note + 24), STEP * 0.9, { vol: 0.012, type: 'square', lp: 3000, delay, bus: musicBus });
      if (beat === 0 || beat === 4) tone(midi(ch[0] - 12), STEP * 3.6, { vol: 0.06, type: 'sine', delay, bus: musicBus });
      if (beat === 0) ch.forEach((n) => tone(midi(n), STEP * 7.5, { vol: 0.008, type: 'sawtooth', lp: 700, attack: 0.4, delay, bus: musicBus }));
      if (I >= 2 && beat % 2 === 1) noise(0.04, { freq: 7000, ftype: 'highpass', vol: 0.012, delay, bus: musicBus });
      if (I >= 3 && beat % 4 === 0) { tone(120, 0.18, { slide: 45, vol: 0.09, type: 'sine', delay, bus: musicBus }); }
      if (I >= 3 && beat % 4 === 2) noise(0.1, { freq: 1800, ftype: 'bandpass', vol: 0.025, delay, bus: musicBus });
      nextT += STEP;
      step++;
    }
  }
  A.duck = function (dur = 1.5) {
    if (!A.ready) return;
    const t = A.ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setTargetAtTime(0.05, t, 0.08);
    musicBus.gain.setTargetAtTime(KK.S.settings.music ? 0.55 : 0, t + dur, 0.5);
  };

  // ---------------------------------------------------------------- event wiring
  const p = A.play;
  KK.on('hit', ({ crit, ult }) => { if (crit) p('crit'); else if (!ult) p('hit'); });
  KK.on('shoot', () => p('shoot'));
  KK.on('cast', () => p('cast'));
  KK.on('explode', () => p('explode'));
  KK.on('coinArrive', () => p('coin'));
  KK.on('activity', () => { if (KK.S.settings.keySound) p('spark'); });
  KK.on('kill', ({ e }) => { if (e.boss) { p('bossKill'); A.duck(2.5); } else p('die'); });
  KK.on('heroHit', () => p('hurt'));
  KK.on('heal', () => p('heal'));
  KK.on('levelUp', ({ from, to }) => { const st = to >= 100 ? 50 : 10; p(Math.floor(to / st) > Math.floor(from / st) ? 'milestone' : 'levelup'); });
  KK.on('voidWarn', ({ e }) => { if ((e.slams || 0) < 3) p('zone'); });
  KK.on('chargeWarn', () => p('deny'));
  KK.on('shellCrack', () => p('crit'));
  KK.on('lavaLand', () => p('explode'));
  KK.on('webTorn', () => p('ui'));
  KK.on('warCharge', () => p('slam'));
  KK.on('reassemble', () => p('heal'));
  KK.on('voidSlam', ({ e }) => { if ((e.slams || 0) <= 3) p('slam'); });
  KK.on('recruit', () => p('recruit'));
  KK.on('ult', ({ id }) => p({ knight: 'ultKnight', archer: 'ultArcher', mage: 'ultMage', cleric: 'ultCleric' }[id]));
  KK.on('meteorLand', () => p('meteor'));
  KK.on('bossSpawn', () => { p('bossIntro'); A.duck(2.2); });
  KK.on('bossSlam', () => p('slam'));
  KK.on('chest', () => p('chest'));
  let lastFlowSfx = -1e9;
  KK.on('fervorTier', ({ from, to }) => {
    A.intensity = to;
    if (to <= from) return;
    if (to === 3 && performance.now() - lastFlowSfx > 600000) { lastFlowSfx = performance.now(); p('flow'); }
    else if (to >= 2) p('zone');
  });
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => A.applySettings());
  KK.on('power', () => A.applySettings());
  KK.on('wipe', () => p('wipe'));
  KK.on('door', () => p('door'));
  KK.on('relicPicked', () => p('relic'));
  KK.on('relicOffer', () => setTimeout(() => p('offer'), 1200));
  KK.on('ratSpawn', () => p('rat'));
  KK.on('ratCaught', () => p('ratCaught'));
  KK.on('retired', () => p('retire'));
})();
