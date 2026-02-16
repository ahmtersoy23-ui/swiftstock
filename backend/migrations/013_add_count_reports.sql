-- ============================================
-- COUNT REPORTS SYSTEM
-- ============================================
-- This migration adds count report functionality for storing
-- barcode-based counting results from Operations page

-- Count Reports - Store completed count reports
CREATE TABLE IF NOT EXISTS count_reports (
  report_id SERIAL PRIMARY KEY,
  report_number VARCHAR(50) NOT NULL UNIQUE,
  warehouse_id INTEGER NOT NULL,
  warehouse_code VARCHAR(20) NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_locations INTEGER NOT NULL DEFAULT 0,
  total_expected INTEGER NOT NULL DEFAULT 0,
  total_counted INTEGER NOT NULL DEFAULT 0,
  total_variance INTEGER NOT NULL DEFAULT 0,
  variance_percentage DECIMAL(5,2) DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  created_by VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_cr_warehouse FOREIGN KEY (warehouse_id)
    REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
  CONSTRAINT chk_cr_status CHECK (status IN ('COMPLETED', 'ARCHIVED'))
);

-- Count Report Locations - Store per-location details
CREATE TABLE IF NOT EXISTS count_report_locations (
  report_location_id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL,
  location_id INTEGER,
  location_code VARCHAR(100) NOT NULL,
  location_qr VARCHAR(100),
  total_expected INTEGER NOT NULL DEFAULT 0,
  total_counted INTEGER NOT NULL DEFAULT 0,
  total_variance INTEGER NOT NULL DEFAULT 0,
  unexpected_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_crl_report FOREIGN KEY (report_id)
    REFERENCES count_reports(report_id) ON DELETE CASCADE,
  CONSTRAINT fk_crl_location FOREIGN KEY (location_id)
    REFERENCES locations(location_id) ON DELETE SET NULL
);

-- Count Report Items - Store per-item details for each location
CREATE TABLE IF NOT EXISTS count_report_items (
  report_item_id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL,
  report_location_id INTEGER NOT NULL,
  sku_code VARCHAR(50) NOT NULL,
  product_name VARCHAR(255),
  expected_quantity INTEGER NOT NULL DEFAULT 0,
  counted_quantity INTEGER NOT NULL DEFAULT 0,
  variance INTEGER NOT NULL DEFAULT 0,
  is_unexpected BOOLEAN NOT NULL DEFAULT FALSE,
  scanned_barcodes TEXT[], -- Array of scanned serial barcodes
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_cri_report FOREIGN KEY (report_id)
    REFERENCES count_reports(report_id) ON DELETE CASCADE,
  CONSTRAINT fk_cri_location FOREIGN KEY (report_location_id)
    REFERENCES count_report_locations(report_location_id) ON DELETE CASCADE,
  CONSTRAINT fk_cri_product FOREIGN KEY (sku_code)
    REFERENCES products(sku_code) ON DELETE CASCADE
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_cr_warehouse ON count_reports(warehouse_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_cr_date ON count_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_cr_number ON count_reports(report_number);
CREATE INDEX IF NOT EXISTS idx_cr_created_by ON count_reports(created_by);

CREATE INDEX IF NOT EXISTS idx_crl_report ON count_report_locations(report_id);
CREATE INDEX IF NOT EXISTS idx_crl_location ON count_report_locations(location_id);

CREATE INDEX IF NOT EXISTS idx_cri_report ON count_report_items(report_id);
CREATE INDEX IF NOT EXISTS idx_cri_location ON count_report_items(report_location_id);
CREATE INDEX IF NOT EXISTS idx_cri_sku ON count_report_items(sku_code);

COMMENT ON TABLE count_reports IS 'Stores completed count report summaries from Operations page';
COMMENT ON TABLE count_report_locations IS 'Stores per-location count details for each report';
COMMENT ON TABLE count_report_items IS 'Stores per-item count details for each location in a report';
