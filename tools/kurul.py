#!/usr/bin/env python3
"""Rebel Minds: Cosmos — yayın kurulu yardımcı aracı (sadece Python standart kütüphanesi).

Kurul üyeleri (Claude Code alt ajanları) yaratıcı işi yapar; bu araç da tekrarlanabilir
"tesisat" işlerini üstlenir: puanlama, karar, NASA araması/indirme, paketleme, kare çıkarma.

  python3 tools/kurul.py yeni "<konu>"            bölüm klasörünü oluşturur, kodu yazar
  python3 tools/kurul.py karar <kod> <tur>        hakem JSON'larından kurul kararını verir
  python3 tools/kurul.py rapor <kod>              kurul_raporu.md üretir
  python3 tools/kurul.py adaylar <kod>            her sahne için ücretsiz NASA aday görsellerini/videolarını (+ SVS animasyonları) indirir
  python3 tools/kurul.py plan-kontrol <kod>       Yönetmen'in sahne planını doğrular (photo/video dağılımı dahil)
  python3 tools/kurul.py gruplar <kod>            görsel seçici için sahne gruplarını listeler
  python3 tools/kurul.py indir <kod>              seçilen fotoğrafların büyük sürümünü, videoların ise kesilmiş klibini assets/ içine indirir
  python3 tools/kurul.py paketle <kod>            production.json + gorsel_raporu.md + credits.txt
  python3 tools/kurul.py kareler <kod> [video]    videodan kontrol kareleri çıkarır, grupları listeler
  python3 tools/kurul.py son-rapor <kod>          son_kontrol_raporu.md üretir
  python3 tools/kurul.py muzik <kod>              bölüm için seçilecek müzik dosyasını yazdırır
  python3 tools/kurul.py shorts-kontrol <kod>     shorts_plani.json kesimlerini doğrular (cümle sonu, süre, kanca)
  python3 tools/kurul.py yayin <kod>              bolumler/<kod>/yayin_paketi.md (yapıştırmaya hazır) üretir
"""
import json, os, re, sys, shutil, subprocess, datetime, urllib.request, urllib.parse, glob
from concurrent.futures import ThreadPoolExecutor

# Windows konsolu Türkçe karakter/emoji basarken çökmesin
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = os.environ.get("KURUL_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NASA = os.environ.get("NASA_API", "https://images-api.nasa.gov")
SVS = os.environ.get("SVS_API", "https://svs.gsfc.nasa.gov")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "RebelMindsCosmos-Kurul/1.0"}


# ------------------------------------------------------------------ yardımcılar
def ayarlar():
    with open(os.path.join(ROOT, "kanal", "ayarlar.json"), encoding="utf-8") as f:
        return json.load(f)


def bolum(kod):
    d = os.path.join(ROOT, "bolumler", kod)
    if not os.path.isdir(d):
        sys.exit(f"HATA: bölüm klasörü yok: {d}")
    return d


def oku_json(path, varsayilan=None):
    try:
        with open(path, encoding="utf-8") as f:
            txt = f.read().strip()
    except FileNotFoundError:
        if varsayilan is not None:
            return varsayilan
        sys.exit(f"HATA: dosya yok: {path}")
    txt = re.sub(r"^```(?:json)?\s*|\s*```$", "", txt)
    try:
        return json.loads(txt)
    except json.JSONDecodeError:
        s, e = txt.find("{"), txt.rfind("}")
        if s >= 0 and e > s:
            return json.loads(txt[s:e + 1])
        raise


def yaz(path, icerik):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        if isinstance(icerik, str):
            f.write(icerik)
        else:
            json.dump(icerik, f, ensure_ascii=False, indent=2)


def slugify(s):
    tr = str.maketrans("çÇğĞıİöÖşŞüÜ", "cCgGiIoOsSuU")
    s = s.translate(tr).lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:50]


def mmss(sec):
    sec = int(round(sec))
    return f"{sec // 60:02d}:{sec % 60:02d}"


def guvenli_url(url):
    """NASA dosya adlarında boşluk olabiliyor; yolu kodla, http'yi https yap."""
    p = urllib.parse.urlsplit(url)
    scheme = "https" if p.netloc.endswith("nasa.gov") else p.scheme
    return urllib.parse.urlunsplit((scheme, p.netloc, urllib.parse.quote(urllib.parse.unquote(p.path)), p.query, p.fragment))


