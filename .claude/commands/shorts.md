---
description: Shorts — bölümden 4-5 dikey Short kes, render et, yayın paketine ekle
argument-hint: <bölüm kodu>
---
First read `REBEL_MINDS_KURUL.md` in the repository root and the **Shorts** section of `kanal/stil_rehberi.md`: they explain the board, the folder layout and the vertical layout rules.

You are the managing editor running the Rebel Minds Shorts for episode `$ARGUMENTS` (`<KOD>`). Folder: `bolumler/<KOD>/`. Use the named subagents for creative decisions; keep your messages to Tunç short and in Turkish.

1. **Check.** `bolumler/<KOD>/script.md`, `sahne_plani.json`, `production.json` and `strateji.json` must exist (they come from `/yeni-bolum` and `/gorsel-kurul`). If one is missing, tell Tunç which command to run first and stop. The per-scene narration audio (`projects/<KOD>/assets/audio/scenes/`) must also exist for rendering; if it does not, still do steps 2-4 and say that rendering is waiting for the audio.
2. **Cut points.** Call `youtube-stratejisti` in **Shorts mode** with: script path, `bolumler/<KOD>/sahne_plani.json`, `bolumler/<KOD>/strateji.json`, output `bolumler/<KOD>/shorts_plani.json`.
3. **Validate.** Run `python3 tools/kurul.py shorts-kontrol <KOD>`. It checks 4-5 Shorts, that each starts at a sentence start and ends at a sentence end, the length, and the hook. On `HATA` lines, call `youtube-stratejisti` again with the exact error lines and ask it to fix only those Shorts in `shorts_plani.json`; re-run the check (max 2 repair rounds, then tell Tunç what is still wrong).
4. **Vertical covers.** Call `grafiker` with: `bolumler/<KOD>/shorts_plani.json`, the task "Shorts covers", output `bolumler/<KOD>/shorts_kapak.json`.
5. **Render.** Run `python3 tools/kurul_shorts.py <KOD>` (use the project `.venv` Python; on Windows `.venv\Scripts\python.exe`). It renders `bolumler/<KOD>/shorts/short_N.mp4` natively at 1080x1920 from the original `assets/` photos and clips (full-frame cover, horizontal pan across each scene's `focus_x`; no 16:9 box, no blurred band) with narration at -14 LUFS, the channel music about 20 dB under it, captions in the safe area (max 2 lines), a big hook in the first 2 seconds and "Full episode on the channel" in the last 2. If it reports a length over 59 seconds, ask `youtube-stratejisti` to shorten that cut and render that Short again with `--only N`.
6. **Publishing package.** Run `python3 tools/kurul.py yayin <KOD>` — `bolumler/<KOD>/yayin_paketi.md` now holds, ready to paste, the episode's 3 cover concepts and for each Short its vertical cover brief, title, description and pinned comment.
7. **Hand over** (Turkish, max ~8 lines): the Shorts (number, scene range, length, hook), where the files are, any validation warnings, and that everything to paste is in `yayin_paketi.md`. Remind that `shorts/` and `*.mp4` are not committed to git.
