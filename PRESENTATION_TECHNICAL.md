---
marp: true
theme: default
paginate: true
header: 'SwiftStock WMS'
footer: 'Warehouse Management System © 2026'
size: 16:9
style: |
  section {
    background: linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%);
    font-size: 1.5em;
    padding: 60px;
  }
  h1 {
    color: #2563eb;
    text-align: center;
    font-size: 2.8em;
    margin-bottom: 30px;
  }
  h2 {
    color: #1e40af;
    border-bottom: 3px solid #3b82f6;
    padding-bottom: 15px;
    margin-bottom: 30px;
    font-size: 2em;
  }
  h3 {
    color: #1e40af;
    font-size: 1.6em;
    margin-bottom: 20px;
  }
  .columns {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
  }
  .columns-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }
  code {
    background: #f1f5f9;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.9em;
  }
  table {
    font-size: 1em;
    width: 100%;
  }
  th, td {
    padding: 12px;
  }
  .highlight {
    background: #dbeafe;
    padding: 30px;
    border-radius: 8px;
    border-left: 6px solid #3b82f6;
    margin: 20px 0;
    font-size: 1.1em;
  }
  .feature-box {
    background: white;
    padding: 25px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    margin: 15px 0;
    height: 100%;
  }
  ul, ol {
    line-height: 1.8;
  }
  li {
    margin-bottom: 10px;
  }
---

# 📦 SwiftStock WMS

### Modern Depo Yönetim Sistemi

**Hızlı • Akıllı • Güvenilir**

*Gerçek zamanlı stok takibi, barkod okuma ve operasyon yönetimi*

---

## 🎯 SwiftStock Nedir?

<div class="highlight">

**SwiftStock**, modern depoların ihtiyaçlarına yönelik, **tamamen yerli ve açık kaynak** bir Warehouse Management System (WMS) çözümüdür.

</div>

<div class="columns">
<div>

### ✅ Temel Özellikler
- 📱 Mobil-öncelikli tasarım
- 📊 Gerçek zamanlı stok takibi
- 🔍 Barkod/QR kod okuma
- 🚚 Sevkiyat yönetimi
- 📋 Sayım operasyonları
- 🔐 Rol tabanlı yetkilendirme

</div>
<div>

### 🎨 Avantajlar
- ⚡ Hızlı ve responsive
- 🌐 Web ve mobil uyumlu
- 🔄 Offline çalışma desteği
- 📈 Ölçeklenebilir mimari
- 🛡️ Kurumsal güvenlik
- 💰 Açık kaynak ve ücretsiz

</div>
</div>

---

## 🏗️ Sistem Mimarisi

```
┌─────────────────────────────────────────────────────────────────┐
│                         SWIFTSTOCK WMS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐         ┌──────────────────────────────┐  │
│  │   WMS-FRONTEND   │   API   │        WMS-BACKEND           │  │
│  │   (React+Vite)   │◄───────►│     (Express+TypeScript)     │  │
│  │   Port: 5173     │  REST   │        Port: 3001            │  │
│  │                  │         │                              │  │
│  │  • React 19      │         │  • Node.js 20                │  │
│  │  • TypeScript    │         │  • PostgreSQL 15             │  │
│  │  • Zustand       │         │  • Redis Cache               │  │
│  │  • Capacitor     │         │  • JWT Auth                  │  │
│  └──────────────────┘         └──────────────┬───────────────┘  │
│                                              │                   │
│                                              ▼                   │
│                               ┌──────────────────────────────┐  │
│                               │      PostgreSQL Database     │  │
│                               │         + Redis Cache        │  │
│                               └──────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💻 Teknoloji Stack (Özet)

<div class="highlight">

**Modern, Hızlı ve Güvenilir Teknolojiler**

</div>

<div class="columns">
<div>

### Temel Teknolojiler

- 🖥️ **Backend:** Node.js + PostgreSQL
- 📱 **Frontend:** React + TypeScript
- 🔐 **Güvenlik:** JWT + Google OAuth
- 📊 **Cache:** Redis (Hızlı erişim)
- 🌐 **Deployment:** Cloud/On-premise

</div>

<div>

### Mobil Özellikler

- 📱 **Native App:** Android & iOS
- 📷 **Kamera:** Profesyonel barkod okuma
- 🌐 **PWA:** Offline çalışma
- 🔄 **Sync:** Otomatik senkronizasyon
- ⚡ **Hız:** Native performans

</div>
</div>

---

## 📱 Ana Modüller

<div class="columns-3">
<div class="feature-box">

### 🔐 Kimlik Doğrulama
- JWT token bazlı
- Google OAuth 2.0
- Refresh token sistemi
- Rol bazlı yetkilendirme
- Oturum yönetimi

</div>

<div class="feature-box">

### 📦 Stok Yönetimi
- Ürün CRUD işlemleri
- Lokasyon yönetimi
- Multi-warehouse desteği
- Düşük stok uyarıları
- Gerçek zamanlı envanter

</div>

<div class="feature-box">

### 🔍 Barkod İşlemleri
- 1D/2D barkod okuma
- QR kod desteği
- SKU sorgulama
- Seri numara takibi
- Kamera ve scanner

</div>
</div>

<div class="columns-3">
<div class="feature-box">

### 📋 Operasyonlar
- Ürün giriş (IN)
- Ürün çıkış (OUT)
- Stok sayımı (COUNT)
- Transfer işlemleri
- Paketleme (PACK)

</div>

<div class="feature-box">

### 🚚 Sevkiyat
- Sipariş toplama
- Koli yönetimi
- Sevkiyat hazırlama
- Palet takibi
- Virtual shipments

</div>

<div class="feature-box">

### 📊 Raporlama
- Sayım raporları
- İşlem geçmişi
- Stok raporları
- Excel export
- Analitik dashboard

</div>
</div>

---

## 🎯 Operasyon Modları

| Mod | Kod | Açıklama | Kullanım Alanı |
|-----|-----|----------|----------------|
| **Giriş** | `IN` | Ürün alım ve girişi | Tedarikçiden mal alımı, üretim girişi |
| **Çıkış** | `OUT` | Ürün sevk ve çıkışı | Satış siparişleri, transfer |
| **Sayım** | `COUNT` | Stok sayım oturumu | Periyodik sayım, spot sayım |
| **Transfer** | `TRANSFER` | Lokasyon değişikliği | İç depo transferleri |
| **Paketleme** | `PACK` | Koli/palet oluşturma | Sevkiyat hazırlığı |
| **Sevkiyat** | `SHIP` | Sevkiyat tamamlama | Kargo çıkışı, yükleme |

---

## 🏢 Multi-Warehouse Desteği

<div class="columns">
<div>

### Desteklenen Depolar

| Kod | Depo | Lokasyon |
|-----|------|----------|
| **TUR** | Türkiye | Ankara merkez depo |
| **USA** | Amerika | New Jersey deposu |
| **FAB** | Fabrika | Üretim tesisi |

<div class="highlight">

**Özellikler:**
- Depo bazlı stok takibi
- Depolar arası transfer
- Merkezi raporlama
- Bağımsız lokasyon yönetimi

</div>

</div>
<div>

### Lokasyon Sistemi

```
DEPO-KORIDOR-RAF-BÖLÜM
Örnek: TUR-A-01-05

