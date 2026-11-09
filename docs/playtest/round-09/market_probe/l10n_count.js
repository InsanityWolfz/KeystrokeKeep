// R9 market: rough count of hard-coded, player-visible English strings in js/*.js and index.html (localisation readiness).
// Counts string/template literals that contain a letter-run of >=3 and either a space or are ALL CAPS words (banner style),
// excluding obvious code tokens (event names, CSS, selectors, ids, colours, URLs).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const files = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);
const per = {}; let total = 0; const samples = [];
const lit = /(['"`])((?:\.|(?!\1)[^\\n])*)\1/g;
for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  let m, n = 0;
  while ((m = lit.exec(src))) {
    let s = m[2].replace(/\$\{[^}]*\}/g, ' X ').replace(/<[^>]+>/g, ' ');
    if (/^[#.]?[a-z][\w-]*$/i.test(s.trim()) && !/^[A-Z]{3,}!?$/.test(s.trim())) continue; // identifiers, event names
    if (/^(#|rgba?\(|https?:|steam:|[\w-]+:\s|\.|\[)/.test(s.trim())) continue;
    if (/^[\d\s.,%x+\-*/()]*$/.test(s)) continue;
    const words = s.match(/[A-Za-z]{3,}/g) || [];
    if (!words.length) continue;
    const visible = /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(s) || /^[A-Z][A-Z !?'.-]{3,}$/.test(s.trim()) || /^[A-Z][a-z]+(\s|$)/.test(s.trim());
    if (!visible) continue;
    if (/querySelector|classList|addEventListener|getContext|font|px|globalComposite/.test(s)) continue;
    n++; if (samples.length < 400) samples.push(f + ': ' + s.trim().slice(0, 70));
  }
  per[f] = n; total += n;
}
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
const htmlText = (html.match(/>([^<>]*[A-Za-z]{3,}[^<>]*)</g) || []).map((x) => x.slice(1, -1).trim()).filter(Boolean);
const titles = (html.match(/(title|placeholder)="[^"]*[A-Za-z]{3,}[^"]*"/g) || []);
console.log(JSON.stringify({ perFile: per, jsTotal: total, htmlTextNodes: htmlText.length, htmlTitles: titles.length }, null, 1));
fs.writeFileSync(path.join(__dirname, 'out', 'l10n_samples.txt'), samples.join('\n'));
