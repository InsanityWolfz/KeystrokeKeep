#!/bin/sh
# 40 h + demo runs: sh batch40.sh [tag] [extra args]
cd "$(dirname "$0")"
TAG=${1:-base}; shift 2>/dev/null
for p in "typist 1" "typist 2" "idle 1" "light 1"; do set -- $p
  node r6probe.js --profile $1 --seed $2 --min 2400 --quiet $EXTRA > out/${TAG}_${1}_s${2}_2400.txt & done
for p in "typist 1" "typist 2" "idle 1" "burst 1"; do set -- $p
  node r6probe.js --demo --profile $1 --seed $2 --min 180 --quiet $EXTRA > out/${TAG}demo_${1}_s${2}_180.txt & done
wait
