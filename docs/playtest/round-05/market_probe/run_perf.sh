#!/bin/sh
# R5 market: low-GPU ON vs OFF, all cores vs 4 / 2 E-cores (laptop proxy). Probe folders only.
# Run from the project dir:  sh docs/playtest/round-05/market_probe/run_perf.sh
P=docs/playtest/round-05/market_probe
run() { tag=$1; shift; env "$@" KK_PROBE=perf KK_SAMPLES=${KK_SAMPLES:-12} timeout 400 npx electron $P 2>&1 | grep -E "\[probe\] (done|FAILED|sprites)"; cp $P/out/perf.json $P/out/perf_$tag.json; echo "== $tag"; }
run on_all_1    KK_LOWGPU=1 KK_REBAKE=1
run off_all_1   KK_LOWGPU=0
run on_e4       KK_LOWGPU=1 KK_REBAKE=1 KK_AFFINITY=F0000 KK_CORES=4
run off_e4      KK_LOWGPU=0 KK_AFFINITY=F0000 KK_CORES=4
run on_e2       KK_LOWGPU=1 KK_REBAKE=1 KK_AFFINITY=30000 KK_CORES=2
run off_e2      KK_LOWGPU=0 KK_AFFINITY=30000 KK_CORES=2
run on_all_2    KK_LOWGPU=1 KK_REBAKE=1
run off_all_2   KK_LOWGPU=0
run on_all_shipped KK_LOWGPU=1
