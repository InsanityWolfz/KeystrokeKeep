#!/bin/sh
# R7 market: demo<->full handoff on HEAD main.js (dev shell, isolated probe folders; dialog auto-answered via
# KK_AUTODIALOG and logged). Log: out/instance_log.jsonl (one block per case).
# Run from the project dir:  sh docs/playtest/round-07/market_probe/run_instances.sh
P=docs/playtest/round-07/market_probe
L=$P/out/instance_log.jsonl
E=npx
case_() { echo "{\"case\":\"$1\",\"t\":$(date +%s%3N)}" >> $L; }
rm -f $L
# I2: full running, demo launched, "Close the other one" (baseline)
case_ I2_full_then_demo_close
KK_PROBE=hold KK_HOLD=40 KK_TAG=FULL $E electron $P >/dev/null 2>&1 &
sleep 9; KK_DEMO=1 KK_PROBE=hold KK_HOLD=8 KK_AUTODIALOG=0 KK_TAG=DEMO $E electron $P >/dev/null 2>&1; wait; sleep 14
# I4: owner slow to quit (3 s busy before-quit): R6 showed the dialog twice
case_ I4_slow_owner_3s
KK_PROBE=hold KK_HOLD=40 KK_SLOWQUIT=3000 KK_TAG=FULLSLOW3 $E electron $P >/dev/null 2>&1 &
sleep 9; KK_DEMO=1 KK_PROBE=hold KK_HOLD=8 KK_AUTODIALOG=0 KK_TAG=DEMO $E electron $P >/dev/null 2>&1; wait; sleep 20
# I4b: very slow owner (12 s, beyond the 10 s wait)
case_ I4b_slow_owner_12s
KK_PROBE=hold KK_HOLD=40 KK_SLOWQUIT=12000 KK_TAG=FULLSLOW12 $E electron $P >/dev/null 2>&1 &
sleep 9; KK_DEMO=1 KK_PROBE=hold KK_HOLD=8 KK_AUTODIALOG=0 KK_TAG=DEMO $E electron $P >/dev/null 2>&1; wait; sleep 25
# I5: two Windows users (os.userInfo override + own profile folders): B must start without a dialog
case_ I5_two_users
KK_PROBE=hold KK_HOLD=25 KK_FAKEUSER=alice KK_UD=alice KK_TAG=ALICE $E electron $P >/dev/null 2>&1 &
sleep 9; KK_PROBE=hold KK_HOLD=6 KK_FAKEUSER=bob KK_UD=bob KK_AUTODIALOG=1 KK_TAG=BOB $E electron $P >/dev/null 2>&1; wait; sleep 3
case_ end