def http_json(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def http_indir(url, hedef, timeout=120):
    req = urllib.request.Request(guvenli_url(url), headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        if r.status != 200:
            raise IOError(f"HTTP {r.status}")
        data = r.read()
    if len(data) < 500:
        raise IOError("dosya çok küçük")
    os.makedirs(os.path.dirname(hedef), exist_ok=True)
    with open(hedef, "wb") as f:
        f.write(data)


# ------------------------------------------------------------------ senaryo kurulu
def cmd_yeni(konu):
    kod = f"{datetime.date.today().isoformat()}-{slugify(konu)}"
    d = os.path.join(ROOT, "bolumler", kod)
    for alt in ("hakem", "secimler", "kontrol"):
        os.makedirs(os.path.join(d, alt), exist_ok=True)
    yaz(os.path.join(d, "konu.json"), {"topic": konu, "created": datetime.datetime.now().isoformat(timespec="minutes")})
    print(kod)


ROLLER = [("dogrulayici", "Doğrulayıcı"), ("supheci", "Şüpheci Hakem"), ("hikaye", "Hikâye Editörü")]


def cmd_karar(kod, tur):
    tur = int(tur)
    d = bolum(kod)
    a = ayarlar()
    incelemeler = []
    for rol, ad in ROLLER:
        p = os.path.join(d, "hakem", f"{rol}_tur{tur}.json")
        try:
            j = oku_json(p)
        except SystemExit:
            sys.exit(f"HATA: {ad} incelemesi eksik: {p}")
        except Exception as e:
            j = {"score": 0, "summary": f"JSON okunamadı: {e}", "issues": []}
        j["score"] = float(j.get("score") or 0)
        j["issues"] = j.get("issues") or []
        incelemeler.append({"role": rol, "name": ad, **j})

    puanlar = [r["score"] for r in incelemeler]
    ort = round(sum(puanlar) / len(puanlar), 2)
    en_dusuk = min(puanlar)
    kritik = sum(1 for r in incelemeler for i in r["issues"] if i.get("severity") == "critical")
    gecti = ort >= a["pass_avg"] and en_dusuk >= a["pass_min"] and kritik == 0
    if gecti:
        karar = "approved"
    elif tur < a["max_rounds"]:
        karar = "revise"
    else:
        karar = "needs_human"

    # taslağı arşivle
    s = os.path.join(d, "script.md")
    if os.path.exists(s):
        shutil.copy(s, os.path.join(d, f"script_tur{tur}.md"))

    gb = []
    for r in incelemeler:
        gb.append(f"### {r['name']} — {r['score']}/10\n{r.get('summary', '')}")
        for i in r["issues"]:
            gb.append(f"- [{i.get('severity')}] \"{i.get('quote', '')}\" → {i.get('problem', '')} | FIX: {i.get('fix', '')}")
        gb.append("")
    yaz(os.path.join(d, "hakem", f"geri_bildirim_tur{tur}.md"), "\n".join(gb))

    k = oku_json(os.path.join(d, "karar.json"), {"history": []})
    k["history"] = [h for h in k["history"] if h["round"] != tur]
    k["history"].append({"round": tur, "avg": ort, "min": en_dusuk, "critical": kritik, "decision": karar,
                         "reviews": incelemeler})
    k.update({"round": tur, "decision": karar, "avg": ort})
    yaz(os.path.join(d, "karar.json"), k)
    print(f"KARAR: {karar}  (tur {tur}, ortalama {ort}, en düşük {en_dusuk}, kritik {kritik})")
    if karar == "revise":
        print(f"GERİ BİLDİRİM: bolumler/{kod}/hakem/geri_bildirim_tur{tur}.md")


def cmd_rapor(kod):
    d = bolum(kod)
    k = oku_json(os.path.join(d, "karar.json"))
    konu = oku_json(os.path.join(d, "konu.json"), {}).get("topic", kod)
    st = oku_json(os.path.join(d, "strateji.json"), {})
    a = ayarlar()
    durum = {"approved": "✅ ONAYLANDI — kurul yayına hazır buldu",
             "needs_human": f"⚠️ SENİN KARARIN GEREKİYOR — {a['max_rounds']} turda eşik aşılamadı",
             "revise": "🔄 Revizyon sürüyor"}[k["decision"]]
    son = k["history"][-1]
    md = [f"# Kurul Raporu — {konu}", "", f"**Durum:** {durum}", f"**Bölüm kodu:** `{kod}`",
          f"**Taslak turu:** {k['round']} · **Son ortalama:** {k['avg']}/10", "",
          "## Tur geçmişi", "| Tur | Ortalama | En düşük | Kritik sorun | Karar |", "|---|---|---|---|---|"]
    md += [f"| {h['round']} | {h['avg']} | {h['min']} | {h['critical']} | {h['decision']} |" for h in k["history"]]
    md += ["", "## Son tur hakem notları"]
    for r in son["reviews"]:
        md.append(f"### {r['name']} — {r['score']}/10")
        md.append(r.get("summary", ""))
        c = r.get("claims")
        if c:
            md.append(f"\nİddialar: {c.get('verified')} doğrulandı · {c.get('disputed')} tartışmalı · {c.get('unsupported')} kaynaksız")
        if r["issues"]:
            for i in r["issues"]:
                md.append(f"- **{i.get('severity')}** — \"{i.get('quote', '')}\"\n  - Sorun: {i.get('problem', '')}\n  - Öneri: {i.get('fix', '')}")
        else:
            md.append("\nSorun yok.")
        md.append("")
    if st:
        o = st.get("originality", {})
        md += ["## Stratejist", f"**Önerilen başlık:** {st.get('recommended_title')}", "", "**Alternatifler:**"]
        md += [f"- {t}" for t in st.get("titles", [])]
        th = st.get("thumbnail", {})
        md += ["", f"**Thumbnail:** \"{th.get('headline')}\" — {th.get('concept')}", "",
               f"**Özgünlük:** {o.get('score')}/10 · risk: **{o.get('risk')}**", o.get("notes", ""), ""]
        if o.get("similar_to"):
            md.append("Benzediği: " + ", ".join(o["similar_to"]))
        md += ["", f"**Yayın notları:** {st.get('posting_notes', '')}", "", "### Açıklama", "",
               st.get("description", ""), "", "**Etiketler:** " + ", ".join(st.get("tags", []))]
    yaz(os.path.join(d, "kurul_raporu.md"), "\n".join(md) + "\n")
    print(f"RAPOR: bolumler/{kod}/kurul_raporu.md")


# ------------------------------------------------------------------ görsel kurulu
def nasa_ara(sorgu, n, medya="image"):
    """NASA Image Library araması. medya: "image" ya da "video" (video için links = önizleme kareleri)."""
    q = urllib.parse.urlencode({"q": sorgu, "media_type": medya, "page_size": 25})
    try:
        j = http_json(f"{NASA}/search?{q}")
    except Exception as e:
        return [], str(e)
    sonuc = []
    for it in j.get("collection", {}).get("items", []):
        links = [l["href"] for l in it.get("links", []) if l.get("render") == "image" and l.get("href")]
        meta = (it.get("data") or [{}])[0]
        if not links or not meta.get("nasa_id") or meta.get("media_type", medya) != medya:
            continue
        sonuc.append({"nasa_id": meta["nasa_id"], "title": meta.get("title", ""),
                      "center": meta.get("center", "NASA"), "date": (meta.get("date_created") or "")[:10],
                      "description": re.sub(r"\s+", " ", meta.get("description", ""))[:300],
                      "links": links, "media": "video" if medya == "video" else "photo",
                      "source": "nasa-video" if medya == "video" else "nasa"})
        if len(sonuc) >= n:
            break
    return sonuc, None


def sure_cozumle(v):
    """'0:01:20' / '12.5 s' / 80.5 → saniye."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    m = re.match(r"^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$", str(v).strip())
    if m:
        return int(m.group(1) or 0) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    m = re.match(r"^([\d.]+)\s*s", str(v).strip())
    return float(m.group(1)) if m else None


def ffprobe_url(url, timeout=60):
    """(süre sn, genişlik, yükseklik) — ffprobe HTTP üzerinden; olmazsa (None, None, None)."""
    if not shutil.which("ffprobe"):
        return None, None, None
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                            "format=duration:stream=width,height", "-of", "json", guvenli_url(url)],
                           capture_output=True, text=True, timeout=timeout)
        j = json.loads(r.stdout or "{}")
        st = (j.get("streams") or [{}])[0]
        return (float(j["format"]["duration"]) if j.get("format", {}).get("duration") else None,
                st.get("width"), st.get("height"))
    except Exception:
        return None, None, None


MP4_SIRA = ("~large.mp4", "~medium.mp4", "~mobile.mp4", "~small.mp4", "~preview.mp4", "~orig.mp4")


def nasa_video_bilgi(c):
    """Klibin süre/çözünürlük bilgisini ve indirme sırasını (mp4 listesi) ekler. Başarısızsa False."""
    try:
        j = http_json(f"{NASA}/asset/{urllib.parse.quote(c['nasa_id'])}")
    except Exception:
        return False
    hrefs = [i["href"] for i in j.get("collection", {}).get("items", [])]
    mp4 = []
    for son in MP4_SIRA:
        mp4 += [h for h in hrefs if h.lower().endswith(son)]
    mp4 += [h for h in hrefs if h.lower().endswith(".mp4") and h not in mp4]
    if not mp4:
        return False
    c["mp4"] = mp4
    sure = w = h = None
    meta = next((x for x in hrefs if x.lower().endswith("metadata.json")), None)
    if meta:
        try:
            md = http_json(guvenli_url(meta), timeout=30)
            x = md.get("XMP:Duration")
            sure = (float(x["Value"]) * float(x["Scale"]) if isinstance(x, dict) and "Value" in x else None) \
                or sure_cozumle(md.get("QuickTime:Duration")) or sure_cozumle(md.get("QuickTime:MediaDuration"))
            w = md.get("QuickTime:ImageWidth") or md.get("QuickTime:SourceImageWidth") or md.get("File:ImageWidth")
            h = md.get("QuickTime:ImageHeight") or md.get("QuickTime:SourceImageHeight") or md.get("File:ImageHeight")
        except Exception:
            pass
    if not sure or not w:
        d2, w2, h2 = ffprobe_url(next((m for m in mp4 if "~preview" in m or "~small" in m), mp4[0]))
        sure, w, h = sure or d2, w or w2, h or h2
    if not sure:
        return False
    c.update({"duration_s": round(float(sure), 1), "width": w, "height": h})
    return True


def nasa_video_ara(sorgu, n, min_s):
    bulunan, hata = nasa_ara(sorgu, n * 3, "video")
    sonuc = []
    for c in bulunan:
        if nasa_video_bilgi(c) and c["duration_s"] >= min_s:
            sonuc.append(c)
        if len(sonuc) >= n:
            break
    return sonuc, hata


def https(u):
    return re.sub(r"^http://", "https://", u or "")


def svs_video(d):
    """SVS kaydının KENDİ mp4'ünü döndürür. API bazı kayıtlarda main_video olarak başka bir sayfanın ortak klibini
    (örn. 4559_Kepler_Neptune_Twitter_720.mp4) verir; bu yüzden URL, kaydın kendi dizininde (/aNNNNNN/) değilse reddedilir.
    main_video geçersizse media_groups içindeki geçerli mp4'lerin en büyüğü seçilir; yoksa None (kayıt atlanır)."""
    kayit = d.get("id")
    parca = f"/a{int(kayit):06d}/" if str(kayit).isdigit() else None

    def gecerli(v):
        u = str((v or {}).get("url", ""))
        return u.lower().endswith(".mp4") and (parca is None or parca in u)

    mv = d.get("main_video") or {}
    if gecerli(mv):
        return mv
    adaylar = []
    for g in d.get("media_groups") or []:
        for it in g.get("items") or []:
            inst = it.get("instance") or {}
            if gecerli(inst):
                adaylar.append(inst)
    return max(adaylar, key=lambda v: v.get("pixels") or 0) if adaylar else None


def svs_ara(sorgu, n, min_s):
    """NASA Scientific Visualization Studio animasyonları (svs.gsfc.nasa.gov/api) — her sonuç için ana video + ana görsel."""
    try:
        j = http_json(f"{SVS}/api/search/?{urllib.parse.urlencode({'search': sorgu, 'limit': 8})}")
    except Exception as e:
        return [], str(e)
    sonuc = []
    for r in j.get("results", [])[:8]:
        if len(sonuc) >= n:
            break
        try:
            d = http_json(f"{SVS}/api/{r['id']}/")
        except Exception:
            continue
        mv = svs_video(d)
        if not mv:
            continue
        sure, w, h = ffprobe_url(https(mv["url"]))
        if not sure or sure < min_s:
            continue
        mi = d.get("main_image") or {}
        sonuc.append({"nasa_id": f"SVS-{d['id']}", "title": d.get("title", ""), "center": "NASA SVS",
                      "date": (d.get("release_date") or "")[:10],
                      "description": re.sub(r"\s+", " ", d.get("description", ""))[:300],
                      "links": [https(mi["url"])] if mi.get("url") else [],
                      "media": "video", "source": "svs", "video_url": https(mv["url"]),
                      "duration_s": round(sure, 1), "width": w or mv.get("width"), "height": h or mv.get("height"),
                      "credit_line": "NASA's Scientific Visualization Studio", "page": https(d.get("url", ""))})
    return sonuc, None


def surumler(links, sira):
    """Bilinen sürüm adlarını (~medium, ~large…) tercih sırasına göre döndürür; yoksa thumb'dan türetir."""
    out = []
    for son in sira:
        out += [h for h in links if re.search(re.escape(son) + r"\.(jpe?g|png)$", h, re.I)]
    for h in links:
        m = re.search(r"~(thumb|small|medium|large)\.(jpe?g|png)$", h, re.I)
        if m:
            out += [h[:m.start()] + son + "." + m.group(2) for son in sira]
    return list(dict.fromkeys(out))


def onizleme_indir(c, hedef):
    """Seçicinin görebileceği önizleme. Foto: ~medium → ~small → ~thumb. Video: klibin kareleri (~large → ~medium…);
    SVS'te ana görsel; hiçbiri yoksa ffmpeg ile klipten kare."""
    sira = ("~large", "~medium", "~small", "~thumb") if c.get("media") == "video" else ("~medium", "~small", "~thumb")
    adaylar = list(c["links"]) if c.get("source") == "svs" else surumler(c["links"], sira)
    for url in adaylar:
        try:
            http_indir(url, hedef)
            return True
        except Exception:
            continue
    kaynak = c.get("video_url") or (c.get("mp4") or [None])[0]
    if kaynak and shutil.which("ffmpeg"):
        try:
            ts = max(0.0, min(2.0, float(c.get("duration_s") or 0) / 4))
            subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{ts:.1f}", "-i", guvenli_url(kaynak),
                            "-frames:v", "1", "-vf", "scale='min(960,iw)':-2", "-q:v", "3", hedef],
                           check=True, timeout=120)
            return os.path.exists(hedef)
        except Exception:
            return False
    return False


