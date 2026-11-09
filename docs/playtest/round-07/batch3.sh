#!/bin/sh
# Round 07 auditor batch 3: isolate the Lantern (omen+tro+ach2 without it) and a cheaper/stronger Lantern bought naturally
cd "$(dirname "$0")"; mkdir -p out/aud
{
for s in 1 2 3 4; do for p in typist idle light; do
  echo "--profile $p --seed $s --min 2400 --quiet --proto omen,tro,ach2|nl40_${p}_s$s"
  echo "--profile $p --seed $s --min 2400 --quiet --proto week2 --lBase 1500 --lGrowth 2 --lStep 0.1|wn40_${p}_s$s"
done; done
} | xargs -P 24 -I{} sh -c 'a="{}"; node r7probe.js ${a%%|*} > out/aud/${a##*|}.txt 2>&1'
echo done
