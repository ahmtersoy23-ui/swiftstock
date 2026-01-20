# SwiftStock - Docker'dan PM2'ye Migration

## Özet

SwiftStock'u Docker containerized setup'tan PM2'ye taşıyoruz ve pricelab_db'yi shared database olarak kullanacağız.

## Neden Bu Değişiklik?

### Avantajlar
- ✅ **1,530 MB RAM tasarrufu** (Docker overhead yok)
- ✅ **Tek PostgreSQL instance** (pricelab_db shared)
- ✅ **Mevcut 3.7 GB RAM yeterli** (upgrade gerekmez)
- ✅ **Kolay deployment** (diğer uygulamalarla aynı pattern)
- ✅ **Düşük maliyet** (ekstra sunucu gerekmez)
- ✅ **Redis gereksiz** (cache optional hale gelir)

### Kaynak Kullanımı Karşılaştırması

**Docker ile olsaydı:**
```
Mevcut apps:        387 MB
PostgreSQL:         180 MB
SwiftStock Docker: 1400 MB (PostgreSQL + Redis + Backend + Frontend)
Docker Daemon:      150 MB
─────────────────────────
TOPLAM:           2117 MB (57%)
BOŞ:              1589 MB (43%)
```

**PM2 ile (yeni plan):**
```
Mevcut apps:        387 MB
PostgreSQL:         200 MB (+20 MB, shared DB)
SwiftStock Backend:  78 MB (zaten var!)
Nginx:               12 MB (static files)
─────────────────────────
TOPLAM:           1014 MB (27%)
BOŞ:              2792 MB (73%)
```

**KAZANÇ: 1,103 MB RAM!** 🎉

---

## Database Değişiklikleri

### Paylaşılan Tablolar (pricelab_db'de zaten var)