def sahne_medya(s):
    m = str(s.get("media") or "photo").strip().lower()
    return m if m in ("photo", "video") else "photo"


def cmd_adaylar(kod):
    d = bolum(kod)
    a = ayarlar()
    plan = oku_json(os.path.join(d, "sahne_plani.json"))
    sahneler = plan["scenes"]
    min_s = float(a.get("video_min_s", 2))

    def isle(s):
        sid = int(s["id"])
        medya = sahne_medya(s)
        klasor = os.path.join(d, "adaylar", f"scene_{sid:03d}")
        os.makedirs(klasor, exist_ok=True)
        sorgu = s.get("nasa_query") or s.get("visual_brief", "")
        kisa = " ".join(re.findall(r"[A-Za-z0-9]+", s.get("visual_brief", ""))[:3])
        sorgular = [q for q in dict.fromkeys([sorgu, kisa]) if q]
        bulunan, hata, gorulen = [], None, set()

        def ekle(liste):
            for c in liste:
                if c["nasa_id"] not in gorulen:
                    gorulen.add(c["nasa_id"])
                    bulunan.append(c)

        if medya == "video":
            # önce hareketli görüntü: NASA videoları, sonra SVS animasyonları; yedek olarak az sayıda fotoğraf
            for q in sorgular:
                v, h1 = nasa_video_ara(q, a.get("nasa_video_candidates", 3), min_s)
                ekle(v)
                hata = hata or h1
                if v:
                    break
            for q in dict.fromkeys([s.get("svs_query") or sorgu] + sorgular):
                v, h2 = svs_ara(q, a.get("svs_candidates", 2), min_s)
                ekle(v)
                hata = hata or h2
                if v:
                    break
            n_foto = a.get("video_scene_photo_fallback", 2)
        else:
            n_foto = a["nasa_candidates"]
        for q in sorgular:
            f, h3 = nasa_ara(q, n_foto)
            ekle(f)
            hata = hata or h3
            if f:
                break
        adaylar = []
        for c in bulunan:
            dosya = os.path.join(klasor, f"aday_{len(adaylar)}.jpg")
            if onizleme_indir(c, dosya):
                adaylar.append({"index": len(adaylar), "file": os.path.relpath(dosya, ROOT), **c})
        yaz(os.path.join(klasor, "meta.json"), {
            "scene_id": sid, "media": medya, "scene_duration_s": float(s.get("duration_s") or 6),
            "narration": s.get("narration", ""), "visual_brief": s.get("visual_brief", ""),
            "purpose": s.get("purpose", ""), "nasa_query": sorgu, "candidates": adaylar,
            **({"error": hata} if hata and not adaylar else {})})
        return sid, medya, len(adaylar), sum(1 for c in adaylar if c.get("media") == "video")

    with ThreadPoolExecutor(max_workers=6) as ex:
        sonuc = list(ex.map(isle, sahneler))
    bos = [sid for sid, _, n, _ in sonuc if n == 0]
    n_vid = sum(v for *_, v in sonuc)
    istenen = [sid for sid, m, _, _ in sonuc if m == "video"]
    videosuz = [sid for sid, m, _, v in sonuc if m == "video" and v == 0]
    print(f"ADAYLAR: {len(sahneler)} sahne, {sum(n for _, _, n, _ in sonuc)} aday indirildi ({n_vid} video klibi). "
          f"Adayı olmayan sahne: {len(bos)}" + (f" ({', '.join(map(str, bos))})" if bos else ""))
    if istenen:
        print(f"VİDEO SAHNELERİ: {len(istenen)}; hiç klip bulunamayıp fotoğrafa düşen: {len(videosuz)}"
              + (f" ({', '.join(map(str, videosuz))})" if videosuz else ""))


