#!/usr/bin/env python3
"""Rebel Minds: Cosmos — yayın kurulu yardımcı aracı (sadece Python standart kütüphanesi).

Kurul üyeleri (Claude Code alt ajanları) yaratıcı işi yapar; bu araç da tekrarlanabilir
"tesisat" işlerini üstlenir: puanlama, karar, NASA araması/indirme, paketleme, kare çıkarma.

  python3 tools/kurul.py yeni "<konu>"            bölüm klasörünü oluşturur, kodu yazar
  python3 tools/kurul.py karar <kod> <tur>        hakem JSON'larından kurul kararını verir
  python3 tools/kurul.py rapor <kod>              kurul_raporu.md üretir
  python3 tools/kurul.py adaylar <kod>            her sahne için ücretsiz NASA aday görsellerini indirir
  python3 tools/kurul.py plan-kontrol <kod>       Yönetmen'in sahne planını doğrular
  python3 tools/kurul.py gruplar <kod>            görsel seçici için sahne gruplarını listeler
  python3 tools/kurul.py indir <kod>              seçilen görsellerin büyük sürümlerini assets/ içine indirir
  python3 tools/kurul.py paketle <kod>            production.json + gorsel_raporu.md + credits.txt
  python3 tools/kurul.py kareler <kod> [video]    videodan kontrol kareleri çıkarır, grupları listeler
  python3 tools/kurul.py son-rapor <kod>          son_kontrol_raporu.md üretir
"""
import json, os, re, sys, shutil, subprocess, datetime, urllib.request, urllib.parse, glob
from concurrent.futures import ThreadPoolExecutor

# Windows konsolu Türkçe karakter/emoji basarken çökmesin
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NASA = os.environ.get("NASA_API", "https://images-api.nasa.gov")
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
def nasa_ara(sorgu, n):
    q = urllib.parse.urlencode({"q": sorgu, "media_type": "image", "page_size": 25})
    try:
        j = http_json(f"{NASA}/search?{q}")
    except Exception as e:
        return [], str(e)
    sonuc = []
    for it in j.get("collection", {}).get("items", []):
        links = [l["href"] for l in it.get("links", []) if l.get("render") == "image" and l.get("href")]
        meta = (it.get("data") or [{}])[0]
        if not links or not meta.get("nasa_id") or meta.get("media_type", "image") != "image":
            continue
        sonuc.append({"nasa_id": meta["nasa_id"], "title": meta.get("title", ""),
                      "center": meta.get("center", "NASA"), "date": (meta.get("date_created") or "")[:10],
                      "description": re.sub(r"\s+", " ", meta.get("description", ""))[:300],
                      "links": links})
        if len(sonuc) >= n:
            break
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
    """Seçicinin görebileceği orta boy önizleme: ~medium → ~small → ~thumb."""
    for url in surumler(c["links"], ("~medium", "~small", "~thumb")):
        try:
            http_indir(url, hedef)
            return True
        except Exception:
            continue
    return False


def cmd_adaylar(kod):
    d = bolum(kod)
    a = ayarlar()
    plan = oku_json(os.path.join(d, "sahne_plani.json"))
    sahneler = plan["scenes"]

    def isle(s):
        sid = int(s["id"])
        klasor = os.path.join(d, "adaylar", f"scene_{sid:03d}")
        os.makedirs(klasor, exist_ok=True)
        bulunan, hata = nasa_ara(s.get("nasa_query") or s.get("visual_brief", ""), a["nasa_candidates"])
        if not bulunan and s.get("visual_brief"):
            # ikinci şans: brief'in ilk birkaç kelimesi
            kisa = " ".join(re.findall(r"[A-Za-z0-9]+", s["visual_brief"])[:3])
            bulunan, hata = nasa_ara(kisa, a["nasa_candidates"])
        adaylar = []
        for c in bulunan:
            dosya = os.path.join(klasor, f"aday_{len(adaylar)}.jpg")
            if onizleme_indir(c, dosya):
                adaylar.append({"index": len(adaylar), "file": os.path.relpath(dosya, ROOT), **c})
        yaz(os.path.join(klasor, "meta.json"), {
            "scene_id": sid, "narration": s.get("narration", ""), "visual_brief": s.get("visual_brief", ""),
            "purpose": s.get("purpose", ""), "nasa_query": s.get("nasa_query", ""), "candidates": adaylar,
            **({"error": hata} if hata and not adaylar else {})})
        return sid, len(adaylar)

    with ThreadPoolExecutor(max_workers=6) as ex:
        sonuc = list(ex.map(isle, sahneler))
    bos = [sid for sid, n in sonuc if n == 0]
    print(f"ADAYLAR: {len(sahneler)} sahne, {sum(n for _, n in sonuc)} aday görsel indirildi. "
          f"Adayı olmayan sahne: {len(bos)}" + (f" ({', '.join(map(str, bos))})" if bos else ""))


