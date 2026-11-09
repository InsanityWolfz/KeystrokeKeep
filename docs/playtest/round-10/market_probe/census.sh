#!/bin/sh
# R10 market: noise census on HEAD (51310be). demo 2 h, full 12 h; seeds 1 and 6; desktop defaults (calm on, combat sfx off)
cd "$(dirname "$0")/../../../.."
P=docs/playtest/round-10/market_probe
for s in 1 6; do
  node $P/census9.js --min 120 --profile idle --seed $s --retire nudge --omen random --demo --out $P/out/c10_demo_idle_$s.json > $P/out/c10_demo_idle_$s.txt 2>&1 &
  node $P/census9.js --min 120 --profile typist --seed $s --retire nudge --omen random --demo --out $P/out/c10_demo_typist_$s.json > $P/out/c10_demo_typist_$s.txt 2>&1 &
  node $P/census9.js --min 720 --profile idle --seed $s --retire nudge --omen random --out $P/out/c10_full_idle_$s.json > $P/out/c10_full_idle_$s.txt 2>&1 &
  node $P/census9.js --min 720 --profile typist --seed $s --retire nudge --omen random --out $P/out/c10_full_typist_$s.json > $P/out/c10_full_typist_$s.txt 2>&1 &
done
wait
echo CENSUS DONE
