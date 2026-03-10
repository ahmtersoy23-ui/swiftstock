# SwiftStock — Ürün Yaşam Döngüsü

> Bir ürünün üretimden pazar yerine kadar geçtiği tüm aşamalar

---

## Ana Yol: FACTORY → TR → NJ → Pazar Yeri

```
 1. ÜRETİM TAMAMLANDI
 2. ETİKET BASILDI          ← Products sayfası
 3. FACTORY'E GİRİŞ (IN)   ← Operasyonlar / FACTORY
 4. RAFA YERLEŞTİRME        ← Operasyonlar / TRANSFER (opsiyonel)
 5. FACTORY → TR TRANSFERİ  ← Operasyonlar / TRANSFER
 6. TR'DE RAFA YERLEŞTİRME  ← Operasyonlar / TRANSFER (opsiyonel)
 7. SEVKİYAT OLUŞTURULDU    ← Sevkiyat sayfası (kaynak: TR)
 8. KOLİ OLUŞTURULDU        ← Sevkiyat / + Koli (hedef: NJ)
 9. KOLİYE ÜRÜN YÜKLENDİ   ← Operasyonlar / koli barkodu okutulur
10. SEVKİYAT KAPATILDI      ← Sevkiyat / Kapat → CLOSED
11. SEVKİYAT GÖNDERİLDİ    ← Sevkiyat / Gönder → SHIPPED
12. NJ'YE GİRİŞ (varışta)  ← Operasyonlar / NJ / IN
13. NJ → FBA SEVKİYATI     ← Sevkiyat sayfası (kaynak: NJ)
14. PAZAR YERİNE ULAŞTI    ← Manuel kapatma (FBA/USA)
```

---

## Adım Detayları

### 1. Üretim Tamamlandı
- Üretim birimi ürünü bitirdi
- IWASKU kodu zaten katalogda tanımlı (PriceLab üzerinden)

---

### 2. Etiket Basıldı
- **Sayfa:** Products
- IWASKU'yu ara → **Etiket Bas**
- Miktar gir → sistem seri numaralarını otomatik üretir
- Zebra yazıcıdan barkod çıktısı: `IWA-METAL-0001-000001`
- Etiket ürüne yapıştırılır

---

### 3. FACTORY'e Giriş (IN)
- **Sayfa:** Operasyonlar | **Depo:** FACTORY | **Mod:** GİRİŞ → RECEIVING
- `IWA-METAL-0001-000001` barkodu okutulur
- Sistem ürünün kategorisini okur → **zone önerisi** çıkar (örn. "IWA Metal")
- Zone onaylanır veya değiştirilir
- Stok: `FACTORY / IWA Metal zone`

> ⚠️ Seri numarası olmadan FACTORY'e giriş yapılamaz — sistem reddeder.

---

### 4. Rafa Yerleştirme *(opsiyonel)*
- **Mod:** TRANSFER (aynı depo içi)
- RECEIVING alanından hedef rafa taşınır
- Stok: `FACTORY / A-01-B-02 rafı`

---

### 5. FACTORY → TR Transferi
- **Sayfa:** Operasyonlar | **Depo:** FACTORY | **Mod:** TRANSFER
- Hedef: **TR**
- Barkod okutulur → işlem tamamlanır
- Stok: `FACTORY → 0` | `TR → 1 adet`

---

### 6. TR'de Rafa Yerleştirme *(opsiyonel)*
- TR deposu içinde RECEIVING → hedef rafa transfer
- Stok: `TR / ilgili raf`

---

### 7. Sevkiyat Oluşturuldu
- **Sayfa:** Sevkiyat → **+ Yeni**
- Kaynak Depo: **TR** (veya NJ)
- Prefix: `IST` → koliler `IST-00001`, `IST-00002`... olarak numaralanır
- Sanal depo açıldı — durum: **OPEN**

---

### 8. Koli Oluşturuldu
- `IST` sevkiyatına tıkla
- Hedef: **NJ Deposu** → **+ Koli**
- Koli barkodu üretildi: `IST-00001`
- Birden fazla koli farklı hedeflerle oluşturulabilir (NJ, NL, UK, USA, FBA)

---

### 9. Koliye Ürün Yüklendi
- **Sayfa:** Operasyonlar | **Mod:** PAKETLEME veya koli barkodu okutulur
- `IST-00001` kolisi açılır
- `IWA-METAL-0001-000001` barkodu okutulur → koliye eklendi
- Stok durumu: **transit**

---

### 10. Sevkiyat Kapatıldı
- Sevkiyat kartında **Kapat** butonu
- Tüm açık koliler otomatik kapanır
- Durum: **CLOSED**
- Bu aşamadan sonra yeni koli eklenemez

---

### 11. Sevkiyat Gönderildi
- **Gönder** butonu → onay
- Durum: **SHIPPED**
- Ürün fiziksel olarak yola çıktı; transit stokta izlenir

---

### 12. NJ'ye Giriş *(varışta)*
- **Sayfa:** Operasyonlar | **Depo:** NJ | **Mod:** GİRİŞ
- `IST-00001` koli barkodu okutulur → içindeki tüm ürünler NJ'ye alınır
- Stok: `NJ deposu`

---

### 13. NJ → Pazar Yeri Sevkiyatı
- **Sayfa:** Sevkiyat → **+ Yeni** | Kaynak: **NJ**
- Hedef seçenekleri: **ABD Pazar (USA)** veya **Amazon FBA**
- Koli oluştur → ürün yükle → Kapat → Gönder

---

### 14. Pazar Yerine Ulaştı
- **USA:** Wayfair / Walmart deposu → manuel kapatma
- **FBA:** Amazon FBA deposu → manuel kapatma
- Stok artık pazar yeri tarafında

---

## Alternatif Rotalar

### TR → Avrupa Deposu (NL veya UK)
```
FACTORY → TR → Sevkiyat (NL kolisi) → SHIPPED
                                          ↓
                               NL deposuna GİRİŞ → raflanır
```

### Doğrudan TR → Pazar Yeri
```
FACTORY → TR → Sevkiyat (USA/FBA kolisi) → SHIPPED → Manuel kapatma
```

---

## Stok Durumu Özeti

| Aşama | Stok Konumu |
|-------|-------------|
| 3 sonrası | FACTORY |
| 5 sonrası | TR |
| 9–11 arası | Transit (sanal depo) |
| 12 sonrası | NJ / NL / UK |
| 14 sonrası | Pazar yeri (FBA/USA) |
