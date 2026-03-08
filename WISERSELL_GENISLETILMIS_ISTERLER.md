# Wisersell — Genişletilmiş OMS + WMS Platform İsterleri

> **Belge Tipi:** Fonksiyonel Gereksinim Belgesi
> **Kapsam:** Wisersell tek platform — sipariş yönetimi + depo yönetimi + kanal entegrasyonları
> **Versiyon:** 1.0 | **Tarih:** 2026-03
> **Not:** Ayrı bir WMS uygulaması yoktur. Tüm depo yönetim yetenekleri Wisersell içindedir.

---

## 1. Platform Vizyonu

Wisersell; e-ticaret sipariş yönetimi (OMS), fiziksel depo operasyonları (WMS), çoklu kanal stok senkronizasyonu ve lojistik takibini **tek platformda** sunar.

```
┌─────────────────────────────────────────────────────────┐
│                      WİSERSELL                          │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  OMS Modülü │  │  WMS Modülü │  │ Entegrasyon │    │
│  │  Sipariş    │  │  Depo Ops   │  │  Katmanı    │    │
│  │  Yönetimi   │  │  Stok Takip │  │  Shopify    │    │
│  │  Allocation │  │  Transfer   │  │  Amazon     │    │
│  │  Kargo      │  │  Sayım      │  │  Etsy...    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Mobil / PWA  (Barkod Okuma, Depo Personeli)   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Stok Kimlik Standartları

### 2.1 IWASKU — Ana Stok Birimi

- Her ürün tipi için **IWASKU** kodu tanımlanır (sistem geneli tekil anahtar)
- Tüm modüller (OMS, WMS, kanal entegrasyonları) IWASKU üzerinden konuşur
- FNSKU, EAN, Shopify SKU, Etsy vb. harici kodlar IWASKU ile eşleştirilir

### 2.2 Seri Numarası (Zorunlu)

- Her ürün üretildiğinde **IWASKU + seri numarası** birlikte atanır
- Seri numarası sistem tarafından otomatik üretilir; aynı IWASKU'dan birden fazla adet üretildiğinde her birine ayrı seri no verilir
- Stok takibi tekil ürün (IWASKU + SN çifti) bazında yapılır

### 2.3 Barkod Yönetimi

- **Barkod formatı: `IWASKU-SERIALNO`** (sabit format — tek varyant)
- Zebra veya benzeri yazıcı entegrasyonu ile etiket basımı yapılır

---

## 3. Depo Yapısı

### 3.1 Fiziksel Depolar (Şirket Kontrolünde)

| Kod | Adı | Durum |
|-----|-----|-------|
| `FACTORY` | Fabrika Deposu (OSTİM) | Aktif |
| `TR` | TR Ana Sevk Deposu (Ankara İvedik) | Aktif |
| `NJ` | New Jersey Deposu | İlerde |
| `NL` | Hollanda Deposu | İlerde |
| `UK` | İngiltere Deposu | İlerde |

Yeni depo ekleme yazılım değişikliği gerektirmez — sistem konfigürasyonundan yapılır.

### 3.2 Fabrika Deposu Zone Yapısı

Her ürün kategorisi **kendi adıyla ayrı bir zone**'dur. Zone listesi `pricelab_db.products.category` değerlerinden otomatik türetilir:

| Zone (= Kategori Adı) |
|-----------------------|
| IWA Metal |
| IWA Ahşap |
| IWA Tabletop |
| CFW Metal |
| CFW Metal Üstü Ahşap |
| CFW Ahşap Harita |
| Shukran Cam |
| Trend Ahşap |
| Kanvas |
| Mobilya |
| Tekstil |
| Takı |
| İslami Takı |
| Döküm |
| Alsat |
| Montaj Atölyesi |
| Welter Atelier |
| XSarfs |
| Soba |
| Diğer |

**Kategori → Zone otomatik eşlemesi:**
- Ürün `FACTORY`'e kabul edilirken sistem `pricelab_db.products.category` değerini okur ve doğrudan zone olarak önerir
- Zone listesi ve isimleri pricelab_db'deki kategorilerle senkronize kalır; yeni kategori = otomatik yeni zone
- Personel önerilen zone'u onaylar ya da değiştirir

### 3.3 Pazar Yeri Depoları (Sanal Stok Noktaları)

WMS içinde sanal depo olarak tanımlanır; stok manuel veya API ile güncellenir:

```
US Citi FBA  | CA Citi FBA  | US MDN FBA  | UAE MDN FBA | AU MDN FBA
UK IWA FBA   | EU IWA FBA   | CA IWA FBA
US WAYFAIR MDN CG | US WF SH CG | ZA TAKEALOT
```

### 3.4 Lokasyon / Raf Sistemi

- Her depo içinde `ZONE > AISLE > BAY > LEVEL` hiyerarşisinde raf tanımlanır
- Her rafa QR kod basılır; mobil uygulama ile taranır
- Lokasyon tipleri: `RACK`, `FLOOR`, `RECEIVING`, `STAGING`

---

## 4. WMS Modülü — Depo Operasyonları

### 4.1 Temel Operasyon Modları

| Mod | Açıklama |
|-----|----------|
| **GİRİŞ (IN)** | Üretim alımı, satın alma, iade |
| **ÇIKIŞ (OUT)** | Sipariş çıkışı, sevkiyat |
| **SAYIM (COUNT)** | Stok doğrulama |
| **TRANSFER** | Raf arası / depo arası hareket |
| **PAKETLEME (PACK)** | Koli / palet oluşturma |
| **SEVKİYAT (SHIP)** | Sevkiyat hazırlama |

### 4.2 Üretim → Depo Akışı

1. Üretim tamamlandı → IWASKU + seri numarası atandı (sistem otomatik üretir)
2. `IWASKU-SERIALNO` formatında barkod etiketi yazdırıldı
3. Wisersell'e IN işlemi ile fabrika deposuna giriş yapıldı; ürünün kategorisinden zone otomatik önerildi

### 4.3 Warehouse Kabul (Receiving)

**Hızlı Kabul:**
- Barkod okutularak ürün anında sisteme alınır

**Geçici Havuz (Opsiyonel):**
- Ürünler önce `RECEIVING` lokasyonuna alınır, sonra raflara dağıtılır

### 4.4 Koli / Palet (Container) Yönetimi

**Oluşturma:**
- Kullanıcı anlamlı bir isim verir (örn. `FBA-BOX-01`, `TR-AMBALAJ-MART`, `NJ-PLT-045`)
- Sistem dahili barkod üretir; etiket bu kod üzerinden basılır
- Oluşturma sırasında **isteğe bağlı olarak bir sevkiyat (sanal depo) ile ilişkilendirilebilir**

**Sevkiyat ile İlişkilendirme:**
```
SANAL DEPO / SEVKİYAT  →  "US-FBA-MARCH-2026"
  ├── FBA-BOX-01  (koli)
  │     ├── IWASKU-A-000001
  │     └── IWASKU-A-000002
  └── FBA-BOX-02  (koli)
        └── IWASKU-B-000100
