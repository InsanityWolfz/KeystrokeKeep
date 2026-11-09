# T1 economist R10 batches (HEAD in out/BUILD.txt; old = 51310be^ js in old/js)
cd "$(dirname "$0")"
node batch10.js week10.js out/month_new.jsonl typist,burst,idle 1-4 "g60=--days 35 --glance 60" &
node batch10.js week10.js out/month_old.jsonl typist,burst,idle 1-4 "g60=--days 35 --glance 60 --old" &
node batch10.js week10.js out/month300.jsonl burst,idle 1-4 "new300=--days 35 --glance 300;old300=--days 35 --glance 300 --old" &
wait
node batch10.js week10.js out/d9.jsonl typist,burst,idle 1-6 "new=--days 9;old=--days 9 --old;rwfirst=--days 9 --rw first;rwnever=--days 9 --rw never;nostar=--days 9 --omen nostar;random=--days 9 --omen random;idle300=--days 9 --glance 300;idle300old=--days 9 --glance 300 --old"
echo ALLDONE
