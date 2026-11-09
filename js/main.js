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
      try { const src = window.kkNative && window.kkNative.saveInfo && window.kkNative.saveInfo(); if (src === 'backup') setTimeout(() => KK.ui.toast('Your save was damaged, so it was restored from a backup.', 'shield', 'gold', 8), 2000); if (src === 'demo') setTimeout(() => KK.ui.toast('Welcome to the full game! Your demo progress came with you.', 'crown', 'epic', 8), 2000); } catch (e) { /* ignore */ }
      KK.ui.renderPips();
      if (KK.S.omenOffer) setTimeout(KK.ui.chooseOmen, 1500); // an omen choice pending at quit is never lost
    }

    // Frame pacing: this sits on screen all day, so we never render at the monitor's refresh
    // rate. Skipped frames don't touch the canvas, so the compositor has nothing to do either.
    let last = performance.now();
    KK.targetFps = function () {
      if (KK.powerState === 'off') return 0; // screen locked / system suspending
      const set = +KK.S.settings.fps || 24;
      let fps = set;
      if (KK.onBattery) fps = Math.min(fps, 20);
      // nobody's typing and nothing exciting is happening: drop to a slow idle animation
      if (KK.lastInputAgo() > 45 && !W.boss && KK.fervorTier() === 0) fps = Math.min(fps, KK.fx.busy() ? 15 : 10);
      return fps;
    };
    // A sleeping timer loop (not requestAnimationFrame, which wakes at the monitor's refresh
    // rate even when we skip the frame). While locked / asleep / hidden we freeze entirely and
    // awayCheck pays offline gold on return.
    let frozen = false;
    function frame() {
      const now = performance.now();
      const fps = KK.targetFps();
      const off = fps === 0 || document.hidden;
      document.documentElement.classList.toggle('kk-paused', off); // also pauses CSS animations
      if (off) { if (!frozen) { frozen = true; KK.save(); } last = now; setTimeout(frame, 500); return; }
      frozen = false;
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      FX.update(dt);
      const simDt = dt * FX.timeScale() * KK.warp;
      // fixed-ish substeps keep the sim stable at high warp / low fps
      const steps = Math.max(1, Math.ceil(simDt / (1 / 30)));
      if (!KK.paused) for (let i = 0; i < steps; i++) W.update(simDt / steps);
      KK.render.draw(dt);
      KK.ui.update(dt);
      setTimeout(frame, Math.max(1, 1000 / fps - (performance.now() - now)));
    }
    setTimeout(frame, 16);

    setInterval(KK.save, 10000);
    window.addEventListener('beforeunload', () => { if (!KK.resetting) KK.save(true); });
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { hiddenAt = Date.now(); KK.save(); }
      else if (hiddenAt) { awayCheck((Date.now() - hiddenAt) / 1000); hiddenAt = 0; }
    });
    // expose for debugging in the console
    window.KKdebug = { KK, W, FX };
  }

  /** Coming back after time away: short gaps are simulated, long gaps pay offline gold. */
  KK.awayCheck = (secs) => awayCheck(secs);
  function awayCheck(secs) {
    secs = Math.min(MAX_OFFLINE, Math.max(0, secs));
    if (secs < 5) return;
    if (secs < 90) {
      const dt = 1 / 15;
      for (let t = 0; t < secs; t += dt) W.update(dt);
      return;
    }
    const m = KK.mods();
    const S = KK.S, avg = S.incomeAvg || 0;
    const rate = S.incomeRate > 0 ? (avg > 0 ? Math.min(S.incomeRate, avg) : S.incomeRate) : KK.F.enemyGold(S.floor) * 0.3;
    const gold = rate * secs * m.offline;
    KK.gainGold(gold, 'offline');
    KK.ui.offline(secs, gold);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
