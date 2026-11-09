#!/bin/sh
cd "$(dirname "$0")"
for t in 1 2 3; do
  png=""; [ $t = 1 ] && png="--png 100,400"
  node run_shot.js g1 wall$t $png
  node run_shot.js g1 det$t --det $png
  node run_shot.js g1 detq$t --det --audio off
  node run_shot.js s3 detq$t --det --audio off
done
node run_shot.js g2 wall1 --png 600,1500
node run_shot.js s4 old1 --lastsave old --secs 6
for t in 1 2 3; do
  node run_shot.js g2 v9wall$t --script shots/g2_v9.json --secs 40
  node run_shot.js g2 v9det$t --det --script shots/g2_v9.json --secs 40
  node run_shot.js g5 v9wall$t --script shots/g5_v9.json --secs 60
done
node run_shot.js s4 wall1b --png 120
echo BATCH2B DONE
