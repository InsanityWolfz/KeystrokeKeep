#!/bin/sh
# R6 market: re-measure after 89f4651 (willReadFrequently baked canvases, lowGpu 'auto'). No re-bake hacks any more:
# the shipped code draws the party in both modes. Probe folders only (%APPDATA%/kk-market-probe-r6).
# Run from the project dir:  sh docs/playtest/round-06/market_probe/run_perf.sh
P=docs/playtest/round-06/market_probe
run() { tag=$1; shift; env "$@" KK_PROBE=perf KK_SAMPLES=${KK_SAMPLES:-12} timeout 400 npx electron $P 2>&1 | grep -E "\[probe\] (done|FAILED|sprites)"; cp $P/out/perf.json $P/out/perf_$tag.json; echo "== $tag"; }
run auto_all    KK_TAG=auto
run on_all      KK_LOWGPU=1
run off_all     KK_LOWGPU=0
run on_e4       KK_LOWGPU=1 KK_AFFINITY=F0000 KK_CORES=4
run off_e4      KK_LOWGPU=0 KK_AFFINITY=F0000 KK_CORES=4