def cmd_plan_kontrol(kod):
    d = bolum(kod)
    try:
        plan = oku_json(os.path.join(d, "sahne_plani.json"))
        n = len(plan["scenes"])
        assert n > 0
    except Exception as e:
        sys.exit(f"HATA: sahne_plani.json geçersiz: {e}")
    gecersiz = [s.get("id") for s in plan["scenes"] if str(s.get("media", "photo")).strip().lower() not in ("photo", "video")]
    if gecersiz:
        sys.exit(f"HATA: media alanı \"photo\" ya da \"video\" olmalı (sahneler: {gecersiz})")
    sure = sum(float(s.get("duration_s") or 6) for s in plan["scenes"])
    n_vid = sum(1 for s in plan["scenes"] if sahne_medya(s) == "video")
    n_gen = sum(1 for s in plan["scenes"] if s.get("purpose") in ("cutaway", "transition"))
    print(f"PLAN: {n} sahne, ~{mmss(sure)} · {n_vid} video, {n - n_vid} photo")
    if "media" not in plan["scenes"][0]:
        print("UYARI: sahnelerde media alanı yok — hepsi photo sayıldı. Yönetmen her sahne için photo/video seçmeli.")
    elif n_gen and n_vid < n_gen:
        print(f"UYARI: {n_gen} genel/kozmik ara plan sahnesi var ama yalnızca {n_vid} sahne video — "
              "genel cümlelerde ve kozmik ara planlarda video tercih edilir.")


def cmd_gruplar(kod):
    d = bolum(kod)
    a = ayarlar()
    ids = []
    for m in sorted(glob.glob(os.path.join(d, "adaylar", "scene_*", "meta.json"))):
        j = oku_json(m)
        if j["candidates"]:
            ids.append(j["scene_id"])
    n = a["scenes_per_selector_batch"]
    gruplar = [ids[i:i + n] for i in range(0, len(ids), n)]
    for k, g in enumerate(gruplar, 1):
        print(f"GRUP {k}: sahneler {','.join(map(str, g))} → çıktı: bolumler/{kod}/secimler/grup_{k}.json")
    if not gruplar:
        print("GRUP YOK: hiçbir sahnenin NASA adayı yok (hepsi AI promptu ile üretilecek)")


def secimleri_oku(d):
    sec = {}
    for p in sorted(glob.glob(os.path.join(d, "secimler", "*.json"))):
        try:
            for s in oku_json(p).get("selections", []):
                sec[int(s["scene_id"])] = s
        except Exception as e:
            print(f"UYARI: {p} okunamadı: {e}")
    return sec


def buyuk_surum(c):
    """Önce arama sonucundaki linkler, sonra /asset manifesti: ~large → ~orig(jpg/png) → ~medium."""
    sira = surumler(c.get("links", []), ("~large",))
    try:
        j = http_json(f"{NASA}/asset/{urllib.parse.quote(c['nasa_id'])}")
        hrefs = [i["href"] for i in j.get("collection", {}).get("items", [])]
        for son in ("~large.jpg", "~orig.jpg", "~large.png", "~orig.png", "~medium.jpg"):
            sira += [h for h in hrefs if h.lower().endswith(son)]
    except Exception:
        pass
    sira += surumler(c.get("links", []), ("~medium",))
    return list(dict.fromkeys(sira))


def video_kes(c, hedef, start_s, uzunluk_s):
    """Klibin start_s'den başlayan uzunluk_s'lik bölümünü, sesi atılmış H.264 (en çok 1920 px, 30 fps) olarak hedef'e yazar.
    ffmpeg uzaktaki dosyadan yalnızca gereken kısmı okur; büyük dosyaların tamamı indirilmez."""
    kaynaklar = [c["video_url"]] if c.get("video_url") else list(c.get("mp4") or [])
    for url in kaynaklar:
        cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{start_s:.2f}", "-i", guvenli_url(url),
               "-t", f"{uzunluk_s:.2f}", "-an", "-vf", "scale='min(1920,iw)':-2,fps=30,format=yuv420p",
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-movflags", "+faststart", hedef]
        try:
            subprocess.run(cmd, check=True, timeout=900, capture_output=True)
            if os.path.exists(hedef) and os.path.getsize(hedef) > 5000:
                return True
        except Exception:
            pass
        if os.path.exists(hedef):
            os.remove(hedef)
    return False


