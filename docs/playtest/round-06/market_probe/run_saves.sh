#!/bin/sh
# R6 market: save scenarios after 89f4651 (newer .tmp wins, marker after first own save, async retries),
# plus the R5 regressions. All inside %APPDATA%/kk-market-probe-r6 (never the real save folders).
# Run from the project dir:  sh docs/playtest/round-06/market_probe/run_saves.sh
P=docs/playtest/round-06/market_probe
U="$APPDATA/kk-market-probe-r6/userData"
one() { rm -rf "$U"; KK_PROBE=save:$1 timeout 120 npx electron $P 2>&1 | grep -E "\[probe\] (done|FAILED)"; }
for s in tmp-newer tmp-older tmp-newer-corrupt tmp-only marker-then-corrupt own-marker-corrupt-with-demo async-lock async-stale \
         corrupt-main zero-main demo-import wipe-then-reload rotation lock-short session-end lowgpu-off lowgpu-on lowgpu-auto lowgpu-nosettings lowgpu-corrupt; do one $s; done
