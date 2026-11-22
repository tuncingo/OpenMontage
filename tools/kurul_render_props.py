#!/usr/bin/env python3
"""Build Remotion props for the RebelEpisode composition from a board package.

Reads   bolumler/<kod>/production.json  (+ bolumler/<kod>/assets/*)
        projects/<kod>/assets/audio/scenes/scene_XXX.wav   (per-scene narration)
Writes  projects/<kod>/assets/public/            (Remotion --public-dir)
          images/scene_XXX.<ext>                 (copied scene images)
          audio/narration.wav                    (assembled, loudness-normalised only)
        projects/<kod>/render_props.json

Scene length = max(planned duration, narration length + 0.4 s), so speech is never cut.
Narration is only loudness-normalised (mild compression + limiter to reach -14 LUFS; no EQ, no reverb).

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

# Schematic line graphics (remotion-composer/src/components/Schematic.tsx). Full-screen kinds replace
# the photo; "thermal_inset" is drawn over the photo.
GRAPHICS = {
    2: {"kind": "slips", "which": "three"},
    12: {"kind": "phases", "step": 1}, 13: {"kind": "phases", "step": 2}, 14: {"kind": "phases", "step": 3},
    17: {"kind": "thermal"},
    18: {"kind": "thermal_inset"},
    32: {"kind": "slips", "which": "I"}, 33: {"kind": "slips", "which": "III"},
}
# Source lines for graphic scenes (bottom-right). Scene 18 appends to the photo credit.
GRAPHIC_CREDITS = {
    2: "Source: SpacePolicyOnline, Nov 2026",
    12: "Source: NASA Moon Base", 13: "Source: NASA Moon Base", 14: "Source: NASA Moon Base",
    17: "Crater temperature: Planetary Society",
    32: "Sources: Space.com, Aerospace America", 33: "Source: Aerospace America",
}
CREDIT_APPEND = {18: "Pluto: NASA New Horizons, pluto.jhuapl.edu"}
# Photos whose source has black no-data borders: crop to a 16:9 window fully inside the content.
CROP_BLACK = {18}

# Abstract scenes drawn in code (no image model).
PROCEDURAL = {
    # abstract scenes
    16: "crater", 17: "thermal", 22: "radar", 25: "ridge", 43: "ridge", 69: "descent",
    # no honest real image existed: generic code-drawn Moon scenes (labelled "Illustration")
    2: "descent", 14: "ridge", 19: "crater", 21: "descent", 29: "descent", 35: "ridge",
    37: "thermal", 46: "radar", 52: "radar", 53: "ridge", 54: "crater",
}


def crop_inside_content(src: str, dst: str, thresh: int = 14) -> None:
    """Crop to the largest 16:9 window with no black pixels; among equal-size windows keep the most detailed."""
    from PIL import Image

    im = Image.open(src).convert("RGB")
    g = np.asarray(im.convert("L")).astype(np.float32)
    fct = 3
    m = (g > thresh)[::fct, ::fct].astype(np.int32)
    sat = np.pad(m.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    H, W = m.shape

    def full(x, y, w, h):
        return sat[y + h, x + w] - sat[y, x + w] - sat[y + h, x] + sat[y, x] == w * h

    for w in range(W, 150, -4):
        h = int(w * 9 / 16)
        cands = [(x, y) for y in range(0, H - h, 4) for x in range(0, W - w, 4) if full(x, y, w, h)]
        if cands:
            x, y = max(cands, key=lambda c: float(g[c[1] * fct:(c[1] + h) * fct:4, c[0] * fct:(c[0] + w) * fct:4].std()))
            im.crop((x * fct, y * fct, (x + w) * fct, (y + h) * fct)).save(dst, quality=95)
            return
    im.save(dst, quality=95)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("kod")
    ap.add_argument("--max-seconds", type=float, default=None, help="preview: keep only the first N seconds")
    ap.add_argument("--lufs", type=float, default=-14.0)
    ap.add_argument("--tp", type=float, default=-1.5, help="true-peak ceiling for loudnorm (headroom for AAC)")
    ap.add_argument("--scenes", default=None, help="only these scene ids, e.g. 1-4,12-14,17-18 (times re-based back to back)")
    ap.add_argument("--from-seconds", type=float, default=0.0, help="start the clip at this time (clip is re-based to 0)")
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

    if a.scenes:
        want = set()
        for part in a.scenes.split(","):
            lo, _, hi = part.partition("-")
            want.update(range(int(lo), int(hi or lo) + 1))
        timeline = [x for x in timeline if int(x["scene"]["id"]) in want]
        t = 0.0
        for x in timeline:
            x["start"] = t
            t += x["dur"]
        total_full = t
    if a.from_seconds:
        timeline = [x for x in timeline if x["start"] >= a.from_seconds - 1e-6]
        off = timeline[0]["start"]
        for x in timeline:
            x["start"] -= off
        total_full = timeline[-1]["start"] + timeline[-1]["dur"]
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
    # Loudness: speech here is ~-24 LUFS with only ~3 dB of headroom, so plain gain to the target
    # would clip. Mild 2:1 compression + a look-ahead limiter, gain iterated until the
    # measured integrated loudness hits the target and true peak stays under the ceiling.
    def measure(path: str) -> tuple[float, float]:
        r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
        tail = r[r.rindex("Integrated loudness"):]
        i = float(tail.split("I:")[1].split("LUFS")[0])
        tp = float(tail.split("Peak:")[1].split("dBFS")[0])
        return i, tp

    ceil_db = a.tp - 0.4  # sample-peak ceiling; measured true peak lands ~0.4-0.6 dB above it
    ceil_lin = 10 ** (ceil_db / 20)
    gain = a.lufs - measure(raw)[0] - 3.0  # dual-mono stereo reads +3 LU above the mono source
    for _ in range(4):
        chain = (f"aresample=48000,pan=stereo|c0=c0|c1=c0,acompressor=threshold=-26dB:ratio=2:attack=10:release=150,volume={gain:.2f}dB,"
                 f"alimiter=limit={ceil_lin:.4f}:attack=3:release=60:level=0")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", raw, "-af", chain, out_audio], check=True)
        i_meas, tp_meas = measure(out_audio)
        if abs(i_meas - a.lufs) <= 0.15 and tp_meas <= a.tp + 0.4:
            break
        gain += a.lufs - i_meas
    print(f"SES: {i_meas:.1f} LUFS, true peak {tp_meas:.1f} dBTP (hedef {a.lufs} LUFS, tavan {a.tp} dBTP)")

    # 3) scenes + images
    scenes_out = []
    missing = []
    for x in timeline:
        s = x["scene"]
        sid = int(s["id"])
        src = None
        gfx = GRAPHICS.get(sid)
        full_gfx = bool(gfx and gfx["kind"] != "thermal_inset")
        if not full_gfx and s.get("image") and s["image"].get("file"):
            f = os.path.join(ep, s["image"]["file"].split(" (")[0])
            ext = os.path.splitext(f)[1].lower() or ".jpg"
            dst = os.path.join(pub, "images", f"scene_{sid:03d}{ext}")
            if sid in CROP_BLACK:
                crop_inside_content(f, dst)
            else:
                shutil.copy(f, dst)
            src = f"images/scene_{sid:03d}{ext}"
        proc = PROCEDURAL.get(sid) if (not src and not full_gfx) else None
        credit = ""
        if src and s["image"].get("credit"):
            credit = "Image: " + s["image"]["credit"].split(" \u2014 ")[0].strip()
        if sid in GRAPHIC_CREDITS:
            credit = GRAPHIC_CREDITS[sid]
        if sid in CREDIT_APPEND:
            credit = (credit + " \u00b7 " if credit else "") + CREDIT_APPEND[sid]
        if not src and not proc and not full_gfx:
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
            "src": src, "procedural": proc, "purpose": s.get("purpose", ""), "credit": credit, "graphic": gfx, "motion": s.get("motion", ""), "transition": s.get("transition", "cut"),
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
