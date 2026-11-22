# Yönetmen Son Kontrol — 2026-11-21-nasa-s-moon-base-at-the-lunar-south-pole

**Karar:** 🔴 Düzeltme gerekiyor
**Genel puan:** 7.2/10 · **Sorun:** 27
**Türlere göre:** tekrar 5 · okunabilirlik 9 · artefakt 3 · tempo 6 · ilgisiz 2 · teknik 2

## Zaman sırasıyla sorunlar
- **00:00** [tekrar] Acilista Dunya dogusu iki kare boyunca (5 sn+) neredeyse ayni; yalnizca cok yavas hareket var, ekranda yazi yok.
  - Çözüm: Hook cumlesine uygun bir anahtar yazi/ikinci plan ekle veya 4 sn icinde ikinci goruntuye gec.
- **00:10** [okunabilirlik] 'THE FIRST THREE LANDERS' ve 'PLANNED 2026 / NOW: 2027' etiketleri ve alt eksen yazilari 36 px siniri civarinda; kaynak satiri 00:15 karesinde cok soluk.
  - Çözüm: Etiketleri 40 px ve uzeri yap; kaynak satirini biraz daha belirgin tut.
- **00:35** [artefakt] Kanit izleyicisi ile alt baslik ayni anda ekranda; 'PAUSED' alt basligi yari saydam bir kutunun icinde ve alt kenardan kirpilmis gorunuyor, ustte ikinci bir yari saydam serit var. Fotografin ustunde kalabalik ve yarim kalmis bir katman.
  - Çözüm: Tracker ve alt basligi birbirinden ayir (alt baslik tracker bittikten sonra girsin) ve basligin tam girdigi karede bitsin; scrim kenarlari sert olmasin.
- **01:25** [okunabilirlik] Pluto uzerindeki sicaklik paneli sol kenarda %8 civarinda basliyor (%10 guvenli kenarin disinda). 'about 17 degrees colder than Pluto' ve eksen rakamlari telefonda 36 px alti kalabilir. Panelin sert yatay kenari Pluto'yu ortadan kesiyor gibi gorunuyor. Ilk karede -234 sayisi ile isaretci -233 uyumsuz (sayac sayim ani).
  - Çözüm: Paneli iceri al (en az %10 kenar), kucuk metin ve eksen etiketlerini buyut, scrim'i Pluto'nun bir yarisini kesmeyecek sekilde yumusat; sayac ilk karede dogru degere yakin baslasin.
- **01:25** [tekrar] Ayni sicaklik cizelgesi (-250 olcegi) 02:00'de bir kez, Pluto karesinde ikinci kez tekrar ediyor; ikisi arka arkaya benzer bir grafik.
  - Çözüm: Ilk olcegi sadeleştirip Pluto sahnesine donusumu tek hareketli gecis yap ya da birini kaldir.
- **01:25** [okunabilirlik] Kaynak satiri Pluto sahnesinde cok uzun (iki kredi ve URL), sag altta kalabalik.
  - Çözüm: Krediyi kisalt: 'Image: NASA/JHUAPL/SwRI, enhanced color'.
- **01:25** [tempo] Uc-faz plani grafigi (01:25-01:40 bolgesinde 01:25, 01:30, 01:35 civari ayni duzen) birbirine cok benzeyen uc-dort kare; faz 2 iki kez neredeyse ayni gorunuyor (alt baslik olmadan).
  - Çözüm: Faz 2 icin ikinci kareyi kisaltip ara kesme veya hareket ekle.
