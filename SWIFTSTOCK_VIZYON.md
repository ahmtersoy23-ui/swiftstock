# SwiftStock WMS — Sistem Vizyonu

> **Kapsam:** WMS (Depo Yönetimi) + OMS Entegrasyon API + Analitik
> **Versiyon:** 2.0 | **Tarih:** 2026-03-25

---

## 1. Genel Mimari

SwiftStock; üretimden sevkiyata kadar tüm fiziksel stok hareketini takip eden, çok depolu, barkod tabanlı bir Depo Yönetim Sistemi (WMS)'dir.

```
ÜRETİM → FACTORY → TR (Ana Sevk) ──┬── NJ Depo ── Pazar Yeri (USA / FBA)
                                    ├── NL Depo
                                    ├── UK Depo
                                    └── Pazar Yeri (USA / FBA)

Sevkiyat rotaları:
  TR  → NJ / NL / UK (depo transferi)  +  USA / FBA (pazar yeri)
  NJ  → USA / FBA (pazar yeri) only
  FACTORY / UK / NL → çıkış sevkiyatı yapılamaz
```

---

## 2. Stok Kimlik Yapısı

| Alan | Açıklama | Kullanım |
|------|----------|----------|
| **IWASKU** (Product ID) | Ürün kimliği — ana stok birimi | Zorunlu |
| **Seri Numarası** | Tekil ürün takibi | Zorunlu |

- Her ürün üretildiğinde **IWASKU + seri numarası** birlikte atanır
- Seri numarası sistem tarafından otomatik üretilir; aynı IWASKU'dan birden fazla adet üretildiğinde her birine ayrı seri no verilir
- Stok takibi tekil ürün (IWASKU + SN çifti) bazında yapılır
- **Barkod formatı: `IWASKU-SERIALNO`** (sabit format — tek varyant)

---

## 3. Depo Yapısı

### 3.1 Fiziksel Depolar (Şirket Depoları)

| Kod | Adı | Tip | Durum |
|-----|-----|-----|-------|
| `FACTORY` | Fabrika Deposu (OSTİM) | Şirket | Aktif |
| `TR` | TR Ana Sevk Deposu (Ankara İvedik) | Şirket | Aktif |
| `NJ` | New Jersey Deposu | Şirket | Aktif |
| `NL` | Hollanda Deposu | Şirket | Aktif |
| `UK` | İngiltere Deposu | Şirket | Aktif |

---

### 3.2 Fabrika Deposu — Zone Yapısı

**Karar: Tek warehouse + zone bazlı lokasyon** (ayrı depolar yerine)

Her ürün kategorisi **kendi adıyla ayrı bir zone**'dur. Zone listesi `pricelab_db.products.category` değerlerinden otomatik türetilir:

| Zone (= Kategori Adı) |
|-----------------------|
| IWA Metal |
| IWA Ahşap |
| IWA Tabletop |
| CFW Metal |
| CFW Ahşap Harita |
| Shukran Cam |
| Kanvas |
| Mobilya |
| Döküm |
| Alsat |
| Montaj Atölyesi |
| Diğer |

**Kategori → Zone otomatik eşlemesi:**
- Ürün `FACTORY`'e kabul edilirken sistem `pricelab_db.products.category` değerini okur ve doğrudan zone olarak önerir
- Zone listesi ve isimleri pricelab_db'deki kategorilerle senkronize kalır; yeni kategori = otomatik yeni zone
- Personel önerilen zone'u onaylar ya da değiştirir

**Gerekçe:** Tek warehouse = tek stok sorgusu, tek rapor, tek API. Zone field ile fiziksel ayrım sistem içinde karşılanır.

---

### 3.3 Pazar Yeri Depoları (İlerde — DataBridge üzerinden)

Manuel veya API ile eklenecek sanal stok noktaları:

```
US Citi FBA  | CA Citi FBA  | US MDN FBA   | UAE MDN FBA  | AU MDN FBA
UK IWA FBA   | EU IWA FBA   | CA IWA FBA
US WAYFAIR MDN CG | US WF SH CG | ZA TAKEALOT
```

---

## 4. Üretim Aşaması

1. Üretim birimi ürünü üretir
2. Her ürüne **IWASKU + seri numarası** atanır (sistem otomatik üretir)
3. `IWASKU-SERIALNO` formatında barkod etiketi yazdırılır (Zebra veya benzeri)
4. Ürün sisteme **IN** işlemi ile fabrika deposuna alınır; kategori bilgisinden zone otomatik önerilir

