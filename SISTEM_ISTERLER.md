# Stok & Sipariş Yönetim Sistemi — Fonksiyonel İsterler

> **Belge Tipi:** Fonksiyonel Gereksinim Belgesi
> **Kapsam:** Uçtan uca stok ve sipariş yönetimi — üretimden müşteri teslimatına
> **Versiyon:** 1.0 | **Tarih:** 2026-03

---

## 1. Sistem Genel Bakışı

Sistem iki ana katmandan oluşur:

| Katman | Sistem | Sorumluluk |
|--------|--------|------------|
| **OMS** | Wisersell | Sipariş yönetimi, kanal entegrasyonları, müşteri yönü |
| **WMS** | SwiftStock (alt yetenek) | Fiziksel stok, depo operasyonları, transfer, sevkiyat |

```
[PAZARYERLER]        [OMS — Wisersell]        [WMS — SwiftStock]
  Shopify    ──────►  Sipariş Alma    ──────►  Stok Rezervasyon
  Amazon     ──────►  Sipariş Yönet  ──────►  Picking
  Etsy       ──────►  Stok Sync      ◄──────  Stok Bildir
  Walmart    ◄──────  Stok Gönder    ──────►  Sevkiyat
  ...                                          Depo Operasyonları
```

---

## 2. Stok Kimlik Standartları

### 2.1 IWASKU — Ana Stok Birimi

- Her fiziksel ürün tipi için sistem genelinde tekil bir **IWASKU** kodu tanımlanır
- IWASKU, tüm sistemler (WMS, OMS, pazaryerleri) arasında ortak anahtar olarak kullanılır
- Barkod formatı: `IWASKU` veya `IWASKU-SERIALNO`

### 2.2 Seri Numarası

- İsteğe bağlı olarak ürün bazında seri numarası atanabilir
- Seri numarası ile tekil ürün takibi yapılabilir
- Sistem, seri numarasız çalışmayı da destekler

### 2.3 Barkod Yönetimi

- FNSKU (Amazon), EAN, SKU ve IWASKU barkodları sistem içinde eşleştirilir
- Üretim aşamasında her ürüne barkod etiketi yazdırılır
- Zebra veya benzeri barkod yazıcısı entegrasyonu desteklenir

---

## 3. Depo Yapısı Gereksinimleri (WMS — SwiftStock)

### 3.1 Fiziksel Depolar

Sistem aşağıdaki depo türlerini destekler:

**Şirket Depoları:**

| Kod | Adı | Açıklama |
|-----|-----|----------|
| `FACTORY` | Fabrika Deposu | Üretim çıkışı, barkodlama noktası |
| `TR` | TR Ana Sevk Deposu | Ankara İvedik — ana operasyon merkezi |
| `NJ` | New Jersey Deposu | ABD sevkiyat merkezi |
| `NL` | Hollanda Deposu | Avrupa sevkiyat merkezi |
| `UK` | İngiltere Deposu | UK sevkiyat merkezi |

**Genişletilebilirlik:** Yeni depo eklemek sistem konfigürasyonu değişikliği ile yapılabilir, yazılım değişikliği gerektirmez.

### 3.2 Fabrika Deposu — Zone Yapısı

Fabrika deposu tek warehouse olarak tanımlanır; içinde zone/alan ayrımı yapılır:

| Zone | Alan Adı |
|------|----------|
| `METAL` | Metal Üretim Alanı |
| `AHSAP_UV` | Ahşap UV Koridor |
| `AHSAP_GIRIS` | Ahşap Giriş Kat |
| `HARITA` | Harita Alanı (Cam/Ahşap/UV) |
| `TABLETOP` | Tabletop Alanı |

### 3.3 Pazar Yeri Depoları

Pazar yeri depoları WMS'de sanal stok noktaları olarak tanımlanır. Manuel veya API ile stok girişi yapılır:

```
US Citi FBA  | CA Citi FBA  | US MDN FBA  | UAE MDN FBA | AU MDN FBA
UK IWA FBA   | EU IWA FBA   | CA IWA FBA
US WAYFAIR MDN CG | US WF SH CG | ZA TAKEALOT
```

### 3.4 Lokasyon (Raf) Sistemi

- Her depo içinde `ZONE > AISLE > BAY > LEVEL` hiyerarşisinde lokasyon tanımlanır
- Her lokasyona QR kod basılır ve sisteme işlenir
- Desteklenen lokasyon tipleri: `RACK`, `FLOOR`, `RECEIVING`, `STAGING`

