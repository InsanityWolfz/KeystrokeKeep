# count wipes on x1 floors and repeat boss kills (boss rematches after retreating onto a cleared boss floor)
for g in 60 300; do for p in idle typist; do tot=0; for s in 1 2 3 4 5 6 7 8 9 10; do node pt7.js --min 180 --profile $p --seed $s --demo --retire nudge --omen random --glance $g; done | node -e "
const L=require('fs').readFileSync(0,'utf8').trim().split('\n').map(JSON.parse);
const x1=L.map(d=>(d.list.match(/N\d*1\b/g)||[]).length), rep=L.map(d=>d.bossRepeat), h1=L.map(d=>d.h1);
console.log('$p glance $g: h1 wipes on x1 floors', x1.join(','), 'sum', x1.reduce((a,b)=>a+b,0), 'of', h1.reduce((a,b)=>a+b,0), '| repeat boss kills (3h)', rep.join(','));"; done; done
