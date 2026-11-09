/* Keystroke Keep — utilities + event bus. Works in browser and in node (tools/sim.js). */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const KK = root.KK = root.KK || {};
  const U = KK.U = {};

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  U.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  U.chance = (p) => Math.random() < p;
  U.hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); };
  U.hash2 = (a, b) => U.hash(a * 57.31 + b * 113.7);
  U.weighted = (items, wfn) => {
    let tot = 0; for (const it of items) tot += wfn(it);
    let r = Math.random() * tot;
    for (const it of items) { r -= wfn(it); if (r <= 0) return it; }
    return items[items.length - 1];
  };

  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td'];
  U.fmt = (n) => {
    if (n === undefined || n === null || isNaN(n)) return '0';
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + U.fmt(-n);
    if (n < 1000) return n < 10 && n % 1 !== 0 ? (Math.floor(n * 10) / 10).toString() : Math.floor(n).toString();
    const i = Math.floor(Math.log10(n) / 3);
    if (i >= SUF.length) return n.toExponential(2).replace('+', '');
    const v = n / Math.pow(1000, i);
    return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v).toString()) + SUF[i];
  };
  U.fmtTime = (s) => {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`;
  };

  U.ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inCubic: (t) => t * t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outElastic: (t) => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
  };

  // Tiny event bus: the simulation emits, render/fx/audio/ui listen.
  const handlers = {};
  KK.on = (type, fn) => { (handlers[type] = handlers[type] || []).push(fn); return () => { const h = handlers[type], i = h.indexOf(fn); if (i >= 0) h.splice(i, 1); }; };
  KK.emit = (type, data) => {
    const h = handlers[type];
    if (!h) return;
    for (let i = 0; i < h.length; i++) {
      try { h[i](data); } catch (e) { console.error('[KK] handler error for', type, e); }
    }
  };
})();
