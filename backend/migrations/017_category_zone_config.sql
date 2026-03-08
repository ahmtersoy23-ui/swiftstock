-- ============================================
-- Migration 017: Kategori → Zone eşleme tablosu
-- ============================================
-- Her ürün kategorisinin hangi zone'a yerleştirileceğini tutar.
-- FACTORY deposu için 1:1 eşleme (kategori adı = zone adı).
-- Başlangıç verisi pricelab_db.products.category değerlerinden türetilir.
-- ============================================

CREATE TABLE IF NOT EXISTS wms_category_zone_config (
  id              SERIAL PRIMARY KEY,
  category        VARCHAR(100) NOT NULL,
  zone            VARCHAR(100) NOT NULL,
  warehouse_code  VARCHAR(20)  NOT NULL DEFAULT 'FACTORY',
  is_active       BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(category, warehouse_code)
);

CREATE INDEX IF NOT EXISTS idx_category_zone_warehouse
  ON wms_category_zone_config(warehouse_code, is_active);

-- Başlangıç verisi: pricelab_db.products.category değerlerinden 1:1 eşleme
-- (kategori adı = zone adı, FACTORY deposu için)
INSERT INTO wms_category_zone_config (category, zone, warehouse_code)
SELECT DISTINCT category, category, 'FACTORY'
FROM   products
WHERE  category IS NOT NULL
  AND  category != ''
ON CONFLICT (category, warehouse_code) DO NOTHING;
