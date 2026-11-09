#!/bin/sh
# Round 08 auditor batch (r8probe.js = current js/ + fx.js on sim time): demo 3 h, 8 h, 40 h (4 seeds)
cd "$(dirname "$0")"; mkdir -p out
{
for s in 1 2 3 4 5 6; do for p in typist light burst idle; do echo "--profile $p --seed $s --min 180 --demo --quiet|demo_${p}_s$s"; done; done
for s in 1 2 3 4; do for p in typist light burst idle; do echo "--profile $p --seed $s --min 480 --quiet|b8_${p}_s$s"; done; done
for s in 1 2 3 4; do for p in typist light idle; do echo "--profile $p --seed $s --min 2400 --quiet|b40_${p}_s$s"; done; done
} | xargs -P 30 -I{} sh -c 'a="{}"; node r8probe.js ${a%%|*} > out/${a##*|}.txt 2>&1'
echo done