def cmd_plan_kontrol(kod):
    d = bolum(kod)
    try:
        plan = oku_json(os.path.join(d, "sahne_plani.json"))
        n = len(plan["scenes"])
        assert n > 0
    except Exception as e:
        sys.exit(f"HATA: sahne_plani.json geçersiz: {e}")
    print(f"PLAN: {n} sahne, ~{mmss(sum(float(s.get('duration_s') or 6) for s in plan['scenes']))}")


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


def cmd_indir(kod):
    d = bolum(kod)
    sec = secimleri_oku(d)
    is_listesi = []
    for sid, s in sec.items():
        if s.get("chosen", -1) is None or int(s.get("chosen", -1)) < 0:
            continue
        meta = oku_json(os.path.join(d, "adaylar", f"scene_{sid:03d}", "meta.json"))
        c = next((x for x in meta["candidates"] if x["index"] == int(s["chosen"])), None)
        if c:
            is_listesi.append((sid, c))

    def isle(t):
        sid, c = t
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
    print(f"İNDİRME: {len(sonuc)} görsel assets/ klasörüne indirildi" +
          (f"; büyük sürümü bulunamayan: {', '.join(map(str, kucuk))}" if kucuk else ""))


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
            gorsel = {"file": os.path.relpath(asset, d), "source": "nasa", "nasa_id": c.get("nasa_id"),
                      "title": c.get("title"), "credit": f"NASA/{c.get('center', 'NASA')} — {c.get('nasa_id')}",
                      "fit_score": sc.get("fit_score"), "reason": sc.get("reason")}
            kredi.add(gorsel["credit"])
            if (sc.get("fit_score") or 0) < 6:
                zayif.append((sid, sc))
        else:
            eksik.append(s)
        sahneler.append({"id": sid, "start_s": round(t, 2), "duration_s": dur, "narration": s.get("narration"),
                         "purpose": s.get("purpose"), "motion": s.get("motion"), "transition": s.get("transition"),
                         "image": gorsel, "ai_prompt": None if gorsel else s.get("ai_prompt"),
                         "overlays": ov.get(sid, []), "evidence_tracker": ev.get(sid)})
        t += dur
    with open(os.path.join(ROOT, "kanal", "stil_rehberi.md"), encoding="utf-8") as f:
        stil = f.read()
    prod = {"slug": kod, "total_duration_s": round(t, 1), "music": plan.get("music"),
            "director_notes": plan.get("director_notes"), "thumbnail": g.get("thumbnail"),
            "design_notes": g.get("design_notes"), "style_guide": stil, "scenes": sahneler}
    yaz(os.path.join(d, "production.json"), prod)
    yaz(os.path.join(d, "credits.txt"), "Image credits:\n" + "\n".join(sorted(kredi)) + "\n")
    n_nasa = len(sahneler) - len(eksik)
    md = [f"# Görsel Kurulu Raporu — {kod}", "",
          f"**Sahne:** {len(sahneler)} · **Tahmini süre:** {int(t // 60)} dk {int(t % 60)} sn",
          f"**Görsel kaynağı:** {n_nasa} NASA arşivi · {len(eksik)} sahne AI promptuyla üretilecek", "",
          "## Yönetmen notu", plan.get("director_notes", ""), "", "## Grafiker notu", g.get("design_notes", ""), "",
          "## Thumbnail", f"\"{(g.get('thumbnail') or {}).get('headline', '')}\" — {(g.get('thumbnail') or {}).get('layout', '')}",
          "", f"Arka plan promptu: {(g.get('thumbnail') or {}).get('image_prompt', '')}", ""]
    if eksik:
        md += ["## AI ile üretilecek sahneler (arşivde uygun görsel yok)"]
        md += [f"- Sahne {s['id']}: {s.get('ai_prompt', '')}" for s in eksik]
        md.append("")
    if zayif:
        md += ["## Zayıf eşleşmeler (uyum < 6)"]
        md += [f"- Sahne {sid} ({sc.get('fit_score')}/10): {sc.get('reason')}" for sid, sc in zayif]
        md.append("")
    md += ["## Render için", "`production.json` + `assets/` render hattına hazır. `ai_prompt` alanı dolu sahneler için görseli ücretsiz araçlarınla üret.",
           "Açıklamaya `credits.txt` içeriğini ekle."]
    yaz(os.path.join(d, "gorsel_raporu.md"), "\n".join(md) + "\n")
    print(f"PAKET: {len(sahneler)} sahne, ~{mmss(t)} · {n_nasa} arşiv görseli · {len(eksik)} AI sahnesi · {len(zayif)} zayıf eşleşme")
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


KOMUTLAR = {"yeni": cmd_yeni, "karar": cmd_karar, "rapor": cmd_rapor, "adaylar": cmd_adaylar,
            "gruplar": cmd_gruplar, "plan-kontrol": cmd_plan_kontrol, "indir": cmd_indir, "paketle": cmd_paketle, "kareler": cmd_kareler,
            "son-rapor": cmd_son_rapor}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help") or sys.argv[1] not in KOMUTLAR:
        print(__doc__)
        sys.exit(0 if len(sys.argv) > 1 and sys.argv[1] in ("-h", "--help") else 1)
    KOMUTLAR[sys.argv[1]](*sys.argv[2:])
