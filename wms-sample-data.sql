-- ============================================
-- SAMPLE DATA FOR TESTING
-- ============================================

-- Sample Products
INSERT INTO products (sku_code, product_name, description, barcode, base_unit, units_per_box, boxes_per_pallet) VALUES
('SKU-001', 'Laptop Dell XPS 13', 'High-performance laptop', '7891234567890', 'EACH', 1, 50),
('SKU-002', 'Wireless Mouse', 'Ergonomic wireless mouse', '7891234567891', 'EACH', 10, 100),
('SKU-003', 'USB-C Cable 2m', 'Fast charging cable', '7891234567892', 'EACH', 50, 200),
('SKU-004', 'Monitor 27inch', '4K UHD Monitor', '7891234567893', 'EACH', 4, 40),
('SKU-005', 'Keyboard Mechanical', 'RGB Mechanical Keyboard', '7891234567894', 'EACH', 6, 60),
('SKU-006', 'Webcam HD', '1080p Webcam with mic', '7891234567895', 'EACH', 12, 120),
('SKU-007', 'Headphones Wireless', 'Noise cancelling', '7891234567896', 'EACH', 8, 80),
('SKU-008', 'USB Hub 7-Port', 'Powered USB hub', '7891234567897', 'EACH', 20, 200),
('SKU-009', 'SSD 1TB', 'External SSD drive', '7891234567898', 'EACH', 15, 150),
('SKU-010', 'Phone Case', 'Protective case', '7891234567899', 'EACH', 100, 500);

-- Sample Locations
INSERT INTO locations (warehouse_id, qr_code, description) VALUES
-- USA locations
(1, 'USA-A01-R01-S01', 'Aisle A, Rack 1, Shelf 1'),
(1, 'USA-A01-R01-S02', 'Aisle A, Rack 1, Shelf 2'),
(1, 'USA-A02-R01-S01', 'Aisle A, Rack 2, Shelf 1'),
(1, 'USA-B01-R01-S01', 'Aisle B, Rack 1, Shelf 1'),

-- Turkey locations
(2, 'TUR-A01-R01-S01', 'Koridor A, Raf 1, Kasa 1'),
(2, 'TUR-A01-R01-S02', 'Koridor A, Raf 1, Kasa 2'),
(2, 'TUR-A02-R01-S01', 'Koridor A, Raf 2, Kasa 1'),
(2, 'TUR-B01-R01-S01', 'Koridor B, Raf 1, Kasa 1');

-- Sample Initial Inventory (USA Warehouse)
INSERT INTO inventory (sku_code, warehouse_id, location_id, quantity_each, updated_by) VALUES
('SKU-001', 1, 3, 25, 'admin'),  -- USA-A01-R01-S01: 25 laptops
('SKU-002', 1, 3, 150, 'admin'), -- USA-A01-R01-S01: 150 mice (15 boxes)
('SKU-003', 1, 4, 500, 'admin'), -- USA-A01-R01-S02: 500 cables (10 boxes)
('SKU-004', 1, 5, 40, 'admin'),  -- USA-A02-R01-S01: 40 monitors (10 boxes)
('SKU-005', 1, 5, 60, 'admin'),  -- USA-A02-R01-S01: 60 keyboards (10 boxes)
('SKU-006', 1, 6, 120, 'admin'), -- USA-B01-R01-S01: 120 webcams (10 boxes)
('SKU-007', 1, 6, 80, 'admin'),  -- USA-B01-R01-S01: 80 headphones (10 boxes)
('SKU-008', 1, 4, 200, 'admin'), -- USA-A01-R01-S02: 200 USB hubs (10 boxes)
('SKU-009', 1, 5, 150, 'admin'), -- USA-A02-R01-S01: 150 SSDs (10 boxes)
('SKU-010', 1, 6, 1000, 'admin'); -- USA-B01-R01-S01: 1000 phone cases (10 boxes)

