#!/usr/bin/env python3
"""Build Remotion props for the RebelEpisode composition from a board package.

Reads   bolumler/<kod>/production.json  (+ bolumler/<kod>/assets/*)
        projects/<kod>/assets/audio/scenes/scene_XXX.wav   (per-scene narration)
Writes  projects/<kod>/assets/public/            (Remotion --public-dir)
          images/scene_XXX.<ext>                 (copied scene images)
          audio/narration.wav                    (assembled, loudness-normalised only)
        projects/<kod>/render_props.json

Scene length = max(planned duration, narration length + 0.4 s), so speech is never cut.
Narration is only loudness-normalised (no EQ, no reverb).

Usage: python tools/kurul_render_props.py <kod> [--max-seconds N] [--lufs -16]
Run with the project .venv (needs numpy + soundfile).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30
TAIL_PAD_S = 0.4
END_PAD_S = 1.5

# Abstract scenes drawn in code (no image model).
PROCEDURAL = {16: "crater", 17: "thermal", 22: "radar", 25: "ridge", 43: "ridge", 69: "descent"}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("kod")
    ap.add_argument("--max-seconds", type=float, default=None, help="preview: keep only the first N seconds")
    ap.add_argument("--lufs", type=float, default=-16.0)
    ap.add_argument("--suffix", default="", help="output name suffix, e.g. _preview")
    a = ap.parse_args()

    ep = os.path.join(ROOT, "bolumler", a.kod)
    pr = os.path.join(ROOT, "projects", a.kod)
    pub = os.path.join(pr, "assets", "public")
    os.makedirs(os.path.join(pub, "images"), exist_ok=True)
    os.makedirs(os.path.join(pub, "audio"), exist_ok=True)

    prod = json.load(open(os.path.join(ep, "production.json"), encoding="utf-8"))
    scenes_in = prod["scenes"]

    # 1) timeline from real narration lengths
    t = 0.0
    timeline = []
    for s in scenes_in:
        wav = os.path.join(pr, "assets", "audio", "scenes", f"scene_{s['id']:03d}.wav")
        if not os.path.exists(wav):
            sys.exit(f"HATA: ses dosyası yok: {wav}")
        info = sf.info(wav)
        a_len = info.frames / info.samplerate
        dur = max(float(s["duration_s"]), a_len + TAIL_PAD_S)
        timeline.append({"scene": s, "start": t, "dur": dur, "wav": wav, "audio_len": a_len})
        t += dur
    total_full = t

    if a.max_seconds:
        timeline = [x for x in timeline if x["start"] < a.max_seconds]
    total = min(total_full, a.max_seconds) if a.max_seconds else total_full + END_PAD_S

    # 2) assemble narration on one track at the source sample rate
    sr = sf.info(timeline[0]["wav"]).samplerate
    buf = np.zeros(int((timeline[-1]["start"] + timeline[-1]["dur"] + 1) * sr), dtype=np.float32)
    for x in timeline:
        data, r = sf.read(x["wav"], dtype="float32")
        if data.ndim > 1:
            data = data.mean(axis=1)
        assert r == sr, "mixed sample rates"
        i0 = int(x["start"] * sr)
        buf[i0 : i0 + len(data)] += data
    raw = os.path.join(pr, "assets", "audio", f"narration_raw{a.suffix}.wav")
    sf.write(raw, buf, sr)
    out_audio = os.path.join(pub, "audio", f"narration{a.suffix}.wav")
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-i", raw, "-af", f"loudnorm=I={a.lufs}:TP=-1.5:LRA=11",
         "-ar", "48000", "-ac", "1", out_audio],
        check=True,
    )

    # 3) scenes + images
    scenes_out = []
    missing = []
    for x in timeline:
        s = x["scene"]
        sid = int(s["id"])
        src = None
        if s.get("image") and s["image"].get("file"):
            f = os.path.join(ep, s["image"]["file"].split(" (")[0])
            ext = os.path.splitext(f)[1].lower() or ".jpg"
            dst = os.path.join(pub, "images", f"scene_{sid:03d}{ext}")
            shutil.copy(f, dst)
            src = f"images/scene_{sid:03d}{ext}"
        proc = PROCEDURAL.get(sid) if not src else None
        if not src and not proc:
            missing.append(sid)
        overlays = []
        for o in s.get("overlays", []):
            o2 = dict(o)
            o2["out_s"] = min(float(o2["out_s"]), x["dur"])
            o2.pop("scene_id", None)
            overlays.append(o2)
        tr = s.get("evidence_tracker")
        scenes_out.append({
            "id": sid, "start_s": round(x["start"], 3), "duration_s": round(x["dur"], 3),
            "src": src, "procedural": proc, "motion": s.get("motion", ""), "transition": s.get("transition", "cut"),
            "overlays": overlays,
            "evidence_tracker": {"count": tr["count"], "label": tr["label"]} if tr else None,
        })

    props = {"fps": FPS, "totalSeconds": round(total, 3), "scenes": scenes_out,
             "narration": f"audio/narration{a.suffix}.wav"}
    out = os.path.join(pr, f"render_props{a.suffix}.json")
    json.dump(props, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    stretched = [x["scene"]["id"] for x in timeline if x["dur"] > float(x["scene"]["duration_s"]) + 0.01]
    print(f"PROPS: {out}")
    print(f"SÜRE: {total:.1f} sn (planlanan {sum(float(s['duration_s']) for s in scenes_in):.1f} sn, "
          f"anlatıya göre uzatılan sahne: {len(stretched)})")
    if missing:
        print(f"UYARI: görseli de prosedürel çizimi de olmayan sahneler: {missing}")


if __name__ == "__main__":
    main()
