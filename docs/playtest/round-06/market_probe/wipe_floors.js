// R6 market: where and when do idle players wipe in hour 1? (wraps tools/playtest.js like alert_rate.js)
const Module = require('module'); const path = require('path'); const real = Module._load; const w = []; let K;
Module._load = function (req) { const m = real.apply(this, arguments); if (/headless$/.test(req)) return (o) => { K = m(o); const e = K.emit; K.emit = function (ev, d) { if (ev === 'wipe') w.push([Math.round(K.S.stats.playTime / 60), d.floor]); return e.apply(this, arguments); }; return K; }; return m; };
const ol = console.log; console.log = () => {};
process.on('exit', () => { ol(JSON.stringify({ args: process.argv.slice(2).join(' '), wipesFirstHour: w.filter((x) => x[0] < 60).length, list: w.filter((x) => x[0] < 60).map((x) => x[0] + 'm@f' + x[1]).join(' ') })); });
require(path.join(__dirname, '..', '..', '..', '..', 'tools', 'playtest.js'));
