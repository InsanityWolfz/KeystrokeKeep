#!/bin/sh
# R6 market: instance handling in the dev shell (real main.js, isolated probe folders; the dialog is auto-answered
# by KK_AUTODIALOG=<button index> and logged). Every event lands in out/instance_log.jsonl (one block per case).
# Run from the project dir:  sh docs/playtest/round-06/market_probe/run_instances.sh
P=docs/playtest/round-06/market_probe
L=$P/out/instance_log.jsonl
E=npx
case_() { echo "{\"case\":\"$1\",\"t\":$(date +%s%3N)}" >> $L; }
rm -f $L
# I1: same build twice while the strip is hidden -> second exits, strip comes back
case_ I1_same_build_hidden
KK_PROBE=hold KK_HIDE=1 KK_HOLD=14 KK_TAG=A $E electron $P >/dev/null 2>&1 &
sleep 9; KK_PROBE=noop KK_TAG=A2 timeout 30 $E electron $P >/dev/null 2>&1; wait; sleep 2
# I2: full running, demo launched, user picks "Close the other one and start the demo"
case_ I2_full_then_demo_close
KK_PROBE=hold KK_HOLD=40 KK_TAG=FULL $E electron $P >/dev/null 2>&1 &
sleep 9; KK_DEMO=1 KK_PROBE=hold KK_HOLD=8 KK_AUTODIALOG=0 KK_TAG=DEMO $E electron $P >/dev/null 2>&1; wait; sleep 14
echo "{\"case\":\"I2_files\",\"fullSave\":$(node -e "try{console.log(JSON.stringify(require(process.env.APPDATA+'/kk-market-probe-r6/AppData/Keystroke Keep/saves/keystroke-keep.json').floor))}catch(e){console.log('null')}")}" >> $L
# I3: full running, demo launched, user picks Cancel
case_ I3_full_then_demo_cancel
KK_PROBE=hold KK_HOLD=20 KK_TAG=FULL $E electron $P >/dev/null 2>&1 &
sleep 9; KK_DEMO=1 KK_PROBE=hold KK_HOLD=5 KK_AUTODIALOG=1 KK_TAG=DEMO $E electron $P >/dev/null 2>&1; wait; sleep 2
# I4: the running build is slow to quit (3 s, e.g. a save flush behind an AV lock): does the relaunch race the 1.5 s wait?
case_ I4_slow_owner_quit
KK_PROBE=hold KK_HOLD=40 KK_SLOWQUIT=3000 KK_TAG=FULLSLOW $E electron $P >/dev/null 2>&1 &
sleep 9; KK_DEMO=1 KK_PROBE=hold KK_HOLD=8 KK_AUTODIALOG=0 KK_TAG=DEMO $E electron $P >/dev/null 2>&1; wait; sleep 20
case_ end
