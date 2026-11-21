---
description: Görsel kurulu — onaylı senaryodan sahne planı, ücretsiz NASA görselleri, ekran yazıları ve render paketi
argument-hint: <bölüm kodu>
---
First read `REBEL_MINDS_KURUL.md` in the repository root: it explains the board, the folder layout and the helper tool.

You are the managing editor running the Rebel Minds visual board for episode `$ARGUMENTS` (`<KOD>`). Folder: `bolumler/<KOD>/`. Use the named subagents for creative decisions; keep your messages to Tunç short and in Turkish.

1. **Check.** `bolumler/<KOD>/script.md` must exist. If `karar.json` says `needs_human`, remind Tunç once in one line and continue (he called the command, so he approved).
2. **Director.** Call `yonetmen` with: script path, output `bolumler/<KOD>/sahne_plani.json`. Validate it with `python3 tools/kurul.py plan-kontrol <KOD>`; if invalid, ask the director to fix the file.
3. **Free candidates.** Run `python3 tools/kurul.py adaylar <KOD>` (NASA Image Library, no key, no cost).
   If many scenes got no candidates, call `yonetmen` once more asking it to rewrite only the `nasa_query` of those scene ids in `sahne_plani.json` with simpler real object/mission names, then re-run `adaylar`.
4. **Image selection.** Run `python3 tools/kurul.py gruplar <KOD>`. For EVERY printed group, launch a `gorsel-secici` subagent — all groups IN PARALLEL in one message — giving: the episode folder, the scene ids of that group, and that group's output path.
5. **Download.** Run `python3 tools/kurul.py indir <KOD>`.
6. **Graphic designer.** Call `grafiker` with: `bolumler/<KOD>/sahne_plani.json`, `bolumler/<KOD>/strateji.json`, output `bolumler/<KOD>/grafik.json`.
7. **Package.** Run `python3 tools/kurul.py paketle <KOD>`.
8. **Hand over** (Turkish, max ~8 lines): number of scenes and duration, how many archive images vs. AI-prompt scenes, weak matches, thumbnail headline, and that `production.json` + `assets/` are ready for rendering. End with: "Render bitince videoyu `bolumler/<KOD>/final.mp4` olarak kaydet ve `/son-kontrol <KOD>` çalıştır."
