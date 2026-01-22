# SwiftStock WMS - Blueprint

## Mevcut Durum (v1.0.0)

### Sistem Mimarisi

```
┌─────────────────────────────────────────────────────────────────┐
│                        SWIFTSTOCK WMS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐         ┌──────────────────────────────┐  │
│  │   WMS-FRONTEND   │   API   │        WMS-BACKEND           │  │
│  │   (React+Vite)   │◄───────►│     (Express+TypeScript)     │  │
│  │   Port: 5173     │         │        Port: 3001            │  │
│  └──────────────────┘         └──────────────┬───────────────┘  │
│                                              │                   │
│                                              ▼                   │
│                               ┌──────────────────────────────┐  │
│                               │      PostgreSQL Database     │  │
│                               │         + Redis Cache        │  │
│                               └──────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend Modülleri

### Controllers (17 adet)
| Controller | Durum | Açıklama |
|------------|-------|----------|
| auth.controller | ✅ Aktif | Login, logout, refresh token, Google OAuth |
| user.controller | ✅ Aktif | Kullanıcı CRUD, rol yönetimi |
| scan.controller | ✅ Aktif | Barkod tarama, SKU lookup |
| transaction.controller | ✅ Aktif | Stok giriş/çıkış işlemleri |
| inventory.controller | ✅ Aktif | Stok sorgulama, düşük stok |
| product.controller | ✅ Aktif | Ürün CRUD |
| location.controller | ✅ Aktif | Lokasyon CRUD |
| container.controller | ✅ Aktif | Koli/palet yönetimi |
| warehouse.controller | ✅ Aktif | Depo sorgulama |
| operation.controller | ✅ Aktif | Operasyon modları, scan session |
| order.controller | ✅ Aktif | Sipariş toplama (picking) |
| cyclecount.controller | ✅ Aktif | Sayım oturumları |
| rma.controller | ✅ Aktif | İade/RMA yönetimi |
| serial.controller | ✅ Aktif | Seri numara takibi |
| report.controller | ✅ Aktif | Sayım raporları |
| shipment.controller | ✅ Aktif | Sevkiyat ve koli yönetimi |

### Veritabanı Migrations (14 adet)
| Migration | Açıklama |
|-----------|----------|
| 003 | Lokasyonlar ve operasyonlar |
| 004 | Fabrika deposu, composite indexler |
| 005 | Kullanıcılar ve auth |
| 006 | Cihaz takibi |
| 007 | Sevkiyat siparişleri |
| 008 | Depo konfigürasyonu |
| 009 | Cycle count |
| 010 | İade/RMA |
| 011 | Seri numaraları |
| 012 | Seri numara geçmişi |
| 013 | Sayım raporları |
| 014 | Virtual shipments |

---

## Frontend Sayfaları

### Pages (10 adet)
| Sayfa | Durum | Açıklama |
|-------|-------|----------|
| Login | ✅ Aktif | Giriş ekranı, Google OAuth |
| Home | ✅ Aktif | Dashboard, modül kartları |
| Operations | ✅ Aktif | Ana operasyon ekranı (IN/OUT/COUNT/TRANSFER) |
| Inventory | ✅ Aktif | Stok sorgulama |
| Products | ✅ Aktif | Ürün yönetimi |
| Locations | ✅ Aktif | Lokasyon yönetimi |
| Transactions | ✅ Aktif | İşlem geçmişi |
| Reports | ✅ Aktif | Sayım raporları |
| Shipments | ✅ Aktif | Sevkiyat yönetimi |
| Admin | ✅ Aktif | Kullanıcı yönetimi |

### Operations Modüler Yapısı
```
Operations/
├── index.tsx          # Ana orchestrator
├── types.ts           # TypeScript tipleri
├── components/
│   ├── StatusBar.tsx
│   ├── ModeSelector.tsx
│   ├── ItemsList.tsx
│   ├── CountModeView.tsx
│   ├── CountSummaryModal.tsx
│   ├── HelpPanel.tsx
│   └── CameraView.tsx
├── hooks/
│   ├── useScanner.ts
│   ├── useWorkflow.ts
│   └── useCountMode.ts
└── utils/
    ├── audio.ts
    └── helpers.ts
