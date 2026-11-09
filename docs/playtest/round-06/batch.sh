#!/bin/sh
# Round 06 auditor baseline batch -> out/  (usage: sh batch.sh [tag] [extra r6probe args...])
cd "$(dirname "$0")"
TAG=${1:-base}; shift 2>/dev/null
for p in "typist 1" "typist 2" "typist 3" "idle 1" "idle 2" "burst 1" "heavy 1" "light 1"; do set -- $p
  node r6probe.js --profile $1 --seed $2 --min 480 --quiet $EXTRA > out/${TAG}_${1}_s${2}_480.txt & done
wait
