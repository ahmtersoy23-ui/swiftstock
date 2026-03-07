# SwiftStock WMS — Sistem Vizyonu

> **Kapsam:** WMS (Depo Yönetimi) — OMS entegrasyonu ve sipariş akışı ayrı fazda ele alınacak.
> **Versiyon:** 1.0 | **Tarih:** 2026-03

---

## 1. Genel Mimari

SwiftStock; üretimden sevkiyata kadar tüm fiziksel stok hareketini takip eden, çok depolu, barkod tabanlı bir Depo Yönetim Sistemi (WMS)'dir.

```
ÜRETİM → FABRİKA DEPOSU → TR DEPO (Ana Sevk) → SANAL DEPO → HEDEF
                                  ↑
                           NJ / NL / UK Depo
                           (ilerde eklenecek)
```

---

## 2. Stok Kimlik Yapısı

| Alan | Açıklama | Kullanım |
|------|----------|----------|
| **IWASKU** (Product ID) | Ürün kimliği — ana stok birimi | Her zaman zorunlu |
| **Seri Numarası** | Tekil ürün takibi | İsteğe bağlı |

- Stok takibi **IWASKU bazlı** yapılır (varsayılan)
- Seri numarası etkinleştirildiğinde tekil ürün bazında iz sürülebilir
- Barkod = `IWASKU` veya `IWASKU-SerialNo` formatında basılır

---

## 3. Depo Yapısı

### 3.1 Fiziksel Depolar (Şirket Depoları)

| Kod | Adı | Tip | Durum |
|-----|-----|-----|-------|
| `FACTORY` | Fabrika Deposu (OSTİM) | Şirket | Aktif |
| `TR` | TR Ana Sevk Deposu (Ankara İvedik) | Şirket | Aktif |
| `NJ` | New Jersey Deposu | Şirket | İlerde |
| `NL` | Hollanda Deposu | Şirket | İlerde |
| `UK` | İngiltere Deposu | Şirket | İlerde |

### 3.2 Fabrika Deposu — Zone Yapısı

**Karar: Tek warehouse + zone bazlı lokasyon** (ayrı depolar yerine)

Tek `FACTORY` warehouse altında zone/alan ayrımı yapılır:

| Zone Kodu | Alan Adı |
|-----------|----------|
| `METAL` | Metal Üretim Alanı |
| `AHSAP_UV` | Ahşap UV Koridor |
| `AHSAP_GIRIS` | Ahşap Giriş Kat |
| `HARITA` | Harita (Cam/Ahşap/UV) |
| `TABLETOP` | Tabletop Alanı |

**Gerekçe:** Tek warehouse = tek stok sorgusu, tek rapor, tek API. Zone field ile fiziksel ayrım sistem içinde karşılanır.

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
2. Her ürüne **IWASKU bazlı barkod** atanır (isteğe bağlı seri no eklenir)
3. Barkod etiketi yazdırılır (Zebra veya benzeri)
4. Ürün sisteme **IN** işlemi ile fabrika deposuna alınır

---

## 5. Koli / Palet (Container) Yönetimi

### 5.1 Oluşturma
- Sistem üzerinden yeni koli veya palet oluşturulur
- Sistem otomatik barkod üretir: `KOL-XXXXX` / `PAL-XXXXX`
- İçine ürünler tek tek barkod okutularak eklenir

### 5.2 Toplu Hareket
- Koli/palet barkodu okutulduğunda **tüm içerik tek birim** gibi hareket eder
- Transfer, sevkiyat, raf atama: koli kodu ile yapılır

### 5.3 Container Dağıtma (Kırma)
- Koli/palet içindeki **tekil bir ürün** müstakil olarak taratılırsa:
  - Container otomatik olarak **dağıtılır**
  - Geri kalan ürünler **tekil** olarak bulundukları rafa kaydedilir
  - Dağıtılan container kapatılır

### 5.4 Hiyerarşi
```
PALET → KOLİ → ÜRÜN
```
- Palet içinde koli olabilir
- Koli içinde ürün olur

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
- Lokasyon yapısı: `ZONE > AISLE > BAY > LEVEL`
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
- Depolar arası (FACTORY → TR, TR → NJ vb.)
- Warehouse → Sanal Warehouse (sevkiyat hazırlığı)

---

## 9. Sanal Warehouse (Sevkiyat Takibi)

### 9.1 Oluşturma
- Sevkiyat başlangıcında kullanıcı sanal depo oluşturur
- Ad: serbest metin (gemi adı, konteyner no, sevkiyat kodu, vb.)
- Örnekler: `SHIP-ISTANBUL-2026-03`, `CNT-NJPOR-0045`

### 9.2 Yükleme
- Ürünler/koliler/paletler sanal depoya transfer edilir
- Stok sayımına dahil olur (transit stok)

### 9.3 Kapatma
- **Şirket deposuna ulaşanlar:** Hedef depoya transfer → sanal depo otomatik kapanır
- **Pazar yeri depolarına gidenler:** Manuel kapatma (API entegrasyonu ilerde)

---

## 10. Stok Görünürlüğü

- Stok her an tüm warehouse yapısında görülür:
  - Fiziksel depolar (FACTORY, TR, NJ…)
  - Sanal depolar (transit)
  - Raf bazlı dağılım
- IWASKU bazlı toplam stok + lokasyon dağılımı
- Seri no etkinse tekil ürün nerede, hangi rafa göre

---

## 11. Kullanıcı Rolleri

| Rol | Yetkiler |
|-----|----------|
| `ADMIN` | Tüm işlemler + sistem yönetimi |
| `MANAGER` | Tüm operasyonel işlemler |
| `OPERATOR` | Barkod okutma, transfer, sayım |
| `VIEWER` | Salt okunur sorgu |

---

## 12. İlerde Gelecek Özellikler (Bu Fazın Dışı)

### OMS Entegrasyonu
- Wisersell API ile sipariş verisi çekme
- Sipariş gelince stoktan düşme
- Hangi depodan karşılanacağı kararı

### Pazar Yeri Entegrasyonları
- Shopify, Amazon, Etsy, Walmart, Wayfair, bol.com…
- DataBridge üzerinden otomatik stok senkronizasyonu

### Kargo Entegrasyonu
- Kargo fiyatı karşılaştırma
- Siparişin hangi depodan çıkacağına karar

### İleri Analitik
- Demand forecasting
- Dead stock tespiti
- Inventory turnover, DOS metrikleri

---

## 13. Mevcut Sistem Durumu (2026-03)

| Modül | Backend | Frontend | Notlar |
|-------|---------|----------|--------|
| Warehouse & Lokasyon | ✅ | ✅ | Tam çalışıyor |
| Container (Koli/Palet) | ✅ | ⚠️ | Backend tam, UI sadece sorgu |
| Ürün / SKU Kataloğu | ✅ | ✅ | Tam çalışıyor |
| IN/OUT/TRANSFER Operasyonları | ✅ | ✅ | Tam çalışıyor |
| Cycle Count / Sayım | ✅ | ✅ | Tam çalışıyor |
| Sevkiyat (Sanal Depo) | ✅ | ✅ | Tam çalışıyor |
| RMA / İade | ✅ | ❌ | Backend tam, frontend yok |
| Orders / Picking | ✅ | ❌ | Backend tam, frontend yok |
| Seri No Takibi | ✅ | ⚠️ | Backend tam, UI kısmi |
