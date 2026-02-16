# SwiftStock WMS - 4GB Sunucu Deployment Rehberi

## 🎯 Sunucu Özellikleri
- **RAM**: 4 GB
- **Disk**: 40 GB
- **Mevcut Uygulamalar**: 4 adet (amzsellmetrics, stockpulse, manumaestro, pricelab)

## ⚠️ Durum Analizi

### RAM Kullanım Tahmini:
```
Sistem + Mevcut 4 uygulama    : ~2.5-3 GB
SwiftStock (optimize)         : ~0.8-1 GB
──────────────────────────────────────────
TOPLAM                        : ~3.3-4 GB (RAM'in %82-100'ü)
```

**Sonuç**: Sıkışık ama çalışabilir durumda. Optimizasyon şart!

---

## 📋 Deployment Seçenekleri

### **Seçenek 1: Tam Optimizasyon (ÖNERİLEN)** ✅

**Ne İçerir:**
- PostgreSQL memory tuning
- Redis max memory limit (96MB)
- Node.js heap size limit (320MB)
- Docker resource constraints

**Avantajlar:**
- ✅ En düşük RAM kullanımı (~800MB)
- ✅ OOM killer riski minimuma iner
- ✅ Diğer uygulamalar etkilenmez

**Dezavantajlar:**
- ⚠️ Yoğun trafikte yavaşlama olabilir
- ⚠️ Çok sayıda eşzamanlı kullanıcı sorunu yaratabilir

**Kullanım:**
```bash
cd /path/to/swiftstock
docker-compose -f docker-compose.optimized.yml up -d
```

---

### **Seçenek 2: PostgreSQL Paylaşımı** 🔄

**Fikir**: Diğer uygulamalardan biri zaten PostgreSQL kullanıyorsa, SwiftStock aynı PostgreSQL instance'ını kullanabilir.

**Avantajlar:**
- ✅ ~250MB RAM tasarrufu
- ✅ Bir PostgreSQL yerine tek instance

**Gereksinimler:**
- Mevcut PostgreSQL versiyonu 14+ olmalı
- Yeni database oluşturma yetkisi

**Değişiklik:**
```yaml
# docker-compose.yml'den postgres servisini kaldır
# Backend'e bağlantı bilgileri:
DB_HOST: <mevcut-postgres-host>
DB_PORT: 5432
DB_NAME: wms_db  # Yeni database
```

---

### **Seçenek 3: External Redis Kullan** 🔄

**Fikir**: Eğer mevcut uygulamalardan biri Redis kullanıyorsa paylaş.

**Avantajlar:**
- ✅ ~100MB RAM tasarrufu
- ✅ Tek Redis instance

**Değişiklik:**
```yaml
# docker-compose.yml'den redis servisini kaldır
# Backend'e bağlantı:
REDIS_HOST: <mevcut-redis-host>
REDIS_PORT: 6379
```

---

### **Seçenek 4: Minimum Install (En Hafif)** 🪶

**Kurulum:**
- PostgreSQL: Harici (shared)
- Redis: Harici (shared)
- Backend: Docker ile limit
- Frontend: Nginx (static)

**Toplam RAM**: ~400-500MB

**Değişiklikler:**
```bash
# Sadece backend ve frontend deploy et
docker-compose -f docker-compose.minimal.yml up -d
```

---

## 🚀 Adım Adım Kurulum (Optimize)

### 1. Dosyaları Sunucuya Yükle
```bash
# Yerel makineden sunucuya
scp -r swiftstock/ user@your-server:/opt/swiftstock
```

### 2. .env Dosyasını Hazırla
```bash
cd /opt/swiftstock
cp .env.example .env
nano .env

# Değiştir:
POSTGRES_PASSWORD=güçlü_şifre_buraya
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)
VITE_API_URL=https://your-domain.com/api/v1
```

### 3. Docker Compose ile Başlat
```bash
# Optimized versiyonu kullan
docker-compose -f docker-compose.optimized.yml up -d

# Logları izle
docker-compose -f docker-compose.optimized.yml logs -f
```

### 4. Veritabanını Initialize Et
```bash
# İlk defa çalıştırıyorsan
docker exec -i wms-postgres psql -U wms_user -d wms_db < wms-schema.sql
docker exec -i wms-postgres psql -U wms_user -d wms_db < wms-sample-data.sql
```