def yerel_bilgi(path):
    """Yerel videonun (süre, genişlik, yükseklik) bilgisi."""
    try:
        r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                            "format=duration:stream=width,height", "-of", "json", path], capture_output=True, text=True)
        j = json.loads(r.stdout)
        st = j["streams"][0]
        return round(float(j["format"]["duration"]), 2), st["width"], st["height"]
    except Exception:
        return None, None, None


def cmd_indir(kod):
    d = bolum(kod)
    sec = secimleri_oku(d)
    plan = oku_json(os.path.join(d, "sahne_plani.json"))
    sure_of = {int(x["id"]): float(x.get("duration_s") or 6) for x in plan["scenes"]}
    is_listesi = []
    for sid, s in sec.items():
        if s.get("chosen", -1) is None or int(s.get("chosen", -1)) < 0:
            continue
        meta = oku_json(os.path.join(d, "adaylar", f"scene_{sid:03d}", "meta.json"))
        c = next((x for x in meta["candidates"] if x["index"] == int(s["chosen"])), None)
        if c:
            is_listesi.append((sid, c, s))

    def isle(t):
        sid, c, s = t
        for eski in glob.glob(os.path.join(d, "assets", f"scene_{sid:03d}.*")):
            os.remove(eski)  # yeniden indirmede eski fotoğraf/klip kalmasın
        if c.get("media") == "video":
            toplam = float(c.get("duration_s") or 0)
            ihtiyac = min(25.0, sure_of.get(sid, 6) * 1.6 + 1.5)  # render sahneyi anlatıya göre uzatabilir
            bas = max(0.0, float(s.get("start_s") or 0))
            if toplam:
                bas = min(bas, max(0.0, toplam - 2))
                ihtiyac = min(ihtiyac, toplam - bas)
            hedef = os.path.join(d, "assets", f"scene_{sid:03d}.mp4")
            if video_kes(c, hedef, bas, ihtiyac):
                return sid, os.path.relpath(hedef, d)
            print(f"UYARI: sahne {sid} klibi kesilemedi; önizleme karesi kullanılacak")
            hedef = os.path.join(d, "assets", f"scene_{sid:03d}.jpg")
            shutil.copy(os.path.join(ROOT, c["file"]), hedef)
            return sid, os.path.relpath(hedef, d) + " (önizleme boyutu)"
        for url in buyuk_surum(c):
            ext = os.path.splitext(url)[1].lower()
            hedef = os.path.join(d, "assets", f"scene_{sid:03d}{'.png' if ext == '.png' else '.jpg'}")
            try:
                http_indir(url, hedef)
                return sid, os.path.relpath(hedef, d)
            except Exception:
                continue
        # büyük sürüm yoksa önizlemeyi kullan
        hedef = os.path.join(d, "assets", f"scene_{sid:03d}.jpg")
        shutil.copy(os.path.join(ROOT, c["file"]), hedef)
        return sid, os.path.relpath(hedef, d) + " (önizleme boyutu)"

    with ThreadPoolExecutor(max_workers=4) as ex:
        sonuc = list(ex.map(isle, is_listesi))
    kucuk = [sid for sid, p in sonuc if "önizleme" in p]
    n_vid = sum(1 for _, p in sonuc if p.endswith(".mp4"))
    print(f"İNDİRME: {len(sonuc)} görsel assets/ klasörüne indirildi ({n_vid} video klibi)" +
          (f"; büyük sürümü/klibi alınamayan: {', '.join(map(str, kucuk))}" if kucuk else ""))


