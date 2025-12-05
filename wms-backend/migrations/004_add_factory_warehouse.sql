-- ============================================
-- ADD FACTORY WAREHOUSE
-- ============================================

-- Insert factory warehouse
INSERT INTO warehouses (code, name, address, is_active) VALUES
('FAB', 'Fabrika', 'Isparta Fabrika Tesisleri', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- FACTORY CATEGORY-BASED LOCATIONS
-- ============================================

-- Insert category-based locations for factory (no aisle/bay/level structure)
INSERT INTO locations (
  warehouse_id,
  location_code,
  qr_code,
  description,
  zone,
  location_type,
  is_active
) VALUES
-- Factory categories
((SELECT warehouse_id FROM warehouses WHERE code = 'FAB' LIMIT 1), 'LOC-FAB-SARFIYAT', 'LOC-FAB-SARFIYAT', 'Sarfiyat Malzemeler Alanı', 'CATEGORY', 'FLOOR', true),
((SELECT warehouse_id FROM warehouses WHERE code = 'FAB' LIMIT 1), 'LOC-FAB-HAMMADDE', 'LOC-FAB-HAMMADDE', 'Hammadde Depolama Alanı', 'CATEGORY', 'FLOOR', true),
((SELECT warehouse_id FROM warehouses WHERE code = 'FAB' LIMIT 1), 'LOC-FAB-HARITA', 'LOC-FAB-HARITA', 'Harita Saklama Alanı', 'CATEGORY', 'FLOOR', true),
((SELECT warehouse_id FROM warehouses WHERE code = 'FAB' LIMIT 1), 'LOC-FAB-METAL', 'LOC-FAB-METAL', 'Metal Parça Deposu', 'CATEGORY', 'FLOOR', true),
((SELECT warehouse_id FROM warehouses WHERE code = 'FAB' LIMIT 1), 'LOC-FAB-AHSAP', 'LOC-FAB-AHSAP', 'Ahşap Malzeme Alanı', 'CATEGORY', 'FLOOR', true),
((SELECT warehouse_id FROM warehouses WHERE code = 'FAB' LIMIT 1), 'LOC-FAB-MOBILYA', 'LOC-FAB-MOBILYA', 'Mobilya Depolama Alanı', 'CATEGORY', 'FLOOR', true),
((SELECT warehouse_id FROM warehouses WHERE code = 'FAB' LIMIT 1), 'LOC-FAB-MONTAJ', 'LOC-FAB-MONTAJ', 'Montaj Atölyesi', 'CATEGORY', 'FLOOR', true),
((SELECT warehouse_id FROM warehouses WHERE code = 'FAB' LIMIT 1), 'LOC-FAB-CAM', 'LOC-FAB-CAM', 'Cam Malzeme Deposu', 'CATEGORY', 'FLOOR', true)
ON CONFLICT (location_code) DO NOTHING;

-- ============================================
-- ADD CUSTOM CATEGORY ZONE TYPE
-- ============================================

-- Note: The 'zone' field now supports 'CATEGORY' for factory-style locations
-- This allows flexible location structures:
--   - Warehouses (USA, TUR): RECEIVING, STORAGE, PICKING, SHIPPING zones with aisle/bay/level
--   - Factory (FAB): CATEGORY zone without hierarchical structure

COMMENT ON COLUMN locations.zone IS 'Location zone: RECEIVING, STORAGE, PICKING, SHIPPING for warehouses; CATEGORY for factory category-based locations; NULL for legacy locations';
