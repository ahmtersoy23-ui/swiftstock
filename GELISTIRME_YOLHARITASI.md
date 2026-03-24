# SwiftStock WMS — Gap Analizi & Fazlı Geliştirme Planı

## Context

SwiftStock WMS vizyonu (SWIFTSTOCK_VIZYON.md) ile mevcut kod arasındaki farkları, endüstri standartlarıyla karşılaştırarak tespit etmek ve fazlı bir geliştirme planı oluşturmak.

---

## 1. Mevcut Durum Özeti

### Backend: ✅ 8 modül, 80+ endpoint, tam çalışıyor
| # | Modül | Durum |
|---|-------|-------|
| 1 | Catalog + Barcoding | ✅ Tam |
| 2 | Warehouse + Locations + Containers | ✅ Tam |
| 3 | Orders + Picking | ✅ Tam |
| 4 | Inventory Core + Transactions | ✅ Tam |
| 5 | Cycle Count + Reports | ✅ Tam |
| 6 | Virtual Shipments | ✅ Tam |
| 7 | RMA / Returns | ✅ Tam |
| 8 | Operations + Scan Sessions | ✅ Tam |

### Frontend: ✅ 9 sayfa, PWA + Capacitor
| Sayfa | Durum | Not |
|-------|-------|-----|
| Dashboard (Home) | ✅ | Navigasyon grid — KPI yok |
| Operations | ✅ | Barcode workflow, zone suggestion, container naming |
| Inventory | ✅ | 4 sorgu modu (SKU/Location/Serial/Container) |
| Products | ✅ | Katalog + etiket basımı (JsBarcode) |
| Locations | ✅ | CRUD + zone filter |
| Reports | ✅ | Sayım + envanter raporu |
| Shipments | ✅ | Sanal depo + koli yönetimi |
| Transactions | ✅ | Hareket geçmişi + filtreler |
| Admin | ✅ | Kullanıcı yönetimi |