- **01:25** [okunabilirlik] Faz grafiginde sonuk (dim) 01/02/03 ve aciklama metinleri cok dusuk kontrastli; telefonda okunmaz. Aciklama metni boyutu da kucuk.
  - Çözüm: Pasif fazlari %50 opaklik yerine daha acik gri (#8A93A6) yap ve aciklama metnini buyut.
- **01:35** [tempo] LCROSS sahnesi (01:35-01:45 civari) yalnizca ince eş merkezli halkalar; ikinci karede (01:40) yazi ve kaynak satiri da yok, bos ve statik hissi veriyor. Halkalarin LCROSS/su buzu ile iliskisi anlasilmiyor.
  - Çözüm: Sahneyi gercek bir LCROSS veya Cabeus gorseliyle degistir ya da grafige bir veri/etiket ekle; kaynak satiri ekle.
- **02:40** [ilgisiz] Daire ve halkalardan olusan radar benzeri soyut cizgi grafik (02:40-02:45) hicbir etiket, rakam veya baslik tasimiyor; ne anlattigi anlasilmiyor, iki kare boyunca sadece dekor gibi duruyor.
  - Çözüm: Grafige anlatimla ilgili bir etiket ve kaynak satiri ekle ya da yerine gercek NASA/ESA kozmik ara plan koy.
- **03:05** [artefakt] Dalgali cizgi grafiginin sag kenarinda kuyruklu yildiz gorseli sert bir dikey seritle kesilmis; goruntu yarim kalmis gibi duruyor, kenar yumusatilmamis. Grafik 03:05-03:10 arasi metinsiz.
  - Çözüm: Gorselin kesim kenarini yumusat veya tam kadraja yerlestir; grafige kisa bir etiket ekle.
- **03:55** [tempo] Iki ardisik zaman cizelgesi (Moon Base I ve Moon Base III) ayni gorsel islemle art arda geliyor (03:55-04:05); stil rehberi ayni islemin arka arkaya tekrarini yasakliyor.
  - Çözüm: Ikinci cizelgeyi farkli bir duzenle ya da arada kisa bir gercek goruntu ile ayir.
- **04:05** [okunabilirlik] Nova-C ve Moon Base III cizelgesinde etiketler yaklasik 36 px siniri civarinda; 'ACCORDING TO ITS MAKER' gri ve soluk, telefonda zor okunur.
  - Çözüm: Alt etiketi biraz daha buyut ve ice white tonuna yaklastir.
- **04:10** [okunabilirlik] Yengec bulutsusu karesinde kaynak/kredi satiri acik zemin uzerinde neredeyse gorunmuyor (04:10).
  - Çözüm: Kredi satirinin arkasina koyu scrim ekle.
- **04:15** [tekrar] 03:05'te kullanilan dalgali cizgi ve turuncu isaretci grafigi 04:15'te (Evidence 5 sirasinda) neredeyse ayni haliyle geri geliyor; bolum icinde ayni gorsel iki kez kullanilmis.
  - Çözüm: Ikinci kullanimda farkli bir grafik tasarimi veya gercek goruntu kullan.
- **04:20** [okunabilirlik] VIPER illustration karesinde 'Image: Daniel Rutter' kredisi 04:20'de fade-in sirasinda gri zeminde okunmuyor; 04:25'te okunur hale geliyor. Hoppers karesinde (04:40-04:45) kredi de zayif.
  - Çözüm: Kredi satirina koyu zemin kutusu ekle, fade-in suresini kisalt.
- **04:30** [tempo] Eş merkezli halka grafigi (04:30-04:35) iki kare boyunca neredeyse ayni, etiket yok, sadece ILLUSTRATION yazisi var; durgun ve anlami belirsiz.
  - Çözüm: Halkalara rakam/etiket ekle veya daha hareketli gercek bir goruntuyle degistir.
- **04:40** [tekrar] Moonfall hoppers bolumunde ayni Ay yuzeyi fotografi 04:40 ve 04:45'te tekrar ediyor (sadece yakinlasma farki); ardindan Apollo ayak izi geliyor.
  - Çözüm: Ikinci kareyi farkli bir gorselle degistir veya hareketi belirginlestir.
- **05:30** [okunabilirlik] Kanit takipcisi etiketi (EVIDENCE / FISSION REACTOR TARGET) cok kucuk; 1080p'de yaklasik 20-25 px gorunuyor, telefonda zor okunur. Ayni durum 06:35 'CHANG'E-7 DELAY' etiketinde de var.
  - Çözüm: Etiket yazisini en az 36 px yapin, takipci kutusunu buna gore buyutun.
- **05:40** [tekrar] 05:40 ve 05:45'te ayni sarmal gokada gorseli art arda (yaklasik 10 sn), yalnizca yavas zoom var. Gorsel olarak neredeyse ayni kare.
  - Çözüm: Ikinci yarida farkli bir ara plan ya da farkli kamera hareketi (kaydirma/parallax) kullanin.
- **06:00** [okunabilirlik] Alt baslik 'ARTEMIS III: 2027, IV: 2028' ve 06:25'teki 'PLAN OR PROMISE?' yaklasik 45 px; rehber basliklar icin en az 60 px istiyor. Altin renk rakamlar koyu seritte ince kaliyor.
  - Çözüm: Basliklari 60 px ve ustune cikarin, 6 kelime sinirini koruyun.
- **06:35** [tempo] 06:35-06:45 arasi bos bir cizgi grafik: sadece dalgali cizgiler ve bir nokta, rakam yok, 'ILLUSTRATION' etiketi anlamsiz. 10 sn boyunca neredeyse hicbir bilgi vermiyor, durgun hissi veriyor.
  - Çözüm: Bu grafige Chang'e-7 gecikmesini gosteren gercek bir zaman cizelgesi (planlanan ve simdiki tarih) ekleyin ya da bu araligi gercek goruntuyle degistirin; 'ILLUSTRATION' etiketini kaldirin.
- **06:45** [artefakt] 06:45-06:50 arasi (WISE) nebula goruntusu dusuk cozunurluklu buyutulmus gibi yumusak ve bulanik; yildizlar kaba gorunuyor.
  - Çözüm: Daha yuksek cozunurluklu bir kaynak dosya kullanin ya da daha az yakinlastirin.
- **07:10** [ilgisiz] Ogrenci robot yarismasindan Dunya uzerinde bir fotograf (agac, koniler, genclerin elindeki laptoplar) ay roveri gibi sunuluyor. Uzay hissi yok; gercek bir ay aracini gosteriyormus izlenimi verebilir.
  - Çözüm: Anlatim ay roverlarindan bahsediyorsa gercek rover/LTV gorseli kullanin; yoksa genel bir kozmik ara plan koyun. Kullanilacaksa 'NASA student challenge' diye acikca etiketleyin.
- **07:30** [teknik] Ayak izi fotografinda (07:30 ve 07:35 kareleri) sag alt kaynak satiri yok; sahne baslangicindan 5+ saniye sonra bile gorunmuyor. Stil rehberi her foto sahnesinde kaynak/gorsel kredisi istiyor.
  - Çözüm: Sahne basladiktan kisa sure sonra 'Image: NASA/JSC' kaynak satirini gecir ve sahne bitmeden once soldur.
- **07:40** [teknik] Jupiter/Juno sahnesinde 'ILLUSTRATION' etiketi ust sagda, sag kenara yakin; guvenli kenar payina (yuzde 10) girmis olabilir. Ayrica sahne Ay ussu anlatimiyla dogrudan bagli degil, genel ara plan olarak kabul edildi.
  - Çözüm: Etiketi guvenli kenarin icine al (en az yuzde 10 bosluk).
- **08:20** [tempo] 08:15 ve 08:20 kareleri ayni Apollo ay yuzeyi goruntusu; hareket yavas push-in kadar, bu sahne 5+ saniye durgun hissediliyor. 08:20 karesinde kaynak satiri yok.
  - Çözüm: Pan/parallax hareketini biraz artir, sahneyi kisalt ve kaynak satirini sahne bitene kadar tut.

## Bölüm bölüm notlar
- 00:00-02:25 (7/10): Genel olarak temiz, siyah zeminli ve palete uygun bir bolum. Kozmik ara planlar (Carina, Serpens, Orion, Halka Bulutsusu) izinli oldugu icin ilgisiz sayilmadi. Gercek gorseller dogru kredilendirilmis, cizim sahnelerinde 'ILLUSTRATION' etiketi var. Ana sorunlar: Pluto panelinde guvenli kenar ve okunabilirlik, 00:35'te yari kalmis alt baslik, LCROSS sahnesinin bos kalmasi ve faz grafiginin sonuk metinleri. Kareler 960x540 oldugundan piksel boyutlari 2 ile carpilarak degerlendirildi.
- 02:30-04:55 (7/10): Genel kozmik ara planlar (Tarantula, Helix, Gunes, supernova kalintisi, Lagoon, Yengec) stil rehberine gore ilgisiz sayilmadi. Basliklar ve evidence izleyicisi guvenli kenar bosluklarinda ve okunur. Illustration etiketleri dogru kullanilmis. Ana sorunlar: etiketsiz soyut grafikler, tekrar eden dalgali cizgi grafigi, ardisik ayni stil cizelgeler ve zayif kontrastli kaynak satirlari.
- 05:00-07:25 (7/10): Genel kozmik ara planlar (nebula, gokada, Saturn) stil rehberine gore izinli, ilgisiz sayilmadi. Gercek NASA/ESA gorselleri, kaynak satirlari ve 'Illustration' etiketleri genel olarak dogru. Ana sorunlar: ekran yazilarinin boyutu (kanit etiketi ve basliklar), 06:35 civarindaki bos cizgi grafik ve Dunya'dan ogrenci rover fotografi. Siyah/bos kare veya yapay zeka bozulmasi gorulmedi; renk tutarliligi iyi.
- 07:30-08:35 (8/10): Tum kareler uzay/ay temali; genel kozmik ara planlar (yildiz kumesi, Eta Carinae, At Basi Nebulasi, Samanyolu merkezi) rehbere gore ilgisiz sayilmadi. Gorseller her 5-10 saniyede degisiyor, tekrar eden gorsel yok, siyah/bos kare yok, yapay zeka artefakti gozlenmedi. 08:30 SUBSCRIBE metni okunakli ve kenar payi icinde. At Basi Nebulasi karesinde (08:35) kaynak satiri gorunuyor. 07:50-07:55 kareleri (Saturn V kalkisi) cok benzer ama yavas kamera hareketiyle ayni sahnenin devami. Genel kalite iyi; kaynak satirlari ve tek tuk duragan an duzeltilmeli.