```

### API Client Modüler Yapısı
```
lib/api/
├── index.ts       # Export hub
├── client.ts      # Base API client
├── auth.ts        # Authentication
├── users.ts       # User management
├── products.ts    # Products
├── locations.ts   # Locations
├── inventory.ts   # Inventory
├── transactions.ts
├── containers.ts
├── scan.ts
├── serials.ts
├── reports.ts
└── shipments.ts
```

---

## Operasyon Modları

| Kod | Mod | Açıklama |
|-----|-----|----------|
| IN | Giriş | Ürün girişi (alım, üretim) |
| OUT | Çıkış | Ürün çıkışı (satış, sevk) |
| COUNT | Sayım | Stok sayımı |
| TRANSFER | Transfer | Lokasyonlar arası transfer |
| PACK | Paketleme | Kolileme işlemi |
| SHIP | Sevkiyat | Sevkiyat hazırlama |

---

## Depolar

| Kod | Depo | Açıklama |
|-----|------|----------|
| TUR | Türkiye | Ana depo (İstanbul) |
| USA | Amerika | ABD deposu |
| FAB | Fabrika | Üretim deposu |

---

## Eksik / Geliştirilecek Özellikler

### Yüksek Öncelik
- [ ] **Barkod yazdırma** - Zebra printer entegrasyonu
- [ ] **Koli içeriği ekleme** - Sevkiyat kolisine ürün ekleme UI
- [ ] **Mobil uygulama build** - Capacitor APK oluşturma
- [ ] **Production deployment** - Hetzner server kurulumu

### Orta Öncelik
- [ ] **Dashboard grafikleri** - Stok/işlem istatistikleri
- [ ] **Bildirimler** - Düşük stok uyarıları
- [ ] **Excel import/export** - Toplu ürün yükleme
- [ ] **PDF raporlar** - Sayım ve stok raporları

### Düşük Öncelik
- [ ] **Multi-tenant** - Birden fazla şirket desteği
- [ ] **Webhook entegrasyonları** - E-ticaret platformları
- [ ] **Audit log görüntüleme** - Detaylı işlem geçmişi UI
- [ ] **Tema desteği** - Dark mode

---

## Deployment Planı

### Hetzner Server Kurulumu
```bash
# 1. Server gereksinimleri
- Ubuntu 22.04 LTS
- 4GB RAM minimum
- 80GB SSD

# 2. Kurulacak yazılımlar
- Node.js 20.x
- PostgreSQL 15
- Redis 7
- Nginx
- PM2
- Certbot (SSL)

# 3. Domain ayarları
- A record: api.swiftstock.com -> server IP
- A record: app.swiftstock.com -> server IP

# 4. SSL sertifikası
- Let's Encrypt ile otomatik SSL
```

### CI/CD Pipeline (Opsiyonel)
```
GitHub Actions:
  - Push to main → Build → Test → Deploy
```

---

## Teknoloji Stack

### Backend
- **Runtime:** Node.js 20.x
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL
- **Cache:** Redis
- **Auth:** JWT + Google OAuth
- **Validation:** Zod
- **Docs:** Swagger

### Frontend
- **Framework:** React 18
- **Build:** Vite
- **Language:** TypeScript
- **State:** Zustand
- **Routing:** React Router v6
- **Mobile:** Capacitor (Android/iOS)
- **Camera:** BarcodeScanner plugin

---

## Notlar

1. Tüm API endpoint'leri `/api` prefix'i ile başlar
2. Kimlik doğrulama gerektiren endpoint'ler `authenticateToken` middleware kullanır
3. Rol bazlı erişim `requireRole('ADMIN', 'MANAGER')` ile sağlanır
4. Rate limiting login ve password değiştirme işlemlerinde aktif
5. CORS tüm origin'lere açık (development), production'da kısıtlanmalı

---

*Son güncelleme: Aralık 2024*
