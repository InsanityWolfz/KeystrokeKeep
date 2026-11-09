#!/bin/sh
# multi-seed 40 h: softer enrage (fixes2) alone, with the signature set, and with everything
cd "$(dirname "$0")"
SIG="--ratMode hp --shellMult 0.5 --shellDur 4 --lavaMult 0.5 --dodge"
for s in 1 2 3 4; do for p in idle typist light; do
  node r6probe.js --profile $p --seed $s --min 2400 --quiet --proto fixes2 > out/s40_fixes2_${p}_s$s.txt &
  node r6probe.js --profile $p --seed $s --min 2400 --quiet --proto fixes2,sig $SIG > out/s40_final2_${p}_s$s.txt &
  node r6probe.js --profile $p --seed $s --min 2400 --quiet --proto fixes2,sig,week2 $SIG > out/s40_all2_${p}_s$s.txt &
done; wait; done
