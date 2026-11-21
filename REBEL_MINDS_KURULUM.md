# Rebel Minds: Cosmos — Yapay Zekâ Yayın Kurulu (Claude Code, ücretsiz)

Kurulun tamamı Claude Code içinde **alt ajan** olarak çalışır. Ücretli API yok: modeller Claude aboneliğinden, web araması Claude Code'un kendi aracından, görseller ücretsiz NASA arşivinden geliyor. Tek sınır aboneliğinin kullanım limitleri.

## Kurul

| Üye | Model | Görev | Çıktı |
|---|---|---|---|
| Araştırmacı | Sonnet | Web'de araştırma, son 60 günün gelişmeleri, her bilgi kaynaklı | `research.md` |
| Başyazar | Sonnet | Senaryo ve revizyonlar | `script.md` |
| Doğrulayıcı | Sonnet | Her iddiayı kaynağıyla kontrol eder | `hakem/dogrulayici_turN.json` |
| Şüpheci Hakem | **Opus** | Abartı ve kanıt gücü kontrolü (bilerek farklı model) | `hakem/supheci_turN.json` |
| Hikâye Editörü | Sonnet | Kanca, izleyici kaybı, tempo | `hakem/hikaye_turN.json` |
| YouTube Stratejisti | Sonnet | Başlık, thumbnail, açıklama, özgünlük riski | `strateji.json` |
| Yönetmen | Sonnet | Sahne planı, hareket, geçişler | `sahne_plani.json` |
| Görsel Seçici | Haiku | NASA adaylarına **bakıp** en uygununu seçer | `secimler/*.json` |
| Grafiker | Sonnet | Ekran yazıları, kanıt takipçisi, thumbnail | `grafik.json` |
| Son Kontrol Yönetmeni | Sonnet | Render edilmiş videonun karelerini inceler | `kontrol/*.json` |

Üç hakem birbirinin yorumunu görmez ve aynı anda (paralel) çalışır. Puanlama ve karar `tools/kurul.py` içinde sabit kurallarla verilir: ortalama ≥ 7,5, en düşük puan ≥ 6 ve hiç kritik sorun yoksa taslak onaylanır. En fazla 2 tur var. Böylece karar model keyfine kalmıyor.

## Kurulum
Bu dosyalar `tuncingo/OpenMontage` fork'unun içinde. claude.ai'deki **Code** sekmesinde yeni oturum açarken repo olarak **tuncingo/OpenMontage**'ı seç, sonra `/agents` yazıp 10 kurul üyesini gör.

NASA görselleri için bulut ortamının ağ ayarında `images-api.nasa.gov` ve `images-assets.nasa.gov` adreslerine izin verilmiş olmalı.

## Kullanım

```
/yeni-bolum NASA's Moon base at the lunar south pole | Artemis III gecikmelerine değin | 10
```
Kurul araştırır, yazar, denetler, gerekirse revize eder ve sana kısa bir özet verir. Ayrıntılı rapor `bolumler/<kod>/kurul_raporu.md` dosyasında. **Burada durur ve senin onayını bekler.**

```
/gorsel-kurul <kod>
```
Sahne planı çıkarılır, NASA arşivinden adaylar indirilir, Görsel Seçici her sahne için seçim yapar, Grafiker yazıları ve thumbnail'i tasarlar. Sonuç: `production.json` + `assets/` + `credits.txt`.

Render işini mevcut hattınla yap (OpenMontage, seslendirme vb.). `ai_prompt` alanı dolu olan sahneler arşivde uygun görsel bulunamayan sahneler; bunların görselini ücretsiz araçlarınla üret. Videoyu `bolumler/<kod>/final.mp4` olarak kaydet, sonra:

```
/son-kontrol <kod>
```
Yönetmen her 5 saniyeden bir alınan kareleri inceler. Rapor `son_kontrol_raporu.md` dosyasına yazılır.

Yayından sonra:
- Bölümü `kanal/onceki_bolumler.md` listesine ekle. Stratejist özgünlük kontrolünü bu listeye göre yapıyor.
- `credits.txt` içeriğini video açıklamasına yapıştır.

## Ayarlar

- `kanal/stil_rehberi.md`: kanalın ses tonu, görsel dili, telefon okunabilirliği, kanıt takipçisi, renkler, font. **Bütün kurul bunu okuyor.** Bir şeyi değiştirmek istediğinde önce buraya bak.
- `kanal/ayarlar.json`: onay eşikleri (`pass_avg`, `pass_min`), tur sayısı (`max_rounds`), sahne başına NASA aday sayısı, kare aralığı.
- `.claude/agents/*.md`: her kurul üyesinin talimatı ve modeli. Örneğin Şüpheci Hakem'in `model: opus` satırını `sonnet` yaparsan kullanım limitin daha geç dolar.

## Kullanım limiti için ipuçları

En çok limit harcayan adımlar: araştırma (çok sayıda arama ve sayfa okuma), Opus hakem ve görsel seçim (çok sayıda görsel). Limite yaklaşırsan:
- `max_rounds: 1` yap
- Şüpheci Hakem'i Sonnet'e al
- `nasa_candidates` değerini 4'ten 2'ye düşür

## Görsel lisansları

- **NASA:** görsellerin çoğu kamu malı. Yine de kredi vermek iyi uygulama (`credits.txt`). NASA logosu ve astronot yüzleri gibi bazı istisnalar var.
- **ESA/Webb, ESA/Hubble, ESO:** CC BY 4.0, yani kredi şartıyla serbest. Bu kaynaklar şimdilik otomatik aranmıyor; elle eklersen açıklamaya kredisini yaz.

## Sorun giderme

- **"HATA: … incelemesi eksik"**: bir hakem dosyasını yazamamış. Komut o hakemi otomatik olarak yeniden çalıştırır; elle yapmak istersen aynı hakemi tekrar çağır.
- **Hiç NASA adayı yok**: internet bağlantısını kontrol et. Ya da Yönetmen'in `nasa_query` alanları çok soyut kalmış olabilir; komut bu durumda Yönetmen'den sorguları sadeleştirmesini ister.
- **"ffmpeg kurulu değil"**: `brew install ffmpeg`
- Araç komutlarının listesini görmek için: `python3 tools/kurul.py -h`