---

## 5. Koli / Palet (Container) Yönetimi

### 5.1 Oluşturma
- Sistem üzerinden yeni koli veya palet oluşturulur
- **Kullanıcı anlamlı bir isim verir** (örn. `FBA-BOX-01`, `TR-AMBALAJ-MART`, `NJ-PLT-045`)
- Sistem aynı zamanda dahili bir barkod üretir; etiket bu kod üzerinden basılır
- İsim benzersiz olmalıdır; sistem çakışma uyarısı verir
- Oluşturma sırasında **isteğe bağlı olarak bir sevkiyat (sanal depo) ile ilişkilendirilebilir**

---

### 5.2 Sevkiyat ile İlişkilendirme
Koli/palet, bir sanal depo (sevkiyat) altına bağlanabilir:
```
SANAL DEPO / SEVKİYAT  →  "US-FBA-MARCH-2026"
  ├── FBA-BOX-01  (koli)
  │     ├── IWASKU-A-000001
  │     └── IWASKU-A-000002
  └── FBA-BOX-02  (koli)
        └── IWASKU-B-000100
```
- Koli oluşturulurken mevcut sevkiyatlardan biri seçilir (zorunlu değil, sonradan da atanabilir)
- Sevkiyata bağlı koliler sevkiyat detayında listelenir: kaç koli, toplam kaç ürün
- Sevkiyat transfer edildiğinde bağlı tüm koliler otomatik olarak birlikte hareket eder

---

### 5.3 Toplu Hareket
- Koli/palet barkodu okutulduğunda **tüm içerik tek birim** gibi hareket eder
- Transfer, sevkiyat, raf atama: koli adı/kodu ile yapılır

### 5.4 Container Dağıtma (Kırma)
- Koli/palet içindeki **tekil bir ürün** müstakil olarak taratılırsa:
  - Container otomatik olarak **dağıtılır**
  - Geri kalan ürünler **tekil** olarak bulundukları rafa kaydedilir
  - Dağıtılan container kapatılır

---

### 5.5 Hiyerarşi
```
SEVKİYAT (Sanal Depo)
  └── PALET → KOLİ → ÜRÜN (IWASKU-SERIALNO)
```
- Palet içinde koli olabilir
- Koli içinde ürün olur
- Sevkiyat ilişkisi opsiyonel üst katmandır

---

## 6. Warehouse Kabul Süreci (Receiving)

### 6.1 Hızlı Kabul
- Gelen ürünler/koliler barkod okutularak sisteme alınır
- Hedef: hız — minimum tıklama, maksimum verim

### 6.2 Geçici Havuz (Opsiyonel)
- Ürünler önce **RECEIVING** havuz lokasyonuna alınabilir
- Daha sonra raf yerleştirme yapılır
- Havuzda bekleyen stok raporlardan görülür

---

## 7. Raf Sistemi

- Her warehouse içinde **lokasyon/raf** hiyerarşisi tanımlanır
- Lokasyon yapısı: `ZONE > AISLE > BAY > LEVEL`; eski depolarda kullanılan düzen devam edebilir
- Her lokasyona QR kod basılır
- Ürünler spesifik raflara atanır

### 7.1 Desteklenen Lokasyon Türleri
- `RACK` — Standart raf
- `FLOOR` — Zemin
- `RECEIVING` — Giriş havuzu
- `STAGING` — Sevkiyat hazırlık

---

## 8. Transfer Türleri

| Seviye | Örnek | Açıklama |
|--------|-------|----------|
| **Ürün bazlı** | A Rafı → B Rafı | Tekil IWASKU transferi |
| **Koli bazlı** | KOL-00123 → TR Depo | Tüm koli bir arada |
| **Palet bazlı** | PAL-00045 → NJ Depo | Tüm palet bir arada |

### 8.1 Transfer Rotaları
- Raflar arası (aynı warehouse)
- Depolar arası: FACTORY → TR, TR → NJ / NL / UK
- Warehouse → Sanal Warehouse (sevkiyat hazırlığı): TR veya NJ'den başlatılır

---

## 9. Sanal Warehouse (Sevkiyat Takibi)

