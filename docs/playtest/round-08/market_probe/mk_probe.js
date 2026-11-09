// R8 market: wraps a cue script with a renderer probe (fps per second via KK.render.draw, state, events) -> out/<name>.probe.json
// node mk_probe.js <cues.json> <outname>
const fs = require('fs');
const PROBE = `(()=>{const R=KK.render;let n=0;const d=R.draw;R.draw=function(){n++;return d.apply(this,arguments)};let last=performance.now();
setInterval(()=>{const now=performance.now(),S=KK.S,st=S.settings;console.log('[capture] probe '+JSON.stringify({s:Math.round(now/100)/10,fps:Math.round(n*1000/(now-last)),floor:S.floor,tier:KK.fervorTier(),fervor:Math.round(S.fervor),sparks:Math.round(S.sparks),calm:st.calm,combat:st.combatSfx,vol:st.volume,sound:st.sound,music:st.music,size:st.size,paused:!!KK.capturePaused,kkPaused:!!KK.paused,warp:KK.warp,banner:(KK.fx.banners[0]||{}).text||'',alert:(KK.fx.alerts[KK.fx.alerts.length-1]||{}).str||'',ultTurn:KK.world.ultTurn,toasts:document.querySelectorAll('#toasts .toast').length,modal:(document.querySelector('#modal-root .modal h2')||{}).textContent||'',tab:KK.ui.tab||'',offer:!!S.relicOffer,omen:S.omen,glimpse:S.glimpse,demo:KK.DEMO_CAP||0,boss:KK.world.boss?KK.world.boss.def.name+(KK.world.boss.shell>0?' SHELL':''):'',bodyBg:document.body.style.background,lowGpu:st.lowGpu}));n=0;last=now},1000);
['fervorTier','ult','meteorLand','bossSpawn','kill','magmaShell','shellCrack','relicOffer','relicPicked','retired','omenPicked','glimpse','demoComplete','floor','chargeWarn','warCharge','reassemble','webShot','ratSpawn','ratCaught'].forEach(e=>KK.on(e,p=>{if(e==='kill'&&!(p&&p.e&&p.e.boss))return;console.log('[capture] ev '+(Math.round(performance.now()/100)/10)+' '+e+' '+(p&&p.from!==undefined?p.from+'->'+p.to:(p&&(p.floor||p.id))||(p&&p.e&&p.e.def&&p.e.def.name)||(p&&p.boss&&p.boss.def.name)||''))}));})()`;
const [src, name] = process.argv.slice(2);
const s = JSON.parse(fs.readFileSync(src, 'utf8'));
s.cues = [{ t: 0, do: 'js', v: PROBE }, ...s.cues];
const out = __dirname + '/out/' + name + '.probe.json';
fs.writeFileSync(out, JSON.stringify(s, null, 1));
console.log(out);
