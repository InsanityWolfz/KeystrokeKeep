// R5: how many omen delves does "Augur" (delve under all 10 omens) take? Offer rule copied from state.js retire().
const ids = ['gilded','glass','storm','quiet','fever','embertide','march','hoard','muster','deep'];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
for (const pol of ['seek-unseen','random','best-of-rank']) {
  const res=[]; const rank=['deep','glass','storm','embertide','muster','march','gilded','hoard','quiet','fever'];
  for (let trial=0;trial<20000;trial++){
    let last=[], seen=new Set(), n=0;
    while(seen.size<10 && n<500){ const pool=ids.filter(x=>!last.includes(x)); const off=shuffle(pool).slice(0,3); last=off; n++;
      let pick; if(pol==='seek-unseen') pick=off.find(x=>!seen.has(x))||off[0]; else if(pol==='random') pick=off[Math.floor(Math.random()*3)]; else pick=off.slice().sort((a,b)=>rank.indexOf(a)-rank.indexOf(b))[0];
      seen.add(pick);}
    res.push(n);}
  res.sort((a,b)=>a-b);
  console.log(pol.padEnd(13),'omen delves to see all 10: median',res[res.length>>1],'p90',res[Math.floor(res.length*0.9)],'p99',res[Math.floor(res.length*0.99)], 'never(>=500)', res.filter(x=>x>=500).length);
}
