#!/bin/sh
# R7 market: stale-retry + low-GPU migration checks on HEAD main.js, all inside %APPDATA%/kk-market-probe-r7.
# Run from the project dir:  sh docs/playtest/round-07/market_probe/run_saves.sh
P=docs/playtest/round-07/market_probe
U="$APPDATA/kk-market-probe-r7/userData"
O=$P/out
# R6 raw race (async then saveSync without a flush) and the real quit order
KK_PROBE=save:async-stale timeout 120 npx electron $P 2>&1 | grep -E "\[probe\] (done|FAILED)"
KK_PROBE=save:async-stale-quit timeout 120 npx electron $P 2>&1 | grep -E "\[probe\] (done|FAILED)"
# low-GPU: laptop proxy (KK_FAKEBATT=1) and desktop (0); first boot, then a relaunch on the files it left
for b in 1 0; do
  for s in lowgpu-legacy-true lowgpu-chosen-true lowgpu-auto lowgpu-nosettings lowgpu-off; do
    rm -rf "$U"; KK_FAKEBATT=$b KK_PROBE=save:$s timeout 120 npx electron $P 2>&1 | grep -E "\[probe\] (done|FAILED)"
    cp $O/save_$s.json $O/r7_${s}_batt$b.json
    rm -rf "$U"; KK_FAKEBATT=$b KK_PROBE=save:relaunch timeout 120 npx electron $P 2>&1 | grep -E "\[probe\] (done|FAILED)"
    cp $O/save_relaunch.json $O/r7_${s}_batt${b}_boot2.json
  done
done