---

## 4. Üretim → WMS Akışı

### 4.1 Üretim Çıkışı

1. Üretim birimi ürünü tamamlar
2. Her ürüne IWASKU bazlı barkod atanır (isteğe bağlı seri numarası eklenir)
3. Barkod etiketi yazdırılır
4. Ürün WMS'e **IN** işlemi ile fabrika deposuna giriş yapılır

### 4.2 Koli / Palet (Container) Yönetimi

**Oluşturma:**
- Sistem üzerinden yeni koli veya palet oluşturulur
- Otomatik barkod üretilir: `KOL-XXXXX` / `PAL-XXXXX`
- Ürünler tek tek barkod okutularak koli/palete eklenir

**Toplu Hareket:**
- Koli/palet barkodu okutulduğunda tüm içerik tek birim gibi hareket eder
- Transfer, sevkiyat, raf atama koli kodu ile yapılabilir

**Container Dağıtma (Kırma):**
- Koli içindeki tekil bir ürün müstakil taratıldığında:
  - Container otomatik dağıtılır
  - Geri kalan ürünler tekil olarak mevcut rafa kaydedilir
  - Container kapatılır

**Hiyerarşi:** `PALET → KOLİ → ÜRÜN`

### 4.3 Warehouse Kabul (Receiving)

**Hızlı Kabul:**
- Gelen ürün/koli/paletler barkod okutularak sisteme alınır
- Minimum tıklama, maksimum hız hedeflenir

**Geçici Havuz (Opsiyonel):**
- Ürünler önce `RECEIVING` havuz lokasyonuna alınır
- Raflara yerleştirme sonraki adımda yapılır

---

## 5. Depo İçi Operasyonlar (WMS)

### 5.1 Operasyon Modları

| Mod | Kod | Açıklama |
|-----|-----|----------|
| Giriş | `IN` | Ürün alımı, üretim girişi |
| Çıkış | `OUT` | Satış, sevkiyat çıkışı |
| Sayım | `COUNT` | Stok sayımı ve doğrulama |
| Transfer | `TRANSFER` | Lokasyonlar/depolar arası |
| Paketleme | `PACK` | Koli/palet oluşturma |
| Sevkiyat | `SHIP` | Sevkiyat hazırlama |

### 5.2 Transfer Türleri

| Seviye | Açıklama |
|--------|----------|
| Ürün bazlı | Tekil IWASKU hareketi |
| Koli bazlı | Tüm koli içeriği birlikte |
| Palet bazlı | Tüm palet içeriği birlikte |

**Desteklenen Rotalar:**
- Raflar arası (aynı depo)
- Depolar arası (FACTORY → TR, TR → NJ vb.)
- Depo → Sanal Depo (sevkiyat hazırlığı)

### 5.3 Cycle Count (Periyodik Sayım)

- Lokasyon, zone veya tüm depo bazında sayım başlatılabilir
- Sayım sonuçları sistem stoku ile karşılaştırılır
- Fark tespit edildiğinde düzeltme işlemi yapılır ve kayıt altına alınır
- Sayım raporları oluşturulur ve arşivlenir

---

## 6. Sanal Depo — Sevkiyat Takibi (WMS)

### 6.1 Sanal Depo Oluşturma

- Kullanıcı serbest isimle sanal depo oluşturur (gemi adı, konteyner no, sevkiyat kodu vb.)
- Örnek: `SHIP-ISTANBUL-2026-03`, `CNT-NJPOR-0045`

### 6.2 Ürün Yükleme

- Ürünler/koliler/paletler sanal depoya transfer edilir
- Transit stok, sistem genelindeki stok görünürlüğüne dahil edilir

### 6.3 Kapatma

| Hedef | Kapatma Yöntemi |
|-------|-----------------|
| Şirket deposu | Hedef depoya transfer → otomatik kapanır |
| Pazar yeri deposu | Manuel kapatma (ilerde API entegrasyonu) |

---

## 7. OMS Gereksinimleri (Wisersell)

### 7.1 Sipariş Yönetimi

- Tüm satış kanallarından gelen siparişler tek ekranda yönetilir
- Sipariş durumu takibi: `PENDING → ALLOCATED → PICKING → SHIPPED → DELIVERED`
- Sipariş iptal, değişiklik ve birleştirme işlemleri
- Müşteri bilgisi ve teslimat adresi yönetimi