### Eksik Frontend Sayfaları (backend hazır, frontend yok):
- **Orders / Picking sayfası** — Backend tam, frontend yok (picking Operations'dan erişilebilir ama ayrı sayfa yok)
- **RMA / Returns sayfası** — Backend tam, frontend yok

---

## 2. Gap Analizi

### A. Vizyon Belgesi Eksikleri (SWIFTSTOCK_VIZYON.md Sec 13)

| # | Eksik | Backend | Frontend | Öncelik |
|---|-------|---------|----------|---------|
| A1 | **Orders / Picking sayfası** | ✅ Tam | ❌ Yok | Yüksek |
| A2 | **RMA / İade sayfası** | ✅ Tam | ❌ Yok | Yüksek |
| A3 | **Container kırma (dağıtma) otomasyonu** | ❌ Yok | ❌ Yok | Orta |
| A4 | **Container management UI (tam)** | ✅ Tam | ⚠️ Kısmi (Operations modal) | Orta |

### B. Endüstri Standardı Eksikleri (WMS Best Practices)

| # | Eksik | Açıklama | Etki |
|---|-------|----------|------|
| B1 | **Dashboard KPIs** | Gerçek zamanlı metrikler yok (picks/hour, dock-to-stock, accuracy) | Yüksek — görünürlük |
| B2 | **Wave / Batch picking** | Sadece tekil sipariş picking var; toplu sipariş gruplama yok | Yüksek — verimlilik |
| B3 | **Putaway optimizasyonu** | Zone önerisi var ama optimal raf önerisi yok (hız/boyut bazlı) | Orta |
| B4 | **Bildirim / Alert sistemi** | Low-stock endpoint var ama push notification yok | Yüksek — operasyonel farkındalık |
| B5 | **Excel / CSV export** | xlsx bağımlılığı var ama export butonları yok | Yüksek — raporlama |
| B6 | **Toplu (bulk) işlemler** | Tek tek tarama var; toplu transfer / toplu etiket basımı yok | Orta |
| B7 | **Etiket şablonu yönetimi** | Sabit 100×30mm format; farklı boyut/şablon seçimi yok | Düşük |
| B8 | **Offline operation queue** | PWA NetworkFirst cache var ama gerçek offline kuyruk yok | Orta |
| B9 | **Kabul inspeksiyonu (QC)** | Receiving = sadece barkod okut + kabul; kalite kontrol adımı yok | Düşük |
| B10 | **Kitting / Assembly** | Combo ürün oluşturma desteği yok (birden fazla SKU → tek SKU) | Düşük |
| B11 | **Pick path optimizasyonu** | Picking listesi lokasyon sırasına göre optimize edilmiyor | Orta |
| B12 | **Slotting optimizasyonu** | Yüksek hızlı ürünleri prime lokasyona yerleştirme önerisi yok | Düşük |
| B13 | **Replenishment kuralları** | Reserve → forward pick otomatik taşıma kuralı yok | Düşük |
| B14 | **İleri analitik** | Dead stock, DOS, inventory turnover, demand forecasting yok | Orta |
| B15 | **Performans dashboard** | Depo verimliliği KPI'ları yok (picker performance endpoint var ama UI yok) | Orta |

---

## 3. Fazlı Geliştirme Planı

### FAZ 1A — WMS Vizyon Tamamlama ⭐
> **Hedef:** Vizyon belgesindeki eksikleri kapatmak
> **Süre tahmini:** Orta
> **Bağımlılık:** Yok — backend hazır

**Todo listesi:**

- [ ] **Orders / Picking sayfası** (frontend)
  - Sipariş listesi (filtrelenebilir: status, date, picker)
  - Sipariş detay (ürün listesi, picking durumu)
  - Picker atama
  - Picking başlat / kaydet / tamamla
  - Picker performans özeti
  - Backend: `orders.routes.ts` — 9 endpoint hazır

- [ ] **RMA / İade sayfası** (frontend)
  - RMA listesi (filtrelenebilir: status, date)
  - RMA oluşturma formu (ürün + action: REFUND/REPLACE/REPAIR/DISCARD)
  - Onay akışı (PENDING → APPROVED → IN_PROCESS → COMPLETED)
  - İade kabul (barkod okutarak fiziksel kabul)
  - İade geçmişi
  - Backend: `returns.routes.ts` — 7 endpoint hazır

- [ ] **Container management UI** (tam)
  - Ayrı Container sayfası veya Inventory'ye entegre sekme
  - Container listesi (aktif/kapalı filtre)
  - Container oluşturma (display_name + tip + opsiyonel sevkiyat bağı)
  - Container içeriği görüntüleme
  - Container'a ürün ekleme/çıkarma
  - Container → sevkiyat bağlama

- [ ] **Container kırma otomasyonu** (backend + frontend)
  - Tekil ürün taratıldığında container otomatik dağıtılsın
  - Kalan ürünler tekil olarak mevcut lokasyona kaydedilsin
  - Dağıtılan container kapatılsın
  - Operations workflow'a entegre (useWorkflow hook)

---

### FAZ 1B — Operasyonel Verimlilik ⭐
> **Hedef:** Günlük operasyonları kolaylaştıran düşük efor / yüksek etki iyileştirmeler
> **Bağımlılık:** Yok

**Todo listesi:**

- [ ] **Dashboard KPIs**
  - Backend: Yeni `/api/v1/dashboard/stats` endpoint
    - Bugünkü hareket sayısı (IN/OUT/TRANSFER)
    - Bekleyen siparişler
    - Açık sayım oturumları
    - Düşük stoklu ürün sayısı
    - Aktif sevkiyatlar
    - Son 7 gün hareket grafiği verisi
  - Frontend: Home.tsx'i KPI kartlarına dönüştür
    - Sayısal metrik kartları (üst bölüm)
    - Mini trend grafikleri
    - Navigasyon kartları (alt bölüm — mevcut)

- [ ] **Bildirim / Alert sistemi**
  - Backend: `wms_alerts` tablosu (type, severity, message, is_read)
  - Backend: Otomatik alert üretimi: düşük stok, uzun süredir RECEIVING'de kalan ürün, bekleyen sayım
  - Frontend: Header'da bildirim ikonu + badge
  - Frontend: Bildirim listesi dropdown

- [ ] **Excel / CSV export**
  - Inventory sayfası: "Dışa Aktar" butonu → XLSX
  - Reports sayfası: Sayım raporu export
  - Transactions sayfası: Hareket geçmişi export
  - Products sayfası: Ürün listesi export
  - Backend: xlsx kütüphanesi zaten dependency'de

- [ ] **Toplu (bulk) işlemler**
  - Toplu transfer: Birden fazla ürünü seç → hedef depo seç → tek işlemle transfer
  - Toplu etiket basımı: Ürün listesinden çoklu seçim → toplu seri no üret + yazdır
  - Operations'a "çoklu tarama" modu

- [ ] **Etiket şablonu yönetimi**
  - Küçük (50×25mm), standart (100×30mm), büyük (100×50mm) şablon seçimi
  - Ürün adı gösterme/gizleme opsiyonu
  - QR code alternatifi (CODE128 yanında)

---

### FAZ 2A — İleri WMS Operasyonları
> **Hedef:** Depo verimliliğini artıran ileri özellikler
> **Bağımlılık:** Faz 1A (Orders sayfası gerekli)

**Todo listesi:**

- [ ] **Wave / Batch picking**
  - Backend: Birden fazla siparişi tek picking wave'e gruplama
  - Backend: Wave oluşturma algoritması (aynı SKU'lu siparişleri grupla)
  - Frontend: Wave listesi, wave detay, toplu pick onay
  - DB: `wms_pick_waves` tablosu

- [ ] **Putaway optimizasyonu**
  - Backend: Ürün hızına (velocity) göre lokasyon önerisi
  - Backend: Boyut/ağırlık bazlı raf uyumluluğu kontrolü
  - Frontend: Receiving sırasında "önerilen raf" gösterimi
  - Zone suggestion üzerine inşa (mevcut category-zone endpoint genişletilir)

- [ ] **Pick path optimizasyonu**
  - Backend: Picking listesindeki ürünleri lokasyon sırasına göre sırala
  - Aisle → Bay → Level sıralaması
  - Frontend: Sıralı picking listesi gösterimi

- [ ] **Offline operation queue**
  - Frontend: IndexedDB ile offline tarama kuyruğu
  - Bağlantı kesildiğinde taramaları yerel depola
  - Bağlantı geldiğinde sırayla sunucuya gönder
  - Çakışma tespiti ve uyarısı

- [ ] **Kabul inspeksiyonu (QC)**
  - Backend: Receiving'e opsiyonel QC adımı
  - Status: RECEIVED → QC_PENDING → QC_PASSED / QC_FAILED
  - Frontend: QC onay/red ekranı (hasar notu + fotoğraf)

- [ ] **Kitting / Assembly**
  - Backend: `wms_kit_definitions` tablosu (kit_sku → component SKUs)
  - Backend: Kit oluşturma = component SKU'lardan stok düş + kit SKU stok ekle
  - Frontend: Kit tanımlama + kit oluşturma operasyonu

---

### FAZ 2B — OMS Entegrasyon Altyapısı
> **Hedef:** OMS_ISTERLER.md ile uyumlu entegrasyon API'leri
> **Bağımlılık:** Faz 1A (Orders modülü)

**Todo listesi:**

- [ ] **Stok kontrol API** (OMS → WMS)
  - `GET /api/v1/oms/stock?sku=X&warehouse=Y` → kullanılabilir stok
  - Fiziksel − Rezerve = Kullanılabilir hesaplaması

- [ ] **Stok rezervasyon API** (OMS → WMS)
  - `POST /api/v1/oms/reserve` → sipariş için stok rezerve et
  - `DELETE /api/v1/oms/reserve/:reservation_id` → rezervasyon iptal
  - DB: `wms_reservations` tablosu

- [ ] **Picking talimatı API** (OMS → WMS)
  - `POST /api/v1/oms/pick-request` → sipariş bazlı picking talimatı
  - Mevcut orders modülünü OMS entegrasyonuna aç

- [ ] **Stok değişikliği bildirimi** (WMS → OMS)
  - Event-driven: Her IN/OUT/TRANSFER/COUNT sonrası webhook
  - `wms_webhooks` tablosu (url, event_type, is_active)
  - Retry mekanizması (3 deneme, exponential backoff)

- [ ] **Sevkiyat durumu bildirimi** (WMS → OMS)
  - Shipment status değişikliklerinde (CLOSED, SHIPPED) webhook

---

### FAZ 3 — Analitik & Zeka
> **Hedef:** Veri odaklı karar desteği
> **Bağımlılık:** Faz 1B (Dashboard), Faz 2B (OMS verisi)

**Todo listesi:**

- [ ] **Dead stock tespiti**
  - Backend: Son X gün hareket görmeyen ürünleri listele
  - Frontend: Dead stock rapor sayfası (filtrelenebilir: süre, depo, kategori)

- [ ] **Inventory turnover / DOS metrikleri**
  - Backend: IWASKU bazında stok devir hızı hesaplama
  - Backend: Days of Supply = mevcut stok / günlük ortalama çıkış
  - Frontend: Metrik kartları + sıralama

- [ ] **Performans dashboard'ları**
  - Picks per hour (picker bazlı)
  - Dock-to-stock time (receiving → rafa yerleşme süresi)
  - Order cycle time (sipariş → sevkiyat süresi)
  - Inventory accuracy (sayım sonuçlarından)
  - Frontend: Grafik/chart kütüphanesi (recharts veya chart.js)

- [ ] **Slotting optimizasyonu**
  - Yüksek hızlı ürünleri (çok hareket gören) prime lokasyonlara öner
  - Hareket verisinden velocity hesaplama
  - Önerilen yer değişikliği listesi

- [ ] **Replenishment kuralları**
  - Lokasyon bazında min/max stok seviyesi tanımla
  - Min altına düşünce reserve → forward pick transfer öner
  - Otomatik veya onaylı replenishment

---

## 4. Öncelik Matrisi

| Faz | Etki | Efor | Bağımlılık | Başlangıç |
|-----|------|------|------------|-----------|
| **1A** Vizyon tamamlama | ⭐⭐⭐ | Düşük-Orta (backend hazır) | Yok | Hemen |
| **1B** Operasyonel verimlilik | ⭐⭐⭐ | Düşük-Orta | Yok | Hemen (paralel) |
| **2A** İleri operasyonlar | ⭐⭐ | Orta-Yüksek | Faz 1A | Faz 1A sonrası |
| **2B** OMS entegrasyon | ⭐⭐⭐ | Orta | Faz 1A | Faz 1A sonrası |
| **3** Analitik | ⭐ | Orta | Faz 1B, 2B | En son |

---

## 5. Dosya Referansları

### Backend
- Routes: `backend/src/routes/*.routes.ts`
- Modules: `backend/src/modules/{catalog,warehouse,orders,inventory-core,quality,shipments,returns,operations}/`
- Migration: `backend/src/migrations/010_create_missing_wms_tables.sql`
- Shared: `backend/src/modules/shared/services/` (product, warehouse, user)
- Events: `backend/src/modules/shared/events/event-bus.ts`

### Frontend
- Pages: `frontend/src/pages/` (Home, Operations/, Products, Inventory, Locations, Reports, Shipments, Transactions, Admin)
- API: `frontend/src/lib/api/` (14 modül)
- Stores: `frontend/src/stores/` (appStore, ssoStore)
- Types: `frontend/src/types/index.ts`

### Vizyon & İsterler
- WMS Vizyon: `SWIFTSTOCK_VIZYON.md`
- OMS İsterler: `OMS_ISTERLER.md`
- Sistem İsterler: `SISTEM_ISTERLER.md`

## Kaynaklar (Endüstri Araştırması)
- [WMS Implementation Checklist 2026 — WareGo](https://warego.co/blog/wms-implementation-checklist/)
- [15 Warehouse Management Best Practices 2026 — LogiMax](https://www.logimaxwms.com/blog/warehouse-management-best-practices/)
- [Complete WMS Features Checklist — ExploreWMS](https://www.explorewms.com/complete-wms-modules-and-features-checklist.html)
- [Top 38 Warehouse KPIs 2026 — Hopstack](https://www.hopstack.io/blog/warehouse-metrics-kpis)
- [Warehouse Picking Strategies — LaceUp](https://www.laceupsolutions.com/optimizing-warehouse-efficiency-an-overview-of-wms-picking-strategies/)
- [WMS Features & Requirements Guide — ExploreWMS](https://www.explorewms.com/complete-wms-features-and-requirements-guide.html)
