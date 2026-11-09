#!/bin/sh
# multi-seed 40 h check: fixes vs final signature set vs everything (week2 included)
cd "$(dirname "$0")"
for s in 1 2 3 4; do for p in idle typist light; do
  node r6probe.js --profile $p --seed $s --min 2400 --quiet --proto fixes > out/s40_fixes_${p}_s$s.txt &
  node r6probe.js --profile $p --seed $s --min 2400 --quiet --proto fixes,sig --ratMode hp --shellMult 0.5 --shellDur 4 --lavaMult 0.5 --dodge > out/s40_final_${p}_s$s.txt &
  node r6probe.js --profile $p --seed $s --min 2400 --quiet --proto all --ratMode hp --shellMult 0.5 --shellDur 4 --lavaMult 0.5 --dodge > out/s40_all_${p}_s$s.txt &
  node r6probe.js --profile $p --seed $s --min 2400 --quiet > out/s40_base_${p}_s$s.txt &
done; wait; done