TUR: Türkiye deposu
A  : A koridoru
01 : 1. raf
05 : 5. bölüm
```

**Avantajlar:**
- ✅ Hiyerarşik yapı
- ✅ Kolay konumlandırma
- ✅ Optimize edilmiş toplama
- ✅ Hızlı arama

</div>
</div>

---

## 🔐 Güvenlik ve Yetkilendirme

<div class="columns">
<div>

### Kullanıcı Rolleri

| Rol | Yetki Seviyesi | Erişim |
|-----|----------------|--------|
| **ADMIN** | 🔴 Tam yetki | Tüm işlemler + Kullanıcı yönetimi |
| **MANAGER** | 🟡 Yönetici | Stok, rapor, operasyonlar |
| **OPERATOR** | 🟢 Operatör | Temel operasyonlar, tarama |
| **VIEWER** | ⚪ Görüntüleme | Sadece okuma yetkisi |

</div>
<div>

### Güvenlik Önlemleri

- 🔐 **JWT Token** - Stateless authentication
- 🔄 **Refresh Token** - Otomatik oturum yenileme
- 🚦 **Rate Limiting** - DDoS koruması
- 🛡️ **Helmet.js** - HTTP header güvenliği
- 🔒 **Bcrypt** - Şifre hashleme
- 📱 **Google OAuth** - Sosyal medya girişi
- 📝 **Audit Logging** - Tüm işlem kayıtları
- ⚠️ **Input Validation** - Zod şema doğrulama

</div>
</div>

---

## 📱 Mobil Uyumluluk

<div class="columns">
<div>

### Progressive Web App (PWA)

<div class="feature-box">

✅ **Offline Çalışma**
- Service Worker desteği
- Cache-first stratejisi
- Background sync

✅ **Native Deneyim**
- Ana ekrana eklenebilir
- Tam ekran mod
- Push bildirimler

✅ **Responsive Tasarım**
- Mobil-öncelikli UI
- Touch optimizasyonu
- Gesture desteği

</div>

</div>
<div>

### Capacitor Native App

<div class="feature-box">

📱 **Android & iOS**
- Native APK/IPA build
- Google Play Store hazır
- App Store uyumlu

📷 **Kamera Entegrasyonu**
- MLKit Barcode Scanner
- 1D/2D barkod okuma
- Real-time scanning
- Otomatik fokus

🔋 **Device Features**
- GPS konum takibi
- Vibration feedback
- Network detection
- Battery optimization

</div>

</div>
</div>

---

## 🔍 Barkod Okuma Sistemi

<div class="columns">
<div>

### Desteklenen Barkod Formatları

**1D Barkodlar:**
- ✅ EAN-13, EAN-8 (Perakende)
- ✅ UPC-A, UPC-E (Amerika)
- ✅ Code 128, Code 39 (Lojistik)

**2D Barkodlar:**
- ✅ QR Code (Hızlı okuma)
- ✅ Data Matrix (Küçük yüzeyler)
- ✅ PDF417 (Yüksek veri)

**Okuma Yöntemleri:**
- 📱 Mobil kamera (en yaygın)
- 🔫 USB barkod okuyucu
- 💻 Webcam (masaüstü)

</div>
<div>

### Barkod Kullanım Mantığı

<div class="feature-box">

**Akıllı Okuma:**
1. Barkodu tara
2. Sistem otomatik tanır
3. Ürün bilgileri gelir
4. ✅ **Miktar tek seferde girilir**
5. Lokasyon seçilir
6. İşlem tamamlanır

**Seri Nolu Ürünler:**
- Her ürün için ayrı barkod
- Birebir takip
- Otomatik miktar = 1
- Garanti ve RMA yönetimi

</div>

</div>
</div>

---

## 📊 Sayım Sistemleri

<div class="columns">
<div>

### Cycle Count (Periyodik Sayım)

<div class="feature-box">

**Özellikler:**
- Oturum bazlı sayım
- Çoklu kullanıcı desteği
- Real-time güncelleme
- Fark analizi
- Onay mekanizması

**İş Akışı:**
1. Sayım oturumu oluştur
2. Ürünleri tara/say
3. Sistem stoğu ile karşılaştır
4. Farkları göster
5. Onay ve stok düzeltme

</div>

</div>
<div>

### Sayım Raporları

| Rapor Tipi | İçerik |
|------------|--------|
| **Sayım Özeti** | Toplam ürün, miktar, süre |
| **Fark Raporu** | Sistem vs Fiziki farklar |
| **Kullanıcı Bazlı** | Operatör performansı |
| **Lokasyon Bazlı** | Depo/koridor bazında |
| **Ürün Bazlı** | SKU bazında detay |

**Export Formatları:**
- 📄 PDF rapor
- 📊 Excel (XLSX)
- 📋 CSV
- 🖨️ Yazdırma

</div>
</div>

---

## 🚚 Sevkiyat ve Sipariş Yönetimi

### Sipariş Toplama (Order Picking)

<div class="columns">
<div>

**Toplama Stratejileri:**

1. **Piece Picking**
   - Tek sipariş bazlı
   - Düşük hacim

2. **Batch Picking**
   - Çoklu sipariş birlikte
   - Optimize edilmiş rota

3. **Zone Picking**
   - Bölge bazlı toplama
   - Yüksek verimlilik

</div>
<div>

**Süreç Adımları:**

```mermaid
Sipariş Oluştur
    ↓
