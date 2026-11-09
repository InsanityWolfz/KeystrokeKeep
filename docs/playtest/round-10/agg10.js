// Round 10 auditor: aggregate out/*.txt R10 lines and summary lines per run
const fs = require('fs');
const pat = process.argv[2] ? new RegExp(process.argv[2]) : /./;
const keys = (process.argv[3] || 'BIOME after|FIRST SEEN|ACH new|WARDEN|SPORELING|LASHER|OVERGROWTH|LOCKDOWN|WARD |AFTER 8h|longest gap|===').split('|');
for (const f of fs.readdirSync('out').filter((x) => x.endsWith('.txt') && pat.test(x)).sort()) {
  const L = fs.readFileSync('out/' + f, 'utf8').split('\n');
  console.log('## ' + f);
  for (const l of L) if (keys.some((k) => l.includes(k))) console.log('  ' + l.slice(0, 700));
}
