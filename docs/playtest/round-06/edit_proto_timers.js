// one-off: switch the prototype sig timers to start on activation (scratch helper, edits only r6proto.js)
const fs = require('fs'), path = require('path');
const f = path.join(__dirname, 'r6proto.js');
let s = fs.readFileSync(f, 'utf8');
s = s.replace('ratFirst: 1.0,', 'ratFirst: +args.ratFirst || 0.8,')
  .replace('webFirst: 1.5,', 'webFirst: +args.webFirst || 1.0,')
  .replace('shellFirst: 1.0,', 'shellFirst: args.shellFirst !== undefined ? +args.shellFirst : 0.01,')
  .replace('lavaFirst: 1.0,', 'lavaFirst: +args.lavaFirst || 1.0,')
  .replace('    const engaged = e.x - front.x <= e.def.w / 2 + e.def.range + 40;\n    if (!engaged) return;\n', '    // timers run from activation (boss on screen), so a 2-second typist fight still sees the opener\n');
fs.writeFileSync(f, s);
console.log(s.match(/First[^,]*,/g));
