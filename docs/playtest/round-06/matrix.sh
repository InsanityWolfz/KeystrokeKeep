#!/bin/sh
# Round 06: per-move impact matrix -> out/mx_<cfg>_<profile>_s<seed>_<min>.txt
cd "$(dirname "$0")"
run() { cfg=$1; shift; args="$1"; shift
  for p in "typist 1 480" "typist 2 480" "idle 1 480" "idle 2 480" "light 1 480" "burst 1 480" "idle 1 2400" "light 1 2400" "typist 1 2400"; do set -- $p
    node r6probe.js --profile $1 --seed $2 --min $3 --quiet $args > out/mx_${cfg}_${1}_s${2}_${3}.txt & done; wait; }
run fixes "--proto fixes" &
run rat "--proto fixes,rat" &
run rathp "--proto fixes,rat --ratMode hp" &
run web "--proto fixes,web" &
run shell "--proto fixes,shell" &
run shell54 "--proto fixes,shell --shellMult 0.5 --shellDur 4" &
run lava "--proto fixes,lava" &
run lava5 "--proto fixes,lava --lavaMult 0.5" &
run final "--proto fixes,sig --ratMode hp --shellMult 0.5 --shellDur 4 --lavaMult 0.5 --dodge" &
wait
