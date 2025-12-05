-- ============================================
-- UPDATE EXISTING LOCATIONS TABLE
-- ============================================

-- Add new columns to existing locations table
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS location_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS zone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS aisle VARCHAR(10),
  ADD COLUMN IF NOT EXISTS bay VARCHAR(10),
  ADD COLUMN IF NOT EXISTS level VARCHAR(10),
  ADD COLUMN IF NOT EXISTS location_type VARCHAR(20) DEFAULT 'RACK',
  ADD COLUMN IF NOT EXISTS capacity_units INTEGER,
  ADD COLUMN IF NOT EXISTS max_weight_kg DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Update location_code from qr_code if not set
UPDATE locations SET location_code = qr_code WHERE location_code IS NULL;

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'locations_location_code_key') THEN
    ALTER TABLE locations ADD CONSTRAINT locations_location_code_key UNIQUE (location_code);
  END IF;
END$$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_locations_warehouse ON locations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_locations_zone ON locations(zone);
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(is_active);

-- ============================================
-- LOCATION INVENTORY
-- ============================================

CREATE TABLE IF NOT EXISTS location_inventory (
  location_inventory_id SERIAL PRIMARY KEY,
  location_id INTEGER NOT NULL REFERENCES locations(location_id) ON DELETE CASCADE,
  sku_code VARCHAR(50) NOT NULL REFERENCES products(sku_code) ON DELETE CASCADE,
  quantity_each INTEGER DEFAULT 0,
  quantity_box INTEGER DEFAULT 0,
  quantity_pallet INTEGER DEFAULT 0,
  last_counted_at TIMESTAMP,
  last_moved_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(location_id, sku_code)
);

CREATE INDEX IF NOT EXISTS idx_location_inventory_location ON location_inventory(location_id);
CREATE INDEX IF NOT EXISTS idx_location_inventory_sku ON location_inventory(sku_code);

-- ============================================
-- OPERATION MODES (trigger barkodları)
-- ============================================

