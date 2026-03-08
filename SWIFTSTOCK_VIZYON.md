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
| `NJ` | New Jersey Deposu | Şirket | İlerde |
| `NL` | Hollanda Deposu | Şirket | İlerde |
| `UK` | İngiltere Deposu | Şirket | İlerde |

### 3.2 Fabrika Deposu — Zone Yapısı

**Karar: Tek warehouse + zone bazlı lokasyon** (ayrı depolar yerine)

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

### 5.3 Toplu Hareket
- Koli/palet barkodu okutulduğunda **tüm içerik tek birim** gibi hareket eder
- Transfer, sevkiyat, raf atama: koli adı/kodu ile yapılır

### 5.4 Container Dağıtma (Kırma)
- Koli/palet içindeki **tekil bir ürün** müstakil olarak taratılırsa:
  - Container otomatik olarak **dağıtılır**
  - Geri kalan ürünler **tekil** olarak bulundukları rafa kaydedilir
  - Dağıtılan container kapatılır

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
| Seri No Takibi | ✅ | ⚠️ | Backend tam, UI güncellenmeli (zorunlu hale getirildi) |
| Container — Kullanıcı Adı + Sevkiyat Bağı | ❌ | ❌ | Backend + UI yeni tasarım gerekiyor |
| Kategori → Zone Otomatik Eşleme | ❌ | ❌ | pricelab_db entegrasyonu gerekiyor |
