-- ============================================
-- RETURNS & RMA SYSTEM
-- ============================================
-- This migration adds returns and RMA (Return Merchandise Authorization) functionality

-- RMA requests - Return authorization records
CREATE TABLE IF NOT EXISTS rma_requests (
  rma_id SERIAL PRIMARY KEY,
  rma_number VARCHAR(50) NOT NULL UNIQUE,
  warehouse_id INTEGER NOT NULL,
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  order_number VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  reason VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'NORMAL',
  requested_date DATE DEFAULT CURRENT_DATE,
  approved_date TIMESTAMP,
  approved_by VARCHAR(50),
  completed_date TIMESTAMP,
  notes TEXT,
  internal_notes TEXT,
  created_by VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_rma_warehouse FOREIGN KEY (warehouse_id)
    REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
  CONSTRAINT chk_rma_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'IN_PROCESS', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT chk_rma_reason CHECK (reason IN ('DEFECTIVE', 'WRONG_ITEM', 'DAMAGED', 'NOT_AS_DESCRIBED', 'CUSTOMER_REQUEST', 'OTHER')),
  CONSTRAINT chk_rma_priority CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT'))
);

-- RMA items - Individual items to be returned
CREATE TABLE IF NOT EXISTS rma_items (
  item_id SERIAL PRIMARY KEY,
  rma_id INTEGER NOT NULL,
  sku_code VARCHAR(50) NOT NULL,
  quantity_requested INTEGER NOT NULL,
  quantity_received INTEGER DEFAULT 0,
  quantity_approved INTEGER DEFAULT 0,
  unit_price DECIMAL(10,2),
  condition VARCHAR(20),
  action VARCHAR(20) NOT NULL,
  restocking_fee DECIMAL(10,2) DEFAULT 0.00,
  refund_amount DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_rma_item_rma FOREIGN KEY (rma_id)
    REFERENCES rma_requests(rma_id) ON DELETE CASCADE,
  CONSTRAINT fk_rma_item_product FOREIGN KEY (sku_code)
    REFERENCES products(sku_code) ON DELETE CASCADE,
  CONSTRAINT chk_rma_item_condition CHECK (condition IN ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'DEFECTIVE')),
  CONSTRAINT chk_rma_item_action CHECK (action IN ('REFUND', 'REPLACE', 'REPAIR', 'CREDIT', 'DISPOSE'))
);

-- Return receipts - Track physical receipt of returned items
CREATE TABLE IF NOT EXISTS return_receipts (
  receipt_id SERIAL PRIMARY KEY,
  rma_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  sku_code VARCHAR(50) NOT NULL,
  quantity_received INTEGER NOT NULL,
  condition VARCHAR(20) NOT NULL,
  location_id INTEGER,
  received_by VARCHAR(50) NOT NULL,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  transaction_id INTEGER,
  notes TEXT,
  images JSONB,

  CONSTRAINT fk_receipt_rma FOREIGN KEY (rma_id)
    REFERENCES rma_requests(rma_id) ON DELETE CASCADE,
  CONSTRAINT fk_receipt_item FOREIGN KEY (item_id)
    REFERENCES rma_items(item_id) ON DELETE CASCADE,
  CONSTRAINT fk_receipt_product FOREIGN KEY (sku_code)
    REFERENCES products(sku_code) ON DELETE CASCADE,
  CONSTRAINT fk_receipt_location FOREIGN KEY (location_id)
    REFERENCES locations(location_id) ON DELETE SET NULL,
  CONSTRAINT fk_receipt_transaction FOREIGN KEY (transaction_id)
    REFERENCES transactions(transaction_id) ON DELETE SET NULL
);

-- RMA history - Track status changes and actions
CREATE TABLE IF NOT EXISTS rma_history (
  history_id SERIAL PRIMARY KEY,
  rma_id INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL,
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  performed_by VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_history_rma FOREIGN KEY (rma_id)
    REFERENCES rma_requests(rma_id) ON DELETE CASCADE
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- RMA requests indexes
CREATE INDEX IF NOT EXISTS idx_rma_requests_warehouse ON rma_requests(warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_rma_requests_status ON rma_requests(status, requested_date);
CREATE INDEX IF NOT EXISTS idx_rma_requests_number ON rma_requests(rma_number);
CREATE INDEX IF NOT EXISTS idx_rma_requests_customer ON rma_requests(customer_email);
CREATE INDEX IF NOT EXISTS idx_rma_requests_order ON rma_requests(order_number);
CREATE INDEX IF NOT EXISTS idx_rma_requests_dates ON rma_requests(requested_date, completed_date);

-- RMA items indexes
CREATE INDEX IF NOT EXISTS idx_rma_items_rma ON rma_items(rma_id);
CREATE INDEX IF NOT EXISTS idx_rma_items_sku ON rma_items(sku_code);
CREATE INDEX IF NOT EXISTS idx_rma_items_action ON rma_items(action);

-- Return receipts indexes
CREATE INDEX IF NOT EXISTS idx_receipts_rma ON return_receipts(rma_id);
CREATE INDEX IF NOT EXISTS idx_receipts_item ON return_receipts(item_id);
CREATE INDEX IF NOT EXISTS idx_receipts_received ON return_receipts(received_at);
CREATE INDEX IF NOT EXISTS idx_receipts_location ON return_receipts(location_id);

-- RMA history indexes
CREATE INDEX IF NOT EXISTS idx_rma_history_rma ON rma_history(rma_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rma_history_created ON rma_history(created_at);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update rma_requests.updated_at on changes
CREATE OR REPLACE FUNCTION update_rma_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_rma_requests_updated_at
  BEFORE UPDATE ON rma_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_rma_updated_at();

CREATE TRIGGER trigger_rma_items_updated_at
  BEFORE UPDATE ON rma_items
  FOR EACH ROW
  EXECUTE FUNCTION update_rma_updated_at();

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Insert sample RMA request
INSERT INTO rma_requests (rma_number, warehouse_id, customer_name, customer_email, status, reason, created_by)
SELECT
  'RMA-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-001',
  warehouse_id,
  'Sample Customer',
  'customer@example.com',
  'PENDING',
  'DEFECTIVE',
  'admin'
FROM warehouses
WHERE code = 'USA'
LIMIT 1
ON CONFLICT DO NOTHING;

COMMENT ON TABLE rma_requests IS 'Return Merchandise Authorization requests';
COMMENT ON TABLE rma_items IS 'Individual items in RMA requests';
COMMENT ON TABLE return_receipts IS 'Physical receipt records of returned items';
COMMENT ON TABLE rma_history IS 'Audit trail of RMA status changes and actions';