### 9.1 Oluşturma
- Yalnızca **TR** ve **NJ** depolarından sevkiyat başlatılabilir
- Ad: serbest prefix (gemi adı, konteyner no, sevkiyat kodu — koli barkoduna önek olur)
- Örnekler: `IST`, `NYC`, `CNT-NJ`

---

### 9.2 Rota Kuralları

| Kaynak | Hedef Seçenekleri |
|--------|-------------------|
| **TR** | NJ Deposu / NL Deposu / UK Deposu / ABD Pazar (USA) / Amazon FBA |
| **NJ** | ABD Pazar (USA) / Amazon FBA only |
| FACTORY / UK / NL | — (çıkış sevkiyatı yapılamaz) |

---

### 9.3 Yükleme
- Koliler oluşturulurken hedef belirlenir (NJ / NL / UK / USA / FBA)
- Koliler sanal depoya bağlanır → transit stok sayıma dahil olur

### 9.4 Kapatma
- **Şirket deposuna ulaşanlar** (NJ/NL/UK): Hedef depoya transfer → sanal depo kapanır
- **Pazar yeri depolarına gidenler** (USA/FBA): Manuel kapatma

---

## 10. Stok Görünürlüğü

- Stok her an tüm warehouse yapısında görülür:
  - Fiziksel depolar (FACTORY, TR, NJ…)
  - Sanal depolar (transit)
  - Raf bazlı dağılım
- IWASKU bazlı toplam stok + lokasyon dağılımı
- Tekil ürün (IWASKU-SERIALNO) nerede, hangi rafta takip edilebilir

---

## 11. Kullanıcı Rolleri

| Rol | Yetkiler |
|-----|----------|
| `ADMIN` | Tüm işlemler + sistem yönetimi |
| `MANAGER` | Tüm operasyonel işlemler |
| `OPERATOR` | Barkod okutma, transfer, sayım |
| `VIEWER` | Salt okunur sorgu |

---

## 12. OMS Entegrasyon API (Faz 2B — Tamamlandı)

SwiftStock, OMS sistemleriyle standart REST API üzerinden iletişim kurar.

### 12.1 OMS → WMS (Talimat Yönü)

| Endpoint | Açıklama |
|----------|----------|
| `GET /oms/stock` | IWASKU + depo bazında kullanılabilir stok sorgula (fiziksel − rezerve) |
| `POST /oms/reserve` | Sipariş için stok rezerve et |
| `DELETE /oms/reserve/:id` | Rezervasyon iptal |
| `POST /oms/pick-request` | Sipariş bazlı picking talimatı oluştur |

### 12.2 WMS → OMS (Bildirim Yönü — Webhook)

| Event | Tetikleyici |
|-------|-------------|
| `STOCK_CHANGE` | Her IN/OUT/TRANSFER/COUNT sonrası |
| `SHIPMENT_STATUS` | Sevkiyat durumu değişikliği |
| `ORDER_STATUS` | Picking tamamlandı, sipariş durumu değişti |

Webhook retry: 3 deneme, exponential backoff. `wms_webhook_logs` ile audit trail.

---

## 13. Analitik & Zeka (Faz 3 — Tamamlandı)

### 13.1 Birleşik Stok Görünümü
- IWASKU bazlı tüm stok noktaları tek ekranda: fiziksel + transit + FBA + Wayfair CG + diğer marketplace
- Amazon FBA: `pricelab_db.fba_inventory` üzerinden (DataBridge sync, 8 saatte bir)
- Wayfair CG + diğer: `wms_marketplace_stock` push API (DataBridge → SwiftStock)
- XLSX export

### 13.2 Dead Stock Tespiti
- Son X gün hareket görmeyen ürünler (depo bazlı filtreleme)

### 13.3 Inventory Turnover / DOS
- Days of Supply = mevcut stok / günlük ortalama çıkış
- Stok devir hızı (turnover ratio)

### 13.4 Performans Metrikleri
- Hareket hacmi (IN/OUT/TRANSFER ayrı)
- Toplayıcı performansı (sipariş sayısı, ortalama süre)
- Sayım doğruluğu (%)
- Günlük trend chart

### 13.5 Slotting Optimizasyonu
- Yüksek hızlı ürünleri prime lokasyona taşıma önerisi (velocity bazlı)

### 13.6 Replenishment
- Min stok seviyesi altındaki ürünler
- OUT_OF_STOCK / BELOW_MIN uyarıları + yenileme miktarı

---

## 14. İleri Özellikler (Gelecek Fazlar)