```
- Sevkiyata bağlı koliler sevkiyat detayında listelenir: kaç koli, toplam kaç ürün
- Sevkiyat transfer edildiğinde bağlı tüm koliler otomatik olarak birlikte hareket eder

**Toplu Hareket:**
- Koli/palet barkodu okunduğunda tüm içerik tek birim gibi hareket eder

**Container Kırma:**
- Koli içindeki tekil ürün müstakil taratılırsa → container dağıtılır, geri kalanlar tekil rafa işlenir

**Hiyerarşi:**
```
SEVKİYAT (Sanal Depo) [opsiyonel üst katman]
  └── PALET → KOLİ → ÜRÜN (IWASKU-SERIALNO)
```

### 4.5 Transfer

| Seviye | Açıklama |
|--------|----------|
| Ürün bazlı | Tekil IWASKU hareketi |
| Koli bazlı | Tüm koli birlikte |
| Palet bazlı | Tüm palet birlikte |

Transfer rotaları: raf arası, depo arası (FACTORY → TR, TR → NJ), depo → sanal depo

### 4.6 Cycle Count (Periyodik Sayım)

- Lokasyon, zone veya tam depo bazında sayım başlatılır
- Sistem stoku ile karşılaştırma yapılır, farklar kayıt altına alınır
- Sayım raporu oluşturulur

### 4.7 Sanal Depo — Transit Stok Takibi

- Sevkiyat başlarken kullanıcı sanal depo oluşturur (gemi adı, konteyner no, sevkiyat kodu — serbest metin)
- Koliler/paletler oluşturulurken veya sonradan bu sanal depoya bağlanır
- Ürünler koliler aracılığıyla sanal depoya yüklenir → transit stok sayıma dahil olur
- Sanal depo detay ekranında: bağlı koli listesi, toplam ürün adedi, hedef depo bilgisi izlenir
- Şirket deposuna ulaşınca hedef depoya transfer → sanal depo otomatik kapanır
- Pazar yeri deposuna gidenlerde (FBA vb.) manuel kapatma yapılır

---

## 5. OMS Modülü — Sipariş Yönetimi

### 5.1 Sipariş Akışı

```
Sipariş Alındı (Kanaldan)
       │
       ▼
