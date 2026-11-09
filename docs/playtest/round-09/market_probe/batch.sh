#!/bin/sh
cd "$(dirname "$0")"
for shot in g1 s3 s4 g2 g5; do
  for t in 1 2 3; do
    png=""; [ $t = 1 ] && png="--png 120,400,900"
    node run_shot.js $shot wall$t $png
    node run_shot.js $shot det$t --det $png
  done
done
echo BATCH DONE
