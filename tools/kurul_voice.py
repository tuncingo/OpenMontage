#!/usr/bin/env python3
"""Narrate an episode with the channel voice (Kokoro; settings from kanal/ayarlar.json `narration_*`).

Reads   bolumler/<kod>/production.json   (scene narration excerpts)  +  bolumler/<kod>/script.md (paragraph breaks)
Writes  projects/<kod>/assets/audio/scenes/scene_XXX.wav   one clip per scene, raw level (the episode track is
                                                           loudness-normalised later by tools/kurul_render_props.py)
        projects/<kod>/assets/audio/scenes/scene_XXX.json  sentence timings inside the clip (drives the SRT)
        projects/<kod>/assets/audio/scenes/gaps_embedded   marker: the silences below are part of the clips

Silence (all from kanal/ayarlar.json): `narration_sentence_gap_s` between sentences and after a scene that ends a
sentence, `narration_paragraph_gap_s` after a scene that ends a script paragraph, nothing after a scene that ends
in the middle of a sentence. A sentence that is split over several scenes is synthesised in one piece (natural
intonation) and cut at the quietest point near the proportional cut.

Usage: .venv/bin/python tools/kurul_voice.py <kod> [--only 1-5,9]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

import numpy as np
import soundfile as sf

ROOT = os.environ.get("KURUL_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from tools.audio import narration  # noqa: E402

END = ".?!"


def norm(t: str) -> str:
    return " ".join((t or "").split())


def script_paragraphs(path: str) -> list[str]:
    """Spoken paragraphs of the script (no tags, no [EVIDENCE] lines, no sources)."""
    txt = open(path, encoding="utf-8").read()
    m = re.search(r"##\s*Script\s*\n(.*?)(?=\n##\s|\Z)", txt, re.S)
    body = m.group(1) if m else txt
    body = "\n".join(ln for ln in body.splitlines() if not ln.strip().startswith("[EVIDENCE"))
    body = re.sub(r"\s*\[S\d+\]", "", body)
    return [norm(p) for p in re.split(r"\n\s*\n", body) if norm(p)]


def ends_sentence(t: str) -> bool:
    return norm(t).rstrip("\"'”’)")[-1:] in tuple(END)


def synth_sentences(kokoro, text: str, cfg: dict):
    """(audio, sr, [(sentence, start_s, end_s)]) with sentence_gap between sentences."""
    gap = float(cfg["narration_sentence_gap_s"])
    parts, segs, sr, t = [], [], 24000, 0.0
    sentences = [s for sub in narration.split_paragraphs(text) for s in sub]
    for i, s in enumerate(sentences):
        a, sr = kokoro.create(s, voice=cfg["narration_voice"], speed=float(cfg["narration_speed"]), lang=cfg["narration_lang"])
        a = np.asarray(a, dtype=np.float32).reshape(-1)
        segs.append((s, t, t + len(a) / sr))
        parts.append(a)
        t += len(a) / sr
        if i < len(sentences) - 1:
            parts.append(np.zeros(int(round(gap * sr)), dtype=np.float32))
            t += int(round(gap * sr)) / sr
    return np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32), sr, segs


def quiet_cut(audio: np.ndarray, sr: int, at: int, window_s: float = 0.3) -> int:
    """Sample index of the quietest 20 ms frame within ±window_s of `at`."""
    lo, hi = max(0, at - int(window_s * sr)), min(len(audio), at + int(window_s * sr))
    fr = int(0.02 * sr)
    best, best_i = None, at
    for i in range(lo, max(lo + 1, hi - fr), fr // 2):
        e = float(np.mean(audio[i:i + fr] ** 2))
        if best is None or e < best:
            best, best_i = e, i + fr // 2
    return best_i


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("kod")
    ap.add_argument("--only", default=None, help="only these scene ids, e.g. 1-5,9")
    a = ap.parse_args()

    ep = os.path.join(ROOT, "bolumler", a.kod)
    out = os.path.join(ROOT, "projects", a.kod, "assets", "audio", "scenes")
    os.makedirs(out, exist_ok=True)
    cfg = narration.load_settings()
    scenes = json.load(open(os.path.join(ep, "production.json"), encoding="utf-8"))["scenes"]
    texts = [norm(s["narration"]) for s in scenes]
    paras = script_paragraphs(os.path.join(ep, "script.md"))
    starts = [p[:28] for p in paras]

    # boundary after each scene: 'par' (paragraph end), 'sent' (sentence end) or 'mid'
    bound = []
    for i, t in enumerate(texts):
        nxt = texts[i + 1] if i + 1 < len(texts) else None
        if not ends_sentence(t):
            bound.append("mid")
        elif nxt is None or any(nxt.startswith(st) for st in starts):
            bound.append("par")
        else:
            bound.append("sent")

    want = None
    if a.only:
        want = set()
        for part in a.only.split(","):
            lo, _, hi = part.partition("-")
            want.update(range(int(lo), int(hi or lo) + 1))

    # units: runs of scenes joined by 'mid' boundaries are synthesised together
    units, cur = [], []
    for i in range(len(scenes)):
        cur.append(i)
        if bound[i] != "mid" or i == len(scenes) - 1:
            units.append(cur)
            cur = []

    from kokoro_onnx import Kokoro

    kokoro = Kokoro(os.environ.get("KOKORO_MODEL", "/home/user/kokoro-models/kokoro-v1.0.onnx"),
                    os.environ.get("KOKORO_VOICES", "/home/user/kokoro-models/voices-v1.0.bin"))
    gap_s = float(cfg["narration_sentence_gap_s"])
    gap_p = float(cfg["narration_paragraph_gap_s"])
    total = 0.0
    for unit in units:
        ids = [int(scenes[i]["id"]) for i in unit]
        if want is not None and not (set(ids) & want):
            continue
        text = " ".join(texts[i] for i in unit)
        audio, sr, segs = synth_sentences(kokoro, text, cfg)
        # cut a multi-scene unit at the quietest point near the proportional position
        cuts = [0]
        if len(unit) > 1:
            chars = np.cumsum([len(texts[i]) + 1 for i in unit])[:-1]
            for c in chars:
                cuts.append(quiet_cut(audio, sr, int(len(audio) * c / (len(text) + 1))))
        cuts.append(len(audio))
        for k, i in enumerate(unit):
            clip = audio[cuts[k]:cuts[k + 1]]
            tail = {"par": gap_p, "sent": gap_s, "mid": 0.0}[bound[i]]
            speech_s = len(clip) / sr
            clip = np.concatenate([clip, np.zeros(int(round(tail * sr)), dtype=np.float32)])
            sid = int(scenes[i]["id"])
            sf.write(os.path.join(out, f"scene_{sid:03d}.wav"), clip, sr)
            if len(unit) == 1:
                segments = [{"text": s, "start": round(b, 3), "end": round(e, 3)} for s, b, e in segs]
            else:  # a sentence spread over several scenes: one segment per scene, speech part only
                segments = [{"text": texts[i], "start": 0.0, "end": round(speech_s, 3)}]
            json.dump({"id": sid, "boundary": bound[i], "speech_s": round(speech_s, 3), "segments": segments},
                      open(os.path.join(out, f"scene_{sid:03d}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            total += len(clip) / sr
    open(os.path.join(out, "gaps_embedded"), "w").write("sentence/paragraph silence is part of the scene clips\n")
    print(f"SES: {sum(len(u) for u in units)} sahne, {total:.1f} sn · {cfg['narration_voice']} x{cfg['narration_speed']} "
          f"({cfg['narration_lang']}) · cümle {gap_s} sn, paragraf {gap_p} sn")
    pb = sum(1 for b in bound if b == "par")
    mb = sum(1 for b in bound if b == "mid")
    print(f"SINIR: {pb} paragraf sonu, {mb} cümle ortası bölünme (birleştirilerek okundu)")


if __name__ == "__main__":
    main()
