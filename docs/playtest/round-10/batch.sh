#!/bin/sh
# Round 10 auditor batch: r10probe on HEAD js/ (new) and on 51310be^ js/ (old_js) for before/after
cd "$(dirname "$0")"; mkdir -p out
{
for s in 1 2 3 4; do for p in typist light burst idle; do echo "new|--profile $p --seed $s --min 480 --quiet --json out/n8_${p}_s$s.json|n8_${p}_s$s"; done; done
for s in 1 2 3 4; do for p in typist light idle; do echo "new|--profile $p --seed $s --min 2400 --quiet --json out/n40_${p}_s$s.json|n40_${p}_s$s"; done; done
for s in 1 2 3 4; do for p in typist light idle; do echo "old|--profile $p --seed $s --min 2400 --quiet --json out/o40_${p}_s$s.json|o40_${p}_s$s"; done; done
for s in 1 2; do for p in typist idle; do echo "new|--profile $p --seed $s --min 180 --demo --quiet --json out/demo_${p}_s$s.json|demo_${p}_s$s"; done; done
echo "new|--profile typist --seed 1 --min 4800 --quiet --json out/n80_typist_s1.json|n80_typist_s1"
} | xargs -P 30 -I{} sh -c 'a="{}"; v=${a%%|*}; r=${a#*|}; if [ "$v" = old ]; then export KK_SRC="$PWD/old_js"; fi; node r10probe.js ${r%%|*} > out/${r##*|}.txt 2>&1'
echo done
