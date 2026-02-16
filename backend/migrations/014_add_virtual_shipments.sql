-- ============================================
-- VIRTUAL SHIPMENTS (Sevkiyat / Toplu Gönderim)
-- ============================================
-- Virtual warehouse system for bulk shipments
-- Each shipment has a prefix that becomes box barcode prefix
-- Boxes can have different destination warehouses (USA vs FBA)

-- Virtual Shipments table - Container for bulk shipments
CREATE TABLE IF NOT EXISTS virtual_shipments (
  shipment_id SERIAL PRIMARY KEY,
  prefix VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  source_warehouse_id INTEGER NOT NULL,
  default_destination VARCHAR(20) DEFAULT 'USA',
  status VARCHAR(20) DEFAULT 'OPEN',
  total_boxes INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  notes TEXT,
  created_by VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,
  shipped_at TIMESTAMP,

  CONSTRAINT chk_shipment_status CHECK (status IN ('OPEN', 'CLOSED', 'SHIPPED', 'CANCELLED')),
  CONSTRAINT chk_default_destination CHECK (default_destination IN ('USA', 'FBA')),
  CONSTRAINT fk_shipment_source FOREIGN KEY (source_warehouse_id)
    REFERENCES warehouses(warehouse_id) ON DELETE RESTRICT
);

-- Shipment Boxes - Individual boxes within a shipment
CREATE TABLE IF NOT EXISTS shipment_boxes (
  box_id SERIAL PRIMARY KEY,
  shipment_id INTEGER NOT NULL,
  barcode VARCHAR(50) NOT NULL UNIQUE,
  box_number INTEGER NOT NULL,
  destination VARCHAR(20) DEFAULT 'USA',
  status VARCHAR(20) DEFAULT 'OPEN',
  total_items INTEGER DEFAULT 0,
  total_quantity INTEGER DEFAULT 0,
  weight_kg DECIMAL(10, 2),
  notes TEXT,
  created_by VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP,

  CONSTRAINT chk_box_status CHECK (status IN ('OPEN', 'CLOSED', 'SHIPPED')),
  CONSTRAINT chk_box_destination CHECK (destination IN ('USA', 'FBA')),
  CONSTRAINT fk_box_shipment FOREIGN KEY (shipment_id)
    REFERENCES virtual_shipments(shipment_id) ON DELETE CASCADE,
  CONSTRAINT unique_shipment_box_number UNIQUE (shipment_id, box_number)
);