### OMS Sipariş Entegrasyonu
- Wisersell / özel OMS ile kanal bazlı sipariş akışı
- Shopify (6 mağaza), Amazon SP-API (3 account — MFN), Etsy, Walmart, Wayfair, bol.com
- Stok allocation motoru (kanal bazlı bölüşüm kuralları)

### Kargo Entegrasyonu
- Kargo fiyatı karşılaştırma + etiket üretimi
- FBA Inbound Shipment yönetimi

### İleri Analitik
- Demand forecasting
- Kanal karlılığı analizi
- Sezonsal planlama

---

## 15. Mevcut Sistem Durumu (2026-03-25)

### Backend: 15 route modülü, 129 endpoint

| # | Modül | Endpoint | Durum |
|---|-------|----------|-------|
| 1 | Auth + Kullanıcı Yönetimi | 12 | ✅ SSO + Google OAuth + RBAC |
| 2 | Ürün Kataloğu + Seri No + QC | 16 | ✅ PriceLab read-only, seri üretim, QC |
| 3 | Depo + Lokasyon + Container | 16 | ✅ 5 depo, zone, QR, koli/palet, container kırma |
| 4 | Sipariş + Picking | 10 | ✅ Sipariş, picker atama, wave/batch picking |
| 5 | Envanter + İşlemler | 8 | ✅ IN/OUT/TRANSFER/ADJUST, düşük stok |
| 6 | Sayım + Raporlar | 11 | ✅ Cycle count (tam/kısmi/spot), raporlar |
| 7 | Sevkiyat (Sanal Depo) | 12 | ✅ TR/NJ rota, koli bazlı, transit stok |
| 8 | RMA / İade | 6 | ✅ PENDING→APPROVED→IN_PROCESS→COMPLETED |
| 9 | Operasyon Engine | 9 | ✅ Tarama oturumları, mod yönetimi |
| 10 | Dashboard KPIs | 1 | ✅ Günlük metrikler, trend |
| 11 | Bildirimler | 5 | ✅ Düşük stok, stale order/RMA uyarıları |
| 12 | OMS Entegrasyon API | 16 | ✅ Stok, rezervasyon, picking, webhook |
| 13 | Kitting / Assembly | 3 | ✅ Kit tanımı, bileşen yönetimi, kit oluşturma |
| 14 | Analitik | 8 | ✅ Unified stock, dead stock, DOS, performance, slotting |

### Frontend: 14 sayfa (PWA + Capacitor)

| Sayfa | Durum | Not |
|-------|-------|-----|
| Dashboard (Home) | ✅ | KPI kartları + navigasyon grid |
| Operations | ✅ | Barcode workflow, zone suggestion, container naming |
| Inventory | ✅ | 4 sorgu modu (SKU/Location/Serial/Container) + XLSX export |
| Products | ✅ | Katalog + seri no üretim + etiket basım (çoklu şablon) |
| Locations | ✅ | CRUD + zone filter + QR print |
| Reports | ✅ | Sayım + envanter raporu + XLSX export |
| Shipments | ✅ | Sanal depo + koli + rota kuralları |
| Transactions | ✅ | Hareket geçmişi + filtreler + XLSX export |
| Admin | ✅ | Kullanıcı CRUD + rol yönetimi |
| Orders | ✅ | Sipariş listesi, detay, picking workflow, wave |
| Returns | ✅ | RMA listesi, onay akışı, iade kabul |
| Containers | ✅ | Koli/palet listesi, detay, sevkiyat bağlama, açma |
| Stock Dashboard | ✅ | Birleşik stok (fiziksel + transit + FBA + marketplace) |
| Analytics | ✅ | Dead stock, turnover/DOS, performans, slotting, replenishment |

### Güvenlik
- SSO entegrasyonu (Apps-SSO + Google OAuth)
- Helmet.js güvenlik header'ları
- Rate limiting (4 tier: login, reset, API, refresh)
- RBAC (ADMIN/MANAGER/OPERATOR/VIEWER) + depo izolasyonu
- Zod v4 input validation (tüm endpoint'ler)
- Parameterized SQL (injection koruması)

### CI/CD
- GitHub Actions: type check → lint → test → build → deploy
- Hetzner VPS, PM2, Nginx reverse proxy + SSL
- Frontend: Vite build → SCP → `/var/www/swiftstock/frontend/`
- Backend: tsc → SCP → `npm ci` → PM2 restart
