/* Keystroke Keep — activity input. Counts events only, never which keys.
   Browser: listens inside the page. Electron: window.kkNative forwards global counts. */
(function () {
  'use strict';
  const KK = window.KK, U = KK.U;
  const I = KK.input = {};

  // token bucket: max ~15 counted events per second (stops key-repeat / autoclicker abuse)
  let tokens = 15, lastRefill = performance.now();
  function allow() {
    const now = performance.now();
    tokens = Math.min(15, tokens + ((now - lastRefill) / 1000) * 15);
    lastRefill = now;
    if (tokens >= 1) { tokens -= 1; return true; }
    return false;
  }
  I.event = function (kind) {
    if (!KK.booted || !allow()) return;
    KK.addActivity(kind);
  };

  I.init = function () {
    const native = !!(window.kkNative && window.kkNative.onActivity);
    // In the desktop build the global hook already sees these, so don't double count.
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      KK.audio.init();
      if (!native) I.event('key');
    }, true);
    window.addEventListener('mousedown', () => {
      KK.audio.init();
      if (!native) I.event('click');
    }, true);

    // clicks on the strip: catch the golden rat or poke an enemy
    const cvs = document.getElementById('game');
    cvs.addEventListener('mousedown', (e) => {
      const p = KK.render.toWorld(e.clientX, e.clientY);
      const W = KK.world;
      if (W.rat && Math.abs(p.x - W.rat.x) < 18 && Math.abs(p.y - (W.rat.y - 4)) < 18) { W.catchRat(); return; }
      W.poke(p.x, p.y);
    });

    // Electron bridge (global input counts from uiohook)
    if (window.kkNative && window.kkNative.onActivity) {
      document.body.classList.add('native');
      window.kkNative.onActivity((kind) => { KK.audio.init(); I.event(kind === 'click' ? 'click' : 'key'); });
    }
  };

  // dev: simulated bursty typing (~5 keys/s while "typing", short pauses)
  let autoTimer = null;
  I.autotype = function (on) {
    if (autoTimer && autoTimer.cancel) autoTimer.cancel(); else clearTimeout(autoTimer);
    if (!on) return;
    let burst = 0;
    const tick = () => {
      if (burst <= 0) burst = U.randi(15, 60);
      I.event('key');
      burst--;
      const pause = burst === 0 ? U.rand(600, 2200) : U.rand(90, 260);
      autoTimer = KK.later ? KK.later(tick, pause) : setTimeout(tick, pause);
    };
    tick();
  };
})();
