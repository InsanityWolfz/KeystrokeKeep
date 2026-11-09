/* Keystroke Keep — capture mode for store screenshots, GIFs and the trailer (desktop build only).
   Enabled by KK_CAPTURE=1 (see electron/main.js and tools/capture/README.md). Fixed 60 fps, seeded
   randomness, full juice, no tutorial/achievement toasts, hotkeys (Ctrl+Shift+Alt+digit) and an
   optional cue script that stages a shot frame-for-frame. Does nothing in normal play. */
(function () {
  'use strict';
  const KK = window.KK;
  const N = window.kkNative;
  const C = N && N.capture;
  if (!C) return;
  KK.capture = C;

  // seeded randomness so takes repeat (mulberry32, as in tools/headless.js)
  let a = (C.seed || 1) >>> 0;
  Math.random = function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // frame-locked clock: performance.now() advances exactly 1/fps per drawn frame, and cue / autotype
  // timers fire on frame boundaries, so the same seed and save give the same frames at any CPU load
  const FPS = C.fps || 60;
  let frameNo = 0;
  const waiters = [];
  performance.now = () => (frameNo * 1000) / FPS;
  KK.fixedDt = 1 / FPS;
  KK.onFrame = () => {
    frameNo++;
    for (let i = waiters.length - 1; i >= 0; i--) if (waiters[i].at <= frameNo) { const w = waiters.splice(i, 1)[0]; if (!w.dead) w.fn(); }
  };
  KK.later = (fn, ms) => { const w = { at: frameNo + Math.max(1, Math.round((ms * FPS) / 1000)), fn }; waiters.push(w); return { cancel: () => { w.dead = true; } }; };
  const sleep = (sec) => new Promise((r) => KK.later(r, sec * 1000));

  const whenBooted = (fn) => (KK.booted ? fn() : setTimeout(() => whenBooted(fn), 50));
  whenBooted(() => {
    const S = KK.S, W = KK.world, UI = KK.ui;
    // the shot is staged: no welcome, no tutorial nudges, no stray toasts
    const modal = document.querySelector('#modal-root .modal [data-x=go]');
    if (modal) modal.click();
    S.tutorial = new Proxy({}, { get: () => 1, set: () => true });
    const realToast = UI.toast;
    UI.toast = function () { if (C.toasts) realToast.apply(UI, arguments); };
    const s = S.settings;
    s.size = C.size || 'L';
    s.calm = C.juice === 'companion';
    s.combatSfx = C.juice !== 'companion';
    s.volume = C.audio === 'off' ? 0 : 0.6;
    s.sound = C.audio !== 'off';
    s.music = C.audio === 'music' || C.audio === 'both';
    KK.audio.init(); KK.audio.applySettings(); KK.render.resize();
    KK.targetFps = () => (KK.capturePaused ? 0 : C.fps || 60);
    if (C.bg) { document.body.style.background = C.bg; }

    const W_ = () => { W.enemies = []; W.shots = []; W.wave = 0; W.door = null; W.boss = null; UI.renderPips(); };
    const ops = {
      warp: (v) => { KK.warp = +v || 1; },
      floor: (v) => { S.floor = +v; S.maxFloorRun = Math.max(S.maxFloorRun, S.floor); S.maxFloorEver = Math.max(S.maxFloorEver, S.floor); W_(); },
      sparks: (v) => { S.sparks = v === 'full' ? KK.mods().sparkCap : +v; },
      autotype: (v) => KK.input.autotype(!!v),
      flow: () => { const before = KK.fervorTier(); S.fervor = 100; KK.addActivity('key'); const after = KK.fervorTier(); if (after !== before) KK.emit('fervorTier', { from: before, to: after }); },
      rat: () => W.spawnRat(),
      relicOffer: () => KK.actions.rollRelics(),
      openPanel: (v) => (v ? UI.open(v) : UI.close()),
      pickRelic: (v) => { if (S.relicOffer) KK.actions.pickRelic(S.relicOffer[+v || 0]); },
      retire: () => { if (KK.actions.retire()) W.reset(); },
      omen: (v) => { S.omenOffer = S.omenOffer || [v]; KK.actions.pickOmen(v); },
      size: (v) => { s.size = v; KK.render.resize(); },
      juice: (v) => { s.calm = v === 'companion'; s.combatSfx = v !== 'companion'; },
      pause: (v) => { KK.capturePaused = v === undefined ? !KK.capturePaused : !!v; },
      toast: (v) => realToast.call(UI, String(v), 'crown', 'gold', 4),
      js: (v) => (N.captureJs ? N.captureJs(String(v)) : console.warn('[capture] js cue needs the desktop shell')),
      wave: () => { W.enemies = []; W.shots = []; W.door = null; W.boss = null; W.wave = W.waves - 1; W.spawnWave(); },
      mark: (v) => N.mark && N.mark(String(v)),
    };
    KK.captureOps = ops;

    // hotkeys (Ctrl+Shift+Alt+digit, registered by the main process only in capture mode)
    let warpIdx = 0;
    const HOT = {
      1: () => { KK.captureAuto = !KK.captureAuto; ops.autotype(KK.captureAuto); },
      2: () => { warpIdx = (warpIdx + 1) % 3; ops.warp([1, 5, 20][warpIdx]); },
      3: () => ops.sparks('full'),
      4: () => ops.floor(S.floor + 5),
      5: () => ops.floor(Math.ceil((S.floor + 1) / 10) * 10 - 1),
      6: () => ops.rat(),
      7: () => ops.flow(),
      8: () => ops.pause(),
      9: () => { const order = [null, 'party', 'relics', 'legacy']; const i = (order.indexOf(UI.tab) + 1) % order.length; ops.openPanel(order[i]); },
      0: () => runScript(),
    };
    if (N.onCapture) N.onCapture((k) => { const f = HOT[k]; if (f) f(); });

    // cue script: { cues: [{ t: seconds, do: op, v: value }] } on wall-clock time after boot
    let timers = [];
    // cues run in order; "t" is seconds after the previous cue (or after an {"do":"await","v":"<event>"} fires)
    let runId = 0;
    async function runScript() {
      const id = ++runId;
      const cues = (C.script && C.script.cues) || [];
      let last = 0;
      for (const c of cues) {
        const wait = Math.max(0, (c.t || 0) - (c.abs === false ? 0 : last));
        if (wait) await sleep(wait);
        if (id !== runId) return;
        last = c.t || 0;
        if (c.do === 'await') {
          await new Promise((r) => {
            let done = false, tm = null;
            const off = KK.on(c.v, () => { if (done) return; done = true; off(); tm.cancel(); r(); });
            tm = KK.later(() => { if (done) return; done = true; off(); if (N.mark) N.mark('await ' + c.v + ' TIMED OUT'); console.warn('[capture] await ' + c.v + ' TIMED OUT'); r(); }, (c.timeout || 30) * 1000);
          });
          last = 0; continue;
        }
        const f = ops[c.do];
        if (f) f(c.v); else console.warn('[capture] unknown cue', c.do);
      }
    }
    KK.later(runScript, 600);
    console.log('[capture] ready', JSON.stringify({ seed: C.seed, size: s.size, juice: C.juice, cues: ((C.script && C.script.cues) || []).length }));
  });
})();
