// Renders the app icon (build/icon.png, 256x256) from the game's own pixel-art crown.
// Usage: npx electron tools/make-icon.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 400, height: 300, webPreferences: { contextIsolation: true } });
  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  const url = await win.webContents.executeJavaScript(`new Promise((res) => setTimeout(() => {
    const spr = KK.SPR.icons.crown, src = spr.c; // baked sprite {c, w, h}
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    // dark rounded tile + gold crown
    g.fillStyle = '#1a1328'; g.fillRect(16, 16, 224, 224);
    g.fillStyle = '#000'; g.fillRect(16, 16, 224, 8); g.fillRect(16, 232, 224, 8); g.fillRect(16, 16, 8, 224); g.fillRect(232, 16, 8, 224);
    const s = Math.floor(176 / Math.max(src.width, src.height));
    g.drawImage(src, 128 - src.width * s / 2, 136 - src.height * s / 2, src.width * s, src.height * s);
    res(c.toDataURL('image/png'));
  }, 800))`).catch((e) => { console.error('icon failed', e); app.quit(); });
  if (!url) return;
  fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.png'), Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote build/icon.png');
  app.quit();
});
