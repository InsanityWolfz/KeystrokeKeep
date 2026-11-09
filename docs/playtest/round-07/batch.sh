#!/bin/sh
# Round 07 auditor batch: 8 h baseline, 3 h demo, 40 h baseline vs week-2 prototypes (4 seeds each)
cd "$(dirname "$0")"; mkdir -p out
{
for s in 1 2 3 4; do for p in typist idle burst light; do echo "--profile $p --seed $s --min 480 --quiet|b8_${p}_s$s"; done; done
for s in 1 2 3; do for p in typist idle burst; do echo "--profile $p --seed $s --min 180 --demo|demo_${p}_s$s"; done; done
for s in 1 2 3 4; do for p in typist idle light; do
  echo "--profile $p --seed $s --min 2400 --quiet|b40_${p}_s$s"
  echo "--profile $p --seed $s --min 2400 --quiet --proto week2|w40_${p}_s$s"
  echo "--profile $p --seed $s --min 2400 --quiet --proto week2 --lanternFirst|wl40_${p}_s$s"
done; done
} | xargs -P 24 -I{} sh -c 'a="{}"; node r7probe.js ${a%%|*} > out/${a##*|}.txt 2>&1'
echo done
