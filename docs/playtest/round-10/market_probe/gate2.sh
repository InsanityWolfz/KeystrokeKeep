#!/bin/sh
# R10 market: does the audio path cause the G2/G5 drift? same takes with KK_CAPTURE_AUDIO=off
cd "$(dirname "$0")"
for t in 1 2 3; do node run_shot.js g2 aoff_$t --audio off; done
for t in 1 2 3; do node run_shot.js g5 aoff_$t --audio off; done
echo GATE2 DONE
