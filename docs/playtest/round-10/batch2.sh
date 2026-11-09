#!/bin/sh
# Round 10 auditor batch 2: same probe with KK.dayTick (daysPlayed grows 1 per 8 h of play), new and old js
cd "$(dirname "$0")"; mkdir -p out
{
for s in 1 2; do for p in typist light idle; do echo "new|--profile $p --seed $s --min 2400 --quiet --json out/d40_${p}_s$s.json|d40_${p}_s$s"; echo "old|--profile $p --seed $s --min 2400 --quiet --json out/do40_${p}_s$s.json|do40_${p}_s$s"; done; done
} | xargs -P 12 -I{} sh -c 'a="{}"; v=${a%%|*}; r=${a#*|}; if [ "$v" = old ]; then export KK_SRC="$PWD/old_js"; fi; node r10probe.js ${r%%|*} > out/${r##*|}.txt 2>&1'
echo done
