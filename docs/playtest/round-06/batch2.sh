#!/bin/sh
# Round 06 economist batch 2 (enrage designs, Dynamo designs) -> out/
cd "$(dirname "$0")"
for p in typist idle burst; do
  node econ6.js variants --profile $p --hours 8 --seeds 5 --v base,fix,noEnrage,fix+enrage300,fix+enrage420,fix+wounds50,soft180 > out/en8_$p.txt &
  node econ6.js variants --profile $p --hours 8 --seeds 5 --v base,noDynamo,wsSmart,dyn10,dynIdle60,dyn10+dynIdle60,wsSmart+dyn10+dynIdle60 > out/dy8_$p.txt &
done
wait