### 5. Health Check
```bash
# Backend sağlık kontrolü
curl http://localhost:3001/api/health

# Çıktı:
# {"status":"ok","timestamp":"...","database":"connected","redis":"connected"}
```

---

## 📊 İzleme ve Optimizasyon

### RAM Kullanımını İzle
```bash
# Tüm container'ların RAM kullanımı
docker stats

# SwiftStock servisleri
docker stats wms-postgres wms-redis backend frontend
```

### Beklenen Çıktı:
```
NAME            CPU %    MEM USAGE / LIMIT     MEM %
wms-postgres    2%       180MB / 256MB         70%
wms-redis       1%       85MB / 128MB          66%
backend     5%       290MB / 384MB         75%
frontend    0.5%     25MB / 64MB           39%
```

### Log Temizliği
```bash
# Docker log boyutunu sınırla
docker-compose -f docker-compose.optimized.yml down
# .env'e ekle:
echo "COMPOSE_LOG_MAX_SIZE=10m" >> .env
echo "COMPOSE_LOG_MAX_FILE=3" >> .env
docker-compose -f docker-compose.optimized.yml up -d
```

---

## ⚡ Performans İyileştirmeleri

### 1. Nginx Gzip Compression
Frontend Dockerfile'a ekle:
```nginx
gzip on;
gzip_types text/css application/javascript application/json;
gzip_min_length 1000;
```

### 2. PostgreSQL Connection Pooling
Backend'de zaten var (pg-pool), ancak limit düşük tutulmuş:
```env
POSTGRES_MAX_CONNECTIONS=50  # Default: 100
```

### 3. Redis Eviction Policy
Zaten ayarlanmış:
```
maxmemory-policy allkeys-lru  # Eski verileri otomatik sil
```

### 4. Node.js Cluster Mode (İsteğe Bağlı)
Eğer CPU idle ise:
```javascript
// PM2 kullanarak:
pm2 start dist/index.js -i 2  # 2 instance
```

---

## 🔥 Sorun Giderme

### Sorun: "Out of Memory" Hatası
```bash
# Swap alanını kontrol et
free -h

# Swap yoksa oluştur (2GB):
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Kalıcı yap:
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Sorun: Container Sürekli Restart Oluyor
```bash
# Logları kontrol et
docker logs backend --tail 100

# Bellek limiti aşıldıysa artır:
# docker-compose.optimized.yml'de memory limits'i değiştir
```

### Sorun: Yavaş Yanıt Veriyor
```bash
# Redis cache'i temizle
docker exec -it wms-redis redis-cli FLUSHALL

# PostgreSQL vacuum
docker exec -it wms-postgres psql -U wms_user -d wms_db -c "VACUUM ANALYZE;"
```

---

## 🎯 Tavsiyeler

### ✅ Yapılması Gerekenler:
1. **Swap alanı oluştur** (en az 2GB)
2. **Monitoring kur** (Prometheus + Grafana veya basit cron script)
3. **Auto-restart policy** aktif (zaten `restart: unless-stopped` var)
4. **Backup stratejisi** oluştur (PostgreSQL dump'ları)
5. **Log rotation** aktif et

### ⚠️ Yapılmaması Gerekenler:
1. Aynı anda tüm uygulamalarda yük testi yapma
2. RAM limitlerini kaldırma (OOM killer riski)
3. Swap olmadan production'a alma
4. Log dosyalarını sınırsız büyüt

---

## 📈 Gelecek Planları

### RAM Yükseltme Zamanı Gelince:
**6GB RAM'e yükseltilirse:**
- Docker resource limits kaldırılabilir
- PostgreSQL shared_buffers → 256MB
- Redis maxmemory → 512MB
- Backend heap → 512MB
- Rahat çalışır ✅

**8GB RAM'e yükseltilirse:**
- Tüm limitler kaldırılabilir
- Production-grade performans
- Çok kullanıcılı senaryolar rahat çalışır ✅

---

## 📞 Destek

Sorun yaşarsan:
1. `docker logs` komutlarıyla logları kontrol et
2. `docker stats` ile kaynak kullanımını izle
3. Gerekirse bana geri dön!

---

**Hazırlayan**: Claude AI Assistant
**Tarih**: 2026-01-20
**Versiyon**: 1.0 - Optimized for 4GB RAM
