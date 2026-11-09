#!/bin/sh
# Round 07 auditor batch 2 (after fixing the f150/f200 beat double count): week-2 at 40 h, Lantern price variants
cd "$(dirname "$0")"; mkdir -p out/aud
{
for s in 1 2 3 4; do for p in typist idle light; do
  echo "--profile $p --seed $s --min 2400 --quiet --proto week2|w40_${p}_s$s"
  echo "--profile $p --seed $s --min 2400 --quiet --proto week2 --lanternSave|ws40_${p}_s$s"
  echo "--profile $p --seed $s --min 2400 --quiet --proto week2 --lanternSave --lBase 1500 --lGrowth 2|wc40_${p}_s$s"
done; done
} | xargs -P 24 -I{} sh -c 'a="{}"; node r7probe.js ${a%%|*} > out/aud/${a##*|}.txt 2>&1'
echo done
