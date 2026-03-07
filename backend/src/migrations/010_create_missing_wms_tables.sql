-- =============================================
-- Migration 010: Create missing WMS tables
-- DB: swiftstock_db
-- Services verified: serial.service, cyclecount.service,
--   report.service, rma.service, operation.service
-- =============================================

-- ── User Permissions ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wms_user_permissions (
  permission_id   SERIAL PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES wms_users(user_id) ON DELETE CASCADE,
  permission_type VARCHAR(50) NOT NULL,
  resource        VARCHAR(100),
  created_at      TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_user_permission UNIQUE (user_id, permission_type, resource)
);

-- ── Devices & Sessions ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wms_devices (
  device_id        SERIAL PRIMARY KEY,
  device_uuid      VARCHAR(100) UNIQUE NOT NULL,
  device_name      VARCHAR(200),
  assigned_user_id INT REFERENCES wms_users(user_id),
  last_seen        TIMESTAMP,
  registered_by    VARCHAR(100),
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wms_device_sessions (
  session_id    SERIAL PRIMARY KEY,
  device_id     INT REFERENCES wms_devices(device_id),
  user_id       INT REFERENCES wms_users(user_id),
  session_token TEXT,
  ip_address    VARCHAR(45),
  is_active     BOOLEAN DEFAULT true,
  started_at    TIMESTAMP DEFAULT NOW(),
  ended_at      TIMESTAMP
);

-- ── Product Config ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wms_product_config (
  config_id      SERIAL PRIMARY KEY,
  product_sku    VARCHAR(50) UNIQUE NOT NULL,
  barcode        VARCHAR(100),
  units_per_box  INT DEFAULT 1,
  boxes_per_pallet INT DEFAULT 1,
  weight_kg      DECIMAL(10,2),
  dimensions_cm  VARCHAR(50),
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMP DEFAULT NOW(),
  updated_at     TIMESTAMP DEFAULT NOW()
);

-- ── Serial Tracking ───────────────────────────────────────────────────────────

-- Counter table used by get_next_serial() stored function
CREATE TABLE IF NOT EXISTS serial_counters (
  sku_code    VARCHAR(50) PRIMARY KEY,
  last_serial INT DEFAULT 0
);

-- Stored function: atomically increments counter and returns 6-digit padded serial
CREATE OR REPLACE FUNCTION get_next_serial(sku VARCHAR) RETURNS VARCHAR AS $$
DECLARE
  next_num INT;
BEGIN
  INSERT INTO serial_counters (sku_code, last_serial)
  VALUES (sku, 1)
  ON CONFLICT (sku_code)
  DO UPDATE SET last_serial = serial_counters.last_serial + 1
  RETURNING last_serial INTO next_num;

  RETURN LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS wms_serial_numbers (
  serial_id           SERIAL PRIMARY KEY,
  product_sku         VARCHAR(50) NOT NULL,
  -- sku_code mirrors product_sku; used by JOIN to products table in getSerialNumbers / lookupSerialBarcode
  sku_code            VARCHAR(50) GENERATED ALWAYS AS (product_sku) STORED,
  serial_no           VARCHAR(100) NOT NULL,
  full_barcode        VARCHAR(200) UNIQUE NOT NULL,
  status              VARCHAR(20) DEFAULT 'AVAILABLE',
  warehouse_id        INT REFERENCES wms_warehouses(warehouse_id),
  location_id         INT REFERENCES wms_locations(location_id),
  last_transaction_id INT,
  last_scanned_at     TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_serial_product_sku ON wms_serial_numbers(product_sku);
CREATE INDEX IF NOT EXISTS idx_serial_status      ON wms_serial_numbers(status);

-- Audit trail for serial number state changes (no wms_ prefix — matches service query)
CREATE TABLE IF NOT EXISTS serial_history (
  history_id       SERIAL PRIMARY KEY,
  serial_id        INT REFERENCES wms_serial_numbers(serial_id),
  full_barcode     VARCHAR(200) NOT NULL,
  event_type       VARCHAR(50) NOT NULL,
  from_status      VARCHAR(20),
  to_status        VARCHAR(20),
  from_location_id INT REFERENCES wms_locations(location_id),
  to_location_id   INT REFERENCES wms_locations(location_id),
  from_warehouse_id INT REFERENCES wms_warehouses(warehouse_id),
  to_warehouse_id  INT REFERENCES wms_warehouses(warehouse_id),
  session_id       INT,                     -- FK added after wms_scan_sessions is created (see below)
  transaction_id   INT,
  user_id          INT REFERENCES wms_users(user_id),
  notes            TEXT,
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_serial_history_barcode ON serial_history(full_barcode);

-- ── Operation Modes & Scan Sessions ──────────────────────────────────────────

-- Lookup table for allowed scan session types (no wms_ prefix — matches service query)
CREATE TABLE IF NOT EXISTS operation_modes (
  mode_id     SERIAL PRIMARY KEY,
  mode_code   VARCHAR(50) UNIQUE NOT NULL,
  mode_type   VARCHAR(50) NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Seed standard operation modes (idempotent)
INSERT INTO operation_modes (mode_code, mode_type, description) VALUES
  ('RECEIVING', 'RECEIVING', 'Mal kabul operasyonu'),
  ('PICKING',   'PICKING',   'Sipariş toplama operasyonu'),
  ('TRANSFER',  'TRANSFER',  'Lokasyon transfer operasyonu'),
  ('COUNT',     'COUNT',     'Sayım operasyonu')
ON CONFLICT (mode_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS wms_scan_sessions (
  session_id    SERIAL PRIMARY KEY,
  session_code  VARCHAR(100) UNIQUE NOT NULL,   -- e.g. SESSION-202403-00001
  warehouse_id  INT NOT NULL REFERENCES wms_warehouses(warehouse_id),
  user_name     VARCHAR(100) NOT NULL,
  mode_type     VARCHAR(50) NOT NULL,            -- RECEIVING | PICKING | TRANSFER | COUNT
  status        VARCHAR(20) DEFAULT 'ACTIVE',    -- ACTIVE | COMPLETED | CANCELLED
  notes         TEXT,
  started_at    TIMESTAMP DEFAULT NOW(),
  completed_at  TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scan_sessions_user_status ON wms_scan_sessions(user_name, status);

-- Now add FK from serial_history.session_id → wms_scan_sessions (deferred because table is created above)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_serial_history_session'
  ) THEN
    ALTER TABLE serial_history
      ADD CONSTRAINT fk_serial_history_session
      FOREIGN KEY (session_id) REFERENCES wms_scan_sessions(session_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS wms_scan_operations (
  operation_id     SERIAL PRIMARY KEY,
  session_id       INT NOT NULL REFERENCES wms_scan_sessions(session_id),
  operation_type   VARCHAR(50) NOT NULL,
  product_sku      VARCHAR(50),
  -- location_id used by operation.service for structured joins
  location_id      INT REFERENCES wms_locations(location_id),
  from_location_id INT REFERENCES wms_locations(location_id),
  to_location_id   INT REFERENCES wms_locations(location_id),
  -- location_code used by serial.service for legacy barcode-based joins
  location_code    VARCHAR(100),
  quantity         INT DEFAULT 1,
  unit_type        VARCHAR(50),
  notes            TEXT,
  scanned_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_ops_session    ON wms_scan_operations(session_id);
CREATE INDEX IF NOT EXISTS idx_scan_ops_product_sku ON wms_scan_operations(product_sku);

-- ── Cycle Count ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wms_cycle_count_sessions (
  session_id     SERIAL PRIMARY KEY,
  session_number VARCHAR(50) UNIQUE NOT NULL,   -- e.g. CC-20240101-1234
  warehouse_id   INT NOT NULL REFERENCES wms_warehouses(warehouse_id),
  status         VARCHAR(20) DEFAULT 'PLANNED', -- PLANNED | IN_PROGRESS | COMPLETED
  count_type     VARCHAR(50) NOT NULL,
  scheduled_date DATE,
  assigned_to    VARCHAR(200),
  notes          TEXT,
  created_by     VARCHAR(100) NOT NULL,
  created_at     TIMESTAMP DEFAULT NOW(),
  started_at     TIMESTAMP,
  completed_at   TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wms_cycle_count_items (
  item_id            SERIAL PRIMARY KEY,
  session_id         INT NOT NULL REFERENCES wms_cycle_count_sessions(session_id),
  product_sku        VARCHAR(50) NOT NULL,
  location_id        INT REFERENCES wms_locations(location_id),
  expected_quantity  INT DEFAULT 0,
  counted_quantity   INT,
  variance           INT,
  variance_percentage NUMERIC(10,2),
  status             VARCHAR(20) DEFAULT 'PENDING', -- PENDING | COUNTED | ADJUSTED
  counted_by         VARCHAR(100),
  counted_at         TIMESTAMP,
  notes              TEXT,
  created_at         TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_items_session ON wms_cycle_count_items(session_id);

CREATE TABLE IF NOT EXISTS wms_cycle_count_adjustments (
  adjustment_id   SERIAL PRIMARY KEY,
  item_id         INT REFERENCES wms_cycle_count_items(item_id),
  session_id      INT REFERENCES wms_cycle_count_sessions(session_id),
  product_sku     VARCHAR(50) NOT NULL,
  location_id     INT REFERENCES wms_locations(location_id),
  old_quantity    INT NOT NULL,
  new_quantity    INT NOT NULL,
  variance        INT NOT NULL,
  adjustment_type VARCHAR(20) NOT NULL,  -- INCREASE | DECREASE
  adjusted_by     VARCHAR(100) NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ── Count Reports ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wms_count_reports (
  report_id          SERIAL PRIMARY KEY,
  report_number      VARCHAR(50) UNIQUE NOT NULL,  -- e.g. SAY-20240101-0001
  warehouse_id       INT NOT NULL REFERENCES wms_warehouses(warehouse_id),
  warehouse_code     VARCHAR(50) NOT NULL,          -- denormalized for quick access
  report_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  total_locations    INT DEFAULT 0,
  total_expected     INT DEFAULT 0,
  total_counted      INT DEFAULT 0,
  total_variance     INT DEFAULT 0,
  variance_percentage NUMERIC(10,2) DEFAULT 0,
  created_by         VARCHAR(100) NOT NULL,
  notes              TEXT,
  created_at         TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_count_reports_warehouse ON wms_count_reports(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_count_reports_date      ON wms_count_reports(report_date);

CREATE TABLE IF NOT EXISTS wms_count_report_locations (
  report_location_id SERIAL PRIMARY KEY,
  report_id          INT NOT NULL REFERENCES wms_count_reports(report_id) ON DELETE CASCADE,
  location_id        INT REFERENCES wms_locations(location_id),
  location_code      VARCHAR(100) NOT NULL,
  location_qr        VARCHAR(100),
  total_expected     INT DEFAULT 0,
  total_counted      INT DEFAULT 0,
  total_variance     INT DEFAULT 0,
  unexpected_count   INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wms_count_report_items (
  item_id            SERIAL PRIMARY KEY,
  report_id          INT NOT NULL REFERENCES wms_count_reports(report_id) ON DELETE CASCADE,
  report_location_id INT NOT NULL REFERENCES wms_count_report_locations(report_location_id) ON DELETE CASCADE,
  product_sku        VARCHAR(50) NOT NULL,
  product_name       VARCHAR(200),
  expected_quantity  INT DEFAULT 0,
  counted_quantity   INT DEFAULT 0,
  variance           INT DEFAULT 0,
  is_unexpected      BOOLEAN DEFAULT false,
  scanned_barcodes   TEXT[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_cri_location ON wms_count_report_items(report_location_id);

-- ── RMA (Returns Management) ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wms_rma_requests (
  rma_id          SERIAL PRIMARY KEY,
  rma_number      VARCHAR(50) UNIQUE NOT NULL,   -- e.g. RMA-20240101-1234
  warehouse_id    INT NOT NULL REFERENCES wms_warehouses(warehouse_id),
  customer_name   VARCHAR(200),
  customer_email  VARCHAR(200),
  order_number    VARCHAR(100),
  status          VARCHAR(20) DEFAULT 'PENDING', -- PENDING | APPROVED | IN_PROCESS | COMPLETED
  reason          TEXT NOT NULL,
  priority        VARCHAR(20) DEFAULT 'NORMAL',
  notes           TEXT,
  internal_notes  TEXT,
  created_by      VARCHAR(100) NOT NULL,
  approved_date   TIMESTAMP,
  approved_by     VARCHAR(100),
  completed_date  TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wms_rma_items (
  item_id             SERIAL PRIMARY KEY,
  rma_id              INT NOT NULL REFERENCES wms_rma_requests(rma_id),
  product_sku         VARCHAR(50) NOT NULL,
  quantity_requested  INT NOT NULL,
  quantity_received   INT DEFAULT 0,
  unit_price          NUMERIC(10,2),
  action              VARCHAR(50) NOT NULL,  -- REFUND | REPLACE | REPAIR | DISCARD
  condition           VARCHAR(50),
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wms_rma_history (
  history_id   SERIAL PRIMARY KEY,
  rma_id       INT NOT NULL REFERENCES wms_rma_requests(rma_id),
  action       VARCHAR(100) NOT NULL,
  old_status   VARCHAR(20),
  new_status   VARCHAR(20),
  performed_by VARCHAR(100) NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMP DEFAULT NOW()
);

-- Physical return receipts (no wms_ prefix — matches rma.service query)
CREATE TABLE IF NOT EXISTS return_receipts (
  receipt_id        SERIAL PRIMARY KEY,
  rma_id            INT NOT NULL REFERENCES wms_rma_requests(rma_id),
  item_id           INT NOT NULL REFERENCES wms_rma_items(item_id),
  product_sku       VARCHAR(50) NOT NULL,
  quantity_received INT NOT NULL,
  condition         VARCHAR(50) NOT NULL,
  location_id       INT REFERENCES wms_locations(location_id),
  received_by       VARCHAR(100) NOT NULL,
  notes             TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- ── Inventory Summary View ────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_inventory_summary AS
SELECT
  i.inventory_id,
  i.product_sku,
  p.name          AS product_name,
  i.quantity,
  w.code          AS warehouse_code,
  w.name          AS warehouse_name,
  l.qr_code       AS location_code,
  i.last_updated_at
FROM wms_inventory i
JOIN products p          ON i.product_sku  = p.product_sku
JOIN wms_warehouses w    ON i.warehouse_id = w.warehouse_id
LEFT JOIN wms_locations l ON i.location_id  = l.location_id;