### 7.2 Stok Allocation (OMS Kararı)

Sipariş alındığında OMS şu kararı verir:

- Sipariş hangi depodan karşılanacak?
- Stok yeterli mi? Yeterliyse rezerve et
- Yeterli değilse: uyarı ver veya kısmi karşıla

**Allocation Kural Örnekleri:**
- Wayfair / Walmart siparişleri → yalnızca NJ Depo
- Shopify (ABD) → NJ → TR → FACTORY sırası
- Shopify (TR) → TR → FACTORY sırası
- Amazon FBA → pazar yeri deposundan doğrudan (WMS müdahalesi yok)

**Kanal Bazlı Stok Bölüşümü:**
- Her kanal için stok yüzde/miktar limiti tanımlanabilir
- Örnek: Toplam stokun %20'si Amazon, %80'i Wayfair için ayrılır
- Belirli stok seviyesinin altına düşünce ilgili kanala stok sıfırlanır

### 7.3 OMS → WMS Entegrasyonu

```
Sipariş Oluştu (OMS)
       │
       ▼
Stok Kontrol (WMS API)
       │
   ┌───┴───┐
Yeterli   Yetersiz
   │           │
   ▼           ▼
Rezerve    OMS Uyarı
(WMS)
   │
   ▼
Picking Talimatı (WMS)
   │
   ▼
Paketleme & Sevkiyat (WMS)
   │
   ▼
Stok Düşme + Durum Güncelleme (OMS)
```

### 7.4 WMS → OMS Stok Bildirimi

- Stok hareketleri (IN, OUT, TRANSFER, COUNT düzeltme) OMS'e bildirilir
- OMS, güncel stok bilgisini pazaryerlerine iletir
- Bildirim frekansı: gerçek zamanlı veya periyodik (yapılandırılabilir)

---

## 8. Kanal Entegrasyonları (OMS Katmanı)

### 8.1 Shopify (6 Mağaza)

| Mağaza | URL | Hedef Depo |
|--------|-----|------------|
| IWA Store | islamicwallartstore.com | TR, NJ |
| IWA TR | islamicwallart.com.tr | TR |
| CW Global | colorfullworlds.com | TR, NJ |
| CW TR | colorfullworldstr.com | TR |
| + 2 mağaza | — | — |

- Sipariş webhook ile OMS'e alınır
- Stok seviyeleri OMS → Shopify senkronize edilir
- Kargo takip numarası Shopify'a gönderilir

### 8.2 Amazon (3 Seller Account)

| Account | Pazar | FBA Depoları |
|---------|-------|--------------|
| Citi Global | US, CA | US Citi FBA, CA Citi FBA |
| MDN LLC | US, UAE, AU | US MDN FBA, UAE MDN FBA, AU MDN FBA |
| IWA Concept | UK, EU, CA | UK IWA FBA, EU IWA FBA, CA IWA FBA |

- SP-API ile sipariş ve stok senkronizasyonu
- FBA Inbound Shipment yönetimi (sanal depo → FBA)
- MFN (Merchant Fulfilled) siparişleri WMS'e iletilir

### 8.3 Diğer Kanallar

| Kanal | Entegrasyon Yöntemi | Depo |
|-------|---------------------|------|
| Etsy (MapWooda, MaplyArt) | API | TR, NJ |
| Walmart | API | NJ |
| Wayfair | API | NJ |
| bol.com | API | NL |
| Takealot | API | — (ZA TAKEALOT) |
| Trendyol | API (ilerde) | TR |
| Hepsiburada | API (ilerde) | TR |
| TikTok Shop | API (ilerde) | — |

---

## 9. Wisersell Entegrasyonu

### 9.1 Geçiş Dönemi

- Wisersell aktif kullanımdayken WMS paralel çalışır
- Wisersell'den kapanan siparişler → WMS'e stok düşme bildirimi
- Çakışma yönetimi: aynı sipariş iki sistemde işlenmez

### 9.2 Uzun Vadeli

- Wisersell OMS katmanı olarak kullanılmaya devam eder veya kendi OMS modülüne geçilir
- Bu karar operasyonel deneyime göre verilir

---

## 10. Stok Görünürlüğü

### 10.1 Anlık Stok Durumu

Tüm stok noktaları tek görünümden izlenebilir:

