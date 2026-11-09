#!/bin/sh
# Round 06 economist batch 5 (Sanctuary relevance, omen x enrage, playtest.js reference runs) -> out/
cd "$(dirname "$0")"
for p in typist idle burst; do
  node econ6.js variants --profile $p --hours 8 --seeds 4 --v noSanct,fix+noSanct > out/sanct8_$p.txt &
done
for p in idle burst typist; do for om in glass deep gilded none; do
  node econ6.js variants --profile $p --hours 8 --seeds 4 --forceOmen $om --v base,fix > out/om8_${p}_$om.txt &
done; done
for p in typist idle burst; do
  node ../../../tools/playtest.js --min 480 --profile $p --retire nudge --omen random --seed 6 > out/pt_${p}_480.txt &
done
node ../../../tools/playtest.js --min 180 --profile typist --demo --retire nudge --seed 6 > out/pt_demo_typist_180.txt &
node ../../../tools/playtest.js --min 180 --profile idle --demo --retire nudge --seed 6 > out/pt_demo_idle_180.txt &
wait