Stok Kontrol & Allocation
       │
   ┌───┴───┐
Yeterli   Yetersiz
   │           │
   ▼           ▼
Rezerve    Uyarı / Kısmi
   │
   ▼
Picking Talimatı → WMS
   │
   ▼
Paketleme & Sevkiyat
   │
   ▼
Stok Güncelleme + Kanal Bildirimi
```

### 5.2 Stok Allocation Motoru

Sipariş geldiğinde hangi depodan karşılanacağı otomatik belirlenir:

**Kural Örnekleri:**
- Wayfair / Walmart siparişleri → yalnızca NJ Depo
- Shopify ABD → NJ → TR → FACTORY sırası
- Shopify TR → TR → FACTORY sırası
- Amazon MFN → belirlenmiş depoya göre

**Kanal Bazlı Stok Bölüşümü:**
- Her kanal için stok yüzdesi veya miktar limiti tanımlanır
- Örnek: stokun %20'si Amazon, %80'i Wayfair
- Belirli seviyenin altında ilgili kanalda stok sıfırlanır

### 5.3 Sipariş Durumları

`PENDING → ALLOCATED → PICKING → PACKED → SHIPPED → DELIVERED`

İptal, değişiklik, birleştirme işlemleri desteklenir.

### 5.4 Picking Workflow

- Sipariş WMS'e iletilir → personel picking listesini mobil uygulamada görür
- Barkod okutarak pick onaylanır
- Tamamlandığında stok düşer, sipariş durumu güncellenir

---

## 6. Kanal Entegrasyonları

### 6.1 Shopify (6 Mağaza)

| Mağaza | Hedef Depo |
|--------|------------|
| islamicwallartstore.com | TR, NJ |
| islamicwallart.com.tr | TR |
| colorfullworlds.com | TR, NJ |
| colorfullworldstr.com | TR |
| +2 mağaza | — |

- Sipariş webhook ile Wisersell'e alınır
- Stok Wisersell → Shopify senkronize edilir
- Kargo takip numarası Shopify'a iletilir

### 6.2 Amazon (3 Seller Account)

| Account | Pazar |
|---------|-------|
| Citi Global | US, CA |
| MDN LLC | US, UAE, AU |
| IWA Concept | UK, EU, CA |

- SP-API ile sipariş ve stok senkronizasyonu
- FBA Inbound Shipment takibi (sanal depo → FBA)
- MFN siparişleri Wisersell OMS'e düşer

### 6.3 Diğer Kanallar

| Kanal | Depo |
|-------|------|
| Etsy (MapWooda, MaplyArt) | TR, NJ |
| Walmart | NJ |
| Wayfair | NJ |
| bol.com | NL |
| Takealot | ZA TAKEALOT |
| Trendyol | TR (ilerde) |
| Hepsiburada | TR (ilerde) |
| TikTok Shop | — (ilerde) |

---

## 7. Stok Görünürlüğü

Tüm stok noktaları tek ekrandan izlenir:

| Stok Tipi | Açıklama |
|-----------|----------|
| Fiziksel | Şirket depolarındaki fiili stok |
| Transit | Sanal depodaki (yolda olan) stok |
| Pazar yeri | Amazon FBA, Wayfair vb. |
| Rezerve | Allocation yapılmış, henüz çıkmamış |
| Kullanılabilir | Fiziksel − Rezerve |

**Uyarılar:**
- Minimum stok seviyesi IWASKU bazında tanımlanır
- Seviye aşıldığında bildirim üretilir
- Kanal bazlı stok sıfırlama kuralı tetiklenebilir

---

## 8. İade Yönetimi (RMA)

- İade talebi OMS veya WMS üzerinden oluşturulabilir
- Akış: `REQUESTED → APPROVED → RECEIVED → COMPLETED`
- İade ürün WMS'de stoka geri alınır
- Neden ve durum kayıt altında tutulur

---

## 9. Mobil / PWA Uygulama

Wisersell'in WMS operasyon ekranı; depo personelinin kullandığı, barkod odaklı mobil/PWA arayüzüdür.

**Temel Yetenekler:**
- QR ve barkod okuma (kamera + HID tarayıcı)
- Hızlı IN/OUT/TRANSFER işlemleri
- Koli/palet oluşturma ve yönetimi
- Picking listesi görüntüleme ve onaylama
- Cycle count yürütme
- Offline tolerans (bağlantı kesildiğinde beklet, yeniden bağlandığında senkronize et)

**Cihaz Desteği:**
- Android / iOS
- Mobil web tarayıcısı (PWA)
- Masa üstü web (yönetim ekranları)

---

## 10. Kargo Entegrasyonu (İlerde)

- Kargo şirketi API'leri Wisersell'e entegre edilir
- Allocation kararından sonra kargo hesabı yapılır
- Kargo fiyatı karşılaştırması allocation kararını etkileyebilir
- Takip numarası otomatik olarak kanal ve müşteriye iletilir

---

## 11. Raporlama

| Rapor | Açıklama |
|-------|----------|
| Stok dağılımı | Depo bazında IWASKU stok durumu |
| Hareket geçmişi | Tüm IN/OUT/TRANSFER işlemleri |
| Sayım raporları | Cycle count sonuçları ve farklar |
| Sevkiyat raporları | Tamamlanan sevkiyatlar |
| Dead stock | Belirli süre hareketsiz ürünler |
| Inventory turnover | Stok devir hızı |
| Days of supply (DOS) | Kaç günlük stok kaldığı |
| Kanal performansı | Kanal bazlı sipariş ve stok analizi |

---

## 12. Kullanıcı Yönetimi & Erişim

| Rol | Yetkiler |
|-----|----------|
| `ADMIN` | Tüm sistem + konfigürasyon |
| `MANAGER` | Tüm operasyonlar, raporlar |
| `OPERATOR` | Depo operasyonları (barkod, transfer, sayım) |
| `VIEWER` | Salt okunur |

SSO ile merkezi kimlik doğrulama; Google OAuth desteklenir.

---

## 13. Gereksinim Önceliklendirme

### Faz 1 — WMS Çekirdek (Şu An Geliştiriliyor)

- [x] Çok depolu fiziksel stok yönetimi
- [x] Barkod/QR operasyonları (IN/OUT/TRANSFER/COUNT)
- [x] Lokasyon/raf sistemi
- [x] Koli/palet yönetimi
- [x] Sanal depo — transit stok takibi
- [x] Cycle count
- [x] Mobil/PWA operasyon ekranı
- [ ] Container kırma otomasyonu
- [ ] Seri no zorunlu hale getirme (backend + UI güncelleme)
- [ ] Container — kullanıcı adı + sevkiyat bağı (backend + UI)
- [ ] Kategori → Zone otomatik eşleme (pricelab_db entegrasyonu)

### Faz 2 — OMS + Kanal Entegrasyonu

- [ ] Sipariş alma ve yönetimi (OMS)
- [ ] Stok allocation motoru + kural yapılandırma
- [ ] Shopify entegrasyonu (6 mağaza)
- [ ] Amazon SP-API entegrasyonu (3 account)
- [ ] Etsy, Walmart, Wayfair entegrasyonları
- [ ] WMS ↔ OMS stok senkronizasyonu
- [ ] Picking workflow (OMS siparişi → WMS picking)

### Faz 3 — Lojistik + Analitik

- [ ] Kargo entegrasyonu
- [ ] FBA Inbound Shipment yönetimi
- [ ] Dead stock / DOS / turnover raporları
- [ ] Demand forecasting
- [ ] bol.com, Takealot, Trendyol entegrasyonları
