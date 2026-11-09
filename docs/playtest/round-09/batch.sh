#!/bin/sh
# Round 09 auditor batch (r9probe.js = current js/ + fx.js on sim time): demo 3 h x 6 seeds, 8 h x 4, 40 h x 4
cd "$(dirname "$0")"; mkdir -p out
{
for s in 1 2 3 4 5 6; do for p in typist light burst idle; do echo "--profile $p --seed $s --min 180 --demo --quiet --json out/demo_${p}_s$s.json|demo_${p}_s$s"; done; done
for s in 1 2 3 4; do for p in typist light burst idle; do echo "--profile $p --seed $s --min 480 --quiet --json out/b8_${p}_s$s.json|b8_${p}_s$s"; done; done
for s in 1 2 3 4; do for p in typist light idle; do echo "--profile $p --seed $s --min 2400 --quiet --json out/b40_${p}_s$s.json|b40_${p}_s$s"; done; done
} | xargs -P 28 -I{} sh -c 'a="{}"; node r9probe.js ${a%%|*} > out/${a##*|}.txt 2>&1'
echo done
