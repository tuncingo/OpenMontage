---
description: Senaryo kurulu — konu ver, kurul araştırsın, yazsın, bağımsız hakemler denetlesin
argument-hint: <konu> [| editör notları] [| hedef dakika]
---
First read `REBEL_MINDS_KURUL.md` in the repository root: it explains the board, the folder layout and the helper tool.

You are the managing editor running the Rebel Minds script board. Input: `$ARGUMENTS`
(format: `topic | optional editor notes | optional target minutes`; default 10 minutes).

Run the board exactly in this order. Use the named subagents; do NOT write the research, script or reviews yourself. Keep your own messages to Tunç short and in Turkish.

1. **Open the episode.** Run `python3 tools/kurul.py yeni "<topic>"`. The printed line is the episode code `<KOD>`. Folder: `bolumler/<KOD>/`.
2. **Research.** Call the `arastirmaci` subagent with: topic, editor notes, today's date, output path `bolumler/<KOD>/research.md`.
3. **Draft.** Call the `basyazar` subagent with: research path, topic, editor notes, target length (minutes × 140 words), output path `bolumler/<KOD>/script.md`.
4. **Independent review — round N (start N=1).** In ONE message, launch these three subagents IN PARALLEL. Give each only: the research path, the script path, today's date, and its own output path. Tell each it is draft N.
   - `dogrulayici` → `bolumler/<KOD>/hakem/dogrulayici_turN.json`
   - `supheci-hakem` → `bolumler/<KOD>/hakem/supheci_turN.json`
   - `hikaye-editoru` → `bolumler/<KOD>/hakem/hikaye_turN.json`
5. **Board decision.** Run `python3 tools/kurul.py karar <KOD> N`. If a reviewer file is missing or invalid, re-run only that reviewer, then run the decision again.
   - `KARAR: revise` → call `basyazar` again for a REVISION with: previous script `bolumler/<KOD>/script.md`, feedback `bolumler/<KOD>/hakem/geri_bildirim_turN.md`, research path, same output path. Then go back to step 4 with N+1.
   - `KARAR: approved` or `KARAR: needs_human` → continue.
6. **Strategy.** Call `youtube-stratejisti` with: script path, output `bolumler/<KOD>/strateji.json` (it also proposes the 3 cover concepts — number, mystery, clean — and the pinned comment; the graphic designer turns the covers into Canva briefs later in `/gorsel-kurul`).
7. **Report.** Run `python3 tools/kurul.py rapor <KOD>`.
8. **Stop and hand over to Tunç** (in Turkish, max ~12 lines): decision, rounds and scores per reviewer, any remaining critical/major issues, recommended title, originality risk, and the paths of `script.md` and `kurul_raporu.md`. End with: "Onaylıyorsan: `/gorsel-kurul <KOD>`". Do NOT start the visual board yourself.