1. **`products`** - Ürün kataloğu
   - SwiftStock bu tabloyu READ-ONLY kullanacak
   - Field: `product_sku` (SwiftStock'ta `sku_code` yerine)

2. **`sku_master`** - ASIN mappings
   - Barcode taramada kullanılabilir

### Yeni Tablolar (wms_ prefix ile)

SwiftStock-specific tablolar `wms_` prefix ile eklenecek:

- `wms_warehouses` - Depolar (USA, TUR)
- `wms_locations` - Raf lokasyonları + QR kodlar
- `wms_containers` - Koliler ve paletler
- `wms_container_contents` - Koli/palet içindekiler
- `wms_inventory` - Mevcut stok
- `wms_stock_movements` - Stok hareketleri
- `wms_users` - SwiftStock kullanıcıları

### Foreign Key Değişiklikleri

**ÖNCEKİ (kendi DB'sinde):**
```sql
CREATE TABLE inventory (
    sku_code VARCHAR(50) REFERENCES products(sku_code),
    ...
);
```

**YENİ (pricelab_db'de):**
```sql
CREATE TABLE wms_inventory (
    product_sku VARCHAR(50),  -- Soft reference to products(product_sku)
    -- Foreign key YOK çünkü farklı user permissions
    ...
);
```

**Neden Foreign Key Yok?**
- `swiftstock` user'ı `products` tablosuna SELECT yetkisi var
- Ama INSERT/UPDATE/DELETE yetkisi yok
- Foreign key constraint için REFERENCES yetkisi gerekir
- Çözüm: Soft reference (application-level validation)

---

## Backend Kod Değişiklikleri

### 1. Database Config

**Dosya**: `src/config/database.ts`

**Önceki:**
```typescript
const config = {
  host: process.env.DB_HOST || 'postgres',  // Docker service name
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'wms_db',  // Kendi DB
  user: process.env.DB_USER || 'wms_user',
  password: process.env.DB_PASSWORD,
}
```

**Yeni:**
```typescript
const config = {
  host: process.env.DB_HOST || 'localhost',  // PM2 local
  port: parseInt(process.env.DB_PORT || '5432'),
  database: 'pricelab_db',  // SHARED DATABASE
  user: 'swiftstock',       // Yeni user
  password: process.env.DB_PASSWORD,
}
```

### 2. Table Name Değişiklikleri

Tüm query'lerde table name'leri güncellenecek:

**Önceki → Yeni:**
```typescript
'warehouses'         → 'wms_warehouses'
'locations'          → 'wms_locations'
'products'           → 'products' (DEĞİŞMEZ)
'containers'         → 'wms_containers'
'container_contents' → 'wms_container_contents'
'inventory'          → 'wms_inventory'
'stock_movements'    → 'wms_stock_movements'
'users'              → 'wms_users'
```

**Örnek Controller Değişikliği:**

**Önceki:**
```typescript
// src/controllers/warehouseController.ts
const warehouses = await db.query('SELECT * FROM warehouses');
```

**Yeni:**
```typescript
// src/controllers/warehouseController.ts
const warehouses = await db.query('SELECT * FROM wms_warehouses');
```

### 3. Field Name Değişiklikleri

**`sku_code` → `product_sku`** (pricelab products tablosu field adı)

**Önceki:**
```typescript
// Container contents
interface ContainerContent {
  container_id: number;
  sku_code: string;  // Eski field
  quantity: number;
}

// Query
await db.query(
  'SELECT * FROM container_contents WHERE sku_code = $1',
  [skuCode]
);
```

**Yeni:**
```typescript
// Container contents
interface ContainerContent {
  container_id: number;
  product_sku: string;  // Yeni field
  quantity: number;
}

// Query
await db.query(
  'SELECT * FROM wms_container_contents WHERE product_sku = $1',
  [productSku]
);
```

### 4. Products Query Değişiklikleri

**Önceki (kendi products tablosu):**
```typescript
// Products listesi
const products = await db.query(`
  SELECT sku_code, product_name, barcode
  FROM products
  WHERE is_active = true
`);
```

**Yeni (pricelab products tablosu):**
```typescript
// Products listesi (READ-ONLY)
const products = await db.query(`
  SELECT product_sku, name, id
  FROM products
  WHERE product_sku IS NOT NULL
`);

// Field mapping:
// sku_code    → product_sku
// product_name → name
// barcode     → (yok, sku_master'dan alınabilir)
```

---

## Migration Checklist

### Backend Kodu Güncelleme

- [ ] `src/config/database.ts` - Database config
- [ ] All controllers - Table name prefix (`wms_`)
- [ ] All models/types - Field name (`sku_code` → `product_sku`)
- [ ] All queries - UPDATE table names
- [ ] All queries - UPDATE field names
- [ ] Products queries - Use pricelab schema
- [ ] Remove barcode field references (products tablosunda yok)
- [ ] Test all endpoints

### Database Schema

- [ ] Run migration script: `migrate-to-pricelab-db.sql`
- [ ] Verify `wms_*` tables created
- [ ] Verify `swiftstock` user created
- [ ] Verify permissions granted
- [ ] Test shared `products` table access
- [ ] Insert initial warehouse data

### Deployment

- [ ] Build backend: `npm run build`
- [ ] Build frontend: `npm run build`
- [ ] Deploy backend to `/var/www/swiftstock-backend`
- [ ] Deploy frontend to `/var/www/swiftstock/frontend`
- [ ] Setup PM2 ecosystem config
- [ ] Setup Nginx config
- [ ] Setup SSL certificate
- [ ] Test API endpoints
- [ ] Test frontend access

---

## Önemli Notlar

### 1. Products Tablosu READ-ONLY

SwiftStock `products` tablosuna **sadece SELECT** yetkisi var. Bu yüzden:
- ✅ Ürünleri okuyabilir, listeleyebilir
- ❌ Yeni ürün ekleyemez
- ❌ Ürün güncelleyemez
- ❌ Ürün silemez

**Çözüm**: Ürün yönetimi PriceLab'den yapılır, SwiftStock sadece kullanır.

### 2. Barcode Alanı Yok

Pricelab `products` tablosunda `barcode` field'ı yok. Alternatifler:
1. `product_sku` kullan (zaten unique)
2. `sku_master` tablosuna barcode ekle
3. Yeni bir `product_barcodes` tablosu oluştur (ileride)

**Şimdilik**: `product_sku`'yu barcode olarak kullan.

### 3. Redis Kaldırıldı

Docker setup'ta Redis cache vardı. PM2 setup'ta:
- ✅ Session: PostgreSQL session store kullan
- ✅ Cache: Application-level memory cache
- ⚠️ İleride gerekirse Redis eklenebilir

### 4. Foreign Key Constraints

`wms_container_contents`, `wms_inventory` vs. tablolarda `products` tablosuna hard foreign key YOK.
- Soft reference kullanılıyor
- Application-level validation gerekli
- Delete cascade otomatik çalışmaz

---

## Environment Variables

**Production `.env` dosyası:**

```bash
# Node.js
NODE_ENV=production
PORT=3001

# Database (Shared pricelab_db)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pricelab_db
DB_USER=swiftstock
DB_PASSWORD=your_secure_password_here

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# CORS
ALLOWED_ORIGINS=https://swiftstock.iwa.web.tr

# Logging
LOG_LEVEL=info
```

---

## Test Checklist

### Database Tests

```bash
# SSH to server
ssh root@78.47.117.36

# Test connection
sudo -u postgres psql -d pricelab_db -U swiftstock -c "SELECT version();"

# Test products access
sudo -u postgres psql -d pricelab_db -U swiftstock -c "SELECT count(*) FROM products;"

# Test wms_warehouses
sudo -u postgres psql -d pricelab_db -U swiftstock -c "SELECT * FROM wms_warehouses;"

# Test permissions
sudo -u postgres psql -d pricelab_db -U swiftstock -c "INSERT INTO products (name) VALUES ('test');"
# Should fail with permission denied
```

### API Tests

```bash
# Health check
curl https://swiftstock.iwa.web.tr/api/health

# Login
curl -X POST https://swiftstock.iwa.web.tr/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Get warehouses
curl https://swiftstock.iwa.web.tr/api/warehouses \
  -H "Authorization: Bearer $TOKEN"

# Get products (from shared table)
curl https://swiftstock.iwa.web.tr/api/products \
  -H "Authorization: Bearer $TOKEN"
```

---

## Rollback Plan

Eğer sorun çıkarsa geri almak için:

```bash
# 1. PM2 durdur
pm2 stop swiftstock-backend
pm2 delete swiftstock-backend

# 2. Nginx config kaldır
rm /etc/nginx/sites-enabled/swiftstock
systemctl reload nginx

# 3. Database cleanup
sudo -u postgres psql -d pricelab_db << 'EOF'
DROP TABLE IF EXISTS
  wms_stock_movements,
  wms_inventory,
  wms_container_contents,
  wms_containers,
  wms_locations,
  wms_warehouses,
  wms_users
CASCADE;
DROP USER IF EXISTS swiftstock;
EOF
```

---

## İletişim

Sorular için:
- Migration script: `/Users/ahmetersoy/Desktop/swiftstock/migrate-to-pricelab-db.sql`
- Deployment guide: `/Users/ahmetersoy/Desktop/swiftstock/PM2_DEPLOYMENT_PLAN.md`
- Bu doküman: `/Users/ahmetersoy/Desktop/swiftstock/MIGRATION_TO_PM2.md`
