#!/bin/sh
cd "$(dirname "$0")"; mkdir -p out
{
for s in 1 2 3 4; do for p in typist light burst idle; do echo "--profile $p --seed $s --min 480 --quiet|b8_${p}_s$s"; done; done
for s in 1 2 3 4 5 6; do for p in typist light burst idle; do echo "--profile $p --seed $s --min 180 --demo --quiet|demo_${p}_s$s"; done; done
} | xargs -P 30 -I{} sh -c 'a="{}"; node r8probe.js ${a%%|*} > out/${a##*|}.txt 2>&1'
echo done
