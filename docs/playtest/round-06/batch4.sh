#!/bin/sh
# Round 06 economist batch 4 (Dynamo numbers) -> out/
cd "$(dirname "$0")"
for p in typist idle burst; do
  node econ6.js variants --profile $p --hours 8 --seeds 5 --v dyn10+dynCheap,dyn8,dyn8+dynCheap > out/dy8b_$p.txt &
done
for p in typist idle; do
  node econ6.js variants --profile $p --hours 40 --seeds 3 --v dyn10 > out/dy40_$p.txt &
done
wait
