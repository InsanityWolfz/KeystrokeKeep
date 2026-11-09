/* Keystroke Keep — desktop (Electron) integration. No-op in a normal browser. */
(function () {
  'use strict';
  const KK = window.KK;
  const N = window.kkNative;
  KK.native = !!N;
  if (!N) return;

  document.documentElement.classList.add('native');
  document.addEventListener('DOMContentLoaded', () => document.body.classList.add('native'));

  // Tray icon from our own pixel art, once sprites are baked.
  KK.nativeBoot = function () {
    try { N.setTrayIcon(KK.SPR.iconURL.crown); } catch (e) { /* ignore */ }

    // Grow the window upward while a panel / relic offer / modal / toast is showing.
    let lastH = 0;
    const measure = () => {
      const strip = document.getElementById('strip').getBoundingClientRect().height;
      let extra = 0;
      const panel = document.getElementById('panel');
      if (!panel.classList.contains('closed')) extra = Math.max(extra, panel.getBoundingClientRect().height + 4);
      const offer = document.getElementById('relic-offer');
      if (!offer.classList.contains('hidden')) extra = Math.max(extra, offer.getBoundingClientRect().height + 14);
      if (document.querySelector('#modal-root .modal')) extra = Math.max(extra, 440);
      const toasts = document.getElementById('toasts');
      if (toasts.children.length) extra = Math.max(extra, (UI_panelOpen() ? panel.getBoundingClientRect().height : 0) + toasts.getBoundingClientRect().height + 20);
      const h = Math.ceil(strip + extra);
      if (h !== lastH) { lastH = h; N.setHeight(h); }
    };
    const UI_panelOpen = () => !document.getElementById('panel').classList.contains('closed');
    setInterval(measure, 120);
    measure();

    // Transparent areas pass clicks through to whatever is behind the strip.
    let ignoring = null;
    const passThrough = (el) => !el || el === document.body || el === document.documentElement || el.id === 'toasts' || !!el.closest('#toasts') || el.id === 'relic-offer' || el.id === 'modal-root';
    window.addEventListener('mousemove', (e) => {
      const ig = passThrough(e.target);
      if (ig !== ignoring) { ignoring = ig; N.ignoreMouse(ig); }
    });
    N.ignoreMouse(true);
  };
})();
