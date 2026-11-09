# T1 economist R9: all batches on one build (HEAD in out/BUILD.txt)
set -e
cd "$(dirname "$0")"
node gate9.js --name gate_h1 --seeds 1-10 \
 --cfg "idle g60 none||--min 60 --profile idle --demo --glance 60" \
 --cfg "idle g300 none||--min 60 --profile idle --demo --glance 300" \
 --cfg "idle g60 click|KKCLICK=1|--min 60 --profile idle --demo --glance 60" \
 --cfg "idle g300 click|KKCLICK=1|--min 60 --profile idle --demo --glance 300" \
 --cfg "idle g60 click+mouse20|KKCLICK=1,KKMOUSE=20|--min 60 --profile idle --demo --glance 60" \
 --cfg "idle g300 click+mouse20|KKCLICK=1,KKMOUSE=20|--min 60 --profile idle --demo --glance 300" \
 --cfg "typist g60 click|KKCLICK=1|--min 60 --profile typist --demo --glance 60" \
 --cfg "typist g300 none||--min 60 --profile typist --demo --glance 300" \
 --cfg "typist g300 click+mouse20|KKCLICK=1,KKMOUSE=20|--min 60 --profile typist --demo --glance 300" \
 --cfg "typist g300 c+m20 tl.6|KKCLICK=1,KKMOUSE=20,KKTL=0.6|--min 60 --profile typist --demo --glance 300" \
 --cfg "burst g60 click|KKCLICK=1|--min 60 --profile burst --demo --glance 60" \
 --cfg "burst g300 click+mouse20|KKCLICK=1,KKMOUSE=20|--min 60 --profile burst --demo --glance 300" \
 --cfg "idle FULL g300 click+m20|KKCLICK=1,KKMOUSE=20|--min 60 --profile idle --glance 300"
node gate9.js --name demo180 --seeds 1-10 \
 --cfg "typist g60 nudge|KKCLICK=1|--min 180 --profile typist --demo --glance 60 --retire nudge" \
 --cfg "burst g60 nudge|KKCLICK=1|--min 180 --profile burst --demo --glance 60 --retire nudge" \
 --cfg "idle g60 nudge|KKCLICK=1|--min 180 --profile idle --demo --glance 60 --retire nudge" \
 --cfg "idle g300 nudge|KKCLICK=1,KKMOUSE=20|--min 180 --profile idle --demo --glance 300 --retire nudge"
node qm9.js 60 1-10 60 qm,manual > out/qm9_60_g60.txt
node qm9.js 60 1-10 300 qm,manual > out/qm9_60_g300.txt
node qm9.js 120 1-10 300 qm,manual > out/qm9_120_g300.txt
node batch9.js qmlong9.js out/qmlong.jsonl idle,typist 1-6 "qm=--mode qm;manual=--mode manual;qm60=--mode qm --glance 60;manual60=--mode manual --glance 60;qm5=--mode qm5;qm5_60=--mode qm5 --glance 60"
node batch9.js demohint9.js out/demohint.jsonl idle,burst 1-10 "h25g60=--hint 25 --glance 60;h10g60=--hint 10 --glance 60;offg60=--hint off --glance 60;h10n40g60=--hint 10 --no40 --glance 60;h25g300=--hint 25 --glance 300;h10g300=--hint 10 --glance 300;offg300=--hint off --glance 300;h10n40g300=--hint 10 --no40 --glance 300"
node batch9.js sealfarm9.js out/sealfarm.jsonl typist,idle 1-6 "honest=--mode honest;farm=--mode farm;farm_gap=--mode farm --gap 3600 --wait 40;farm_gap2h=--mode farm --gap 7200 --wait 95;stale=--mode stale"
node econ9batch.js out/e40.jsonl typist,idle,burst 40 1-6 "base=;pmold=--pm old;lanoff=--lantern off"
node econ9batch.js out/e40ws.jsonl idle 40 1-6 "smart2=--ws smart2;smart2lanoff=--ws smart2 --lantern off"
node batch9.js week9.js out/week7.jsonl typist,idle,burst 1-6 "g60=--days 7 --glance 60;g300=--days 7 --glance 300;nooff=--days 7 --glance 60 --off 0;random=--days 7 --glance 60 --omen random;offemb=--days 7 --glance 60 --offember 1"
node batch9.js week9.js out/month.jsonl typist,idle,burst 1-4 "g60=--days 35 --glance 60;g300=--days 35 --glance 300"
echo ALLDONE
