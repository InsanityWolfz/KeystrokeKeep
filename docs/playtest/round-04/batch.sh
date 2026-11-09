#!/bin/sh
# Round 04 auditor batch: node docs/playtest/round-04 runs -> out/
cd "$(dirname "$0")"
for p in "typist 1" "typist 2" "typist 3" "idle 1" "idle 2" "burst 1" "heavy 1" "light 1"; do set -- $p
  node r4probe.js --profile $1 --seed $2 --min 480 --retire nudge --omen random > out/r4_${1}_s${2}_480.txt; done
for p in "typist 1" "idle 1"; do set -- $p
  node r4probe.js --profile $1 --seed $2 --min 1440 --retire nudge --omen new --quiet > out/r4_${1}_s${2}_1440.txt; done
for p in "typist 1" "typist 2" "idle 1" "burst 1"; do set -- $p
  node r4probe.js --demo --profile $1 --seed $2 --min 180 > out/r4demo_${1}_s${2}_180.txt; done
