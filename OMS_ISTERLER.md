---
marp: true
theme: default
paginate: true
width: 794
height: 1123
style: |
  /* Varsayılan: 10-15 satır → 24px */
  section {
    font-size: 24px;
    padding: 36px 56px;
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #1e293b;
  }
  h1 { font-size: 32px; color: #0f172a; border-bottom: 3px solid #16a34a; padding-bottom: 8px; }
  h2 { font-size: 28px; color: #166534; border-bottom: 1.5px solid #86efac; padding-bottom: 4px; margin-top: 14px; margin-bottom: 8px; }
  h3 { font-size: 22px; color: #14532d; margin-top: 10px; margin-bottom: 4px; }
  pre { font-size: 17px; background: #f1f5f9; border-left: 3px solid #16a34a; padding: 8px 12px; border-radius: 3px; }
  code { font-size: 18px; background: #dcfce7; padding: 1px 5px; border-radius: 2px; }
  table { font-size: 20px; width: 100%; border-collapse: collapse; }
  th { background: #166534; color: white; padding: 5px 8px; }
  td { padding: 4px 8px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f0fdf4; }
  blockquote { border-left: 4px solid #16a34a; background: #f0fdf4; padding: 6px 12px; margin: 8px 0; font-size: 20px; }
  ul, ol { margin: 4px 0; padding-left: 20px; }
  li { margin: 3px 0; }
  p { margin: 5px 0; }

  /* 16-20 satır → 20px */
  section.medium {
    font-size: 20px;
  }
  section.medium h2 { font-size: 24px; margin-top: 12px; margin-bottom: 6px; }
  section.medium h3 { font-size: 19px; margin-top: 8px; margin-bottom: 3px; }
  section.medium pre { font-size: 14px; padding: 6px 10px; }
  section.medium code { font-size: 15px; }
  section.medium table { font-size: 17px; }
  section.medium th { padding: 4px 7px; }
  section.medium td { padding: 3px 7px; }
  section.medium blockquote { font-size: 17px; }
  section.medium li { margin: 2px 0; }
  section.medium p { margin: 4px 0; }

  /* 20+ satır → 16px */
  section.dense {
    font-size: 16px;
    padding: 28px 48px;
  }
  section.dense h2 { font-size: 20px; margin-top: 10px; margin-bottom: 5px; }
  section.dense h3 { font-size: 16px; margin-top: 6px; margin-bottom: 2px; }
  section.dense pre { font-size: 11.5px; padding: 5px 8px; }
  section.dense code { font-size: 13px; }
  section.dense table { font-size: 13.5px; }
  section.dense th { padding: 3px 6px; }
  section.dense td { padding: 2px 6px; }
  section.dense blockquote { font-size: 13.5px; }
  section.dense li { margin: 1px 0; }
  section.dense ul, section.dense ol { margin: 2px 0; }
  section.dense p { margin: 3px 0; }
---

# OMS — Sipariş Yönetim Sistemi İsterleri

> **Belge Tipi:** Fonksiyonel Gereksinim Belgesi
> **Kapsam:** Sipariş yönetimi, kanal entegrasyonları, stok allocation — müşteri yönü
> **Versiyon:** 2.0 | **Tarih:** 2026-03-25
> **İlişkili Belge:** `SWIFTSTOCK_VIZYON.md` (WMS — Depo Yönetim Sistemi)

---

## 1. Genel Bakış & Mimari Sınır

Sistem iki bağımsız katmandan oluşur:

| Katman | Sorumluluk | Uygulama |
|--------|------------|----------|
| **OMS** | Sipariş, kanal entegrasyonları, allocation, kargo | Wisersell → Kendi modülü |
| **WMS** | Fiziksel stok, depo operasyonları, sevkiyat | SwiftStock |

**Temel prensip:** OMS karar verir, WMS yürütür.

```
[PAZARYERLER]        [OMS]                  [WMS — SwiftStock]
  Shopify (6)  ────► Sipariş Alma    ────► Stok Rezervasyon
  Amazon (3)   ────► Allocation      ────► Picking Talimatı
  Etsy (2)     ────► Kanal Sync     ◄──── Stok Bildirimi
  Walmart      ◄──── Stok Push      ────► Sevkiyat Durumu
  Wayfair      ◄──── Takip No
  bol.com             Kargo
```

WMS detayı `SWIFTSTOCK_VIZYON.md`'de tanımlıdır, bu belgenin kapsamı dışındadır.

---

<!-- _class: medium -->
## 2. OMS ↔ WMS Entegrasyon Noktaları

### 2.1 OMS → WMS (Talimat Yönü)

| Endpoint | Açıklama | Tetikleyici |
|----------|----------|-------------|
| **Stok Kontrol** | "Bu IWASKU bu depoda kaç adet?" | Sipariş alındığında |
| **Stok Rezervasyon** | "Bu ürünü bu depodan rezerve et" | Allocation sonrası |
| **Picking Talimatı** | "Bu siparişteki ürünleri topla" | Allocation onayında |
| **Rezervasyon İptal** | "Bu ürünün rezervasyonunu kaldır" | Sipariş iptali |

### 2.2 WMS → OMS (Bildirim Yönü)

| Bildirim | Açıklama | Tetikleyici |
|----------|----------|-------------|
| **Stok Değişikliği** | Güncel stok (IWASKU + depo bazında) | Her IN/OUT/TRANSFER/COUNT sonrası |
| **Picking Tamamlandı** | Sipariş toplandı, paketlemeye hazır | Picking bittiğinde |
| **Sevkiyat Durumu** | SHIPPED / DELIVERED | Sanal depo durum değişikliği |

**Bildirim frekansı:** Gerçek zamanlı (webhook/event) veya periyodik — yapılandırılabilir.

---

## 2.3 Ortak Referanslar (ss_vizyon_4 ile uyumlu)

| Kavram | Tanım | Kaynak |
|--------|-------|--------|
| **IWASKU** | Ürün kimliği — tüm sistemlerde ortak anahtar | PriceLab |
| **Seri Numarası** | Tekil ürün takibi (`IWASKU-SERIALNO`) | WMS tarafında üretilir |
| **Depo Kodları** | `FACTORY`, `TR`, `NJ`, `NL`, `UK` | WMS tanımlı |
| **Pazar Yeri Depoları** | FBA, Wayfair CG vb. sanal stok noktaları | WMS'de sanal depo |

> Depo kodları, rota kuralları (TR→NJ/NL/UK/USA/FBA, NJ→USA/FBA only) ve IWASKU yapısı her iki sistemde ortaktır.

---

## 3. Sipariş Yönetimi

### 3.1 Sipariş Akışı

```
Sipariş Alındı (Kanaldan — webhook/API)
       ▼
Doğrulama → Stok Kontrol (WMS API)
   ┌───┴───┐
Yeterli   Yetersiz → Uyarı / Kısmi / Beklemeye Al
   ▼
Allocation (depo seç) → Stok Rezervasyon (WMS)
   ▼
Picking Talimatı → WMS Personeli Toplar
   ▼
Paketleme & Kargo Etiketi
   ▼
Sevkiyat → Stok Düşme → Takip No → Kanal Bildirimi → Teslim
```

---

<!-- _class: medium -->
### 3.2 Sipariş Durumları

```
PENDING → ALLOCATED → PICKING → PACKED → SHIPPED → DELIVERED
                                                        │
                                            (opsiyonel) ▼
                                                    RETURNED
```

### 3.3 Sipariş İşlemleri

| İşlem | Açıklama | Kural |
|-------|----------|-------|
| **İptal** | Sipariş SHIPPED olmadan iptal edilebilir | Rezervasyon WMS'den kaldırılır |
| **Değişiklik** | Ürün/adres değişikliği | PICKING öncesi mümkün |
| **Birleştirme** | Aynı müşterinin birden fazla siparişi tek sevkiyata | Aynı depodan çıkıyorsa |
| **Kısmi Karşılama** | Stok yetmezliğinde mevcut kısmı gönder | Müşteri onayına bağlı |
| **Beklemeye Alma** | Stok veya ödeme bekleyen siparişler | Otomatik veya manuel |

### 3.4 Müşteri Bilgileri

- Teslimat adresi, fatura adresi
- İletişim bilgileri (e-posta, telefon)
- Sipariş geçmişi
- Kanal bazlı müşteri kimliği (Shopify customer ID, Amazon order ID vb.)

---

## 4. Stok Allocation Motoru

### 4.1 Allocation Karar Kriterleri

Sipariş geldiğinde OMS hangi kaynaktan karşılanacağını **çok kriterli** olarak belirler:

| # | Kriter | Açıklama | Ağırlık |
|---|--------|----------|---------|
| 1 | **Stok mevcudiyeti** | Ürün o depoda var mı? Kullanılabilir miktar yeterli mi? | Zorunlu |
| 2 | **Kargo maliyeti** | Kaynak depodan müşteriye tahmini kargo ücreti | Yüksek |
| 3 | **FBA aging stok** | FBA deposunda uzun süredir bekleyen stok varsa öncelik | Yüksek |
| 4 | **Teslimat süresi** | Müşteriye en hızlı ulaşan rota (SLA uyumu) | Orta |
| 5 | **Depo doluluk** | Yüksek doluluklu depolardan çıkışı teşvik | Düşük |

### 4.2 Kargo Maliyeti Kıyası

Her allocation kararında alternatif rotalar ve tahmini kargo bedelleri gösterilir:

```
Sipariş: Shopify ABD, müşteri New York, ürün: IM05600RF2RD

Alternatif 1: NJ Depo        →  $8.50 kargo  | 2-3 gün  | ✅ ÖNERİLEN
Alternatif 2: FBA US (aging)  →  $0 kargo     | 1-2 gün  | ⚡ FBA AGING (180+ gün)
Alternatif 3: TR Depo         →  $35.00 kargo | 7-12 gün | ⚠️ Pahalı
Alternatif 4: FACTORY         →  $42.00 kargo | 10-15 gün| ❌ Son çare
```

**Kural:** Kargo maliyeti farkı belirli bir eşiğin üstündeyse (örn. >$15) daha ucuz rotayı otomatik seç. Aksi halde en hızlı rotayı tercih et.

### 4.3 FBA Aging Stok Optimizasyonu

Amazon FBA depolarında uzun süre kalan ürünler **long-term storage fee** (LTSF) riski taşır:

| FBA Yaş | Durum | Allocation Etkisi |
|---------|-------|-------------------|
| 0-180 gün | Normal | Standart sıralama |
| 180-270 gün | Uyarı | FBA'dan karşılamayı öner (LTSF riski) |
| 270-365 gün | Kritik | FBA'dan karşılamayı **zorla** (NJ/TR yerine) |
| 365+ gün | Acil | FBA removal veya tasfiye öner |

**Örnek:** Müşteri ABD'den sipariş verdi. NJ'de 5 adet, FBA US'te 3 adet (240 gün yaşında) var.
→ Sistem FBA'dan karşılamayı önerir çünkü: kargo $0 + LTSF riski azalır + teslimat daha hızlı.

### 4.4 Depo Bazlı Varsayılan Rotalar

| Kanal / Koşul | Varsayılan Sıra | Not |
|----------------|-----------------|-----|
| **Wayfair** | FBA aging → NJ | ABD'ye hizmet |
| **Walmart** | FBA aging → NJ | ABD'ye hizmet |
| **Shopify (ABD)** | FBA aging → NJ → TR → FACTORY | Maliyet + hız sıralamalı |
| **Shopify (TR)** | TR → FACTORY | TR öncelikli |
| **Etsy (ABD)** | FBA aging → NJ → TR | — |
| **bol.com** | NL | Avrupa |
| **Amazon MFN** | Account deposuna göre | FBA aging kontrolü dahil |
| **Amazon FBA** | FBA (zaten depoda) | OMS sadece izler |

> **Not:** Her alternatif rota tahmini kargo maliyeti ve teslimat süresiyle birlikte gösterilir. Operatör önerilen rotayı onaylar veya değiştirir.

### 4.5 Kanal Bazlı Stok Bölüşümü

| Parametre | Açıklama | Örnek |
|-----------|----------|-------|
| **Stok yüzdesi** | Kanalın toplam stoktan alacağı pay | Amazon: %20, Wayfair: %80 |
| **Miktar limiti** | Kanalda gösterilecek maksimum adet | Etsy: max 5 adet |
| **Minimum eşik** | Bu seviyenin altında kanala stok sıfırlanır | Toplam < 3 → Amazon stok = 0 |

### 4.6 Allocation Çakışma Yönetimi

- Aynı anda birden fazla kanal aynı ürünü talep ederse: **ilk gelen alır** (FIFO)
- Rezerve stok başka kanala verilmez
- Allocation başarısız olursa sipariş `PENDING` kalır, uyarı üretilir
- Kargo maliyeti hesaplanamıyorsa varsayılan depo sırasına düşer

---

## 5. Kanal Entegrasyonları

### 5.1 Shopify (6 Mağaza)

| Mağaza | URL | Hedef Depo |
|--------|-----|------------|
| IWA Store | islamicwallartstore.com | TR, NJ |
| IWA TR | islamicwallart.com.tr | TR |
| CW Global | colorfullworlds.com | TR, NJ |
| CW TR | colorfullworldstr.com | TR |
| +2 mağaza | — | — |

**Entegrasyon detayı:**
- Sipariş: Webhook ile OMS'e alınır
- Stok: OMS → Shopify senkronize edilir (kullanılabilir stok push)
- Kargo: Takip numarası OMS → Shopify'a gönderilir
- Fulfillment: OMS sipariş durumunu Shopify'a bildirir

---

### 5.2 Amazon (3 Seller Account)

| Account | Pazar | FBA Depoları |
|---------|-------|--------------|
| **Citi Global** | US, CA | US Citi FBA, CA Citi FBA |
| **MDN LLC** | US, UAE, AU | US MDN FBA, UAE MDN FBA, AU MDN FBA |
| **IWA Concept** | UK, EU, CA | UK IWA FBA, EU IWA FBA, CA IWA FBA |

**Entegrasyon detayı:**
- SP-API ile sipariş ve stok senkronizasyonu
- **FBA siparişleri:** Amazon tarafından karşılanır — OMS sadece izler
- **MFN siparişleri:** OMS'e düşer → allocation → WMS picking → sevkiyat
- **FBA Inbound Shipment:** WMS sanal depo → FBA deposuna gönderim takibi
- Barkod eşleme: FNSKU ↔ IWASKU mapping

---

<!-- _class: medium -->
### 5.3 Diğer Kanallar

| Kanal | Entegrasyon | Hedef Depo | Durum |
|-------|-------------|------------|-------|
| Etsy (MapWooda) | API | TR, NJ | Aktif |
| Etsy (MaplyArt) | API | TR, NJ | Aktif |
| Walmart | API | NJ | Aktif |
| Wayfair | API | NJ | Aktif |
| bol.com | API | NL | Aktif |
| Takealot | API | ZA TAKEALOT | Aktif |
| Trendyol | API | TR | Planlanan |
| Hepsiburada | API | TR | Planlanan |
| TikTok Shop | API | — | Planlanan |

### 5.4 Kanal Entegrasyon Standartları

| Yetenek | Açıklama |
|---------|----------|
| **Sipariş çekme** | Webhook veya polling ile sipariş alma |
| **Stok push** | Kullanılabilir stok miktarını kanala gönderme |
| **Durum güncelleme** | Sipariş durumu (shipped, tracking no) kanala bildirme |
| **İade bildirimi** | Kanal tarafından başlatılan iade taleplerini alma |
| **Barkod eşleme** | Kanal SKU ↔ IWASKU mapping tablosu |

---

## 6. Picking Workflow (OMS → WMS)

### 6.1 Akış

```
Sipariş ALLOCATED (OMS)
       ▼
Picking Talimatı → WMS API (sipariş ID, IWASKU listesi, depo, öncelik)
       ▼
WMS Picking Listesi → Personel Mobil/PWA'da Görür
       ▼
Barkod Okutarak Pick Onay → Tamamlandı Bildirimi → OMS
       ▼
Sipariş Durumu: PICKING → PACKED
```

### 6.2 Picking Önceliklendirme

| Öncelik | Koşul | Örnek |
|---------|-------|-------|
| **Yüksek** | Express kargo, SLA yaklaşan | Wayfair 2-day |
| **Normal** | Standart kargo | Shopify standard |
| **Düşük** | Pre-order, stok bekleyen | — |

---

## 7. İade Yönetimi (RMA — OMS Tarafı)

### 7.1 İade Akışı

```
İade Talebi (Kanal veya Manuel)
       ▼
REQUESTED → APPROVED → RECEIVED → COMPLETED
                          ▼
             WMS'e Stok Geri Alma Bildirimi (IN işlemi)
```

### 7.2 İade Detayları

| Alan | Açıklama |
|------|----------|
| İade nedeni | Hasarlı, yanlış ürün, müşteri vazgeçti, vb. |
| İade kararı | Stoka geri al / hurda / yeniden gönder |
| Kaynak kanal | Hangi kanaldan geldiği |
| İade tarihi | Talep ve tamamlanma tarihleri |
| Finansal etki | Geri ödeme tutarı ve yöntemi |

---

## 8. Kargo Entegrasyonu

### 8.1 Temel Yetenekler

| Yetenek | Açıklama |
|---------|----------|
| **Fiyat karşılaştırma** | Birden fazla kargo şirketinden fiyat çekme |
| **Etiket üretimi** | Kargo etiketi oluşturma ve yazdırma |
| **Takip numarası** | Kargo takip no alma ve kanala/müşteriye iletme |
| **Durum takibi** | Kargonun teslim durumunu izleme |

### 8.2 Kargo ve Allocation İlişkisi

- Allocation kararı kargo maliyetini etkileyebilir (NJ → ABD ucuz, TR → ABD pahalı)
- OMS, kargo fiyatını allocation kararında opsiyonel ağırlık olarak kullanabilir
- Kargo şirketi seçimi siparişin çıkış deposuna bağlıdır

---

## 9. Stok Görünürlüğü (OMS Perspektifi)

### 9.1 Stok Tipleri

OMS tüm stok noktalarını tek görünümden izler:

| Stok Tipi | Kaynak | Açıklama |
|-----------|--------|----------|
| **Fiziksel** | WMS API | FACTORY, TR, NJ, NL, UK depolarındaki fiili stok |
| **Transit** | WMS API | Sanal depolardaki (yolda olan) stok |
| **Pazar yeri** | Kanal API / Manuel | Amazon FBA, Wayfair CG vb. |
| **Rezerve** | OMS dahili | Allocation yapılmış, henüz sevk edilmemiş |
| **Kullanılabilir** | Hesaplama | Fiziksel − Rezerve |

---

### 9.2 Kanal Stok Senkronizasyonu

```
WMS Stok Değişikliği
       ▼
OMS Güncel Stok Hesapla (fiziksel − rezerve = kullanılabilir)
       ▼
Kanal Bazlı Bölüşüm Kuralları Uygula
       ▼
Her Kanala Stok Push (Shopify, Amazon, Etsy, Walmart...)
```

### 9.3 Düşük Stok Uyarıları

- Her IWASKU için minimum stok seviyesi tanımlanabilir
- Seviye aşıldığında OMS bildirim üretir
- Kanal bazlı stok sıfırlama kuralı otomatik tetiklenebilir
- Reorder point önerisi (ileri analitik — Faz 3)

---

<!-- _class: medium -->
## 10. Raporlama (OMS Kapsamı)

### 10.1 Temel Raporlar

| Rapor | Açıklama |
|-------|----------|
| **Sipariş özeti** | Kanal/dönem bazında sipariş adetleri ve tutarları |
| **Kanal performansı** | Kanal bazlı satış, iade oranı, ortalama sipariş değeri |
| **Allocation raporu** | Hangi depodan kaç sipariş karşılandı |
| **Stok kullanılabilirlik** | Kanal bazında stok durumu ve bölüşüm |
| **İade analizi** | İade nedenleri, oranları, finansal etki |
| **SLA uyumu** | Kargo sürelerine uyum oranı |

### 10.2 İleri Analitik (Faz 3)

| Özellik | Açıklama |
|---------|----------|
| **Demand forecasting** | Geçmiş satıştan stok ihtiyacı tahmini |
| **Reorder point** | Otomatik yenileme eşiği hesaplama |
| **Sezonsal planlama** | Kampanya ve dönemsel talep analizi |
| **Kanal karlılığı** | Kanal bazlı maliyet ve gelir analizi (kargo dahil) |
| **Dead stock** | Uzun süre satılmayan ürün tespiti |
| **Days of supply (DOS)** | IWASKU bazında kaç günlük stok kaldığı |

---

<!-- _class: medium -->
## 11. Wisersell — OMS Katmanı

Wisersell, OMS katmanı olarak sipariş yönetimini üstlenir. SwiftStock WMS ile API üzerinden entegre çalışır.

### 11.1 Rol Dağılımı

| Katman | Sorumluluk | Platform |
|--------|------------|----------|
| **OMS** | Sipariş alma, allocation kararı, kanal stok push, kargo, takip no | Wisersell |
| **WMS** | Fiziksel stok, depo operasyonları, picking, sevkiyat | SwiftStock |

### 11.2 Entegrasyon Noktaları

| Yön | Akış | API |
|-----|------|-----|
| **Wisersell → SwiftStock** | Stok kontrol, rezervasyon, picking talimatı | `/oms/stock`, `/oms/reserve`, `/oms/pick-request` |
| **SwiftStock → Wisersell** | Stok değişikliği, sevkiyat durumu, sipariş durumu | Webhook (STOCK_CHANGE, SHIPMENT_STATUS, ORDER_STATUS) |

### 11.3 Stok Senkronizasyonu

- WMS fiziksel stok kaynağıdır (single source of truth)
- Wisersell, WMS'den kullanılabilir stok alır → kanallara dağıtır
- Stok değişikliğinde webhook ile Wisersell otomatik güncellenir

---

<!-- _class: dense -->
## 12. Mevcut Durum & Fazlama (2026-03-25)

### WMS Faz 1 — Tamamlandı ✅

- [x] Çok depolu fiziksel stok yönetimi (5 depo)
- [x] Barkod/QR operasyonları (unique barkod, tarama bazlı)
- [x] Koli/palet yönetimi + container kırma otomasyonu
- [x] Lokasyon/raf sistemi (zone, aisle, bay, level)
- [x] Sanal depo — transit stok takibi
- [x] Cycle count (tam/kısmi/spot)
- [x] Seri no zorunluluğu (IWASKU-SERIALNO)
- [x] Kategori → Zone otomatik eşleme
- [x] RMA / iade yönetimi (frontend + backend)
- [x] Container management UI (tam)
- [x] Sipariş + picking workflow + wave/batch picking
- [x] Dashboard KPIs + bildirim sistemi
- [x] XLSX export + etiket şablonları

### OMS ↔ WMS Entegrasyon API — Tamamlandı ✅

- [x] `GET /oms/stock` — Stok kontrol (fiziksel − rezerve = kullanılabilir)
- [x] `POST /oms/reserve` — Stok rezervasyon (expiry desteği)
- [x] `DELETE /oms/reserve/:id` — Rezervasyon iptal
- [x] `POST /oms/pick-request` — Picking talimatı (lokasyon sıralamalı)
- [x] Webhook altyapısı (STOCK_CHANGE, SHIPMENT_STATUS, ORDER_STATUS)
- [x] Webhook retry (3 deneme, exponential backoff) + audit log

### Analitik — Tamamlandı ✅

- [x] Birleşik stok görünümü (fiziksel + transit + FBA + Wayfair CG + marketplace)
- [x] Dead stock tespiti / DOS / Inventory turnover
- [x] Performans metrikleri + slotting + replenishment

### OMS Faz 2 — Sipariş & Kanal Entegrasyonu (Sırada)

- [ ] Stok allocation motoru + kanal bazlı bölüşüm kuralları
- [ ] Shopify entegrasyonu (6 mağaza — webhook sipariş alma + stok push)
- [ ] Amazon SP-API entegrasyonu (3 account — MFN sipariş)
- [ ] Etsy, Walmart, Wayfair sipariş entegrasyonları
- [ ] Wisersell geçiş planı ve paralel çalışma

---

<!-- _class: medium -->
### Faz 3 — Lojistik + İleri Analitik

- [ ] Kargo entegrasyonu (fiyat karşılaştırma, etiket, takip no)
- [ ] FBA Inbound Shipment yönetimi
- [ ] Demand forecasting
- [ ] Kanal karlılığı analizi
- [ ] bol.com, Takealot, Trendyol, Hepsiburada, TikTok Shop entegrasyonları

### Ek: Barkod & SKU Eşleme Tablosu

OMS tüm kanalların SKU kodlarını IWASKU ile eşleştirir:

| Kanal | Kanal SKU Tipi | Eşleme |
|-------|----------------|--------|
| Amazon | FNSKU, ASIN | FNSKU ↔ IWASKU |
| Shopify | Shopify SKU | Shopify SKU ↔ IWASKU |
| Etsy | Etsy SKU | Etsy SKU ↔ IWASKU |
| Walmart | Walmart SKU | Walmart SKU ↔ IWASKU |
| Wayfair | Wayfair SKU | Wayfair SKU ↔ IWASKU |
| bol.com | EAN | EAN ↔ IWASKU |
| WMS (SwiftStock) | IWASKU-SERIALNO | Doğrudan |

> Bu eşleme tablosu OMS içinde yönetilir. WMS her zaman IWASKU ile çalışır.
