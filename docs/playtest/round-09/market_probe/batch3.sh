#!/bin/sh
cd "$(dirname "$0")"
for t in 1 2 3; do
  png=""; [ $t = 1 ] && png="--png 300,1200"
  node run_shot.js g1 new$t $png --secs 10
  node run_shot.js s3 new$t $png --secs 10
  node run_shot.js g2 new$t --secs 16
  node run_shot.js g2 newb$t --script shots/g2_v9b.json --secs 12 $png
  node run_shot.js g5 new$t --secs 18 $png
done
echo BATCH3 DONE
