# SwiftStock PM2 Deployment Plan

## Avantajlar
- ✅ 1,530 MB RAM tasarrufu (Docker overhead yok)
- ✅ Tek PostgreSQL instance (shared pricelab_db)
- ✅ Redis gereksiz (cache isteğe bağlı)
- ✅ Mevcut setup ile uyumlu
- ✅ Kolay deployment (StockPulse gibi)

## Adımlar

### 1. Database Migration (Sunucuda)

```bash
# SSH ile bağlan
ssh root@78.47.117.36

# Migration script'i çalıştır
sudo -u postgres psql -d pricelab_db -f /tmp/migrate-to-pricelab-db.sql

# Test et
sudo -u postgres psql -d pricelab_db -c "\dt wms_*"
```

### 2. Backend Kodu Güncelle (Local)

**Değiştirilecek dosyalar**:
- `wms-backend/src/config/database.ts` → pricelab_db bağlantısı
- Table names: `products` → `products` (değişmez)
- Table names: `warehouses` → `wms_warehouses`
- Table names: `locations` → `wms_locations`
- Table names: `inventory` → `wms_inventory`
- Table names: `containers` → `wms_containers`
- Table names: `container_contents` → `wms_container_contents`
- Table names: `stock_movements` → `wms_stock_movements`
- Table names: `users` → `wms_users`

**Önemli**: `sku_code` → `product_sku` (pricelab products tablosu field adı)

### 3. Build Backend

```bash
cd /Users/ahmetersoy/Desktop/swiftstock/wms-backend

# Dependencies kur
npm install

# TypeScript build
npm run build

# dist/ klasörü oluşacak
```

### 4. Frontend Build

```bash
cd /Users/ahmetersoy/Desktop/swiftstock/wms-frontend

# Dependencies kur
npm install

# Production build
npm run build

# dist/ klasörü oluşacak
```

### 5. Sunucuya Deploy

```bash
# Backend deploy
cd /Users/ahmetersoy/Desktop/swiftstock
scp -r wms-backend/dist root@78.47.117.36:/var/www/swiftstock-backend/
scp wms-backend/package*.json root@78.47.117.36:/var/www/swiftstock-backend/

# Frontend deploy
scp -r wms-frontend/dist/* root@78.47.117.36:/var/www/swiftstock/frontend/

# Environment dosyası
scp wms-backend/.env.production root@78.47.117.36:/var/www/swiftstock-backend/.env
```

### 6. PM2 Setup (Sunucuda)

```bash
ssh root@78.47.117.36

# Backend için dependencies kur
cd /var/www/swiftstock-backend
npm install --production

# PM2 ecosystem dosyası oluştur
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'swiftstock-backend',
    script: 'dist/index.js',
    cwd: '/var/www/swiftstock-backend',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      DB_NAME: 'pricelab_db',
      DB_USER: 'swiftstock',
      DB_PASSWORD: 'your_password_here'
    },
    error_file: '/var/log/pm2/swiftstock-error.log',
    out_file: '/var/log/pm2/swiftstock-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '200M'
  }]
};
EOF

# PM2 başlat
pm2 start ecosystem.config.js
pm2 save
```

### 7. Nginx Config

```bash
# Nginx config düzenle
cat > /etc/nginx/sites-available/swiftstock << 'EOF'
server {
    listen 80;
    server_name swiftstock.iwa.web.tr;

    # Frontend static files
    location / {
        root /var/www/swiftstock/frontend;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Symlink oluştur
ln -sf /etc/nginx/sites-available/swiftstock /etc/nginx/sites-enabled/

# Nginx test ve reload
nginx -t
systemctl reload nginx
```

### 8. SSL Sertifikası (Certbot)

```bash
# Certbot ile SSL
certbot --nginx -d swiftstock.iwa.web.tr

# Auto-renewal kontrol
certbot renew --dry-run
```

## Verification Checklist

- [ ] Database migration başarılı
- [ ] wms_* tabloları oluşturuldu
- [ ] swiftstock user'ı permissions aldı
- [ ] Backend build başarılı
- [ ] Frontend build başarılı
- [ ] PM2 swiftstock-backend çalışıyor
- [ ] Nginx config geçerli
- [ ] SSL sertifikası kuruldu
- [ ] API'ye erişim var (https://swiftstock.iwa.web.tr/api/health)
- [ ] Frontend yükleniyor (https://swiftstock.iwa.web.tr)

## Rollback Plan

Eğer bir sorun olursa:
```bash
# PM2 durdur
pm2 stop swiftstock-backend
pm2 delete swiftstock-backend

# Nginx config kaldır
rm /etc/nginx/sites-enabled/swiftstock
systemctl reload nginx

# Database değişiklikleri geri al
sudo -u postgres psql -d pricelab_db -c "DROP TABLE IF EXISTS wms_users, wms_stock_movements, wms_inventory, wms_container_contents, wms_containers, wms_locations, wms_warehouses CASCADE;"
sudo -u postgres psql -d pricelab_db -c "DROP USER IF EXISTS swiftstock;"
```

## Resource Monitoring

```bash
# PM2 monitoring
pm2 monit

# Memory usage
pm2 list

# Logs
pm2 logs swiftstock-backend --lines 100

# PostgreSQL connections
sudo -u postgres psql -d pricelab_db -c "SELECT count(*) FROM pg_stat_activity WHERE datname='pricelab_db';"
```
