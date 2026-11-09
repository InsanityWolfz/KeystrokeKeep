#!/bin/sh
# R10 market gate: 3 real-time takes each of S3, G5, G1, G2 through the safe launcher (right-hand monitor only)
cd "$(dirname "$0")"
for t in 1 2 3; do
  png=""; [ $t = 1 ] && png="--png 300,1200"
  node run_shot.js s3 r10_$t $png
  node run_shot.js g5 r10_$t $png
done
for t in 1 2 3; do
  png=""; [ $t = 1 ] && png="--png 300,600"
  node run_shot.js g1 r10_$t $png
  node run_shot.js g2 r10_$t $png
done
echo GATE DONE
