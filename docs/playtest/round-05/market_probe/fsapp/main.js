// Fullscreen test helper (a SEPARATE process, like a browser playing fullscreen video).
// args: --x --y --w --h --ms --color
const { app, BrowserWindow } = require('electron');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
app.whenReady().then(() => {
  const w = new BrowserWindow({ x: +arg('x', 0), y: +arg('y', 0), width: +arg('w', 800), height: +arg('h', 600), frame: false, backgroundColor: arg('color', '#00ff00'), show: false });
  w.loadURL('data:text/html,<body style="background:' + encodeURIComponent(arg('color', '#00ff00')) + ';margin:0;color:#000;font:40px sans-serif">Keystroke Keep fullscreen test (separate process)</body>');
  w.once('ready-to-show', () => {
    w.show(); if (arg('windowed', '0') !== '1') w.setFullScreen(true); w.focus();
    const h = w.getNativeWindowHandle();
    console.log('HWND ' + (h.length >= 8 ? h.readBigUInt64LE(0).toString() : h.readUInt32LE(0).toString()));
  });
  setTimeout(() => app.quit(), +arg('ms', 6000));
});
