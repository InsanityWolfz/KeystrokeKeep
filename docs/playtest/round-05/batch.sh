#!/bin/sh
# Round 05 auditor batch -> out/
cd "$(dirname "$0")"
for p in "typist 1" "typist 2" "typist 3" "idle 1" "idle 2" "burst 1" "heavy 1" "light 1"; do set -- $p
  node r5probe.js --profile $1 --seed $2 --min 480 --retire nudge --omen random > out/r5_${1}_s${2}_480.txt & done
for p in "typist 1" "idle 1" "light 1"; do set -- $p
  node r5probe.js --profile $1 --seed $2 --min 2400 --retire nudge --omen random --quiet > out/r5_${1}_s${2}_2400.txt & done
for p in "typist 1" "typist 2" "idle 1" "burst 1"; do set -- $p
  node r5probe.js --demo --profile $1 --seed $2 --min 180 > out/r5demo_${1}_s${2}_180.txt & done
wait
