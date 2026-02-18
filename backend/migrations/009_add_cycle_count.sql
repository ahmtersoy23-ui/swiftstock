-- ============================================
-- CYCLE COUNT SYSTEM
-- ============================================
-- This migration adds cycle count (inventory counting) functionality

-- Cycle count sessions - Track counting sessions
CREATE TABLE IF NOT EXISTS cycle_count_sessions (
  session_id SERIAL PRIMARY KEY,
  session_number VARCHAR(50) NOT NULL UNIQUE,
  warehouse_id INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
  count_type VARCHAR(20) NOT NULL,
  scheduled_date DATE,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_by VARCHAR(50) NOT NULL,
  assigned_to VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_cc_warehouse FOREIGN KEY (warehouse_id)
    REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
  CONSTRAINT chk_cc_status CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT chk_cc_type CHECK (count_type IN ('FULL', 'PARTIAL', 'CYCLE', 'BLIND'))
);

-- Cycle count items - Items to be counted
CREATE TABLE IF NOT EXISTS cycle_count_items (
  item_id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL,
  product_sku VARCHAR(50) NOT NULL,
  location_id INTEGER,
  expected_quantity INTEGER,
  counted_quantity INTEGER,
  variance INTEGER,
  variance_percentage DECIMAL(5,2),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  counted_by VARCHAR(50),
  counted_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_cci_session FOREIGN KEY (session_id)
    REFERENCES cycle_count_sessions(session_id) ON DELETE CASCADE,
  CONSTRAINT fk_cci_product FOREIGN KEY (product_sku)
    REFERENCES products(product_sku) ON DELETE CASCADE,
  CONSTRAINT fk_cci_location FOREIGN KEY (location_id)
    REFERENCES locations(location_id) ON DELETE SET NULL,
  CONSTRAINT chk_cci_status CHECK (status IN ('PENDING', 'COUNTED', 'VERIFIED', 'ADJUSTED'))
);

-- Cycle count adjustments - Track inventory adjustments from counts
CREATE TABLE IF NOT EXISTS cycle_count_adjustments (
  adjustment_id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL,
  session_id INTEGER NOT NULL,
  product_sku VARCHAR(50) NOT NULL,
  location_id INTEGER,
  old_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  variance INTEGER NOT NULL,
  adjustment_type VARCHAR(20) NOT NULL,
  transaction_id INTEGER,
  adjusted_by VARCHAR(50) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_cca_item FOREIGN KEY (item_id)
    REFERENCES cycle_count_items(item_id) ON DELETE CASCADE,
  CONSTRAINT fk_cca_session FOREIGN KEY (session_id)
    REFERENCES cycle_count_sessions(session_id) ON DELETE CASCADE,
  CONSTRAINT fk_cca_product FOREIGN KEY (product_sku)
    REFERENCES products(product_sku) ON DELETE CASCADE,
  CONSTRAINT fk_cca_location FOREIGN KEY (location_id)
    REFERENCES locations(location_id) ON DELETE SET NULL,
  CONSTRAINT fk_cca_transaction FOREIGN KEY (transaction_id)
    REFERENCES transactions(transaction_id) ON DELETE SET NULL,
  CONSTRAINT chk_cca_type CHECK (adjustment_type IN ('INCREASE', 'DECREASE', 'NO_CHANGE'))
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Cycle count sessions indexes
CREATE INDEX IF NOT EXISTS idx_cc_sessions_warehouse ON cycle_count_sessions(warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_cc_sessions_status ON cycle_count_sessions(status, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_cc_sessions_number ON cycle_count_sessions(session_number);
CREATE INDEX IF NOT EXISTS idx_cc_sessions_assigned ON cycle_count_sessions(assigned_to, status);

-- Cycle count items indexes
CREATE INDEX IF NOT EXISTS idx_cc_items_session ON cycle_count_items(session_id, status);
CREATE INDEX IF NOT EXISTS idx_cc_items_sku ON cycle_count_items(product_sku);
CREATE INDEX IF NOT EXISTS idx_cc_items_location ON cycle_count_items(location_id, status);
CREATE INDEX IF NOT EXISTS idx_cc_items_status ON cycle_count_items(status);

-- Cycle count adjustments indexes
CREATE INDEX IF NOT EXISTS idx_cc_adj_session ON cycle_count_adjustments(session_id);
CREATE INDEX IF NOT EXISTS idx_cc_adj_item ON cycle_count_adjustments(item_id);
CREATE INDEX IF NOT EXISTS idx_cc_adj_sku ON cycle_count_adjustments(product_sku);
CREATE INDEX IF NOT EXISTS idx_cc_adj_created ON cycle_count_adjustments(created_at);

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Insert sample cycle count session
INSERT INTO cycle_count_sessions (session_number, warehouse_id, status, count_type, created_by, notes)
SELECT
  'CC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-001',
  warehouse_id,
  'PLANNED',
  'CYCLE',
  'admin',
  'Monthly cycle count'
FROM warehouses
WHERE code = 'USA'
LIMIT 1
ON CONFLICT DO NOTHING;

COMMENT ON TABLE cycle_count_sessions IS 'Tracks cycle count sessions for inventory verification';
COMMENT ON TABLE cycle_count_items IS 'Individual items to be counted in a cycle count session';
COMMENT ON TABLE cycle_count_adjustments IS 'Inventory adjustments made based on cycle count results';
