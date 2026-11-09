#!/bin/sh
# R5 market: save-file scenarios, all inside %APPDATA%/kk-market-probe-r5 (never the real save folders).
# Run from the project dir:  sh docs/playtest/round-05/market_probe/run_saves.sh
P=docs/playtest/round-05/market_probe
U="$APPDATA/kk-market-probe-r5/userData"
one() { KK_PROBE=save:$1 timeout 120 npx electron $P 2>&1 | grep -E "\[probe\] (done|FAILED)"; }
rm -rf "$U"; KK_PROBE=lsseed timeout 60 npx electron $P 2>&1 | grep -E "\[probe\] (done|FAILED)"
one ls-migrate
for s in corrupt-main zero-main all-corrupt-with-demo demo-import; do rm -rf "$U"; one $s; done
cp $P/out/save_demo-import.json $P/out/save_demo-import_first.json
one relaunch   # same files as demo-import left: must load the full save, not re-import
for s in imported-then-deleted wipe-then-reload rotation rename-locked lock-short session-end lowgpu-off lowgpu-on lowgpu-nosettings lowgpu-corrupt; do rm -rf "$U"; one $s; done
rm -rf "$U"; KK_DEMO=1 KK_PROBE=save:demo-build timeout 120 npx electron $P 2>&1 | grep -E "\[probe\] (done|FAILED)"
