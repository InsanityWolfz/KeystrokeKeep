/* Keystroke Keep — boot, main loop, autosave, offline progress. */
(function () {
  'use strict';
  const KK = window.KK, U = KK.U;
  const W = KK.world, FX = KK.fx;
  KK.warp = 1;
  const MAX_OFFLINE = 12 * 3600;

  function boot() {
    const had = KK.load();
    W.reset();
    KK.render.init();
    KK.ui.init();
    KK.input.init();
    if (KK.native && KK.nativeBoot) KK.nativeBoot();
    KK.booted = true;

    if (!had) {
      KK.ui.welcome(() => { KK.audio.init(); KK.fx.banner('FLOOR 1', 'THE CRYPT', '#ffffff', 2.4, { subCol: '#c9b8ea' }); });
    } else {
      awayCheck((Date.now() - (KK.S.lastSave || Date.now())) / 1000);
      KK.ui.renderPips();
      if (KK.S.relicOffer) setTimeout(KK.ui.showOffer, 800);
    }

    let last = performance.now();
    function frame(now) {
      let dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      FX.update(dt);
      const simDt = dt * FX.timeScale() * KK.warp;
      // fixed-ish substeps keep the sim stable at high warp
      const steps = Math.max(1, Math.ceil(simDt / (1 / 30)));
      for (let i = 0; i < steps; i++) W.update(simDt / steps);
      KK.render.draw(dt);
      KK.ui.update(dt);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    setInterval(KK.save, 10000);
    window.addEventListener('beforeunload', () => { if (!KK.resetting) KK.save(); });
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { hiddenAt = Date.now(); KK.save(); }
      else if (hiddenAt) { awayCheck((Date.now() - hiddenAt) / 1000); hiddenAt = 0; }
    });
    // expose for debugging in the console
    window.KKdebug = { KK, W, FX };
  }

  /** Coming back after time away: short gaps are simulated, long gaps pay offline gold. */
  function awayCheck(secs) {
    secs = Math.min(MAX_OFFLINE, Math.max(0, secs));
    if (secs < 5) return;
    if (secs < 90) {
      const dt = 1 / 15;
      for (let t = 0; t < secs; t += dt) W.update(dt);
      return;
    }
    const m = KK.mods();
    const rate = Math.max(KK.S.incomeRate, KK.F.enemyGold(KK.S.floor) * 0.3);
    const gold = rate * secs * m.offline;
    KK.gainGold(gold, 'offline');
    KK.ui.offline(secs, gold);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
