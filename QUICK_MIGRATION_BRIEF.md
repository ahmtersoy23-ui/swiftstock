# SwiftStock Migration - Quick Brief

## Görev

SwiftStock'u Docker containerized setup'tan PM2'ye taşı ve pricelab_db'yi shared database olarak kullan.

## Ana Değişiklikler

### 1. Database
- **Önce**: Kendi `wms_db` database'i
- **Sonra**: `pricelab_db` shared database
- **User**: `swiftstock` (yeni user, limited permissions)

### 2. Table Names
Tüm SwiftStock tablolarına `wms_` prefix ekle:
```
warehouses         → wms_warehouses
locations          → wms_locations
containers         → wms_containers
container_contents → wms_container_contents
inventory          → wms_inventory
stock_movements    → wms_stock_movements
users              → wms_users
```

**Shared table** (değişmez):
```
products → products (READ-ONLY, pricelab products tablosu)
```

### 3. Field Names
**Önemli**: `sku_code` → `product_sku`

Pricelab `products` tablosu `product_sku` field'ı kullanıyor, `sku_code` değil.

### 4. Database Connection
```typescript
// src/config/database.ts
const config = {
  host: 'localhost',      // Docker'da 'postgres' idi
  database: 'pricelab_db', // wms_db değil
  user: 'swiftstock',      // wms_user değil
  // ...
}
```

## Yapılacaklar

### Kod Değişiklikleri
1. **Tüm queries**: Table name'leri `wms_*` yap
2. **Tüm queries**: `sku_code` → `product_sku` değiştir
3. **Database config**: `pricelab_db` kullan
4. **Products queries**: Pricelab schema'ya uyarla
   - `sku_code` → `product_sku`
   - `product_name` → `name`
   - `barcode` → (yok, kaldır veya product_sku kullan)

### Örnek Değişiklik

**Önceki:**
```typescript
// controllers/inventoryController.ts
const inventory = await db.query(`
  SELECT i.*, p.product_name, p.barcode
  FROM inventory i
  JOIN products p ON i.sku_code = p.sku_code
  WHERE i.warehouse_id = $1
`, [warehouseId]);
```

**Yeni:**
```typescript
// controllers/inventoryController.ts
const inventory = await db.query(`
  SELECT i.*, p.name as product_name, p.product_sku
  FROM wms_inventory i
  JOIN products p ON i.product_sku = p.product_sku
  WHERE i.warehouse_id = $1
`, [warehouseId]);
```

## Migration Script

`migrate-to-pricelab-db.sql` dosyasını sunucuda çalıştır:
```bash
sudo -u postgres psql -d pricelab_db -f migrate-to-pricelab-db.sql
```

Bu script:
1. ✅ `swiftstock` user'ı oluşturur
2. ✅ `wms_*` tablolarını oluşturur
3. ✅ İzinleri ayarlar
4. ✅ Initial warehouse data ekler

## Dosyalar

Detaylı bilgi için:
- **Migration Detayları**: `MIGRATION_TO_PM2.md`
- **Deployment Adımları**: `PM2_DEPLOYMENT_PLAN.md`
- **Database Script**: `migrate-to-pricelab-db.sql`

## Önemli Kısıtlamalar

### Products Tablosu READ-ONLY
`swiftstock` user'ı `products` tablosuna **sadece SELECT** yapabilir:
- ✅ Ürün listesi alabilir
- ❌ Yeni ürün ekleyemez
- ❌ Ürün güncelleyemez

**Sonuç**: Ürün yönetimi PriceLab'den yapılır.

### Barcode Field Yok
Pricelab `products` tablosunda `barcode` field'ı yok:
- **Çözüm**: `product_sku`'yu barcode yerine kullan
- **Alternatif**: `sku_master` tablosuna barcode ekle (ileride)

### Foreign Key Constraints
`wms_inventory`, `wms_container_contents` gibi tablolarda `products` tablosuna hard foreign key YOK:
- **Neden**: Permission kısıtlaması
- **Çözüm**: Application-level validation

## Test Checklist

Build ve deploy ettikten sonra:

```bash
# 1. Database bağlantı testi
curl https://swiftstock.iwa.web.tr/api/health

# 2. Login testi
curl -X POST https://swiftstock.iwa.web.tr/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# 3. Products testi (shared table)
curl https://swiftstock.iwa.web.tr/api/products \
  -H "Authorization: Bearer $TOKEN"

# 4. Warehouses testi (wms_ table)
curl https://swiftstock.iwa.web.tr/api/warehouses \
  -H "Authorization: Bearer $TOKEN"
```

## RAM Tasarrufu

**Docker ile**: 2,117 MB total (1,400 MB SwiftStock)
**PM2 ile**: 1,014 MB total (+20 MB SwiftStock)

**KAZANÇ**: 1,103 MB RAM! 🎉

## Sorular?

Detaylı dokümantasyon için `MIGRATION_TO_PM2.md` dosyasına bak.