def cmd_paketle(kod):
    d = bolum(kod)
    plan = oku_json(os.path.join(d, "sahne_plani.json"))
    g = oku_json(os.path.join(d, "grafik.json"), {})
    sec = secimleri_oku(d)
    ov, ev = {}, {}
    for o in g.get("overlays", []):
        ov.setdefault(int(o["scene_id"]), []).append(o)
    for e in g.get("evidence_tracker", []):
        ev[int(e["scene_id"])] = e
    t = 0.0
    sahneler, eksik, zayif, kredi = [], [], [], set()
    for s in plan["scenes"]:
        sid = int(s["id"])
        dur = float(s.get("duration_s") or 6)
        asset = next(iter(sorted(glob.glob(os.path.join(d, "assets", f"scene_{sid:03d}.*")))), None)
        gorsel = None
        sc = sec.get(sid)
        if asset and sc:
            meta = oku_json(os.path.join(d, "adaylar", f"scene_{sid:03d}", "meta.json"))
            c = next((x for x in meta["candidates"] if x["index"] == int(sc["chosen"])), {})
            gorsel = {"file": os.path.relpath(asset, d), "source": "svs" if c.get("source") == "svs" else "nasa",
                      "nasa_id": c.get("nasa_id"),
                      "title": c.get("title"), "credit": f"{c.get('credit_line') or 'NASA/' + str(c.get('center', 'NASA'))} — {c.get('nasa_id')}",
                      "fit_score": sc.get("fit_score"), "reason": sc.get("reason")}
            if asset.lower().endswith(".mp4"):
                sure_k, w, h = yerel_bilgi(asset)
                gorsel.update({"media": "video", "clip_s": sure_k, "width": w, "height": h,
                               "start_s": float(sc.get("start_s") or 0), "source_clip_s": c.get("duration_s")})
            try:
                gorsel["focus_x"] = max(0.0, min(1.0, float(sc.get("focus_x", 0.5))))
            except (TypeError, ValueError):
                gorsel["focus_x"] = 0.5
            kredi.add(gorsel["credit"])
            if (sc.get("fit_score") or 0) < 6:
                zayif.append((sid, sc))
        else:
            eksik.append(s)
        video = bool(gorsel and gorsel.get("media") == "video")
        sahneler.append({"id": sid, "start_s": round(t, 2), "duration_s": dur, "narration": s.get("narration"),
                         "purpose": s.get("purpose"), "motion": s.get("motion"), "transition": s.get("transition"),
                         "media": "video" if video else "photo",
                         "image": None if video else gorsel, "video": gorsel if video else None,
                         "schematic": None if gorsel else (s.get("schematic_brief") or None),
                         "ai_prompt": None if (gorsel or s.get("schematic_brief")) else s.get("ai_prompt"),
                         "overlays": ov.get(sid, []), "evidence_tracker": ev.get(sid)})
        t += dur
    with open(os.path.join(ROOT, "kanal", "stil_rehberi.md"), encoding="utf-8") as f:
        stil = f.read()
    try:
        from kurul_audio import muzik_sec
        mf = muzik_sec(kod)
    except Exception:
        mf = None
    prod = {"slug": kod, "total_duration_s": round(t, 1), "music": plan.get("music"),
            "music_file": os.path.relpath(mf, ROOT) if mf else None,
            "director_notes": plan.get("director_notes"), "thumbnail": g.get("thumbnail"),
            "design_notes": g.get("design_notes"), "style_guide": stil, "scenes": sahneler}
    yaz(os.path.join(d, "production.json"), prod)
    muzik_kredi = ""
    if mf and os.path.abspath(mf) == os.path.abspath(os.path.join(ROOT, ayarlar().get("default_music", ""))):
        muzik_kredi = ayarlar().get("default_music_credit", "") + "\n"
    yaz(os.path.join(d, "credits.txt"), "Image & video credits:\n" + "\n".join(sorted(kredi)) + "\n"
        + (("\n" + muzik_kredi) if muzik_kredi else ""))
    n_nasa = len(sahneler) - len(eksik)
    n_sema = sum(1 for s in eksik if s.get("schematic_brief"))
    bos = [s for s in eksik if not s.get("schematic_brief") and not s.get("ai_prompt")]
    n_vid = sum(1 for x in sahneler if x["media"] == "video")
    md = [f"# Görsel Kurulu Raporu — {kod}", "",
          f"**Sahne:** {len(sahneler)} · **Tahmini süre:** {int(t // 60)} dk {int(t % 60)} sn",
          f"**Görsel kaynağı:** {n_nasa} NASA/SVS arşivi ({n_vid} video klibi, {n_nasa - n_vid} fotoğraf) · {n_sema} sahne şematik grafikle çizilecek · {len(eksik) - n_sema - len(bos)} sahne AI promptlu (eski) · {len(bos)} sahne BOŞ",
          f"**Müzik:** {prod['music_file'] or 'bulunamadı'}", "",
          "## Yönetmen notu", plan.get("director_notes", ""), "", "## Grafiker notu", g.get("design_notes", ""), "",
          "## Thumbnail", f"\"{(g.get('thumbnail') or {}).get('headline', '')}\" — {(g.get('thumbnail') or {}).get('layout', '')}",
          "", f"Arka plan promptu: {(g.get('thumbnail') or {}).get('image_prompt', '')}", ""]
    if bos:
        md += ["## ⚠️ BOŞ KALAN SAHNELER (ne arşiv görseli ne şematik tarif var)"]
        md += [f"- Sahne {s['id']}: {s.get('visual_brief', '')}" for s in bos]
        md.append("")
    sema = [s for s in eksik if s.get("schematic_brief")]
    if sema:
        md += ["## Şematik grafikle çizilecek sahneler (arşivde uygun görsel yok; AI görsel YOK)"]
        md += [f"- Sahne {s['id']}: {s['schematic_brief']}" for s in sema]
        md.append("")
    eski = [s for s in eksik if not s.get("schematic_brief") and s.get("ai_prompt")]
    if eski:
        md += ["## AI promptlu sahneler (eski biçim)"]
        md += [f"- Sahne {s['id']}: {s.get('ai_prompt', '')}" for s in eski]
        md.append("")
    if zayif:
        md += ["## Zayıf eşleşmeler (uyum < 6)"]
        md += [f"- Sahne {sid} ({sc.get('fit_score')}/10): {sc.get('reason')}" for sid, sc in zayif]
        md.append("")
    md += ["## Render için", "`production.json` + `assets/` render hattına hazır. `schematic` alanı dolu sahneler kod ile çizilen şematik grafiktir (kanal stil rehberi: zemin #05070C, teal #62C2CF, amber #D9A25B, Inter, etiket ≥36px, hafif hareketli kozmik doku); `ai_prompt` alanı dolu (eski biçim) sahneler için görseli ücretsiz araçlarınla üret.",
           "Açıklamaya `credits.txt` içeriğini ekle."]
    yaz(os.path.join(d, "gorsel_raporu.md"), "\n".join(md) + "\n")
    print(f"PAKET: {len(sahneler)} sahne, ~{mmss(t)} · {n_nasa} arşiv görseli ({n_vid} video) · {n_sema} şematik sahne · {len(eksik) - n_sema - len(bos)} AI (eski) · {len(bos)} BOŞ · {len(zayif)} zayıf eşleşme")
    print(f"DOSYALAR: bolumler/{kod}/production.json, gorsel_raporu.md, credits.txt")


# ------------------------------------------------------------------ son kontrol
def cmd_kareler(kod, video=None):
    d = bolum(kod)
    a = ayarlar()
    video = video or os.path.join(d, "final.mp4")
    if not os.path.exists(video):
        sys.exit(f"HATA: video bulunamadı: {video}")
    if not shutil.which("ffmpeg"):
        sys.exit("HATA: ffmpeg kurulu değil")
    kd = os.path.join(d, "kontrol_kareleri")
    shutil.rmtree(kd, ignore_errors=True)
    os.makedirs(kd)
    every = a["frame_every_s"]
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", video,
                    "-vf", f"fps=1/{every},scale=960:-2", "-q:v", "4", os.path.join(kd, "f_%05d.jpg")], check=True)
    kareler = []
    for p in sorted(glob.glob(os.path.join(kd, "f_*.jpg"))):
        n = int(re.search(r"(\d+)", os.path.basename(p)).group(1))
        yeni = os.path.join(kd, f"t_{(n - 1) * every:04d}.jpg")
        os.rename(p, yeni)
        kareler.append(os.path.basename(yeni))
    for p in glob.glob(os.path.join(d, "kontrol", "*.json")):
        os.remove(p)
    n = a["frames_per_batch"]
    gruplar = [kareler[i:i + n] for i in range(0, len(kareler), n)]
    for k, g in enumerate(gruplar, 1):
        print(f"GRUP {k}: {g[0]} … {g[-1]} ({len(g)} kare) → çıktı: bolumler/{kod}/kontrol/grup_{k}.json")
        yaz(os.path.join(kd, f"grup_{k}.txt"), "\n".join(g) + "\n")
    print(f"KARELER: {len(kareler)} kare, bolumler/{kod}/kontrol_kareleri/ (liste: grup_N.txt)")


def cmd_son_rapor(kod):
    d = bolum(kod)
    notlar = []
    for p in sorted(glob.glob(os.path.join(d, "kontrol", "grup_*.json")),
                    key=lambda x: int(re.search(r"grup_(\d+)", x).group(1))):
        try:
            notlar.append(oku_json(p))
        except Exception as e:
            notlar.append({"batch_score": None, "problems": [], "notes": f"okunamadı: {e}", "range": os.path.basename(p)})
    if not notlar:
        sys.exit("HATA: kontrol/ klasöründe not yok")
    puan = [n["batch_score"] for n in notlar if isinstance(n.get("batch_score"), (int, float))]
    ort = round(sum(puan) / len(puan), 1) if puan else None
    sorun = [p for n in notlar for p in n.get("problems", [])]
    sorun.sort(key=lambda p: p.get("time", ""))
    agir = any(p.get("type") in ("okunabilirlik", "artefakt", "teknik") for p in sorun)
    if not sorun:
        karar = "✅ Yayına hazır"
    elif ort is not None and ort >= 7.5 and not agir:
        karar = "🟡 Küçük düzeltmelerle hazır"
    else:
        karar = "🔴 Düzeltme gerekiyor"
    tur = {}
    for p in sorun:
        tur[p.get("type")] = tur.get(p.get("type"), 0) + 1
    md = [f"# Yönetmen Son Kontrol — {kod}", "", f"**Karar:** {karar}",
          f"**Genel puan:** {ort}/10 · **Sorun:** {len(sorun)}"]
    if tur:
        md.append("**Türlere göre:** " + " · ".join(f"{k} {v}" for k, v in tur.items()))
    md += ["", "## Zaman sırasıyla sorunlar"]
    md += [f"- **{p.get('time')}** [{p.get('type')}] {p.get('detail')}\n  - Çözüm: {p.get('fix')}" for p in sorun] or ["Sorun bulunmadı."]
    md += ["", "## Bölüm bölüm notlar"]
    md += [f"- {n.get('range', '')} ({n.get('batch_score')}/10): {n.get('notes', '')}" for n in notlar]
    yaz(os.path.join(d, "son_kontrol_raporu.md"), "\n".join(md) + "\n")
    print(f"SON KONTROL: {karar} — {ort}/10, {len(sorun)} sorun → bolumler/{kod}/son_kontrol_raporu.md")


