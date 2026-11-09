#!/bin/sh
# Round 06 economist batch 3 (long-run enrage designs) -> out/
cd "$(dirname "$0")"
for v in noEnrage fix+wounds1 fix+wounds25 fix+enrage300+wounds1 fix+enrage420 soft180; do
  node econ6.js variants --profile idle --hours 40 --seeds 3 --v $v > out/en40_idle_$v.txt &
done
for v in fix+wounds1 fix+enrage300+wounds1; do
  node econ6.js variants --profile typist --hours 40 --seeds 3 --v $v > out/en40_typist_$v.txt &
  node econ6.js variants --profile burst --hours 24 --seeds 3 --v $v > out/en24_burst_$v.txt &
done
node econ6.js variants --profile burst --hours 24 --seeds 3 --v noEnrage > out/en24_burst_noEnrage.txt &
wait
