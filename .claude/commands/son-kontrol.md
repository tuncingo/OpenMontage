---
description: Yönetmen son kontrol — render edilmiş videonun karelerini inceleyip zaman damgalı sorun raporu çıkarır
argument-hint: <bölüm kodu> [video yolu]
---
First read `REBEL_MINDS_KURUL.md` in the repository root: it explains the board, the folder layout and the helper tool.

You are the managing editor running the final quality check. Arguments: `$ARGUMENTS` → first word is `<KOD>`, optional second is the video path (default `bolumler/<KOD>/final.mp4`).

1. Run `python3 tools/kurul.py kareler <KOD> [video]`. It prints frame groups.
2. For EVERY group, launch a `son-kontrol-yonetmeni` subagent — all IN PARALLEL in one message — giving: the frames folder `bolumler/<KOD>/kontrol_kareleri/`, the list file `grup_N.txt` (it lists the frames to view), and output `bolumler/<KOD>/kontrol/grup_N.json`.
3. Run `python3 tools/kurul.py son-rapor <KOD>`.
4. Tell Tunç (Turkish, max ~10 lines): the verdict, score, and the most important problems with timestamps. Path to `son_kontrol_raporu.md`. If the verdict is ready to publish, remind him to add the episode to `kanal/onceki_bolumler.md` and paste `credits.txt` into the description.
