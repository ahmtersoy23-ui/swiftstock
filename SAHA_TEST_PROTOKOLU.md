# SwiftStock WMS — Saha Test Protokolü

> **Amaç:** Sistemin gerçek saha koşullarında doğru çalıştığını adım adım doğrulamak
> **Versiyon:** 1.0 | **Tarih:** 2026-03-09
> **Uygulayan:** Test eden personel + sistem yöneticisi

---

## Test Öncesi Hazırlık

### Gerekli Malzeme
- [ ] Barkod okuyucu (HID veya Bluetooth)
- [ ] Etiket yazıcısı (Zebra veya benzeri)
- [ ] En az 2 adet test ürünü (bilinen IWASKU'su olan, seri no basılmamış)
- [ ] Sisteme erişim: swiftstock.apps.iwa.web.tr

### Ön Kontrol
- [ ] Kullanıcı girişi başarılı (apps.iwa.web.tr üzerinden SSO)
- [ ] Header'da depo seçici görünüyor (FACTORY / TR / NJ / NL / UK)
- [ ] Ağ bağlantısı stabil

---

## TEST 1 — Ürün Kataloğu ve Etiket Basımı

**Modül:** Products
**Amaç:** Ürün listesinin PriceLab'dan doğru çekiliğini ve etiket üretiminin çalıştığını doğrulamak

| # | Adım | Beklenen Sonuç | ✓/✗ |
|---|------|----------------|-----|
| 1 | Sol menüden **Ürünler** sayfasına git | Ürün listesi yükleniyor | |
| 2 | Arama kutusuna bilinen bir IWASKU yaz | İlgili ürün filtreleniyor | |
| 3 | Herhangi bir ürünün **Etiket Bas** butonuna tıkla | Miktar girme modali açılıyor | |
| 4 | Miktar: `3` gir, **Oluştur** tıkla | 3 adet seri no üretiliyor; barkod önizlemesi görünüyor | |
| 5 | **Yazdır** butonuna bas | Tarayıcı print dialogu açılıyor; etiketler `IWASKU-000001` formatında | |
| 6 | Ürünler sayfasında **Ekle / Sil** butonu arama | Bu butonlar görünmüyor olmalı (salt okunur) | |

**Beklenen barkod formatı:** `IWA-METAL-XXXX-000001`
**Geçer kriteri:** 3 etiket basılabilir, format doğru, ekleme/silme yok ✓

---

## TEST 2 — FACTORY'e Ürün Girişi (IN) — Seri No Zorunlu

**Modül:** Operations → IN (FACTORY)
**Amaç:** Fabrika deposuna girişin seri numara zorunluluğuyla çalıştığını doğrulamak

### 2A: Seri Nosuz Giriş Denemesi (Reddetmeli)

| # | Adım | Beklenen Sonuç | ✓/✗ |
|---|------|----------------|-----|
| 1 | Header'dan depo: **FACTORY** seç | Header FACTORY gösteriyor | |
| 2 | **Operasyonlar** sayfasına git | Mod seçim ekranı açılıyor | |
| 3 | **GİRİŞ (IN)** → **RECEIVING** modunu seç | FACTORY+IN ekranı açılıyor | |
| 4 | Sadece IWASKU barkodunu okut (seri nosuz) | `"Seri numarası zorunlu"` uyarısı görünüyor | |
| 5 | İşlem devam etmiyor | Hata mesajı ekranda kalıyor | |

### 2B: Seri Numara ile Başarılı Giriş

| # | Adım | Beklenen Sonuç | ✓/✗ |
|---|------|----------------|-----|
| 1 | Test 1'de basılan etiketlerden birini al: `IWASKU-000001` | — | |
| 2 | FACTORY+IN modunda bu barkodu okut | Ürün tanınıyor; zone önerisi banner çıkıyor | |
| 3 | Zone öneri banner'ını kontrol et | Ürünün kategorisine göre zone öneriliyor (örn. "IWA Metal") | |
| 4 | Zone'u onayla veya değiştir | Seçim kaydediliyor | |
| 5 | **İşlemi Tamamla** | Başarı mesajı; stok FACTORY'de görünüyor | |
| 6 | Stok > FACTORY > söz konusu SKU kontrolü | 1 adet FACTORY'de kayıtlı | |

**Geçer kriteri:** Seri nosuz giriş reddedildi ✓; Seri no ile giriş zone önerisiyle tamamlandı ✓

---

## TEST 3 — Transfer: FACTORY → TR

**Modül:** Operations → TRANSFER
**Amaç:** Fabrikadan ana sevk deposuna ürün aktarımını doğrulamak

| # | Adım | Beklenen Sonuç | ✓/✗ |
|---|------|----------------|-----|
| 1 | Header'dan depo: **FACTORY** seç | — | |
| 2 | Operasyonlar → **TRANSFER** modunu seç | Transfer ekranı açılıyor | |
| 3 | Hedef depo olarak **TR** seç | — | |
| 4 | Test 2'de sisteme alınan ürünün barkodunu okut | Ürün listede görünüyor | |
| 5 | **İşlemi Tamamla** | Başarı mesajı | |
| 6 | Stok sayfasında kontrol: FACTORY stoku | İlgili ürün FACTORY'den düşmüş | |
| 7 | Stok sayfasında kontrol: TR stoku | İlgili ürün TR'de görünüyor | |

**Geçer kriteri:** Stok FACTORY'den TR'ye taşındı ✓

---

## TEST 4 — Sevkiyat: TR → NJ (Depo Transferi)

**Modül:** Sevkiyat
**Amaç:** TR deposundan NJ'ye sevkiyat oluşturma ve koli hedeflemenin çalıştığını doğrulamak

### 4A: Sevkiyat Oluşturma

| # | Adım | Beklenen Sonuç | ✓/✗ |
|---|------|----------------|-----|
| 1 | Sol menüden **Sevkiyat** sayfasına git | Sevkiyat listesi görünüyor | |
| 2 | **+ Yeni** butonuna tıkla | Modal açılıyor; kural bilgisi görünüyor (`TR → NJ/NL/UK/ABD Pazar/FBA`) | |
| 3 | Kaynak Depo: **TR Ana Sevk Deposu (TR)** seçili olduğunu kontrol et | Sadece TR ve NJ seçilebilir (FACTORY/UK/NL yok) | |
| 4 | Prefix: `TST` gir | Otomatik büyük harfe çevriliyor | |
| 5 | **Oluştur** tıkla | Sevkiyat listesinde `TST` görünüyor; durum: Açık | |

### 4B: NJ Hedefli Koli Oluşturma

| # | Adım | Beklenen Sonuç | ✓/✗ |
|---|------|----------------|-----|
| 1 | `TST` sevkiyatına tıkla | Sağ panelde koli alanı açılıyor | |
| 2 | Rota bilgisini kontrol et: `TR → NJ / NL / UK / USA / FBA` | Tüm 5 hedef görünüyor | |
| 3 | Hedef dropdown'dan **NJ Deposu** seç | — | |
| 4 | **+ Koli** tıkla | Koli oluşturuldu; barkod: `TST-00001`; badge: yeşil NJ | |
| 5 | Tekrar koli oluştur, bu sefer hedef: **Amazon FBA** | Koli: `TST-00002`; badge: amber FBA | |
| 6 | Sevkiyat kartında `NJ: 1` ve `FBA: 1` görünüyor | Doğru sayılar | |

**Geçer kriteri:** Kaynak filtrelemesi çalışıyor ✓; NJ + FBA kolileri ayrı ayrı oluşturuldu ✓

---

## TEST 5 — Sevkiyat: NJ → Yalnızca Pazar Yeri

**Modül:** Sevkiyat
**Amaç:** NJ deposundan başlatılan sevkiyatta NL/UK/NJ seçeneğinin çıkmadığını doğrulamak

| # | Adım | Beklenen Sonuç | ✓/✗ |
|---|------|----------------|-----|
| 1 | **+ Yeni** tıkla | Modal açılıyor | |
| 2 | Kaynak Depo: **New Jersey Deposu (NJ)** seç | — | |
| 3 | Prefix: `NJT` gir, **Oluştur** | — | |
| 4 | `NJT` sevkiyatına tıkla | Sağ panelde rota: `NJ → ABD Pazar / Amazon FBA` | |
| 5 | Hedef dropdown'u aç | Sadece `ABD Pazar` ve `Amazon FBA` görünüyor; NJ/NL/UK yok | |

**Geçer kriteri:** NJ → NL/UK koli oluşturulamıyor ✓

---

## TEST 6 — Sevkiyat Kapatma ve Gönderim Akışı

**Modül:** Sevkiyat
**Amaç:** OPEN → CLOSED → SHIPPED durum akışını doğrulamak

| # | Adım | Beklenen Sonuç | ✓/✗ |
|---|------|----------------|-----|
| 1 | Test 4'te oluşturulan `TST` sevkiyatını bul | Durum: **Açık** | |
| 2 | **Kapat** butonuna tıkla | Onay soruluyor | |
| 3 | Onayla | Durum: **Kapalı**; Kapat butonu yerini **Gönder** butonuna bıraktı | |
| 4 | Kapalı sevkiyata yeni koli eklemeye çalış | Koli oluşturma butonu görünmüyor | |
| 5 | **Gönder** butonuna tıkla | Onay soruluyor | |
| 6 | Onayla | Durum: **Gönderildi**; mavi badge | |
| 7 | Filtreden **Gönderildi** seç | `TST` listede görünüyor | |

**Geçer kriteri:** OPEN → CLOSED → SHIPPED akışı tamamlandı ✓

---

## TEST 7 — Lokasyon ve Stok Görüntüleme

**Modül:** Locations / Inventory
**Amaç:** Depo içi raf ve stok bilgilerinin doğru görüntülendiğini doğrulamak

| # | Adım | Beklenen Sonuç | ✓/✗ |
|---|------|----------------|-----|
| 1 | Header'dan depo: **TR** seç | — | |
| 2 | Sol menüden **Lokasyonlar** sayfasına git | TR deposuna ait raflar/zoneler listeleniyor | |
| 3 | Herhangi bir lokasyona tıkla | İçeriği (ürünler) görünüyor | |
| 4 | Sol menüden **Stok** sayfasına git | SKU bazında stok durumu görünüyor | |
| 5 | Test 3'te TR'ye transfer edilen ürünü ara | TR stokunda görünüyor; FACTORY'de 0 | |
| 6 | Header'dan depo: **FACTORY** değiştir | Stok listesi FACTORY'ye göre güncelleniyor | |

**Geçer kriteri:** Depo bazlı stok filtresi çalışıyor ✓

---

## TEST 8 — Cycle Count (Sayım)

**Modül:** Sayım / Count
**Amaç:** Stok sayım akışının çalıştığını doğrulamak

| # | Adım | Beklenen Sonuç | ✓/✗ |
|---|------|----------------|-----|
| 1 | **Sayım** modülüne git | Sayım başlatma ekranı | |
| 2 | Yeni sayım başlat; scope: tek bir lokasyon seç | Sayım açıldı; bekleyen ürünler listeleniyor | |
| 3 | Barkod okuyucu ile bir ürün tarat | Ürün sayıma işaretleniyor | |
| 4 | Sayımı tamamla | Sistem stoku ile karşılaştırma raporu görünüyor | |
| 5 | Fark yoksa onay, fark varsa fark kaydediliyor | Sayım raporu oluştu | |

**Geçer kriteri:** Sayım tamamlandı, fark raporu görüntülendi ✓

---

## TEST 9 — Barkod Okuyucu Entegrasyon Kontrolü

**Amaç:** HID barkod okuyucunun tüm giriş alanlarında çalıştığını doğrulamak

| # | Test Noktası | Beklenen | ✓/✗ |
|---|-------------|---------|-----|
| 1 | Operations barkod alanı | Okutunca alan dolup Enter tetikleniyor | |
| 2 | Ürün arama kutusu | Okutunca anlık filtreleme çalışıyor | |
| 3 | Koli barkod okutma (getBoxByBarcode) | Koli bilgisi açılıyor | |
| 4 | Mobil PWA (telefon kamerası) | Kamera ile QR/barkod okunabiliyor | |

---

## TEST 10 — Depo Seçici Tutarlılığı

**Amaç:** Depo seçicinin tüm sayfalarda tutarlı davrandığını ve yeniden başlatmada korunduğunu doğrulamak

| # | Adım | Beklenen Sonuç | ✓/✗ |
|---|------|----------------|-----|
| 1 | Header'dan depo: **NJ** seç | Header NJ gösteriyor | |
| 2 | Farklı sayfalara geç (Stok, Lokasyon, Operasyon) | Her sayfada NJ seçili kalıyor | |
| 3 | Sayfayı yenile (F5) | NJ seçimi korunuyor (localStorage) | |
| 4 | Çıkış yap, tekrar giriş yap | Depo seçimi hala geçerli depoyu gösteriyor | |
| 5 | Tüm 5 depoyu sırayla seç: FACTORY, TR, NJ, NL, UK | Her biri seçilebiliyor; hepsi dropdown'da aktif | |

**Geçer kriteri:** Depo seçimi tüm sayfalarda ve yeniden başlatmada korunuyor ✓

---

## Sonuç Özeti

| Test | Modül | ✓ Geçti | ✗ Kaldı | Not |
|------|-------|---------|---------|-----|
| TEST 1 | Ürün Kataloğu + Etiket | | | |
| TEST 2A | IN — Seri nosuz red | | | |
| TEST 2B | IN — Seri no ile giriş | | | |
| TEST 3 | Transfer FACTORY→TR | | | |
| TEST 4 | Sevkiyat TR→NJ | | | |
| TEST 5 | Sevkiyat NJ kısıtı | | | |
| TEST 6 | Sevkiyat OPEN→SHIPPED | | | |
| TEST 7 | Lokasyon + Stok görüntüleme | | | |
| TEST 8 | Cycle Count | | | |
| TEST 9 | Barkod okuyucu | | | |
| TEST 10 | Depo seçici tutarlılığı | | | |

**Test Tarihi:** ___________
**Test Eden:** ___________
**Toplam:** _____ / 11 Geçti

---

## Hata Raporlama

Bir test adımında beklenmedik davranış gözlemlenirse:

1. Ekran görüntüsü al
2. Tarayıcı console'u aç (F12) → kırmızı hata varsa not al
3. Şu bilgileri ilet: **Test #**, **Adım #**, **Beklenen**, **Gerçekleşen**, **Console hatası**
