#!/usr/bin/env python3
"""Rebel Minds: Cosmos — müzik yatağı yardımcıları (yalnızca ffmpeg + standart kütüphane).

Bölüm ve Short render'ı aynı işlevleri kullanır:
  muzik_sec(kod)               → kullanılacak müzik dosyası (bölümün kendi muzik/ klasörü > kanal varsayılanı)
  yatak_yap(src, sure, hedef)  → anlatının altına girecek, süreye göre döngülenmiş + fade'li müzik yatağı
  karistir(anlatim, yatak, h)  → anlatı + yatak tek dosyada (anlatı seviyesi değişmez)

Seviye: yatak, anlatının ölçülen LUFS değerinin `music_db_below_narration` (varsayılan 20 dB) altındadır.
Parça hedef süreden kısaysa, parça kendi sonunu başına eşit-güç çapraz geçişle bağlayarak döngülenir,
böylece dikiş fark edilmez.

CLI:  python3 tools/kurul_audio.py <kod>      hangi müziğin seçileceğini yazdırır
"""
from __future__ import annotations

import json
import math
import os
import re
import subprocess
import sys

ROOT = os.environ.get("KURUL_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UZANTILAR = (".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac")


def ayarlar() -> dict:
    with open(os.path.join(ROOT, "kanal", "ayarlar.json"), encoding="utf-8") as f:
        return json.load(f)


def muzik_sec(kod: str) -> str | None:
    """Önce bolumler/<kod>/muzik/ içindeki ilk ses dosyası (alfabetik), yoksa kanalın varsayılan parçası."""
    d = os.path.join(ROOT, "bolumler", kod, "muzik")
    if os.path.isdir(d):
        dosyalar = sorted(f for f in os.listdir(d) if f.lower().endswith(UZANTILAR))
        if dosyalar:
            return os.path.join(d, dosyalar[0])
    varsayilan = os.path.join(ROOT, ayarlar().get("default_music", "kanal/muzik/long_voyage_to_outer_space.mp3"))
    return varsayilan if os.path.exists(varsayilan) else None


def sure_olc(path: str) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def lufs_olc(path: str) -> tuple[float, float]:
    """(integrated LUFS, true peak dBTP)"""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    tail = r[r.rindex("Integrated loudness"):]
    i = float(re.search(r"I:\s*(-?[\d.]+)\s*LUFS", tail).group(1))
    tp = float(re.search(r"Peak:\s*(-?[\d.]+)\s*dBFS", tail).group(1))
    return i, tp


def dongu_filtresi(parca_s: float, sure_s: float, xfade_s: float) -> tuple[int, float]:
    """Kaç kopya gerekir ve çapraz geçiş süresi (parça çok kısaysa geçiş kısaltılır)."""
    xf = max(0.05, min(xfade_s, parca_s / 3))
    if parca_s >= sure_s:
        return 1, xf
    n = 1 + math.ceil((sure_s - parca_s) / (parca_s - xf))
    return n, xf


def yatak_yap(src: str, sure_s: float, hedef: str, anlatim_lufs: float = -14.0, a: dict | None = None,
              fade_in_s: float | None = None, fade_out_s: float | None = None, baslangic_s: float = 0.0) -> dict:
    """Müzik yatağını `hedef` (wav, 48 kHz stereo) olarak yazar; anlatı LUFS'unun `music_db_below_narration` altına ayarlar."""
    a = a or ayarlar()
    ust = float(a.get("music_db_below_narration", 20))
    fi = float(a.get("music_fade_in_s", 2.0) if fade_in_s is None else fade_in_s)
    fo = float(a.get("music_fade_out_s", 3.0) if fade_out_s is None else fade_out_s)
    xfade = float(a.get("music_loop_xfade_s", 4.0))
    parca = sure_olc(src) - baslangic_s
    n, xf = dongu_filtresi(parca, sure_s, xfade)

    girdiler: list[str] = []
    for _ in range(n):
        girdiler += ["-ss", f"{baslangic_s:.3f}", "-i", src]
    prep = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo"
    parcalar = [f"[{i}:a]{prep}[p{i}]" for i in range(n)]
    zincir, onceki = [], "p0"
    for i in range(1, n):
        cikti = f"x{i}"
        zincir.append(f"[{onceki}][p{i}]acrossfade=d={xf:.3f}:c1=qsin:c2=qsin[{cikti}]")
        onceki = cikti
    fo_basla = max(0.0, sure_s - fo)
    son = (f"[{onceki}]atrim=0:{sure_s:.3f},asetpts=PTS-STARTPTS,"
           f"afade=t=in:st=0:d={fi:.3f}:curve=qsin,afade=t=out:st={fo_basla:.3f}:d={fo:.3f}:curve=qsin[out]")
    fg = ";".join(parcalar + zincir + [son])
    os.makedirs(os.path.dirname(hedef), exist_ok=True)
    nötr = hedef + ".tmp.wav"
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *girdiler, "-filter_complex", fg,
                    "-map", "[out]", "-ar", "48000", "-ac", "2", nötr], check=True)
    olculen, _ = lufs_olc(nötr)
    hedef_lufs = anlatim_lufs - ust
    kazanc = hedef_lufs - olculen
    # kazancı uygularken tepe 0 dBFS'i aşmasın (müzik zaten sessiz; yine de güvenlik)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", nötr, "-af",
                    f"volume={kazanc:.2f}dB,alimiter=limit=0.89:level=0", "-ar", "48000", hedef], check=True)
    os.remove(nötr)
    son_lufs, _ = lufs_olc(hedef)
    return {"file": hedef, "source": src, "copies": n, "loop_xfade_s": round(xf, 2) if n > 1 else 0,
            "fade_in_s": fi, "fade_out_s": fo, "target_lufs": round(hedef_lufs, 1), "measured_lufs": round(son_lufs, 1),
            "db_below_narration": ust}


def karistir(anlatim: str, yatak: str, hedef: str) -> tuple[float, float]:
    """Anlatı + yatak → hedef (wav). Anlatı kazancına dokunulmaz; sonuç (LUFS, true peak) döner."""
    os.makedirs(os.path.dirname(hedef), exist_ok=True)
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", anlatim, "-i", yatak, "-filter_complex",
                    "[0:a]aresample=48000[a0];[1:a]aresample=48000[a1];"
                    "[a0][a1]amix=inputs=2:duration=first:normalize=0:dropout_transition=0,alimiter=limit=0.89:level=0[m]",
                    "-map", "[m]", "-ar", "48000", "-ac", "2", hedef], check=True)
    return lufs_olc(hedef)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    print(muzik_sec(sys.argv[1]) or "MÜZİK YOK")
