#!/usr/bin/env python3
"""English SRT for an episode from the per-scene sentence timings written by tools/kurul_voice.py.

Each sentence is cut into caption cues of at most two lines of ~42 characters; the sentence's speech time is shared
between its cues in proportion to their length. Timing follows the synthesised speech, so cues are accurate to the
sentence and approximate (a few tenths of a second) inside long sentences.
"""
from __future__ import annotations

import textwrap

MAX_LINE = 42
MAX_LINES = 2


def _ts(t: float) -> str:
    t = max(0.0, t)
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def chunks(text: str) -> list[str]:
    """Split a sentence into cue texts (<= MAX_LINES lines of <= MAX_LINE chars), preferring breaks after commas."""
    words = text.split()
    cues, cur = [], []
    for w in words:
        trial = " ".join(cur + [w])
        if len(textwrap.wrap(trial, MAX_LINE)) > MAX_LINES:
            cues.append(" ".join(cur))
            cur = [w]
        else:
            cur.append(w)
    if cur:
        cues.append(" ".join(cur))
    return cues


def build(items: list[tuple[float, list[dict]]]) -> str:
    """items: [(scene_start_s, [{'text','start','end'} ...]), ...] → SRT text."""
    out, n = [], 1
    for scene_start, segs in items:
        for seg in segs:
            cues = chunks(seg["text"])
            if not cues:
                continue
            total = sum(len(c) for c in cues)
            a = scene_start + float(seg["start"])
            span = float(seg["end"]) - float(seg["start"])
            for c in cues:
                b = a + span * len(c) / total
                lines = "\n".join(textwrap.wrap(c, MAX_LINE))
                out.append(f"{n}\n{_ts(a)} --> {_ts(max(b - 0.02, a + 0.3))}\n{lines}\n")
                a, n = b, n + 1
    return "\n".join(out)
