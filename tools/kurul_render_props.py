#!/usr/bin/env python3
"""Build Remotion props for the RebelEpisode composition from a board package.

Reads   bolumler/<kod>/production.json  (+ bolumler/<kod>/assets/*)
        projects/<kod>/assets/audio/scenes/scene_XXX.wav   (per-scene narration)
Writes  projects/<kod>/assets/public/            (Remotion --public-dir)
          images/scene_XXX.<ext>                 (copied scene images)
          video/scene_XXX.mp4                    (seçilen video klipleri)
          audio/narration.wav                    (assembled, loudness-normalised only)
          audio/mix.wav                          (narration + music bed, music ~20 dB under the narration)
        projects/<kod>/render_props.json

Scene length = max(planned duration, narration length + 0.4 s), so speech is never cut.
Narration is only loudness-normalised (mild compression + limiter to reach -14 LUFS; no EQ, no reverb).

Music: bolumler/<kod>/muzik/ (if present) else kanal/muzik/long_voyage_to_outer_space.mp3, looped with an inaudible
equal-power crossfade when shorter than the episode, with soft fade in/out (see tools/kurul_audio.py, kanal/ayarlar.json).

Usage: python tools/kurul_render_props.py <kod> [--max-seconds N] [--lufs -14] [--no-music]
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

ROOT = os.environ.get("KURUL_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kurul_audio  # noqa: E402

FPS = 30
TAIL_PAD_S = 0.4
END_PAD_S = 0.0  # no trailing black frames

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
CREDIT_APPEND = {18: "enhanced color \u00b7 Pluto: NASA New Horizons, pluto.jhuapl.edu"}
# Photos whose source has black no-data borders: crop to a 16:9 window fully inside the content.
CROP_BLACK: set[int] = set()  # (scene 18 used a Pluto mosaic strip before; it now uses a full-disc image)
# Photos shown whole, centred on the dark ground, instead of cropped to fill the frame.
FIT_CONTAIN = {18}

# Transition into these scenes is forced to a hard cut (a crossfade of two bright photos reads as a glitch).
TRANSITION_OVERRIDES = {56: "cut"}
# Extra darkening over the scene (end card).
DIM = {68: 0.6}

# Abstract scenes drawn in code (no image model).
PROCEDURAL = {
    # abstract scenes
    22: "radar", 25: "ridge",
    # no honest real image existed: generic code-drawn Moon scenes (labelled "Illustration")
    19: "crater", 35: "ridge", 37: "thermal", 53: "ridge",
}


def media_size(path: str) -> tuple[int, int] | None:
    """(width, height) of a photo or clip via ffprobe."""
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                            "-of", "csv=p=0:s=x", path], capture_output=True, text=True, check=True)
        w, h = r.stdout.strip().split("x")[:2]
        return int(w), int(h)
    except Exception:
        return None


def pick_backdrop(all_scenes: list, sid: int) -> dict | None:
    """For schematic / code-drawn scenes: the nearest cutaway (else any) scene of the episode that has a photo or clip.
    The Short renders it full-screen, darkened and slowly moving behind the graphic, so no frame is flat black."""
    cands = []
    for s in all_scenes:
        if int(s["id"]) == sid or int(s["id"]) in GRAPHICS or int(s["id"]) in PROCEDURAL:
            continue
        g = s.get("video") or s.get("image")
        if g and g.get("file"):
            cands.append((0 if s.get("purpose") == "cutaway" else 1, abs(int(s["id"]) - sid), s))
    if not cands:
        return None
    return min(cands, key=lambda c: (c[0], c[1]))[2]


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
    ap.add_argument("--narration-file", default=None,
                    help="use the audio of this file (e.g. the episode's final.mp4) as narration instead of the per-scene wavs; "
                         "the cut is taken from --narration-from (default: where the cut starts in the episode timeline)")
    ap.add_argument("--narration-from", type=float, default=None, help="seconds into --narration-file where the cut starts")
    ap.add_argument("--no-backdrop", action="store_true", help="no darkened photo/clip behind schematic scenes")
    ap.add_argument("--no-music", action="store_true", help="narration only")
    ap.add_argument("--music-fade-in", type=float, default=None, help="seconds (default: kanal/ayarlar.json)")
    ap.add_argument("--music-fade-out", type=float, default=None, help="seconds (default: kanal/ayarlar.json)")
    a = ap.parse_args()

    ep = os.path.join(ROOT, "bolumler", a.kod)
    pr = os.path.join(ROOT, "projects", a.kod)
    pub = os.path.join(pr, "assets", "public")
    os.makedirs(os.path.join(pub, "images"), exist_ok=True)
    os.makedirs(os.path.join(pub, "audio"), exist_ok=True)
    os.makedirs(os.path.join(pub, "video"), exist_ok=True)

    prod = json.load(open(os.path.join(ep, "production.json"), encoding="utf-8"))
    scenes_in = prod["scenes"]

    # 1) timeline from real narration lengths
    t = 0.0
    timeline = []
    for s in scenes_in:
        wav = os.path.join(pr, "assets", "audio", "scenes", f"scene_{s['id']:03d}.wav")
        if a.narration_file:
            a_len, dur = 0.0, float(s["duration_s"])  # timeline = planned durations; speech comes from the file
        else:
            if not os.path.exists(wav):
                sys.exit(f"HATA: ses dosyası yok: {wav}")
            info = sf.info(wav)
            a_len = info.frames / info.samplerate
            dur = max(float(s["duration_s"]), a_len + TAIL_PAD_S)
        timeline.append({"scene": s, "start": t, "dur": dur, "wav": wav, "audio_len": a_len})
        t += dur
    total_full = t

    source_start = 0.0
    if a.scenes:
        want = set()
        for part in a.scenes.split(","):
            lo, _, hi = part.partition("-")
            want.update(range(int(lo), int(hi or lo) + 1))
        timeline = [x for x in timeline if int(x["scene"]["id"]) in want]
        source_start = timeline[0]["start"]  # where this cut begins in the full episode timeline
        t = 0.0
        for x in timeline:
            x["start"] = t
            t += x["dur"]
        total_full = t
    if a.from_seconds:
        timeline = [x for x in timeline if x["start"] >= a.from_seconds - 1e-6]
        off = timeline[0]["start"]
        source_start += off
        for x in timeline:
            x["start"] -= off
        total_full = timeline[-1]["start"] + timeline[-1]["dur"]
    if a.max_seconds:
        timeline = [x for x in timeline if x["start"] < a.max_seconds]
    total = min(total_full, a.max_seconds) if a.max_seconds else total_full + END_PAD_S

    # 2) assemble narration on one track at the source sample rate
    raw = os.path.join(pr, "assets", "audio", f"narration_raw{a.suffix}.wav")
    os.makedirs(os.path.dirname(raw), exist_ok=True)
    if a.narration_file:
        t_from = a.narration_from if a.narration_from is not None else source_start
        length = timeline[-1]["start"] + timeline[-1]["dur"]
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t_from:.3f}", "-t", f"{length:.3f}",
                        "-i", a.narration_file, "-vn", "-ac", "1", "-ar", "48000", "-c:a", "pcm_f32le", raw], check=True)
        print(f"ANLATI: {os.path.relpath(a.narration_file, ROOT) if a.narration_file.startswith(ROOT) else a.narration_file} "
              f"{t_from:.1f}–{t_from + length:.1f} sn")
    else:
        sr = sf.info(timeline[0]["wav"]).samplerate
        buf = np.zeros(int((timeline[-1]["start"] + timeline[-1]["dur"] + 1) * sr), dtype=np.float32)
        for x in timeline:
            data, r = sf.read(x["wav"], dtype="float32")
            if data.ndim > 1:
                data = data.mean(axis=1)
            assert r == sr, "mixed sample rates"
            i0 = int(x["start"] * sr)
            buf[i0 : i0 + len(data)] += data
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

    # 2b) music bed under the narration (~20 dB below it), looped invisibly, soft fade in/out
    audio_rel = f"audio/narration{a.suffix}.wav"
    music_info = None
    muzik = None if a.no_music else kurul_audio.muzik_sec(a.kod)
    if muzik:
        sure_ses = min(total, sf.info(out_audio).frames / sf.info(out_audio).samplerate)  # fade-out ends with the video
        yatak = os.path.join(pr, "assets", "audio", f"music_bed{a.suffix}.wav")
        music_info = kurul_audio.yatak_yap(muzik, sure_ses, yatak, anlatim_lufs=i_meas,
                                           fade_in_s=a.music_fade_in, fade_out_s=a.music_fade_out)
        mix = os.path.join(pub, "audio", f"mix{a.suffix}.wav")
        mi, mtp = kurul_audio.karistir(out_audio, yatak, mix)
        audio_rel = f"audio/mix{a.suffix}.wav"
        music_info.pop("source", None)
        music_info.update({"file": os.path.relpath(muzik, ROOT), "mix_lufs": round(mi, 1), "mix_true_peak": round(mtp, 1)})
        print(f"MÜZİK: {os.path.relpath(muzik, ROOT)} · yatak {music_info['measured_lufs']} LUFS "
              f"(anlatının {music_info['db_below_narration']:.0f} dB altı) · {music_info['copies']} kopya · karışım {mi:.1f} LUFS, {mtp:.1f} dBTP")
    elif not a.no_music:
        print("UYARI: müzik bulunamadı (kanal/muzik/ boş) — yalnızca anlatı")

    # 3) scenes + images
    scenes_out = []
    missing = []
    for x in timeline:
        s = x["scene"]
        sid = int(s["id"])
        src = None
        video = None
        size = None
        focus = 0.5
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
            size = media_size(dst)
            focus = float(s["image"].get("focus_x", 0.5))
        v = s.get("video")
        if not full_gfx and v and v.get("file"):
            f = os.path.join(ep, v["file"].split(" (")[0])
            dst = os.path.join(pub, "video", f"scene_{sid:03d}.mp4")
            shutil.copy(f, dst)
            clip = v.get("clip_s") or kurul_audio.sure_olc(f)
            video = {"src": f"video/scene_{sid:03d}.mp4", "clip_s": round(float(clip), 3)}
            size = media_size(dst)
            focus = float(v.get("focus_x", 0.5))
        proc = PROCEDURAL.get(sid) if (not src and not video and not full_gfx) else None
        credit = ""
        if src and s["image"].get("credit"):
            credit = "Image: " + s["image"]["credit"].split(" \u2014 ")[0].strip()
        elif video and v.get("credit"):
            credit = "Video: " + v["credit"].split(" \u2014 ")[0].strip()
        if sid in GRAPHIC_CREDITS:
            credit = GRAPHIC_CREDITS[sid]
        if sid in CREDIT_APPEND:
            credit = (credit + " \u00b7 " if credit else "") + CREDIT_APPEND[sid]
        if not src and not video and not proc and not full_gfx:
            missing.append(sid)
        overlays = []
        for o in s.get("overlays", []):
            o2 = dict(o)
            o2["out_s"] = min(float(o2["out_s"]), x["dur"])
            o2.pop("scene_id", None)
            overlays.append(o2)
        tr = s.get("evidence_tracker")
        backdrop = None
        if (full_gfx or proc) and not a.no_backdrop:
            b = pick_backdrop(scenes_in, sid)
            if b:
                bid = int(b["id"])
                bv, bi = b.get("video"), b.get("image")
                if bv and bv.get("file"):
                    f = os.path.join(ep, bv["file"].split(" (")[0])
                    dstb = os.path.join(pub, "video", f"scene_{bid:03d}.mp4")
                    shutil.copy(f, dstb)
                    clipb = bv.get("clip_s") or kurul_audio.sure_olc(f)
                    sz = media_size(dstb)
                    backdrop = {"video": {"src": f"video/scene_{bid:03d}.mp4", "clip_s": round(float(clipb), 3)},
                                "src": None, "w": sz[0] if sz else None, "h": sz[1] if sz else None,
                                "focus_x": float(bv.get("focus_x", 0.5))}
                else:
                    f = os.path.join(ep, bi["file"].split(" (")[0])
                    extb = os.path.splitext(f)[1].lower() or ".jpg"
                    dstb = os.path.join(pub, "images", f"scene_{bid:03d}{extb}")
                    shutil.copy(f, dstb)
                    sz = media_size(dstb)
                    backdrop = {"src": f"images/scene_{bid:03d}{extb}", "video": None, "w": sz[0] if sz else None,
                                "h": sz[1] if sz else None, "focus_x": float(bi.get("focus_x", 0.5))}
        scenes_out.append({
            "id": sid, "start_s": round(x["start"], 3), "duration_s": round(x["dur"], 3),
            "src": src, "video": video, "procedural": proc,
            "w": size[0] if size else None, "h": size[1] if size else None, "focus_x": round(focus, 3), "backdrop": backdrop, "purpose": s.get("purpose", ""), "credit": credit, "graphic": gfx, "fit": "contain" if sid in FIT_CONTAIN else "cover", "dim": DIM.get(sid, 0), "motion": s.get("motion", ""), "transition": TRANSITION_OVERRIDES.get(sid, s.get("transition", "cut")),
            "overlays": overlays,
            "evidence_tracker": {"count": tr["count"], "label": tr["label"]} if tr else None,
        })

    props = {"fps": FPS, "totalSeconds": round(total, 3), "scenes": scenes_out,
             "narration": audio_rel, "music": music_info, "sourceStartS": round(source_start, 3)}
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
