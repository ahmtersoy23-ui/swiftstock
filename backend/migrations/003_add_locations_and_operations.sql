-- ============================================
-- LOCATIONS SYSTEM
-- ============================================

-- Locations table (raf barkodları)
CREATE TABLE IF NOT EXISTS locations (
  location_id SERIAL PRIMARY KEY,
  location_code VARCHAR(50) UNIQUE NOT NULL,  -- LOC-A01-B02-C03
  warehouse_code VARCHAR(10) NOT NULL REFERENCES warehouses(warehouse_code),
  zone VARCHAR(20),  -- RECEIVING, STORAGE, PICKING, SHIPPING
  aisle VARCHAR(10),
  bay VARCHAR(10),
  level VARCHAR(10),
  location_type VARCHAR(20) DEFAULT 'RACK',  -- FLOOR, RACK, PALLET, BULK
  capacity_units INTEGER,
  max_weight_kg DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_locations_warehouse ON locations(warehouse_code);
CREATE INDEX idx_locations_zone ON locations(zone);
CREATE INDEX idx_locations_active ON locations(is_active);

-- Location Inventory (hangi üründen nerede ne kadar var)
CREATE TABLE IF NOT EXISTS location_inventory (
  location_inventory_id SERIAL PRIMARY KEY,
  location_code VARCHAR(50) NOT NULL REFERENCES locations(location_code) ON DELETE CASCADE,
  product_sku VARCHAR(50) NOT NULL REFERENCES products(product_sku) ON DELETE CASCADE,
  quantity_each INTEGER DEFAULT 0,
  quantity_box INTEGER DEFAULT 0,
  quantity_pallet INTEGER DEFAULT 0,
  last_counted_at TIMESTAMP,
  last_moved_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(location_code, product_sku)
);

CREATE INDEX idx_location_inventory_location ON location_inventory(location_code);
CREATE INDEX idx_location_inventory_sku ON location_inventory(product_sku);

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
  warehouse_code VARCHAR(10) NOT NULL REFERENCES warehouses(warehouse_code),
  user_name VARCHAR(100) NOT NULL,
  mode_type VARCHAR(20) NOT NULL,  -- RECEIVING, PICKING, TRANSFER, COUNT
  status VARCHAR(20) DEFAULT 'ACTIVE',  -- ACTIVE, COMPLETED, CANCELLED
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scan_sessions_user ON scan_sessions(user_name);
CREATE INDEX idx_scan_sessions_status ON scan_sessions(status);
CREATE INDEX idx_scan_sessions_mode ON scan_sessions(mode_type);

-- ============================================
-- SCAN OPERATIONS (her bir scan işlemi)
-- ============================================

CREATE TABLE IF NOT EXISTS scan_operations (
  operation_id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES scan_sessions(session_id) ON DELETE CASCADE,
  operation_type VARCHAR(20) NOT NULL,  -- SCAN_PRODUCT, SCAN_LOCATION, SCAN_MODE, QUANTITY_INPUT
  product_sku VARCHAR(50) REFERENCES products(product_sku),
  location_code VARCHAR(50) REFERENCES locations(location_code),
  from_location VARCHAR(50),
  to_location VARCHAR(50),
  quantity INTEGER,
  unit_type VARCHAR(20),  -- EACH, BOX, PALLET
  scanned_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_scan_operations_session ON scan_operations(session_id);
CREATE INDEX idx_scan_operations_sku ON scan_operations(product_sku);
CREATE INDEX idx_scan_operations_location ON scan_operations(location_code);

-- ============================================
-- SAMPLE LOCATIONS
-- ============================================

-- Insert sample locations for testing
INSERT INTO locations (location_code, warehouse_code, zone, aisle, bay, level, location_type) VALUES
-- Receiving Zone
('LOC-RCV-01', 'USA', 'RECEIVING', 'RCV', '01', '01', 'FLOOR'),
('LOC-RCV-02', 'USA', 'RECEIVING', 'RCV', '02', '01', 'FLOOR'),

-- Storage Zone - Aisle A
('LOC-A01-01-01', 'USA', 'STORAGE', 'A01', '01', '01', 'RACK'),
('LOC-A01-01-02', 'USA', 'STORAGE', 'A01', '01', '02', 'RACK'),
('LOC-A01-01-03', 'USA', 'STORAGE', 'A01', '01', '03', 'RACK'),
('LOC-A01-02-01', 'USA', 'STORAGE', 'A01', '02', '01', 'RACK'),
('LOC-A01-02-02', 'USA', 'STORAGE', 'A01', '02', '02', 'RACK'),
('LOC-A01-02-03', 'USA', 'STORAGE', 'A01', '02', '03', 'RACK'),

-- Storage Zone - Aisle B
('LOC-B01-01-01', 'USA', 'STORAGE', 'B01', '01', '01', 'RACK'),
('LOC-B01-01-02', 'USA', 'STORAGE', 'B01', '01', '02', 'RACK'),
('LOC-B01-01-03', 'USA', 'STORAGE', 'B01', '01', '03', 'RACK'),

-- Picking Zone
('LOC-PICK-01', 'USA', 'PICKING', 'PICK', '01', '01', 'FLOOR'),
('LOC-PICK-02', 'USA', 'PICKING', 'PICK', '02', '01', 'FLOOR'),

-- Shipping Zone
('LOC-SHIP-01', 'USA', 'SHIPPING', 'SHIP', '01', '01', 'FLOOR'),
('LOC-SHIP-02', 'USA', 'SHIPPING', 'SHIP', '02', '01', 'FLOOR')
ON CONFLICT (location_code) DO NOTHING;

COMMENT ON TABLE locations IS 'Physical locations (raflar) in warehouse';
COMMENT ON TABLE location_inventory IS 'Current inventory by location and product';
COMMENT ON TABLE operation_modes IS 'Barcode triggers for different operation types';
COMMENT ON TABLE scan_sessions IS 'Tracking sessions for warehouse operations';
COMMENT ON TABLE scan_operations IS 'Individual scan events within a session';
