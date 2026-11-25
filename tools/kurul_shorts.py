#!/usr/bin/env python3
"""Rebel Minds: Cosmos — dikey Short render'ı (1080x1920).

Girdi : bolumler/<kod>/shorts_plani.json  (youtube-stratejisti)   +  production.json  +  projects/<kod>/assets/audio/scenes/*.wav
Çıktı : bolumler/<kod>/shorts/short_<n>.mp4   (shorts/ .gitignore'da)

Her Short için:
  1. tools/kurul_render_props.py ile ilgili sahne aralığı için props üretilir (anlatı -14 LUFS, müzik ~-20 dB altında,
     başta/sonda yumuşak geçiş — bölümle aynı kurallar, Short için kısa fade)
  2. altyazılar bölümün subtitles_en.srt dosyasından (yoksa sahne metninden) alınır, güvenli alana sığacak şekilde
     en çok 2 satıra bölünür (satır başına ≤ 20 karakter)
  3. Remotion `RebelShort` kompozisyonu render edilir (kurallar: kanal/stil_rehberi.md → "Shorts")

Kullanım: python tools/kurul_shorts.py <kod> [--only N] [--props-only] [--concurrency 2]
Proje .venv'i ile çalıştır (numpy + soundfile gerekir). Chromium yolu gerekirse REMOTION_BROWSER_EXECUTABLE ile verilir.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys

ROOT = os.environ.get("KURUL_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.dirname(os.path.abspath(__file__))
REMOTION = os.path.join(os.path.dirname(TOOLS), "remotion-composer")
MAX_CHARS = 20          # altyazı satırı başına en çok karakter (güvenli alan: 720 px genişlik, 50 px punto)
MAX_LINES = 2
MIN_CUE_S = 0.8
SHORT_FADE_IN, SHORT_FADE_OUT = 0.4, 1.5


def oku(path, varsayilan=None):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        if varsayilan is not None:
            return varsayilan
        sys.exit(f"HATA: dosya yok: {path}")


def srt_oku(path):
    """[(başlangıç sn, bitiş sn, metin)]"""
    try:
        with open(path, encoding="utf-8-sig") as f:
            txt = f.read()
    except FileNotFoundError:
        return []
    cues = []
    for blok in re.split(r"\n\s*\n", txt.replace("\r\n", "\n")):
        m = re.search(r"(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)", blok)
        if not m:
            continue
        g = [int(x) for x in m.groups()]
        t0 = g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000
        t1 = g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000
        satirlar = blok.strip().split("\n")
        i = next(k for k, l in enumerate(satirlar) if "-->" in l)
        metin = " ".join(satirlar[i + 1:]).strip()
        if metin:
            cues.append((t0, t1, metin))
    return cues


def satirlara_bol(kelimeler):
    """Kelimeleri açgözlü biçimde ≤MAX_CHARS'lık satırlara dizer. (satırlar, kalan kelimeler) döner; en çok MAX_LINES satır."""
    satirlar, mevcut, i = [], "", 0
    while i < len(kelimeler):
        k = kelimeler[i]
        aday = (mevcut + " " + k).strip()
        if len(aday) <= MAX_CHARS or not mevcut:
            mevcut = aday
            i += 1
        else:
            satirlar.append(mevcut)
            mevcut = ""
            if len(satirlar) == MAX_LINES:
                break
    if mevcut and len(satirlar) < MAX_LINES:
        satirlar.append(mevcut)
    return satirlar, kelimeler[i:]


def parcala(metin):
    """Metni her biri en çok 2 satırlık parçalara böler (satırlar '\\n' ile)."""
    kelimeler = metin.split()
    parcalar = []
    while kelimeler:
        satirlar, kelimeler = satirlara_bol(kelimeler)
        parcalar.append("\n".join(satirlar))
    return parcalar


def altyazilar(cues, toplam):
    """[(t0, t1, metin)] → parçalanmış, zamanı orantılı dağıtılmış altyazılar (en çok 2 satır)."""
    out = []
    for t0, t1, metin in cues:
        t0, t1 = max(0.0, t0), min(toplam, t1)
        if t1 - t0 < 0.2:
            continue
        pr = parcala(metin)
        agirlik = [max(1, len(p.replace("\n", " "))) for p in pr]
        toplam_a = sum(agirlik)
        t = t0
        for p, a in zip(pr, agirlik):
            d = (t1 - t0) * a / toplam_a
            out.append({"from_s": round(t, 3), "to_s": round(t + d, 3), "text": p})
            t += d
    return out