-- Shipment Box Contents - Items in each box
CREATE TABLE IF NOT EXISTS shipment_box_contents (
  content_id SERIAL PRIMARY KEY,
  box_id INTEGER NOT NULL,
  sku_code VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL,
  added_by VARCHAR(50) NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_content_box FOREIGN KEY (box_id)
    REFERENCES shipment_boxes(box_id) ON DELETE CASCADE,
  CONSTRAINT fk_content_sku FOREIGN KEY (sku_code)
    REFERENCES products(sku_code) ON DELETE RESTRICT,
  CONSTRAINT chk_quantity CHECK (quantity > 0)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_shipments_prefix ON virtual_shipments(prefix);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON virtual_shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_source ON virtual_shipments(source_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_shipments_created ON virtual_shipments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_boxes_shipment ON shipment_boxes(shipment_id);
CREATE INDEX IF NOT EXISTS idx_boxes_barcode ON shipment_boxes(barcode);
CREATE INDEX IF NOT EXISTS idx_boxes_destination ON shipment_boxes(destination);
CREATE INDEX IF NOT EXISTS idx_boxes_status ON shipment_boxes(status);

CREATE INDEX IF NOT EXISTS idx_box_contents_box ON shipment_box_contents(box_id);
CREATE INDEX IF NOT EXISTS idx_box_contents_sku ON shipment_box_contents(sku_code);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update shipment totals when box is added/removed
CREATE OR REPLACE FUNCTION trigger_update_shipment_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE virtual_shipments
    SET
      total_boxes = (SELECT COUNT(*) FROM shipment_boxes WHERE shipment_id = OLD.shipment_id),
      total_items = (SELECT COALESCE(SUM(total_quantity), 0) FROM shipment_boxes WHERE shipment_id = OLD.shipment_id)
    WHERE shipment_id = OLD.shipment_id;
    RETURN OLD;
  ELSE
    UPDATE virtual_shipments
    SET
      total_boxes = (SELECT COUNT(*) FROM shipment_boxes WHERE shipment_id = NEW.shipment_id),
      total_items = (SELECT COALESCE(SUM(total_quantity), 0) FROM shipment_boxes WHERE shipment_id = NEW.shipment_id)
    WHERE shipment_id = NEW.shipment_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shipment_totals
  AFTER INSERT OR UPDATE OR DELETE ON shipment_boxes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_shipment_totals();

-- Update box totals when content is added/removed
CREATE OR REPLACE FUNCTION trigger_update_box_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE shipment_boxes
    SET
      total_items = (SELECT COUNT(*) FROM shipment_box_contents WHERE box_id = OLD.box_id),
      total_quantity = (SELECT COALESCE(SUM(quantity), 0) FROM shipment_box_contents WHERE box_id = OLD.box_id)
    WHERE box_id = OLD.box_id;
    RETURN OLD;
  ELSE
    UPDATE shipment_boxes
    SET
      total_items = (SELECT COUNT(*) FROM shipment_box_contents WHERE box_id = NEW.box_id),
      total_quantity = (SELECT COALESCE(SUM(quantity), 0) FROM shipment_box_contents WHERE box_id = NEW.box_id)
    WHERE box_id = NEW.box_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_box_totals
  AFTER INSERT OR UPDATE OR DELETE ON shipment_box_contents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_box_totals();

-- ============================================
-- VIEWS
-- ============================================

-- Shipment summary view
CREATE OR REPLACE VIEW v_shipment_summary AS
SELECT
  vs.shipment_id,
  vs.prefix,
  vs.name,
  vs.status,
  vs.total_boxes,
  vs.total_items,
  w.code AS source_warehouse_code,
  w.name AS source_warehouse_name,
  vs.default_destination,
  COUNT(CASE WHEN sb.destination = 'USA' THEN 1 END) AS usa_boxes,
  COUNT(CASE WHEN sb.destination = 'FBA' THEN 1 END) AS fba_boxes,
  vs.created_by,
  vs.created_at,
  vs.shipped_at
FROM virtual_shipments vs
JOIN warehouses w ON vs.source_warehouse_id = w.warehouse_id
LEFT JOIN shipment_boxes sb ON vs.shipment_id = sb.shipment_id
GROUP BY vs.shipment_id, vs.prefix, vs.name, vs.status, vs.total_boxes, vs.total_items,
         w.code, w.name, vs.default_destination, vs.created_by, vs.created_at, vs.shipped_at;

-- Box details view
CREATE OR REPLACE VIEW v_box_details AS
SELECT
  sb.box_id,
  sb.barcode,
  sb.box_number,
  sb.destination,
  sb.status,
  sb.total_items,
  sb.total_quantity,
  sb.weight_kg,
  vs.prefix,
  vs.name AS shipment_name,
  vs.shipment_id,
  sb.created_by,
  sb.created_at
FROM shipment_boxes sb
JOIN virtual_shipments vs ON sb.shipment_id = vs.shipment_id;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Generate next box barcode for a shipment
CREATE OR REPLACE FUNCTION generate_box_barcode(p_shipment_id INTEGER)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR(20);
  v_next_number INTEGER;
  v_barcode VARCHAR(50);
BEGIN
  SELECT prefix INTO v_prefix FROM virtual_shipments WHERE shipment_id = p_shipment_id;

  SELECT COALESCE(MAX(box_number), 0) + 1 INTO v_next_number
  FROM shipment_boxes WHERE shipment_id = p_shipment_id;

  v_barcode := v_prefix || '-' || LPAD(v_next_number::TEXT, 5, '0');

  RETURN v_barcode;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE virtual_shipments IS 'Virtual warehouse for bulk shipments with prefix-based box barcodes';
COMMENT ON TABLE shipment_boxes IS 'Individual boxes within a shipment, each with its own destination';
COMMENT ON TABLE shipment_box_contents IS 'Products packed into each box';
COMMENT ON COLUMN virtual_shipments.prefix IS 'Barcode prefix for all boxes in this shipment (e.g., IST -> IST-00001)';
COMMENT ON COLUMN shipment_boxes.destination IS 'Final destination: USA warehouse or FBA warehouse';