-- Sample Initial Inventory (Turkey Warehouse)
INSERT INTO inventory (sku_code, warehouse_id, location_id, quantity_each, updated_by) VALUES
('SKU-001', 2, 7, 15, 'admin'),  -- TUR-A01-R01-S01: 15 laptops
('SKU-002', 2, 7, 100, 'admin'), -- TUR-A01-R01-S01: 100 mice (10 boxes)
('SKU-003', 2, 8, 300, 'admin'), -- TUR-A01-R01-S02: 300 cables (6 boxes)
('SKU-004', 2, 9, 20, 'admin'),  -- TUR-A02-R01-S01: 20 monitors (5 boxes)
('SKU-005', 2, 9, 36, 'admin'),  -- TUR-A02-R01-S01: 36 keyboards (6 boxes)
('SKU-006', 2, 10, 60, 'admin'),  -- TUR-B01-R01-S01: 60 webcams (5 boxes)
('SKU-007', 2, 10, 40, 'admin'),  -- TUR-B01-R01-S01: 40 headphones (5 boxes)
('SKU-008', 2, 8, 100, 'admin'), -- TUR-A01-R01-S02: 100 USB hubs (5 boxes)
('SKU-009', 2, 9, 75, 'admin'),  -- TUR-A02-R01-S01: 75 SSDs (5 boxes)
('SKU-010', 2, 10, 500, 'admin'); -- TUR-B01-R01-S01: 500 phone cases (5 boxes)

-- Sample Container (Box)
INSERT INTO containers (barcode, container_type, warehouse_id, created_by, status) VALUES
('KOL-00001', 'BOX', 1, 'admin', 'ACTIVE'),
('KOL-00002', 'BOX', 1, 'admin', 'ACTIVE'),
('KOL-00003', 'BOX', 2, 'admin', 'ACTIVE');

-- Sample Container Contents
INSERT INTO container_contents (container_id, sku_code, quantity) VALUES
(1, 'SKU-002', 10),  -- KOL-00001 contains 10 mice
(1, 'SKU-003', 50),  -- KOL-00001 contains 50 cables
(2, 'SKU-006', 12),  -- KOL-00002 contains 12 webcams
(3, 'SKU-002', 10),  -- KOL-00003 contains 10 mice (Turkey)
(3, 'SKU-010', 100); -- KOL-00003 contains 100 phone cases (Turkey)

-- Sample Transactions (past movements)
INSERT INTO transactions (transaction_type, warehouse_id, location_id, reference_no, notes, created_by, device_id) VALUES
(1, 'IN', 1, 3, 'PO-2024-001', 'Initial stock - USA', 'admin', 'WEB'),
(2, 'IN', 2, 7, 'PO-2024-002', 'Initial stock - Turkey', 'admin', 'WEB'),
(3, 'OUT', 1, 3, 'SO-2024-001', 'Customer order #1234', 'admin', 'WEB'),
(4, 'OUT', 2, 7, 'SO-2024-002', 'Customer order #5678', 'admin', 'WEB');

-- Sample Transaction Items
INSERT INTO transaction_items (transaction_id, sku_code, quantity, unit_type, quantity_each, to_location_id) VALUES
-- Transaction 1 (USA IN)
(1, 'SKU-001', 25, 'EACH', 25, 3),
(1, 'SKU-002', 15, 'BOX', 150, 3),
(1, 'SKU-003', 10, 'BOX', 500, 4),

-- Transaction 2 (Turkey IN)
(2, 'SKU-001', 15, 'EACH', 15, 7),
(2, 'SKU-002', 10, 'BOX', 100, 7),

-- Transaction 3 (USA OUT)
(3, 'SKU-001', 5, 'EACH', 5, 3),
(3, 'SKU-002', 20, 'EACH', 20, 3),

-- Transaction 4 (Turkey OUT)
(4, 'SKU-001', 3, 'EACH', 3, 7),
(4, 'SKU-002', 10, 'EACH', 10, 7);

-- Note: The inventory table already has the correct quantities
-- because the trigger automatically updates it based on transactions

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- View inventory summary
SELECT * FROM v_inventory_summary ORDER BY warehouse_code, product_name;

-- View recent transactions
SELECT * FROM v_recent_transactions LIMIT 10;

-- View container details
SELECT * FROM v_container_details;

-- Check total inventory
SELECT 
    w.code as warehouse,
    COUNT(DISTINCT i.sku_code) as unique_skus,
    SUM(i.quantity_each) as total_units
FROM inventory i
JOIN warehouses w ON i.warehouse_id = w.warehouse_id
WHERE i.quantity_each > 0
GROUP BY w.code;