# ------------------------------------------------------------------ müzik
def cmd_muzik(kod):
    bolum(kod)
    from kurul_audio import muzik_sec
    m = muzik_sec(kod)
    print(os.path.relpath(m, ROOT) if m else "MÜZİK YOK: kanal/muzik/ boş ve bölümün muzik/ klasörü yok")


# ------------------------------------------------------------------ shorts
def sahne_sonu_cumle_mi(metin):
    return bool(re.search(r"[.!?]['\"”’)\]]*\s*$", (metin or "").strip()))


def shorts_oku(d):
    return oku_json(os.path.join(d, "shorts_plani.json"))


def short_araligi(sh):
    sc = sh.get("scenes")
    if isinstance(sc, str):
        m = re.match(r"^\s*(\d+)\s*-\s*(\d+)\s*$", sc)
        return (int(m.group(1)), int(m.group(2))) if m else None
    if isinstance(sc, (list, tuple)) and len(sc) == 2:
        return int(sc[0]), int(sc[1])
    return None


def cmd_shorts_kontrol(kod):
    """Her Short: ardışık sahne aralığı, cümle başında başlayıp cümle sonunda bitmeli; süre sınırları; kanca metni."""
    d = bolum(kod)
    a = ayarlar()
    plan = oku_json(os.path.join(d, "sahne_plani.json"))
    sp = shorts_oku(d)
    shorts = sp.get("shorts", [])
    by_id = {int(x["id"]): x for x in plan["scenes"]}
    ids = [int(x["id"]) for x in plan["scenes"]]
    hatalar, uyarilar = [], []
    if not a["shorts_min"] <= len(shorts) <= a["shorts_max"]:
        hatalar.append(f"{len(shorts)} Short var; {a['shorts_min']}-{a['shorts_max']} olmalı")
    for sh in shorts:
        n = sh.get("n")
        ar = short_araligi(sh)
        if not ar or ar[0] not in by_id or ar[1] not in by_id or ar[0] > ar[1]:
            hatalar.append(f"Short {n}: scenes geçersiz ({sh.get('scenes')}); örnek: \"5-9\"")
            continue
        ilk, son = ar
        secili = [i for i in ids if ilk <= i <= son]
        sure = sum(float(by_id[i].get("duration_s") or 6) for i in secili)
        if not sahne_sonu_cumle_mi(by_id[son].get("narration")):
            hatalar.append(f"Short {n}: son sahne ({son}) cümle sonunda bitmiyor: \"...{(by_id[son].get('narration') or '')[-40:]}\"")
        onceki = ids[ids.index(ilk) - 1] if ids.index(ilk) > 0 else None
        if onceki is not None and not sahne_sonu_cumle_mi(by_id[onceki].get("narration")):
            hatalar.append(f"Short {n}: ilk sahne ({ilk}) cümlenin ortasında başlıyor")
        if sure < a["short_min_s"]:
            hatalar.append(f"Short {n}: ~{sure:.0f} sn — en az {a['short_min_s']} sn olmalı")
        elif sure > a["short_max_s"]:
            hatalar.append(f"Short {n}: ~{sure:.0f} sn — en çok {a['short_max_s']} sn olmalı (render anlatıya göre biraz uzatabilir)")
        elif sure > a["short_max_s"] - 4:
            uyarilar.append(f"Short {n}: ~{sure:.0f} sn — sınıra yakın, render uzatırsa 60 sn'yi aşabilir")
        hook = (sh.get("hook") or {}).get("text", "")
        if not hook.strip():
            hatalar.append(f"Short {n}: hook.text yok (ilk 2 sn için rakam ya da kısa iddia)")
        elif len(hook.split()) > 6:
            hatalar.append(f"Short {n}: kanca en çok 6 kelime olmalı: \"{hook}\"")
        for alan in ("title", "description", "pinned_comment"):
            if not str(sh.get(alan, "")).strip():
                hatalar.append(f"Short {n}: {alan} eksik")
    for h in hatalar:
        print("HATA:", h)
    for u in uyarilar:
        print("UYARI:", u)
    if hatalar:
        sys.exit(1)
    print(f"SHORTS: {len(shorts)} kesim geçerli")


# ------------------------------------------------------------------ yayın paketi
HYPE = ("shocking", "shocked", "shocks", "insane", "unbelievable", "you won't believe", "you wont believe", "mind-blowing",
        "destroyed", "exposed", "secret they", "changes everything", "proves", "they don't want", "they dont want",
        "impossible", "terrifying", "horrifying", "nasa lied", "cover-up", "coverup")


def hype_bul(*metinler):
    j = " ".join(m for m in metinler if m).lower()
    return [h for h in HYPE if h in j]


def blok(metin, dil=""):
    return f"```{dil}\n{(metin or '').strip()}\n```"