def sahne_metninden(props, prod):
    metin = {int(s["id"]): s.get("narration", "") for s in prod["scenes"]}
    cues = []
    for s in props["scenes"]:
        t0, t1 = s["start_s"], s["start_s"] + max(0.5, s["duration_s"] - 0.4)
        if metin.get(s["id"]):
            cues.append((t0, t1, metin[s["id"]]))
    return cues


def cmd(kod, n, sh, prod, ar, props_only, concurrency):
    ilk, son = ar
    ek = os.path.join(ROOT, "projects", kod)
    suffix = f"_short{n}"
    r = subprocess.run([sys.executable, os.path.join(TOOLS, "kurul_render_props.py"), kod, "--scenes", f"{ilk}-{son}",
                        "--suffix", suffix, "--music-fade-in", str(SHORT_FADE_IN), "--music-fade-out", str(SHORT_FADE_OUT)],
                       capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"HATA: Short {n} props üretilemedi:\n{r.stdout}\n{r.stderr}")
    props_path = os.path.join(ek, f"render_props{suffix}.json")
    props = oku(props_path)
    toplam = props["totalSeconds"]
    if toplam > 59.5:
        print(f"UYARI: Short {n} {toplam:.1f} sn — 60 sn sınırına çok yakın/aşıyor; kesimi kısalt")

    srt = srt_oku(os.path.join(ROOT, "bolumler", kod, "subtitles_en.srt"))
    kaynak = props.get("sourceStartS", 0.0)
    cues = [(t0 - kaynak, t1 - kaynak, m) for t0, t1, m in srt if t1 > kaynak and t0 < kaynak + toplam]
    kaynak_adi = "subtitles_en.srt"
    if not cues:
        cues, kaynak_adi = sahne_metninden(props, prod), "sahne metni"
    hook = dict(sh.get("hook") or {})
    props.update({"hook": {"text": hook.get("text", ""), **({"sub": hook["sub"]} if hook.get("sub") else {})},
                  "captions": altyazilar(cues, toplam), "endCard": "Full episode on the channel",
                  "hookSeconds": 2, "endSeconds": 2})
    # iki satırdan fazlası olmamalı (parcala bunu garanti eder; yine de doğrula)
    assert all(c["text"].count("\n") < MAX_LINES for c in props["captions"])
    with open(props_path, "w", encoding="utf-8") as f:
        json.dump(props, f, ensure_ascii=False, indent=1)
    print(f"SHORT {n}: sahneler {ilk}-{son}, {toplam:.1f} sn, {len(props['captions'])} altyazı ({kaynak_adi}) → {props_path}")
    if props_only:
        return
    cikti = os.path.join(ROOT, "bolumler", kod, "shorts", f"short_{n}.mp4")
    os.makedirs(os.path.dirname(cikti), exist_ok=True)
    komut = ["npx", "remotion", "render", "src/index.tsx", "RebelShort", cikti, f"--props={props_path}",
             f"--public-dir={os.path.join(ek, 'assets', 'public')}", f"--concurrency={concurrency}", "--codec=h264",
             "--audio-codec=aac", "--crf=18"]
    if os.environ.get("REMOTION_BROWSER_EXECUTABLE"):
        komut.append(f"--browser-executable={os.environ['REMOTION_BROWSER_EXECUTABLE']}")
    subprocess.run(komut, cwd=REMOTION, check=True)
    print(f"RENDER: {os.path.relpath(cikti, ROOT)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("kod")
    ap.add_argument("--only", type=int, default=None, help="yalnızca bu Short")
    ap.add_argument("--props-only", action="store_true", help="render etme, yalnızca props üret")
    ap.add_argument("--concurrency", type=int, default=2)
    a = ap.parse_args()
    ep = os.path.join(ROOT, "bolumler", a.kod)
    sp = oku(os.path.join(ep, "shorts_plani.json"))
    prod = oku(os.path.join(ep, "production.json"))
    for sh in sp.get("shorts", []):
        n = int(sh["n"])
        if a.only and n != a.only:
            continue
        sc = sh["scenes"]
        if isinstance(sc, str):
            lo, _, hi = sc.partition("-")
            ar = (int(lo), int(hi))
        else:
            ar = (int(sc[0]), int(sc[1]))
        cmd(a.kod, n, sh, prod, ar, a.props_only, a.concurrency)


if __name__ == "__main__":
    main()
