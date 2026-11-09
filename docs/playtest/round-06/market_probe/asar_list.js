// R5 market: list a packaged app.asar (entries + sizes). node asar_list.js <path to app.asar>
const a = require('C:/Development/KeystrokeKeep/node_modules/@electron/asar');
const file = process.argv[2];
const list = a.listPackage(file).map((x) => x.split('\\').join('/'));
let total = 0;
const rows = [];
for (const f of list) {
  try { const s = a.statFile(file, f.slice(1)); if (s && s.size !== undefined) { total += s.size; rows.push([f, s.size, !!s.unpacked]); } } catch (e) { /* dir */ }
}
console.log('entries', list.length, 'files', rows.length, 'bytes', total);
for (const r of rows) console.log(String(r[1]).padStart(9), r[2] ? 'U' : ' ', r[0]);
