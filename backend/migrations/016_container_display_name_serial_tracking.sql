-- ============================================
-- Migration 016: Container kullanıcı adı + sevkiyat bağı + seri no takibi
-- ============================================

-- 1. Container'a kullanıcı tanımlı isim ve sevkiyat bağı ekleniyor
ALTER TABLE wms_containers
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS shipment_id INTEGER REFERENCES virtual_shipments(shipment_id) ON DELETE SET NULL;

-- Benzersizlik: aynı warehouse içinde display_name tekrar edemez (NULL değerleri hariç)
CREATE UNIQUE INDEX IF NOT EXISTS uq_container_display_name_warehouse
  ON wms_containers(display_name, warehouse_id)
  WHERE display_name IS NOT NULL;

-- Sevkiyat filtrelemesi için index
CREATE INDEX IF NOT EXISTS idx_containers_shipment_id
  ON wms_containers(shipment_id);

-- 2. Transaction item'larına seri no takibi ekleniyor
ALTER TABLE wms_transaction_items
  ADD COLUMN IF NOT EXISTS serial_id INTEGER REFERENCES wms_serial_numbers(serial_id) ON DELETE SET NULL;

-- Seri no bazlı sorgu için index
CREATE INDEX IF NOT EXISTS idx_transaction_items_serial_id
  ON wms_transaction_items(serial_id);
