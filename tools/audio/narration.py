"""Channel narration assembly: sentence / paragraph silence and loudness normalisation.

All values come from ``kanal/ayarlar.json`` (``narration_*`` keys) — nothing is hard-coded here except safe
fallbacks used only when a key is missing:

    narration_voice, narration_speed, narration_lang,
    narration_sentence_gap_s, narration_paragraph_gap_s,
    narration_lufs, narration_true_peak_db   (true-peak ceiling in dBTP, default -1.0)

The functions are pure (numpy / ffmpeg only), so they can be tested without the Kokoro model.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path
from typing import Callable, Iterable

import numpy as np

ROOT = Path(os.environ.get("KURUL_ROOT") or Path(__file__).resolve().parents[2])

_FALLBACK = {
    "narration_voice": "bm_lewis",
    "narration_speed": 0.9,
    "narration_lang": "en-gb",
    "narration_sentence_gap_s": 0.35,
    "narration_paragraph_gap_s": 0.7,
    "narration_lufs": -14.0,
    "narration_true_peak_db": -1.0,
}


def load_settings(path: Path | None = None) -> dict:
    """Narration settings from kanal/ayarlar.json (missing keys fall back to the channel defaults above)."""
    p = path or ROOT / "kanal" / "ayarlar.json"
    try:
        data = json.loads(Path(p).read_text(encoding="utf-8"))
    except Exception:
        data = {}
    return {k: data.get(k, v) for k, v in _FALLBACK.items()}


def split_paragraphs(text: str) -> list[list[str]]:
    """Paragraphs (separated by a blank line) → sentences (split after . ? !)."""
    out = []
    for para in re.split(r"\n\s*\n", text.strip()):
        para = " ".join(para.split())
        if not para:
            continue
        out.append([s for s in re.split(r"(?<=[.?!])\s+", para) if s])
    return out


def assemble(paragraphs: list[list[str]], synth: Callable[[str], tuple[np.ndarray, int]],
             sentence_gap_s: float, paragraph_gap_s: float) -> tuple[np.ndarray, int]:
    """Synthesise sentence by sentence; sentence_gap_s after each sentence, paragraph_gap_s after the last one of a
    paragraph (no silence after the very last sentence)."""
    parts: list[np.ndarray] = []
    sr = None
    n_par = len(paragraphs)
    for pi, sentences in enumerate(paragraphs):
        for si, sentence in enumerate(sentences):
            audio, sr = synth(sentence)
            parts.append(np.asarray(audio, dtype=np.float32).reshape(-1))
            last_of_par = si == len(sentences) - 1
            if pi == n_par - 1 and last_of_par:
                continue
            parts.append(np.zeros(int(round(sr * (paragraph_gap_s if last_of_par else sentence_gap_s))), dtype=np.float32))
    if not parts:
        return np.zeros(0, dtype=np.float32), sr or 24000
    return np.concatenate(parts), int(sr)


def _measure(path: str, af: str | None = None) -> tuple[float, float]:
    """(integrated LUFS, true peak dBTP) of a file, optionally after an ffmpeg filter chain."""
    chain = (af + "," if af else "") + "ebur128=peak=true"
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", chain, "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", err)
    tp = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", err)
    if not i or not tp:
        raise RuntimeError("ffmpeg ebur128 gave no measurement")
    return float(i[-1]), float(tp[-1])


def normalize_loudness(src: str, dst: str, lufs: float, true_peak_db: float, sample_rate: int = 48000) -> tuple[float, float]:
    """Write ``dst`` (wav) at ``lufs`` integrated loudness with true peak <= ``true_peak_db`` dBTP.

    Gain is iterated; a look-ahead limiter keeps the peak under the ceiling (speech has a high crest factor, so plain
    gain to -14 LUFS would clip). The ceiling is tightened until the *measured* true peak is under the target.
    Returns the final measured (LUFS, dBTP).
    """
    base_i, _ = _measure(src)
    ceiling = true_peak_db - 0.3  # start slightly under the target; limiter is sample-peak based
    best = None
    for _ in range(8):
        gain = lufs - base_i
        limit = 10 ** (ceiling / 20)
        af = ""
        for _ in range(5):
            af = f"volume={gain:.3f}dB,alimiter=limit={limit:.4f}:attack=5:release=60:level=false"
            got_i, got_tp = _measure(src, af)
            if abs(got_i - lufs) <= 0.15:
                break
            gain += lufs - got_i
        best = (af, got_i, got_tp)
        if got_tp <= true_peak_db and abs(got_i - lufs) <= 0.3:
            break
        if got_tp > true_peak_db:
            ceiling -= max(0.3, got_tp - true_peak_db + 0.1)
    af, got_i, got_tp = best
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-af", af + f",aresample={sample_rate}",
                    "-ac", "1", "-c:a", "pcm_s16le" if str(dst).endswith(".wav") else "libmp3lame", dst], check=True)
    return _measure(dst)