def cmd_yayin(kod):
    d = bolum(kod)
    konu = oku_json(os.path.join(d, "konu.json"), {}).get("topic", kod)
    st = oku_json(os.path.join(d, "strateji.json"), {})
    gf = oku_json(os.path.join(d, "grafik.json"), {})
    sp = oku_json(os.path.join(d, "shorts_plani.json"), {})
    sk = oku_json(os.path.join(d, "shorts_kapak.json"), {})
    plan = oku_json(os.path.join(d, "sahne_plani.json"), {"scenes": []})
    prod_sc = oku_json(os.path.join(d, "production.json"), {"scenes": []})["scenes"]
    kredi = ""
    try:
        with open(os.path.join(d, "credits.txt"), encoding="utf-8") as f:
            kredi = f.read().strip()
    except FileNotFoundError:
        pass
    eksik, uyari = [], []
    md = [f"# Yayın Paketi — {konu}", "",
          f"Bölüm kodu: `{kod}`. Kod blokları yapıştırmaya hazır; hepsi İngilizce, ABD izleyicisi için yazılmış. "
          "Türkçe notlar yalnızca sana.", ""]

    # --- ana video
    md += ["## 1. Ana video", ""]
    if not st:
        eksik.append("strateji.json yok (/yeni-bolum çalıştırılmadı)")
    else:
        md += ["### Başlık", blok(st.get("recommended_title")), ""]
        if st.get("titles"):
            md += ["Alternatifler: " + " · ".join(f"`{t}`" for t in st["titles"] if t != st.get("recommended_title")), ""]
        h = hype_bul(st.get("recommended_title"), *st.get("titles", []))
        if h:
            uyari.append(f"Ana video başlığında abartılı ifade: {h}")
        desc = st.get("description", "").rstrip()
        if kredi:
            desc += "\n\n" + kredi
        md += ["### Açıklama (kredilerle birlikte)", blok(desc), ""]
        md += ["### Etiketler", blok(", ".join(st.get("tags", []))), ""]
        if st.get("pinned_comment"):
            md += ["### Sabitlenmiş yorum", blok(st["pinned_comment"]), ""]
        else:
            eksik.append("strateji.json: pinned_comment yok")

    # --- kapak konseptleri
    md += ["### Kapak konseptleri (3)", "",
           "Her konsept için önce başlığı (en fazla 4 kelime), sonra Canva'ya verilecek tarifi yapıştır. "
           "Tarifler görsel metin içermez; başlık Canva'da eklenir.", ""]
    kons = gf.get("cover_concepts") or []
    if not kons:
        eksik.append("grafik.json: cover_concepts yok (/gorsel-kurul grafiker adımı)")
    else:
        turler = [str(k.get("type", "")).lower() for k in kons]
        if len(kons) != 3 or sorted(turler) != ["clean", "mystery", "number"]:
            uyari.append(f"Kapak konseptleri number/mystery/clean olmalı, 3 adet; bulunan: {turler}")
        for i, k in enumerate(kons, 1):
            hl = str(k.get("headline", "")).strip()
            if len(hl.split()) > 4 or not hl:
                uyari.append(f"Kapak {i} başlığı 1-4 kelime olmalı: \"{hl}\"")
            if hype_bul(hl):
                uyari.append(f"Kapak {i} başlığında abartılı ifade: {hype_bul(hl)}")
            md += [f"#### Konsept {i} — {k.get('type', '')}", "**Kapak başlığı:**", blok(hl),
                   "**Canva görsel tarifi:**", blok(k.get("canva_brief")), ]
            if k.get("accuracy_note"):
                md.append(f"_Bilimsel doğruluk notu:_ {k['accuracy_note']}")
            md.append("")

    # --- shorts
    md += ["## 2. Shorts", ""]
    shorts = sp.get("shorts", [])
    if not shorts:
        eksik.append("shorts_plani.json yok (/shorts çalıştırılmadı)")
    kap = {int(c["n"]): c for c in sk.get("covers", []) if "n" in c}
    by_id = {int(x["id"]): x for x in plan.get("scenes", [])}
    for sh in shorts:
        n = int(sh.get("n", 0))
        ar = short_araligi(sh)
        zaman = ""
        if ar and ar[0] in by_id and ar[1] in by_id:
            t0 = sum(float(by_id[i].get("duration_s") or 6) for i in by_id if i < ar[0])
            t1 = sum(float(by_id[i].get("duration_s") or 6) for i in by_id if i <= ar[1])
            zaman = f" · bölümde yaklaşık {mmss(t0)}–{mmss(t1)}"
        md += [f"### Short {n}", f"Dosya: `bolumler/{kod}/shorts/short_{n}.mp4` · sahneler {sh.get('scenes')}{zaman}", ""]
        md += [f"Kanca (ilk 2 sn): **{(sh.get('hook') or {}).get('text', '')}**", ""]
        if sh.get("why"):
            md += [f"_Neden bu kesim:_ {sh['why']}", ""]
        t = str(sh.get("title", "")).strip()
        if len(t) > 70 or len(t) < 5:
            uyari.append(f"Short {n} başlığı 5-70 karakter olmalı ({len(t)})")
        if hype_bul(t, sh.get("description"), sh.get("pinned_comment")):
            uyari.append(f"Short {n} metinlerinde abartılı ifade: {hype_bul(t, sh.get('description'), sh.get('pinned_comment'))}")
        desc_s = str(sh.get("description", "")).rstrip()
        if ar:
            kr = []
            for x in prod_sc:
                if ar[0] <= int(x["id"]) <= ar[1]:
                    g = x.get("video") or x.get("image") or {}
                    c = (g.get("credit") or "").split(" \u2014 ")[0].strip()
                    if c and c not in kr:
                        kr.append(c)
            if kr:
                desc_s += "\n\nCredits: " + "; ".join(kr)
            mk = ayarlar().get("default_music_credit", "")
            if mk:
                desc_s += "\n" + mk
        md += ["**Başlık:**", blok(t), "**Açıklama (kredilerle):**", blok(desc_s),
               "**Sabitlenmiş yorum:**", blok(sh.get("pinned_comment"))]
        if sh.get("tags"):
            md += ["**Etiketler:**", blok(", ".join(sh["tags"]))]
        c = kap.get(n)
        if not c:
            eksik.append(f"Short {n}: dikey kapak tarifi yok (shorts_kapak.json)")
        else:
            hl = str(c.get("headline", "")).strip()
            if len(hl.split()) > 4 or not hl:
                uyari.append(f"Short {n} kapak başlığı 1-4 kelime olmalı: \"{hl}\"")
            md += ["**Dikey kapak (1080×1920) başlığı:**", blok(hl), "**Canva görsel tarifi:**", blok(c.get("canva_brief"))]
        md.append("")

    if eksik or uyari:
        md += ["## Eksikler ve uyarılar", ""]
        md += [f"- ⚠️ EKSİK: {e}" for e in eksik] + [f"- ⚠️ {u}" for u in uyari] + [""]
    yaz(os.path.join(d, "yayin_paketi.md"), "\n".join(md) + "\n")
    print(f"YAYIN PAKETİ: bolumler/{kod}/yayin_paketi.md — {len(kons)} kapak konsepti, {len(shorts)} Short"
          + (f"; {len(eksik)} eksik, {len(uyari)} uyarı" if eksik or uyari else ""))
    for e in eksik:
        print("EKSİK:", e)
    for u in uyari:
        print("UYARI:", u)


KOMUTLAR = {"yeni": cmd_yeni, "karar": cmd_karar, "rapor": cmd_rapor, "adaylar": cmd_adaylar,
            "gruplar": cmd_gruplar, "plan-kontrol": cmd_plan_kontrol, "indir": cmd_indir, "paketle": cmd_paketle, "kareler": cmd_kareler,
            "son-rapor": cmd_son_rapor, "muzik": cmd_muzik, "shorts-kontrol": cmd_shorts_kontrol, "yayin": cmd_yayin}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help") or sys.argv[1] not in KOMUTLAR:
        print(__doc__)
        sys.exit(0 if len(sys.argv) > 1 and sys.argv[1] in ("-h", "--help") else 1)
    KOMUTLAR[sys.argv[1]](*sys.argv[2:])
