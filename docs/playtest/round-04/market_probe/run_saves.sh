#!/bin/sh
# R4 market: save-file scenarios, all inside %APPDATA%/kk-market-probe-r4 (never the real save folders).
# Run from the project dir:  sh docs/playtest/round-04/market_probe/run_saves.sh
P=docs/playtest/round-04/market_probe
U="$APPDATA/kk-market-probe-r4/userData"
rm -rf "$U"; KK_PROBE=lsseed timeout 60 npx electron $P 2>&1 | grep -E "\[probe\] (done|FAILED)"
KK_PROBE=save:ls-migrate timeout 90 npx electron $P 2>&1 | grep -E "\[probe\] (done|FAILED)"
for s in corrupt-main zero-main all-corrupt-with-demo demo-import wipe-then-reload rotation rename-locked; do
  rm -rf "$U"; KK_PROBE=save:$s timeout 90 npx electron $P 2>&1 | grep -E "\[probe\] (done|FAILED)"
done
rm -rf "$U"; KK_DEMO=1 KK_PROBE=save:demo-build timeout 90 npx electron $P 2>&1 | grep -E "\[probe\] (done|FAILED)"