| Stok Tipi | Açıklama |
|-----------|----------|
| Fiziksel stok | FACTORY, TR, NJ, NL, UK depolarındaki miktar |
| Transit stok | Sanal depolardaki (sevkiyatta olan) miktar |
| Pazar yeri stoku | Amazon FBA, Wayfair vb. — API veya manuel giriş |
| Rezerve stok | OMS tarafından allocation yapılmış, henüz çıkmamış |
| Kullanılabilir stok | Fiziksel - Rezerve |

### 10.2 Düşük Stok Uyarıları

- Her IWASKU için minimum stok seviyesi tanımlanabilir
- Seviye aşıldığında sistem uyarı üretir
- Kanal bazlı stok sıfırlama kuralı tetiklenebilir

### 10.3 Raporlama

| Rapor | Açıklama |
|-------|----------|
| Stok dağılımı | Depo bazında IWASKU stok durumu |
| Hareket geçmişi | Tüm IN/OUT/TRANSFER işlemleri |
| Sayım raporları | Cycle count sonuçları ve farklar |
| Sevkiyat raporları | Tamamlanan sevkiyatlar |
| Dead stock | Belirli süre hareketsiz ürünler |
| Inventory turnover | Stok devir hızı |
| Days of supply (DOS) | Kaç günlük stok kaldığı |

---

## 11. İade Yönetimi (RMA)

- İade talebi OMS veya WMS üzerinden oluşturulabilir
- İade onay akışı: `REQUESTED → APPROVED → RECEIVED → COMPLETED`
- İade edilen ürün WMS'de stoka geri alınır
- İade nedeni ve durumu kayıt altına alınır

---

## 12. Kullanıcı Yönetimi

| Rol | Yetkiler |
|-----|----------|
| `ADMIN` | Tüm sistem ayarları + tüm operasyonlar |
| `MANAGER` | Tüm operasyonel işlemler, raporlar |
| `OPERATOR` | Barkod okutma, transfer, sayım |
| `VIEWER` | Salt okunur sorgu |

- SSO ile merkezi kimlik doğrulama (Google OAuth)
- Rol bazlı erişim kontrolü hem OMS hem WMS için geçerli

---

## 13. Kargo Entegrasyonu (İlerde)

- Kargo şirketi API'leri OMS veya WMS'e entegre edilir
- Siparişin hangi depodan çıkacağı belirlendikten sonra kargo hesabı yapılır
- Kargo fiyatı karşılaştırması siparişin nereden karşılanacağı kararını etkileyebilir
- Takip numaraları OMS → pazaryeri aktarılır

---

## 14. İleri Analitik (İlerde)

| Özellik | Açıklama |
|---------|----------|
| Demand forecasting | Geçmiş satış verisinden stok ihtiyacı tahmini |
| Reorder point | Otomatik yenileme eşiği hesaplama |
| Sezonsal planlama | Kampanya ve dönemsel talep analizi |
| Kanal karlılığı | Kanal bazlı maliyet ve gelir analizi |

---

## 15. Sistem Gereksinimleri Özeti

### WMS (SwiftStock) Kapsamı

- [x] Çok depolu fiziksel stok yönetimi (FACTORY, TR + genişletilebilir)
- [x] Barkod/QR tabanlı operasyonlar
- [x] Koli/palet (container) yönetimi
- [x] Lokasyon/raf sistemi
- [x] IN / OUT / TRANSFER / COUNT / PACK / SHIP modları
- [x] Sanal depo — transit stok takibi
- [x] Cycle count
- [x] RMA / iade yönetimi
- [x] Seri numarası takibi
- [ ] Container kırma (dağıtma) otomasyonu
- [ ] Container management UI (mevcut: sadece sorgulama)

### OMS Entegrasyon Kapsamı (Wisersell + SwiftStock)

- [ ] OMS → WMS sipariş iletimi
- [ ] WMS → OMS stok bildirimi
- [ ] Stok allocation kuralları motoru
- [ ] Kanal bazlı stok bölüşüm kuralları
- [ ] Pazaryeri stok senkronizasyonu (Shopify, Amazon, Etsy…)
- [ ] FBA Inbound Shipment yönetimi
- [ ] Kargo entegrasyonu

### Raporlama Kapsamı

- [x] Sayım raporları
- [x] İşlem geçmişi
- [ ] Dead stock
- [ ] Inventory turnover / DOS
- [ ] Kanal bazlı stok görünürlüğü