CREATE TABLE IF NOT EXISTS operation_modes (
  mode_id SERIAL PRIMARY KEY,
  mode_code VARCHAR(50) UNIQUE NOT NULL,  -- MODE-IN-RECEIVING, MODE-OUT-PICKING, etc.
  mode_type VARCHAR(20) NOT NULL,  -- RECEIVING, PICKING, TRANSFER, COUNT
  mode_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default operation mode barcodes
INSERT INTO operation_modes (mode_code, mode_type, mode_name, description) VALUES
('MODE-IN-RECEIVING', 'RECEIVING', 'Start Receiving', 'Scan to start receiving/putaway operation'),
('MODE-OUT-PICKING', 'PICKING', 'Start Picking', 'Scan to start picking/shipping operation'),
('MODE-MOVE-TRANSFER', 'TRANSFER', 'Start Transfer', 'Scan to start location transfer'),
('MODE-COUNT-CYCLE', 'COUNT', 'Start Cycle Count', 'Scan to start cycle counting')
ON CONFLICT (mode_code) DO NOTHING;

-- ============================================
-- SCAN SESSIONS (operasyon takibi)
-- ============================================

CREATE TABLE IF NOT EXISTS scan_sessions (
  session_id SERIAL PRIMARY KEY,
  session_code VARCHAR(50) UNIQUE NOT NULL,  -- SESSION-202501-00001
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(warehouse_id),
  user_name VARCHAR(100) NOT NULL,
  mode_type VARCHAR(20) NOT NULL,  -- RECEIVING, PICKING, TRANSFER, COUNT
  status VARCHAR(20) DEFAULT 'ACTIVE',  -- ACTIVE, COMPLETED, CANCELLED
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_sessions_user ON scan_sessions(user_name);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_status ON scan_sessions(status);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_mode ON scan_sessions(mode_type);

-- ============================================
-- SCAN OPERATIONS (her bir scan işlemi)
-- ============================================

CREATE TABLE IF NOT EXISTS scan_operations (
  operation_id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES scan_sessions(session_id) ON DELETE CASCADE,
  operation_type VARCHAR(20) NOT NULL,  -- SCAN_PRODUCT, SCAN_LOCATION, SCAN_MODE, QUANTITY_INPUT
  sku_code VARCHAR(50) REFERENCES products(sku_code),
  location_id INTEGER REFERENCES locations(location_id),
  from_location_id INTEGER REFERENCES locations(location_id),
  to_location_id INTEGER REFERENCES locations(location_id),
  quantity INTEGER,
  unit_type VARCHAR(20),  -- EACH, BOX, PALLET
  scanned_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_scan_operations_session ON scan_operations(session_id);
CREATE INDEX IF NOT EXISTS idx_scan_operations_sku ON scan_operations(sku_code);
CREATE INDEX IF NOT EXISTS idx_scan_operations_location ON scan_operations(location_id);

-- ============================================
-- UPDATE SAMPLE LOCATIONS
-- ============================================

-- Update existing locations with proper structure
UPDATE locations SET
  location_code = qr_code,
  zone = 'STORAGE',
  location_type = 'RACK',
  is_active = true
WHERE location_code IS NULL;

-- Insert additional sample locations for different zones
INSERT INTO locations (warehouse_id, location_code, qr_code, description, zone, aisle, bay, level, location_type, is_active) VALUES
-- Receiving Zone
((SELECT warehouse_id FROM warehouses WHERE code = 'USA' LIMIT 1), 'LOC-RCV-01', 'LOC-RCV-01', 'Receiving Area 1', 'RECEIVING', 'RCV', '01', '01', 'FLOOR', true),
((SELECT warehouse_id FROM warehouses WHERE code = 'USA' LIMIT 1), 'LOC-RCV-02', 'LOC-RCV-02', 'Receiving Area 2', 'RECEIVING', 'RCV', '02', '01', 'FLOOR', true),

-- Storage Zone - Aisle A
((SELECT warehouse_id FROM warehouses WHERE code = 'USA' LIMIT 1), 'LOC-A01-01-01', 'LOC-A01-01-01', 'Aisle A, Bay 1, Level 1', 'STORAGE', 'A01', '01', '01', 'RACK', true),
((SELECT warehouse_id FROM warehouses WHERE code = 'USA' LIMIT 1), 'LOC-A01-01-02', 'LOC-A01-01-02', 'Aisle A, Bay 1, Level 2', 'STORAGE', 'A01', '01', '02', 'RACK', true),
((SELECT warehouse_id FROM warehouses WHERE code = 'USA' LIMIT 1), 'LOC-A01-01-03', 'LOC-A01-01-03', 'Aisle A, Bay 1, Level 3', 'STORAGE', 'A01', '01', '03', 'RACK', true),
((SELECT warehouse_id FROM warehouses WHERE code = 'USA' LIMIT 1), 'LOC-A01-02-01', 'LOC-A01-02-01', 'Aisle A, Bay 2, Level 1', 'STORAGE', 'A01', '02', '01', 'RACK', true),
((SELECT warehouse_id FROM warehouses WHERE code = 'USA' LIMIT 1), 'LOC-A01-02-02', 'LOC-A01-02-02', 'Aisle A, Bay 2, Level 2', 'STORAGE', 'A01', '02', '02', 'RACK', true),
((SELECT warehouse_id FROM warehouses WHERE code = 'USA' LIMIT 1), 'LOC-A01-02-03', 'LOC-A01-02-03', 'Aisle A, Bay 2, Level 3', 'STORAGE', 'A01', '02', '03', 'RACK', true),

-- Storage Zone - Aisle B
((SELECT warehouse_id FROM warehouses WHERE code = 'USA' LIMIT 1), 'LOC-B01-01-01', 'LOC-B01-01-01', 'Aisle B, Bay 1, Level 1', 'STORAGE', 'B01', '01', '01', 'RACK', true),
((SELECT warehouse_id FROM warehouses WHERE code = 'USA' LIMIT 1), 'LOC-B01-01-02', 'LOC-B01-01-02', 'Aisle B, Bay 1, Level 2', 'STORAGE', 'B01', '01', '02', 'RACK', true),
((SELECT warehouse_id FROM warehouses WHERE code = 'USA' LIMIT 1), 'LOC-B01-01-03', 'LOC-B01-01-03', 'Aisle B, Bay 1, Level 3', 'STORAGE', 'B01', '01', '03', 'RACK', true),

-- Picking Zone
((SELECT warehouse_id FROM warehouses WHERE code = 'USA' LIMIT 1), 'LOC-PICK-01', 'LOC-PICK-01', 'Picking Area 1', 'PICKING', 'PICK', '01', '01', 'FLOOR', true),
((SELECT warehouse_id FROM warehouses WHERE code = 'USA' LIMIT 1), 'LOC-PICK-02', 'LOC-PICK-02', 'Picking Area 2', 'PICKING', 'PICK', '02', '01', 'FLOOR', true),

-- Shipping Zone
((SELECT warehouse_id FROM warehouses WHERE code = 'USA' LIMIT 1), 'LOC-SHIP-01', 'LOC-SHIP-01', 'Shipping Area 1', 'SHIPPING', 'SHIP', '01', '01', 'FLOOR', true),
((SELECT warehouse_id FROM warehouses WHERE code = 'USA' LIMIT 1), 'LOC-SHIP-02', 'LOC-SHIP-02', 'Shipping Area 2', 'SHIPPING', 'SHIP', '02', '01', 'FLOOR', true)
ON CONFLICT (location_code) DO NOTHING;

COMMENT ON TABLE locations IS 'Physical locations (raflar) in warehouse';
COMMENT ON TABLE location_inventory IS 'Current inventory by location and product';
COMMENT ON TABLE operation_modes IS 'Barcode triggers for different operation types';
COMMENT ON TABLE scan_sessions IS 'Tracking sessions for warehouse operations';
COMMENT ON TABLE scan_operations IS 'Individual scan events within a session';
