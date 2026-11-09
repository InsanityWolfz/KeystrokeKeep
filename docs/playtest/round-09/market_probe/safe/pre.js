// R9 market: injected at document start (Page.addScriptToEvaluateOnNewDocument) by safe/main.js. Two parts:
//  1. det (optional): PROTOTYPE of a frame-locked capture clock. performance.now() advances exactly 1/60 s per game
//     frame, and every page setTimeout (cue clock, autotype, whenBooted, audio/ui delays) runs on that virtual clock,
//     fired at frame starts. The frame loop itself is still paced by real time. Nothing in js/ is edited.
//  2. probe: frame counter, event log, state digests every 60 frames, canvas hashes at chosen frames, all relative to
//     the first capture cue (t0).
(function () {
  const CFG = __CFG__;
  const K9 = window.__kk9 = { f: 0, t0f: null, ev: [], dig: [], hashes: [], det: CFG.det, fpsReal: [] };
  const rST = window.setTimeout.bind(window), rNow = performance.now.bind(performance);
  if (CFG.det) {
    const rCT = window.clearTimeout.bind(window);
    let V = rNow(); const STEP = 1000 / CFG.fps;
    const q = new Map(); let id = 1e7, seq = 0;
    performance.now = () => V;
    const runDue = () => {
      for (;;) {
        let best = null;
        for (const [h, t] of q) if (t.at <= V && (!best || t.at < best[1].at || (t.at === best[1].at && t.seq < best[1].seq))) best = [h, t];
        if (!best) return;
        q.delete(best[0]);
        try { best[1].fn(...best[1].args); } catch (e) { console.error('[kk9] timer error ' + e.message); }
      }
    };
    window.setTimeout = function (fn, ms, ...args) {
      if (typeof fn !== 'function') return rST(fn, ms);
      if (fn.name === 'frame') return rST(() => { V += STEP; runDue(); fn(); }, Math.max(1, Math.min(+ms || 0, STEP)));
      const h = ++id; q.set(h, { at: V + Math.max(0, +ms || 0), fn, args, seq: ++seq }); return h;
    };
    window.clearTimeout = (h) => { if (q.has(h)) q.delete(h); else rCT(h); };
  }
  const since = () => ({ f: K9.f - K9.t0f, r: Math.round(rNow() - K9.t0r), v: Math.round(performance.now() - K9.t0v) });
  const ev = (name) => { if (K9.t0f === null) return; K9.ev.push(Object.assign(since(), { e: name })); };
  function hash(cvs) {
    try {
      const d = cvs.getContext('2d').getImageData(0, 0, cvs.width, cvs.height).data; let h = 2166136261 >>> 0;
      for (let i = 0; i < d.length; i += 4) { h ^= d[i] | (d[i + 1] << 8) | (d[i + 2] << 16); h = Math.imul(h, 16777619) >>> 0; }
      return h.toString(16);
    } catch (e) { return 'err'; }
  }
  function hook() {
    const KK = window.KK;
    if (!KK || !KK.booted || !KK.captureOps || !KK.render || !KK.on) return rST(hook, 4);
    const d = KK.render.draw;
    let rf = 0, rt = rNow();
    KK.render.draw = function () {
      const r = d.apply(this, arguments); K9.f++; rf++;
      if (rNow() - rt >= 1000) { K9.fpsReal.push(rf); rf = 0; rt = rNow(); }
      if (K9.t0f !== null) {
        const k = K9.f - K9.t0f;
        if (k % 60 === 0) {
          const S = KK.S, W = KK.world;
          K9.dig.push([k, S.floor, W.wave, Math.round(W.partyX * 10) / 10, W.enemies.length, Math.round(W.enemies.reduce((a, e) => a + (e.hp || 0), 0)), Math.round(S.gold), Math.round(S.sparks * 10) / 10, Math.round(S.fervor * 10) / 10, (W.boss && W.boss.def.name) || ''].join('|'));
        }
        if (CFG.shotsAt.includes(k)) K9.hashes.push([k, hash(document.getElementById('game'))]);
      }
      return r;
    };
    for (const k of Object.keys(KK.captureOps)) {
      const f = KK.captureOps[k];
      KK.captureOps[k] = function (v) {
        if (K9.t0f === null) { K9.t0f = K9.f; K9.t0r = rNow(); K9.t0v = performance.now(); }
        ev('cue ' + k + (v !== undefined ? ' ' + JSON.stringify(v) : ''));
        return f.apply(this, arguments);
      };
    }
    const nm = (p) => (p && p.e && p.e.def && p.e.def.name) || (p && p.boss && p.boss.def && p.boss.def.name) || '';
    const EV = {
      fervorTier: (p) => p.from + '->' + p.to, ult: (p) => p.id, meteorLand: () => '', bossSpawn: nm, magmaShell: nm, shellCrack: nm,
      kill: (p) => (p && p.e && p.e.boss ? 'BOSS ' + nm(p) : null), relicOffer: () => JSON.stringify((KK.S.relicOffer || []).map((r) => r.id || r)),
      relicPicked: (p) => (p && (p.id || (p.r && p.r.id))) || '', omenPicked: (p) => JSON.stringify(p && (p.id || p)), glimpse: () => '', glimpseDoor: () => '', demoComplete: (p) => JSON.stringify(p || {}),
      floor: (p) => p.floor, chargeWarn: nm, warCharge: nm, wipe: () => '', retired: () => '', ratSpawn: () => '',
    };
    for (const [name, f] of Object.entries(EV)) KK.on(name, (p) => { const s = f(p); if (s !== null) ev(name + ' ' + s); });
    const ob = KK.fx.banner;
    KK.fx.banner = function (text, sub) { const n = KK.fx.banners.length; const r = ob.apply(this, arguments); if (KK.fx.banners.length > n) { const b = KK.fx.banners[KK.fx.banners.length - 1]; ev('BANNER ' + text + (sub ? ' / ' + sub : '') + (b.big ? '' : ' (minor)')); } return r; };
    const oa = KK.fx.alert;
    KK.fx.alert = function (str) { ev('ALERT ' + str); return oa.apply(this, arguments); };
    const ot = KK.ui.toast;
    KK.ui.toast = function (text) { ev('TOAST-call ' + String(text).slice(0, 60)); return ot.apply(this, arguments); };
    const om = KK.ui.modal;
    if (om) KK.ui.modal = function (html) { ev('MODAL ' + ((/<h2>(.*?)<\/h2>/.exec(html) || [])[1] || '?')); return om.apply(this, arguments); };
    K9.boot = { gold: KK.S.gold, lastSave: KK.S.lastSave, toastsDom: [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent.slice(0, 80)), modal: (document.querySelector('#modal-root .modal h2') || {}).textContent || '' };
    K9.hooked = true;
  }
  rST(hook, 1);
})();