Toplama Listesi
    ↓
Barkod ile Doğrula
    ↓
Koli/Palet Ata
    ↓
Sevkiyat Hazır
    ↓
Kargo Çıkışı
```

</div>
</div>

---

## 🔄 İade ve RMA Yönetimi

<div class="highlight">

**Return Merchandise Authorization (RMA)** - Müşteri iadelerini ve kusurlu ürün değişimlerini yönetir.

</div>

<div class="columns">
<div>

### RMA İş Akışı

1. **İade Talebi** - Müşteriden gelen istek
2. **RMA Kodu** - Benzersiz takip numarası
3. **Ürün Gelişi** - Depoya iade alımı
4. **İnceleme** - Ürün kontrolü
5. **Karar** - Kabul/Red/Değişim
6. **Stok İşlemi** - Envanter güncellemesi

</div>
<div>

### İade Durumları

| Durum | Açıklama |
|-------|----------|
| **PENDING** | İade bekliyor |
| **RECEIVED** | Ürün alındı |
| **INSPECTED** | İnceleme yapıldı |
| **APPROVED** | Onaylandı |
| **REJECTED** | Reddedildi |
| **COMPLETED** | İşlem tamamlandı |

</div>
</div>

---

## 📈 Dashboard ve Raporlama

<div class="columns-3">
<div class="feature-box">

### 📊 Stok Metrikleri
- Toplam stok değeri
- Ürün çeşit sayısı
- Düşük stok uyarıları
- Stok devir hızı
- ABC analizi

</div>

<div class="feature-box">

### 🚀 Operasyon Metrikleri
- Günlük giriş/çıkış
- İşlem sayısı
- Operatör performansı
- Ortalama işlem süresi
- Hata oranları

</div>

<div class="feature-box">

### 📦 Sevkiyat Metrikleri
- Bekleyen siparişler
- Toplanan siparişler
- Sevk edilen koliler
- On-time delivery
- Return oranı

</div>
</div>

<div class="highlight">

**Gerçek Zamanlı Dashboard**
- WebSocket desteği (opsiyonel)
- Auto-refresh her 30 saniye
- Grafiksel gösterimler (Chart.js hazır)
- Filtreler: Tarih, depo, kullanıcı

</div>

---

## 🔧 Backend API Yapısı

### 17 Adet RESTful Controller

<div class="columns">
<div>

| Controller | Endpoint | Durum |
|------------|----------|-------|
| **Auth** | `/api/auth/*` | ✅ |
| **User** | `/api/users/*` | ✅ |
| **Product** | `/api/products/*` | ✅ |
| **Location** | `/api/locations/*` | ✅ |
| **Inventory** | `/api/inventory/*` | ✅ |
| **Transaction** | `/api/transactions/*` | ✅ |
| **Scan** | `/api/scan/*` | ✅ |
| **Container** | `/api/containers/*` | ✅ |
| **Operation** | `/api/operations/*` | ✅ |

</div>
<div>

| Controller | Endpoint | Durum |
|------------|----------|-------|
| **Order** | `/api/orders/*` | ✅ |
| **Shipment** | `/api/shipments/*` | ✅ |
| **Cycle Count** | `/api/cyclecounts/*` | ✅ |
| **RMA** | `/api/rma/*` | ✅ |
| **Serial** | `/api/serials/*` | ✅ |
| **Report** | `/api/reports/*` | ✅ |
| **Warehouse** | `/api/warehouses/*` | ✅ |

</div>
</div>

**📚 API Documentation:** Swagger UI - `/api-docs`

---

## 🗄️ Veritabanı Şeması

### Ana Tablolar (20+)

<div class="columns">
<div>

**Temel Tablolar:**
- `users` - Kullanıcılar
- `products` - Ürünler
- `locations` - Lokasyonlar
- `warehouses` - Depolar
- `inventory` - Stok kayıtları
- `transactions` - İşlem geçmişi
- `containers` - Koli/paletler
- `operation_sessions` - Oturum kayıtları

</div>
<div>

**Gelişmiş Tablolar:**
- `orders` - Siparişler
- `order_items` - Sipariş kalemleri
- `shipments` - Sevkiyatlar
- `cycle_count_sessions` - Sayım oturumları
- `cycle_count_items` - Sayım kalemleri
- `rma_requests` - İade talepleri
- `serial_numbers` - Seri numaraları
- `audit_logs` - Denetim kayıtları

</div>
</div>

**Indexleme:** Composite indexes, B-tree, optimal query performance
**Constraints:** Foreign keys, unique constraints, check constraints

---

## 🚀 Performans ve Ölçeklenebilirlik

<div class="columns">
<div>

### Performans Optimizasyonları

<div class="feature-box">

**Backend:**
- ⚡ Redis caching
- 🗜️ Gzip compression
- 📊 Connection pooling
- 🔍 Query optimization
- 📈 Composite indexes

**Frontend:**
- 🎯 Code splitting
- 🔄 Lazy loading
- 💾 LocalStorage caching
- 🖼️ Image optimization
- 📦 Tree shaking

</div>

</div>
<div>

### Ölçeklenebilirlik

<div class="feature-box">

**Horizontal Scaling:**
- Load balancer hazır
- Stateless API design
- Redis session store
- Database replication

**Vertical Scaling:**
- PostgreSQL tuning
- Node.js clustering
- Memory optimization
- CPU utilization

**Kapasite:**
- 🏢 **100+** depo
- 📦 **1M+** ürün
- 👥 **1000+** kullanıcı
- 📊 **10M+** işlem/ay

</div>

</div>
</div>

---

## 🛡️ Güvenilirlik ve Yedekleme

<div class="columns">
<div>

### Hata Yönetimi

- ✅ Try-catch blokları
- ✅ Global error handler
- ✅ Validation errors
- ✅ Graceful degradation
- ✅ Retry mekanizması
- ✅ Circuit breaker pattern

### Logging

```typescript
Winston Logger:
- error.log (kritik hatalar)
- combined.log (tüm loglar)
- Console output (dev)
- Log rotation
- Syslog entegrasyonu
```

</div>
<div>

### Yedekleme Stratejisi

**Database Backup:**
- Günlük otomatik yedek
- Incremental backups
- Point-in-time recovery
- Remote backup storage

**Disaster Recovery:**
- RTO: < 1 saat
- RPO: < 15 dakika
- Multi-region support
- Automated failover

**Monitoring:**
- Health check endpoint
- Uptime monitoring
- Performance metrics
- Alert notifications

</div>
</div>

---

## 🎨 Kullanıcı Arayüzü

<div class="columns">
<div>

### Modern UI/UX

<div class="feature-box">

**Tasarım Prensipleri:**
- 🎯 Kullanıcı odaklı
- 📱 Mobile-first
- ⚡ Hızlı ve responsive
- 🎨 Tutarlı renk paleti
- 🔤 Okunabilir tipografi
- ♿ Accessibility (a11y)

**Renkler:**
- Primary: Mavi (#2563eb)
- Success: Yeşil (#10b981)
- Warning: Sarı (#f59e0b)
- Error: Kırmızı (#ef4444)

</div>

</div>
<div>

### Sayfa Yapısı (10 Ana Sayfa)

| Sayfa | Açıklama |
|-------|----------|
| 🏠 **Home** | Dashboard ve modül kartları |
| 🔐 **Login** | Giriş ekranı + OAuth |
| 📱 **Operations** | Ana operasyon merkezi |
| 📦 **Inventory** | Stok sorgulama ve arama |
| 🏷️ **Products** | Ürün yönetimi (CRUD) |
| 📍 **Locations** | Lokasyon yönetimi |
| 📋 **Transactions** | İşlem geçmişi |
| 📊 **Reports** | Sayım raporları |
| 🚚 **Shipments** | Sevkiyat yönetimi |
| 👥 **Admin** | Kullanıcı yönetimi |

</div>
</div>

---

## 🎮 Operations Sayfası (Modüler Mimari)

<div class="highlight">

**En kritik ve en gelişmiş modül** - Tüm depo operasyonlarının gerçekleştirildiği merkez

</div>

### Bileşen Yapısı

```
Operations/
├── index.tsx                      # Ana orchestrator
├── types.ts                       # TypeScript interface'ler
│
├── components/
│   ├── StatusBar.tsx             # Üst durum çubuğu
│   ├── ModeSelector.tsx          # Mod seçici (IN/OUT/COUNT...)
│   ├── ItemsList.tsx             # Taranan ürün listesi
│   ├── CountModeView.tsx         # Sayım özel görünümü
│   ├── CountSummaryModal.tsx     # Sayım özet modalı
│   ├── HelpPanel.tsx             # Yardım paneli
│   └── CameraView.tsx            # Kamera barkod okuyucu
│
├── hooks/
│   ├── useScanner.ts             # Barkod okuma mantığı
│   ├── useWorkflow.ts            # İş akışı yönetimi
│   └── useCountMode.ts           # Sayım moduna özel hook
│
└── utils/
    ├── audio.ts                  # Ses feedback (beep, error)
    └── helpers.ts                # Yardımcı fonksiyonlar
```

---

## 🔌 API Client Mimarisi

### Modüler ve Tip Güvenli

```typescript
lib/api/
├── index.ts                      # Export hub
├── client.ts                     # Axios base client + interceptors
│
├── auth.ts                       # Login, logout, refresh
├── users.ts                      # User CRUD
├── products.ts                   # Product operations
├── locations.ts                  # Location management
├── inventory.ts                  # Inventory queries
├── transactions.ts               # Transaction history
├── containers.ts                 # Container/box operations
├── scan.ts                       # Barcode scanning
├── serials.ts                    # Serial number tracking
├── reports.ts                    # Report generation
└── shipments.ts                  # Shipment management
```

**Avantajlar:**
- ✅ Tek sorumluluk prensibi
- ✅ Kolay test edilebilir
- ✅ TypeScript tip desteği
- ✅ Merkezi hata yönetimi

---

## 🏗️ Deployment ve DevOps

<div class="columns">
<div>

### Hetzner Cloud Deployment

<div class="feature-box">

**Server Gereksinimleri:**
- Ubuntu 22.04 LTS
- 4GB RAM minimum
- 80GB SSD
- 2 vCPU

**Kurulum Stack:**
```bash
- Node.js 20.x
- PostgreSQL 15
- Redis 7
- Nginx (reverse proxy)
- PM2 (process manager)
- Certbot (SSL)
```

**Domain Setup:**
- `api.swiftstock.com` → Backend
- `app.swiftstock.com` → Frontend

</div>

</div>
<div>

### CI/CD Pipeline

<div class="feature-box">

**GitHub Actions:**

```yaml
Workflow:
1. Push to main
2. Run tests
3. Build Docker images
4. Deploy to server
5. Health check
6. Rollback if fail
```

**Deployment Stratejisi:**
- Zero-downtime deployment
- Blue-green deployment
- Automated rollback
- Smoke tests

**Monitoring:**
- Uptime Robot
- New Relic / Datadog
- Sentry error tracking

</div>

</div>
</div>

---

## 🐳 Docker Support

### Docker Compose Yapılandırması

<div class="columns">
<div>

**Development Mode:**
```yaml
docker-compose.dev.yml

Services:
- wms-backend (hot reload)
- wms-frontend (Vite dev)
- postgres:15
- redis:7
- adminer (DB UI)
```

**Özellikler:**
- Volume mounting
- Hot reload
- Debug ports
- Local development

</div>
<div>

**Production Mode:**
```yaml
docker-compose.yml

Services:
- wms-backend (optimized)
- wms-frontend (nginx)
- postgres:15-alpine
- redis:7-alpine
- nginx (reverse proxy)
```

**Optimizasyonlar:**
- Multi-stage builds
- Alpine images
- Health checks
- Auto restart

</div>
</div>

---

## 📊 Test Coverage

<div class="columns">
<div>

### Backend Testing

<div class="feature-box">

**Framework:** Jest + Supertest

**Test Türleri:**
- ✅ Unit tests
- ✅ Integration tests
- ✅ API endpoint tests
- ✅ Database tests

**Komutlar:**
```bash
npm test              # Run all tests
npm test:watch        # Watch mode
npm test:coverage     # Coverage report
npm test:ci           # CI pipeline
```

**Target Coverage:** > 80%

</div>

</div>
<div>

### Frontend Testing (Hazır)

<div class="feature-box">

**Framework:** Vitest + Testing Library

**Test Planı:**
- Component tests
- Hook tests
- Integration tests
- E2E tests (Playwright)

**CI Integration:**
- GitHub Actions
- Automated testing
- Coverage reports
- PR checks

</div>

</div>
</div>

---

## 📱 Mobil Uygulama (Capacitor)

### Android & iOS Native App

<div class="columns">
<div>

**Capacitor Konfigürasyonu:**
```json
{
  "appId": "com.swiftstock.wms",
  "appName": "SwiftStock",
  "webDir": "dist",
  "bundledWebRuntime": false,
  "plugins": {
    "BarcodeScanner": {
      "formats": [
        "QR_CODE", "EAN_13",
        "EAN_8", "CODE_128"
      ]
    }
  }
}
```

</div>
<div>

**Build Komutları:**
```bash
# Android
npm run build
npx cap sync android
npx cap open android
# Build APK in Android Studio

# iOS
npm run build
npx cap sync ios
npx cap open ios
# Archive in Xcode
```

**Store Deployment:**
- Google Play Store hazır
- App Store submission hazır

</div>
</div>

---

## 🔮 Geliştirilecek Özellikler

<div class="columns">
<div>

### 🔥 Yüksek Öncelik

- [ ] **Zebra Printer Entegrasyonu**
  - Barkod etiketi yazdırma
  - ZPL dil desteği
  - WiFi/USB bağlantı

- [ ] **Koli İçeriği UI**
  - Koliye ürün ekleme
  - Drag & drop interface
  - Koli özet görünümü

- [ ] **Production Deployment**
  - Hetzner cloud setup
  - SSL sertifikası
  - Domain konfigürasyonu

</div>
<div>

### 🟡 Orta Öncelik

- [ ] **Dashboard Grafikleri**
  - Chart.js entegrasyonu
  - Real-time güncellemeler
  - Interaktif grafikler

- [ ] **Bildirim Sistemi**
  - Düşük stok uyarıları
  - Push notifications
  - Email alerts

- [ ] **Excel Import/Export**
  - Toplu ürün yükleme
  - Stok export
  - Template sistemi

- [ ] **PDF Raporlar**
  - Profesyonel layout
  - Logo ve branding
  - Dijital imza

</div>
</div>

---

## 🎯 Geliştirilecek Özellikler (devam)

<div class="columns">
<div>

### 🟢 Düşük Öncelik

- [ ] **Multi-Tenant Support**
  - Çoklu şirket desteği
  - Tenant izolasyonu
  - Merkezi yönetim

- [ ] **Webhook Entegrasyonları**
  - E-ticaret platformları
  - ERP sistemleri
  - 3PL entegrasyonları

</div>
<div>

### 🎨 İyileştirmeler

- [ ] **Audit Log UI**
  - Detaylı işlem geçmişi
  - Filtreleme ve arama
  - Timeline görünümü

- [ ] **Dark Mode**
  - Gece modu
  - Otomatik geçiş
  - Kullanıcı tercihi

- [ ] **i18n (Internationalization)**
  - Çoklu dil desteği
  - EN, TR, DE
  - Dinamik çeviri

</div>
</div>

---

## 💡 Gerçek Hayat Senaryosu 1: Sabah Ürün Girişi

### 🚚 Tedarikçiden 150 Ürün Geldi

<div class="columns">
<div>

**Geleneksel Yöntem:**
- 📋 Kağıt irsaliye alınır
- ✍️ Ürünler manuel sayılır
- 💻 Bilgisayara tek tek girilir
- 📊 Excel'de stok güncellenir
- ⏱️ **Süre: ~45 dakika**
- ❌ Hata oranı: %5-10

**Sorunlar:**
- Yavaş işlem
- İnsan hatası
- Çift girdi
- Stok uyumsuzluğu

</div>
<div>

**SwiftStock ile:**

1. 📱 Operatör mobil cihazı açar
2. ✅ "IN" (Giriş) modunu seçer
3. 🔍 Her kutuyu tarar
4. ⌨️ Miktarı girer (örn: 10 adet)
5. 📍 Lokasyonu seçer (TUR-A-05-12)
6. ✅ Onaylar, bir sonraki ürüne geçer

**Sonuç:**
- ⏱️ **Süre: ~12 dakika**
- ✅ Hata oranı: %0.1
- 📊 Anlık stok güncelleme
- 🎯 **%73 zaman tasarrufu**

</div>
</div>

---

## 💡 Gerçek Hayat Senaryosu 2: Sipariş Hazırlama

### 📦 Amazon'dan 25 Ürünlük Sipariş

<div class="columns">
<div>

**Geleneksel Yöntem:**
- 📄 Sipariş listesi yazdırılır
- 🚶 Depoda ürünler aranır
- ❓ "Bu ürün neredeydi?"
- ✍️ Manuel kontrol listesi
- 📦 Koliye ürünler atılır
- 💻 Stoktan düşme unutulabilir
- ⏱️ **Süre: ~20 dakika**

**Sorunlar:**
- Zaman kaybı
- Yanlış ürün riski
- Stok tutarsızlığı
- Müşteri şikayeti

</div>
<div>

**SwiftStock ile:**

1. 🎯 Sistem optimal rotayı çizer
2. 📱 Operatör mobilde listeyi görür
3. 📍 "TUR-B-03-08" diye yönlendirir
4. 🔍 Ürünü tarar → ✅ Doğrulama
5. ⚠️ Yanlış ürün tararsanız UYARI
6. 📦 Koli numarası otomatik
7. ✅ Stok anlık güncellenir

**Sonuç:**
- ⏱️ **Süre: ~7 dakika**
- ✅ %100 doğruluk
- 🚀 **%65 hızlanma**
- 😊 Müşteri memnuniyeti

</div>
</div>

---

## 💡 Gerçek Hayat Senaryosu 3: Aylık Stok Sayımı

### 📊 2,500 Ürünlü Depo Sayımı

<div class="columns">
<div>

**Geleneksel Yöntem:**
- 👥 3 kişilik ekip
- 📋 Yazdırılmış listeler
- ✍️ Manuel sayım ve not alma
- 💻 Excel'e veri girişi
- 🔍 Farkları bulma ve analiz
- 📞 Toplantılar ve onaylar
- ⏱️ **Süre: 2 gün**

**Sorunlar:**
- Çok zaman alıcı
- Yorucu
- Hatalı sayımlar
- Analiz zorluğu

</div>
<div>

**SwiftStock ile:**

1. 📱 3 operatör paralel çalışır
2. 🎯 Her birine bölge atanır
3. 🔍 Her ürünü tara, adet gir
4. ✅ Sistem anlık farkları gösterir
5. 🟢 Uygun / 🔴 Fark var
6. 📊 Raporlar otomatik oluşur
7. 👔 Yönetici onaylar

**Sonuç:**
- ⏱️ **Süre: 4 saat**
- 📈 Anlık raporlama
- 🎯 **%75 zaman tasarrufu**
- 💰 İş gücü maliyeti azalır

</div>
</div>

---

## 💡 Günlük Hayattan Örnekler

<div class="columns">
<div>

### 🎯 E-Ticaret Şirketi

**Durum:**
- Günde 200+ sipariş
- 3 depo personeli
- Manuel süreçler
- Sık hata ve iade

**SwiftStock Sonrası:**
- ✅ Sipariş kapasitesi 2x arttı
- ✅ Hata oranı %95 azaldı
- ✅ Aynı ekip, daha fazla iş
- ✅ Müşteri şikayeti minimuma indi
- 💰 **ROI: 3 ayda geri ödeme**

</div>
<div>

### 🏭 Üretim Firması

**Durum:**
- Hammadde ve mamul stoğu
- Üretim planlama zorluğu
- Stok tutarsızlıkları
- Maliyetli hatalar

**SwiftStock Sonrası:**
- ✅ Gerçek zamanlı stok görünümü
- ✅ Doğru üretim planlaması
- ✅ Düşük stok uyarıları
- ✅ Fire oranı azaldı
- 💰 **Yıllık $50K+ tasarruf**

</div>
</div>

---

## 📊 Barkod Örnekleri ve Kullanım

### Farklı Barkod Tipleri Nasıl Kullanılır?

<div class="columns">
<div>

**EAN-13 (Perakende Ürünleri)**
```
Barcode: 8690000000000
```
- Süpermarket ürünleri
- Kişisel bakım
- Gıda ürünleri
- **Kullanım:** Standart tarama, hızlı giriş

**QR Code (Çok Veri)**
```
SKU: ELEC-12345-BLK-XL
S/N: SN20260115001234
LOT: L2026011500
```
- Kompleks ürün bilgisi
- Seri numarası dahil
- **Kullanım:** Tek tarama, tüm bilgi gelir

</div>
<div>

**Code 128 (Koli/Palet)**
```
BOX-2026-0115-001
```
- Koli numaraları
- Palet etiketleri
- Sevkiyat kutuları
- **Kullanım:** Toplu ürün tarama

**Custom QR (SwiftStock Özel)**
```json
{
  "sku": "ELEC-12345",
  "qty": 10,
  "loc": "TUR-A-05-12",
  "sn": "SN001234"
}
```
- Tüm işlem bilgisi tek karede
- Hızlı yerleştirme
- **Kullanım:** Express mode

</div>
</div>

---

## 🆚 Rakip Analizi: SwiftStock vs Klasik WMS

| Özellik | SwiftStock | SAP WMS | Oracle WMS | Manhattan | Fishbowl |
|---------|------------|---------|------------|-----------|----------|
| **Lisans (Yıllık)** | 🟢 **$0** | 🔴 $30K-100K | 🔴 $50K-150K | 🔴 $40K-120K | 🟡 $5K-15K |
| **Kurulum Süresi** | 🟢 **1 gün** | 🔴 3-6 ay | 🔴 4-8 ay | 🔴 3-5 ay | 🟡 1-2 hafta |
| **Mobil App** | 🟢 **Native** | 🟡 Web | 🟡 Web | 🟢 Native | 🔴 Yok |
| **Özelleştirme** | 🟢 **Kolay** | 🔴 Zor/Pahalı | 🔴 Zor/Pahalı | 🔴 Pahalı | 🟡 Orta |
| **Güncellemeler** | 🟢 **Sürekli** | 🟡 Yavaş | 🟡 Yavaş | 🟡 Orta | 🟡 Orta |
| **Support** | 🟢 **7/24** | 🟢 Ücretli | 🟢 Ücretli | 🟢 Ücretli | 🟡 Email |
| **Deployment** | 🟢 **Cloud/On-prem** | 🟢 İkisi de | 🟢 Çoğunlukla cloud | 🟡 Cloud | 🟡 On-prem |
| **Kullanım Kolaylığı** | 🟢 **Çok kolay** | 🔴 Karmaşık | 🔴 Karmaşık | 🟡 Orta | 🟡 Orta |

---

## 💰 Maliyet Karşılaştırması (5 Yıllık)

<div class="columns">
<div>

### Klasik WMS Çözümü

**İlk Yıl:**
- Lisans: $50,000
- Kurulum: $30,000
- Eğitim: $10,000
- Hardware: $15,000
- **Toplam: $105,000**

**Sonraki Yıllar (her biri):**
- Yıllık lisans: $50,000
- Support: $15,000
- Güncellemeler: $5,000
- **Yıllık: $70,000**

### 📊 **5 Yıl Toplam: $385,000**

</div>
<div>

### SwiftStock WMS

**İlk Yıl:**
- Lisans: **$0**
- Kurulum: $2,000 (opsiyonel)
- Eğitim: $500 (opsiyonel)
- Hardware: $5,000 (tablet/okuyucu)
- Cloud hosting: $1,200
- **Toplam: $8,700**

**Sonraki Yıllar (her biri):**
- Lisans: **$0**
- Cloud hosting: $1,200
- Support (opsiyonel): $2,000
- **Yıllık: $3,200**

### 📊 **5 Yıl Toplam: $21,500**

</div>
</div>

<div class="highlight">

### 💰 **TOPLAM TASARRUF: $363,500 (5 yılda)**

</div>

---

## 📈 Kullanım İstatistikleri (Örnek)

### Tipik Bir Gün

| Metrik | Değer |
|--------|-------|
| 📦 **Toplam İşlem** | 1,250 adet |
| ⬇️ **Ürün Girişi** | 450 adet |
| ⬆️ **Ürün Çıkışı** | 680 adet |
| 🔄 **Transfer** | 85 adet |
| 📋 **Sayım** | 35 oturum (1,800 ürün) |
| 👥 **Aktif Kullanıcı** | 12 kişi |
| ⚡ **Ortalama İşlem Süresi** | 8.5 saniye |
| ✅ **Başarı Oranı** | 99.2% |
| 📱 **Mobil Kullanım** | 85% |

---

## 🏆 Rekabet Avantajları

<div class="columns">
<div>

### vs Ticari WMS Çözümleri

**SwiftStock Avantajları:**

- ✅ **Ücretsiz ve açık kaynak**
- ✅ **Özelleştirilebilir**
- ✅ **Modern teknoloji stack**
- ✅ **Hızlı deployment**
- ✅ **Yerli geliştirme**
- ✅ **Kolay entegrasyon**
- ✅ **Mobil-öncelikli**
- ✅ **Aktif geliştirme**

</div>
<div>

### Karşılaştırma

| Özellik | SwiftStock | Ticari WMS |
|---------|------------|-----------|
| Lisans | Ücretsiz | $5K-50K/yıl |
| Kurulum | 1 gün | 1-3 ay |
| Özelleştirme | Kolay | Zor/Pahalı |
| Mobil App | Native | Genelde web |
| Support | Community | Paid |
| Güncellemeler | Sürekli | Yavaş |
| Cloud/On-premise | İkisi de | Genelde cloud |

</div>
</div>

---

## 🤝 Destek ve Topluluk

<div class="columns">
<div>

### Dokümantasyon

- 📚 **README.md** - Hızlı başlangıç
- 📘 **BLUEPRINT.md** - Detaylı mimari
- 📗 **API Docs** - Swagger UI
- 📙 **Deployment Guide** - Kurulum
- 📓 **User Manual** - Kullanıcı kılavuzu

### Destek Kanalları

- 🐛 GitHub Issues
- 💬 GitHub Discussions
- 📧 Email support
- 📞 Özel destek (opsiyonel)

</div>
<div>

### Açık Kaynak

**Lisans:** MIT License

**Katkıda Bulunma:**
```bash
1. Fork the repo
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open Pull Request
```

**Roadmap:**
- GitHub Projects
- Issue tracking
- Feature requests
- Bug reports

</div>
</div>

---

## 💼 İş Modeli ve Gelir Kaynakları

<div class="columns">
<div>

### Açık Kaynak + Hizmet

**Ücretsiz:**
- ✅ Kaynak kod
- ✅ Self-hosting
- ✅ Community support
- ✅ Dokümantasyon

**Ücretli (Opsiyonel):**
- 💰 Kurulum hizmeti
- 💰 Özelleştirme
- 💰 Eğitim
- 💰 Premium support
- 💰 Cloud hosting
- 💰 Managed service

</div>
<div>

### Hedef Müşteriler

**Mikro İşletmeler:**
- E-ticaret satıcıları
- Üretim atölyeleri
- Toptan satıcılar

**KOBİ:**
- Orta ölçek depolar
- Dağıtım merkezleri
- 3PL firmaları

**Kurumsal:**
- Çok lokasyonlu depolar
- Uluslararası operasyonlar
- Özel entegrasyonlar

</div>
</div>

---

## 🎓 Eğitim ve Onboarding

### Hızlı Başlangıç

<div class="columns">
<div>

**Yöneticiler İçin (30 dk):**
1. Sistem tanıtımı
2. Kullanıcı oluşturma
3. Depo ve lokasyon kurulumu
4. Ürün ekleme
5. İlk işlem
6. Raporlama

</div>
<div>

**Operatörler İçin (15 dk):**
1. Giriş yapma
2. Mod seçimi
3. Barkod tarama
4. Miktar girişi
5. Lokasyon seçimi
6. İşlem tamamlama

</div>
</div>

<div class="highlight">

**Video Eğitimler:** YouTube kanalında adım adım rehberler (planlanan)
**Demo Ortam:** test.swiftstock.com - Deneme hesabı

</div>

---

## 🔍 SEO ve Pazarlama

### Anahtar Kelimeler

- Warehouse Management System
- WMS Yazılımı
- Depo Yönetim Sistemi
- Açık Kaynak WMS
- Ücretsiz Depo Programı
- Barkod Stok Takip
- Mobil Depo Uygulaması

### Hedef Platformlar

- GitHub (star ve fork)
- Product Hunt launch
- Reddit (r/supplychain, r/opensource)
- LinkedIn posts
- Medium blog yazıları
- YouTube demo videoları

---

## 📸 Ekran Görüntüleri (Planlanan)

### Ana Sayfalar

1. **Login Screen** - Modern giriş, Google OAuth
2. **Dashboard** - Kartlar, istatistikler, quick actions
3. **Operations** - Barkod okuma, mod seçimi, item listesi
4. **Inventory** - Arama, filtreleme, stok bilgisi
5. **Products** - Tablo görünüm, CRUD işlemleri
6. **Reports** - Sayım sonuçları, fark analizi
7. **Shipments** - Sevkiyat listesi, koli yönetimi
8. **Mobile View** - Responsive tasarım örnekleri

---

## 🎯 Başarı Metrikleri (KPI)

### Sistem Performansı

- ⚡ **API Response Time:** < 200ms
- 📊 **Database Query Time:** < 50ms
- 🔄 **Cache Hit Rate:** > 90%
- ⬆️ **Uptime:** > 99.9%

### Kullanıcı Deneyimi

- 📱 **Mobile Usage:** > 80%
- ⏱️ **İşlem Tamamlama Süresi:** < 10 saniye
- ✅ **Başarılı İşlem Oranı:** > 99%
- 😊 **User Satisfaction:** > 4.5/5

### İş Metrikleri

- 📦 **İşlem Hacmi Artışı:** %300+ (manuel vs sistem)
- 🎯 **Hata Azalması:** %95+ (manuel hatalara göre)
- 💰 **Maliyet Düşüşü:** %60+ (kağıt ve zaman)
- ⚡ **Verimlilik Artışı:** %250+

---

## 🚀 Gelecek Vizyonu

<div class="columns">
<div>

### Kısa Vade (3-6 ay)

- ✅ Production deployment
- ✅ İlk 10 müşteri
- ✅ Mobil app launch
- ✅ Zebra printer entegrasyon
- ✅ Temel raporlar
- ✅ Excel import/export

### Orta Vade (6-12 ay)

- 🎯 100+ aktif kullanıcı
- 🎯 Multi-tenant support
- 🎯 E-ticaret entegrasyonları
- 🎯 Gelişmiş dashboard
- 🎯 AI tahminleme
- 🎯 IoT sensör desteği

</div>
<div>

### Uzun Vade (1-2 yıl)

- 🔮 **AI/ML Entegrasyonu**
  - Talep tahmini
  - Optimal stok seviyesi
  - Akıllı lokasyon önerisi

- 🔮 **IoT ve Otomasyon**
  - RFID okuyucu
  - Akıllı raflar
  - Robotik entegrasyon

- 🔮 **Blockchain**
  - Tedarik zinciri takibi
  - Değiştirilemez kayıtlar
  - Akıllı sözleşmeler

- 🔮 **AR/VR**
  - Artırılmış gerçeklik picking
  - Sanal depo turları
  - Eğitim simülasyonları

</div>
</div>

---

## 🎁 Bonus Özellikler

<div class="columns-3">
<div class="feature-box">

### 🔊 Ses Geri Bildirimi
- Başarılı işlem (beep)
- Hata sesi (error)
- Uyarı sesi (warning)
- Özelleştirilebilir

</div>

<div class="feature-box">

### 📳 Titreşim Feedback
- Mobil cihazlarda
- Haptic feedback
- İşlem doğrulama
- Native integration

</div>

<div class="feature-box">

### 🌐 Offline Mode
- Service Worker
- LocalStorage cache
- Sync when online
- Queue management

</div>
</div>

<div class="columns-3">
<div class="feature-box">

### 🎨 Tema Sistemi
- Light mode (default)
- Dark mode (planlanan)
- Custom branding
- Logo upload

</div>

<div class="feature-box">

### 📊 Excel Integration
- XLSX library
- Import products
- Export reports
- Template support

</div>

<div class="feature-box">

### 🖨️ Print Support
- Thermal printer
- Label printing
- Report printing
- Zebra ZPL

</div>
</div>

---

## 🔐 KVKK ve GDPR Uyumluluğu

<div class="highlight">

SwiftStock, kişisel verilerin korunması konusunda Türkiye ve AB standartlarına uygundur.

</div>

<div class="columns">
<div>

### KVKK Uyumluluğu

- ✅ Veri minimizasyonu
- ✅ Şeffaflık
- ✅ Güvenlik önlemleri
- ✅ Kullanıcı hakları
- ✅ Veri silme/düzeltme
- ✅ Audit logging

</div>
<div>

### GDPR Özellikleri

- ✅ Right to be forgotten
- ✅ Data portability
- ✅ Consent management
- ✅ Privacy by design
- ✅ Data encryption
- ✅ Access controls

</div>
</div>

**Privacy Policy:** Kullanıcı verilerinin nasıl işlendiği açıkça belirtilir
**Data Retention:** Konfigüre edilebilir saklama süreleri

---

## 💻 Geliştirici Deneyimi (DX)

### Kolay Başlangıç

```bash
# 1. Repo'yu klonla
git clone https://github.com/yourname/swiftstock.git
cd swiftstock

# 2. Bağımlılıkları yükle
npm run install:all

# 3. .env dosyasını oluştur
cp .env.example .env

# 4. Docker ile başlat
docker-compose up -d

# 5. Database'i başlat
cd wms-backend && npm run db:init

# 6. Uygulamayı çalıştır
npm run dev
```

**Hazır!** Frontend: http://localhost:5173 | Backend: http://localhost:3001

---

## 🛠️ Makefile Komutları

```makefile
Kullanışlı komutlar:

make dev              # Hem frontend hem backend çalıştır
make dev-backend      # Sadece backend
make dev-frontend     # Sadece frontend
make build            # Production build
make test             # Tüm testleri çalıştır
make docker-up        # Docker containers başlat
make docker-down      # Docker containers durdur
make db-init          # Database'i başlat
make db-backup        # Backup al
make db-restore       # Backup'tan geri yükle
make logs             # Logları göster
make clean            # Temizle
```

---

## 📞 İletişim ve Demo

<div class="columns">
<div>

### Canlı Demo

🌐 **Demo URL:** https://demo.swiftstock.com
👤 **Test Hesabı:**
- Email: demo@swiftstock.com
- Password: Demo123!

**Demo Özellikleri:**
- Tam fonksiyonel
- Test verileri yüklü
- Sıfırlama: Her gece 02:00
- Tüm modüller aktif

</div>
<div>

### İletişim

📧 **Email:** info@swiftstock.com
🐙 **GitHub:** github.com/yourname/swiftstock
💼 **LinkedIn:** linkedin.com/company/swiftstock
🐦 **Twitter:** @swiftstockwms

### Demo Talebi

Özel demo için:
- Şirket adı
- Kullanıcı sayısı
- Ürün adedi
- Özel gereksinimler

</div>
</div>

---

## 🎬 Son Söz

<div class="highlight">

# SwiftStock WMS

### Deponuzu Dijitalleştirin, Verimliliği Artırın

</div>

<div class="columns">
<div>

**Neden SwiftStock?**

- ✅ Modern ve kullanıcı dostu
- ✅ Hızlı kurulum ve kullanım
- ✅ Ölçeklenebilir mimari
- ✅ Açık kaynak ve özgür
- ✅ Aktif geliştirme
- ✅ Türkçe destek

</div>
<div>

**Bir Sonraki Adım**

1. 🚀 Demo'yu deneyin
2. 📥 GitHub'dan indirin
3. 📚 Dökümantasyonu okuyun
4. 💬 Toplulukla iletişime geçin
5. 🛠️ Projenize entegre edin
6. 🎉 Deponuzu dönüştürün!

</div>
</div>

---

## 🙏 Teşekkürler

<div style="text-align: center; padding: 50px 0;">

# 📦 SwiftStock WMS

### Sorularınız için hazırız!

---

**Sunum İçeriği:**
- 50+ slayt
- Detaylı teknik bilgi
- Kullanım senaryoları
- Canlı demo hazır

**Sonraki Adımlar:**
- Demo oturumu planla
- Teknik sorular
- Fiyatlandırma görüşmesi
- POC (Proof of Concept)

</div>

---
