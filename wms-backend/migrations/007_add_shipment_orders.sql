-- ============================================
-- SHIPMENT ORDERS & PICKING SYSTEM (USA WAREHOUSE)
-- ============================================
-- This migration adds order management and picking functionality

-- Shipment orders table - Customer orders to be picked and shipped
CREATE TABLE IF NOT EXISTS shipment_orders (
  order_id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  external_order_id VARCHAR(100),
  warehouse_code VARCHAR(10) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_address TEXT,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  requested_ship_date DATE,
  priority VARCHAR(20) DEFAULT 'NORMAL',
  status VARCHAR(30) DEFAULT 'PENDING',
  total_items INTEGER DEFAULT 0,
  total_quantity INTEGER DEFAULT 0,
  picked_items INTEGER DEFAULT 0,
  picked_quantity INTEGER DEFAULT 0,
  assigned_picker_id INTEGER,
  picking_started_at TIMESTAMP,
  picking_completed_at TIMESTAMP,
  shipped_at TIMESTAMP,
  tracking_number VARCHAR(100),
  carrier VARCHAR(50),
  shipping_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(50),

  CONSTRAINT chk_priority CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  CONSTRAINT chk_order_status CHECK (status IN (
    'PENDING', 'READY_TO_PICK', 'PICKING', 'PICKED',
    'PACKING', 'PACKED', 'SHIPPED', 'CANCELLED', 'ON_HOLD'
  )),
  CONSTRAINT fk_order_warehouse FOREIGN KEY (warehouse_code)
    REFERENCES warehouses(code) ON DELETE RESTRICT,
  CONSTRAINT fk_order_picker FOREIGN KEY (assigned_picker_id)
    REFERENCES users(user_id) ON DELETE SET NULL
);

-- Shipment order items - Line items in each order
CREATE TABLE IF NOT EXISTS shipment_order_items (
  item_id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  line_number INTEGER NOT NULL,
  sku_code VARCHAR(50) NOT NULL,
  product_name VARCHAR(255),
  barcode VARCHAR(100),
  quantity_ordered INTEGER NOT NULL,
  quantity_picked INTEGER DEFAULT 0,
  quantity_packed INTEGER DEFAULT 0,
  location_id INTEGER,
  location_code VARCHAR(50),
  status VARCHAR(30) DEFAULT 'PENDING',
  picked_by INTEGER,
  picked_at TIMESTAMP,
  notes TEXT,

  CONSTRAINT chk_item_status CHECK (status IN (
    'PENDING', 'PICKING', 'PICKED', 'SHORT_PICKED', 'PACKED', 'CANCELLED'
  )),
  CONSTRAINT fk_item_order FOREIGN KEY (order_id)
    REFERENCES shipment_orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_item_sku FOREIGN KEY (sku_code)
    REFERENCES products(sku_code) ON DELETE RESTRICT,
  CONSTRAINT fk_item_location FOREIGN KEY (location_id)
    REFERENCES locations(location_id) ON DELETE SET NULL,
  CONSTRAINT fk_item_picker FOREIGN KEY (picked_by)
    REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT unique_order_line UNIQUE (order_id, line_number),
  CONSTRAINT chk_quantities CHECK (
    quantity_ordered > 0
    AND quantity_picked >= 0
    AND quantity_packed >= 0
    AND quantity_picked <= quantity_ordered
    AND quantity_packed <= quantity_picked
  )
);

-- Pick lists (waves) - Batch multiple orders together for efficient picking
CREATE TABLE IF NOT EXISTS pick_lists (
  pick_list_id SERIAL PRIMARY KEY,
  pick_list_number VARCHAR(50) NOT NULL UNIQUE,
  warehouse_code VARCHAR(10) NOT NULL,
  pick_type VARCHAR(30) DEFAULT 'BATCH',
  status VARCHAR(30) DEFAULT 'CREATED',
  total_orders INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  assigned_picker_id INTEGER,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(50),

  CONSTRAINT chk_pick_type CHECK (pick_type IN ('SINGLE', 'BATCH', 'ZONE', 'WAVE')),
  CONSTRAINT chk_pick_status CHECK (status IN (
    'CREATED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
  )),
  CONSTRAINT fk_picklist_warehouse FOREIGN KEY (warehouse_code)
    REFERENCES warehouses(code) ON DELETE RESTRICT,
  CONSTRAINT fk_picklist_picker FOREIGN KEY (assigned_picker_id)
    REFERENCES users(user_id) ON DELETE SET NULL
);

-- Pick list orders - Link orders to pick lists
CREATE TABLE IF NOT EXISTS pick_list_orders (
  pick_list_order_id SERIAL PRIMARY KEY,
  pick_list_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  sequence_number INTEGER,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_plo_picklist FOREIGN KEY (pick_list_id)
    REFERENCES pick_lists(pick_list_id) ON DELETE CASCADE,
  CONSTRAINT fk_plo_order FOREIGN KEY (order_id)
    REFERENCES shipment_orders(order_id) ON DELETE CASCADE,
  CONSTRAINT unique_pick_list_order UNIQUE (pick_list_id, order_id)
);

-- Pick confirmations - Track each pick action
CREATE TABLE IF NOT EXISTS pick_confirmations (
  confirmation_id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  pick_list_id INTEGER,
  sku_code VARCHAR(50) NOT NULL,
  location_id INTEGER,
  quantity_picked INTEGER NOT NULL,
  picked_by INTEGER NOT NULL,
  picked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  device_uuid VARCHAR(100),
  scan_method VARCHAR(20),
  notes TEXT,

  CONSTRAINT chk_scan_method CHECK (scan_method IN ('BARCODE', 'QR', 'MANUAL', 'RFID')),
  CONSTRAINT fk_conf_order FOREIGN KEY (order_id)
    REFERENCES shipment_orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_conf_item FOREIGN KEY (item_id)
    REFERENCES shipment_order_items(item_id) ON DELETE CASCADE,
  CONSTRAINT fk_conf_picklist FOREIGN KEY (pick_list_id)
    REFERENCES pick_lists(pick_list_id) ON DELETE SET NULL,
  CONSTRAINT fk_conf_sku FOREIGN KEY (sku_code)
    REFERENCES products(sku_code) ON DELETE RESTRICT,
  CONSTRAINT fk_conf_location FOREIGN KEY (location_id)
    REFERENCES locations(location_id) ON DELETE SET NULL,
  CONSTRAINT fk_conf_picker FOREIGN KEY (picked_by)
    REFERENCES users(user_id) ON DELETE RESTRICT
);

-- Packing records - Track packing process
CREATE TABLE IF NOT EXISTS packing_records (
  packing_id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  package_number VARCHAR(50),
  package_type VARCHAR(30),
  weight_kg DECIMAL(10, 2),
  dimensions_cm VARCHAR(50),
  packed_by INTEGER NOT NULL,
  packed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  shipping_label_url TEXT,
  notes TEXT,

  CONSTRAINT fk_pack_order FOREIGN KEY (order_id)
    REFERENCES shipment_orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_pack_user FOREIGN KEY (packed_by)
    REFERENCES users(user_id) ON DELETE RESTRICT
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Shipment orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_number ON shipment_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_warehouse_status ON shipment_orders(warehouse_code, status);
CREATE INDEX IF NOT EXISTS idx_orders_status_date ON shipment_orders(status, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_picker ON shipment_orders(assigned_picker_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_priority ON shipment_orders(priority, status, order_date);
CREATE INDEX IF NOT EXISTS idx_orders_ship_date ON shipment_orders(requested_ship_date, status);

-- Order items indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order ON shipment_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku ON shipment_order_items(sku_code);
CREATE INDEX IF NOT EXISTS idx_order_items_location ON shipment_order_items(location_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON shipment_order_items(status);

-- Pick lists indexes
CREATE INDEX IF NOT EXISTS idx_picklists_number ON pick_lists(pick_list_number);
CREATE INDEX IF NOT EXISTS idx_picklists_warehouse ON pick_lists(warehouse_code, status);
CREATE INDEX IF NOT EXISTS idx_picklists_picker ON pick_lists(assigned_picker_id, status);
CREATE INDEX IF NOT EXISTS idx_picklists_created ON pick_lists(created_at DESC);

-- Pick list orders indexes
CREATE INDEX IF NOT EXISTS idx_plo_picklist ON pick_list_orders(pick_list_id);
CREATE INDEX IF NOT EXISTS idx_plo_order ON pick_list_orders(order_id);

-- Pick confirmations indexes
CREATE INDEX IF NOT EXISTS idx_conf_order ON pick_confirmations(order_id);
CREATE INDEX IF NOT EXISTS idx_conf_item ON pick_confirmations(item_id);
CREATE INDEX IF NOT EXISTS idx_conf_picker ON pick_confirmations(picked_by, picked_at DESC);
CREATE INDEX IF NOT EXISTS idx_conf_sku ON pick_confirmations(sku_code, picked_at DESC);

-- Packing records indexes
CREATE INDEX IF NOT EXISTS idx_pack_order ON packing_records(order_id);
CREATE INDEX IF NOT EXISTS idx_pack_user ON packing_records(packed_by, packed_at DESC);

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- Order status summary view
CREATE OR REPLACE VIEW v_order_status_summary AS
SELECT
  so.warehouse_code,
  so.status,
  COUNT(*) AS order_count,
  SUM(so.total_items) AS total_items,
  SUM(so.total_quantity) AS total_quantity,
  COUNT(DISTINCT so.assigned_picker_id) AS active_pickers,
  MIN(so.order_date) AS oldest_order_date,
  AVG(EXTRACT(EPOCH FROM (COALESCE(so.picking_completed_at, CURRENT_TIMESTAMP) - so.order_date)) / 3600)::DECIMAL(10,2) AS avg_hours_to_pick
FROM shipment_orders so
WHERE so.status NOT IN ('SHIPPED', 'CANCELLED')
GROUP BY so.warehouse_code, so.status;

-- Picker performance view
CREATE OR REPLACE VIEW v_picker_performance AS
SELECT
  u.user_id,
  u.username,
  u.full_name,
  COUNT(DISTINCT so.order_id) AS orders_picked,
  COUNT(DISTINCT pl.pick_list_id) AS pick_lists_completed,
  SUM(soi.quantity_picked) AS total_items_picked,
  AVG(EXTRACT(EPOCH FROM (so.picking_completed_at - so.picking_started_at)) / 60)::DECIMAL(10,2) AS avg_minutes_per_order,
  MAX(so.picking_completed_at) AS last_pick_time
FROM users u
LEFT JOIN shipment_orders so ON u.user_id = so.assigned_picker_id AND so.status IN ('PICKED', 'SHIPPED')
LEFT JOIN pick_lists pl ON u.user_id = pl.assigned_picker_id AND pl.status = 'COMPLETED'
LEFT JOIN shipment_order_items soi ON so.order_id = soi.order_id
WHERE u.role IN ('OPERATOR', 'MANAGER')
GROUP BY u.user_id, u.username, u.full_name;

-- Active pick lists view
CREATE OR REPLACE VIEW v_active_pick_lists AS
SELECT
  pl.pick_list_id,
  pl.pick_list_number,
  pl.warehouse_code,
  pl.status,
  pl.total_orders,
  pl.total_items,
  u.username AS picker_name,
  u.full_name AS picker_full_name,
  pl.started_at,
  COUNT(plo.order_id) AS orders_in_list,
  SUM(CASE WHEN so.status = 'PICKED' THEN 1 ELSE 0 END) AS orders_completed
FROM pick_lists pl
LEFT JOIN users u ON pl.assigned_picker_id = u.user_id
LEFT JOIN pick_list_orders plo ON pl.pick_list_id = plo.pick_list_id
LEFT JOIN shipment_orders so ON plo.order_id = so.order_id
WHERE pl.status IN ('CREATED', 'ASSIGNED', 'IN_PROGRESS')
GROUP BY pl.pick_list_id, pl.pick_list_number, pl.warehouse_code, pl.status,
         pl.total_orders, pl.total_items, u.username, u.full_name, pl.started_at;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to auto-assign picker based on workload
CREATE OR REPLACE FUNCTION assign_picker_to_order(p_order_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_warehouse_code VARCHAR(10);
  v_picker_id INTEGER;
BEGIN
  -- Get warehouse for this order
  SELECT warehouse_code INTO v_warehouse_code
  FROM shipment_orders
  WHERE order_id = p_order_id;

  -- Find picker with least active orders in this warehouse
  SELECT u.user_id INTO v_picker_id
  FROM users u
  WHERE u.warehouse_code = v_warehouse_code
    AND u.role IN ('OPERATOR', 'MANAGER')
    AND u.is_active = true
  ORDER BY (
    SELECT COUNT(*)
    FROM shipment_orders so
    WHERE so.assigned_picker_id = u.user_id
      AND so.status IN ('PICKING', 'READY_TO_PICK')
  ) ASC
  LIMIT 1;

  -- Update order with assigned picker
  IF v_picker_id IS NOT NULL THEN
    UPDATE shipment_orders
    SET
      assigned_picker_id = v_picker_id,
      status = 'READY_TO_PICK',
      updated_at = CURRENT_TIMESTAMP
    WHERE order_id = p_order_id;
  END IF;

  RETURN v_picker_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate order pick progress
CREATE OR REPLACE FUNCTION calculate_order_progress(p_order_id INTEGER)
RETURNS TABLE (
  order_id INTEGER,
  total_items INTEGER,
  picked_items INTEGER,
  total_quantity INTEGER,
  picked_quantity INTEGER,
  progress_percent DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p_order_id,
    COUNT(*)::INTEGER AS total_items,
    COUNT(CASE WHEN soi.status IN ('PICKED', 'PACKED') THEN 1 END)::INTEGER AS picked_items,
    SUM(soi.quantity_ordered)::INTEGER AS total_quantity,
    SUM(soi.quantity_picked)::INTEGER AS picked_quantity,
    CASE
      WHEN SUM(soi.quantity_ordered) > 0 THEN
        (SUM(soi.quantity_picked)::DECIMAL / SUM(soi.quantity_ordered) * 100)::DECIMAL(5,2)
      ELSE 0
    END AS progress_percent
  FROM shipment_order_items soi
  WHERE soi.order_id = p_order_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to update order progress when items are picked
CREATE OR REPLACE FUNCTION trigger_update_order_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_total_items INTEGER;
  v_picked_items INTEGER;
  v_total_qty INTEGER;
  v_picked_qty INTEGER;
BEGIN
  SELECT
    COUNT(*),
    COUNT(CASE WHEN status IN ('PICKED', 'PACKED') THEN 1 END),
    SUM(quantity_ordered),
    SUM(quantity_picked)
  INTO v_total_items, v_picked_items, v_total_qty, v_picked_qty
  FROM shipment_order_items
  WHERE order_id = NEW.order_id;

  UPDATE shipment_orders
  SET
    total_items = v_total_items,
    picked_items = v_picked_items,
    total_quantity = v_total_qty,
    picked_quantity = v_picked_qty,
    status = CASE
      WHEN v_picked_items = v_total_items THEN 'PICKED'
      WHEN v_picked_items > 0 THEN 'PICKING'
      ELSE status
    END,
    picking_completed_at = CASE
      WHEN v_picked_items = v_total_items THEN CURRENT_TIMESTAMP
      ELSE picking_completed_at
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE order_id = NEW.order_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_progress_on_item_change
  AFTER INSERT OR UPDATE ON shipment_order_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_order_progress();

-- Trigger to update order timestamps
CREATE OR REPLACE FUNCTION trigger_update_order_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;

  -- Set picking_started_at when status changes to PICKING
  IF NEW.status = 'PICKING' AND OLD.status != 'PICKING' THEN
    NEW.picking_started_at = CURRENT_TIMESTAMP;
  END IF;

  -- Set picking_completed_at when status changes to PICKED
  IF NEW.status = 'PICKED' AND OLD.status != 'PICKED' THEN
    NEW.picking_completed_at = CURRENT_TIMESTAMP;
  END IF;

  -- Set shipped_at when status changes to SHIPPED
  IF NEW.status = 'SHIPPED' AND OLD.status != 'SHIPPED' THEN
    NEW.shipped_at = CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_order_timestamps
  BEFORE UPDATE ON shipment_orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_order_timestamps();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE shipment_orders IS 'Customer orders for USA warehouse picking and shipping';
COMMENT ON TABLE shipment_order_items IS 'Line items in shipment orders';
COMMENT ON TABLE pick_lists IS 'Batched pick lists for efficient picking';
COMMENT ON TABLE pick_list_orders IS 'Orders assigned to pick lists';
COMMENT ON TABLE pick_confirmations IS 'Individual pick actions tracking';
COMMENT ON TABLE packing_records IS 'Packing and shipping records';

COMMENT ON VIEW v_order_status_summary IS 'Order status summary by warehouse';
COMMENT ON VIEW v_picker_performance IS 'Picker productivity metrics';
COMMENT ON VIEW v_active_pick_lists IS 'Currently active pick lists with progress';

COMMENT ON FUNCTION assign_picker_to_order IS 'Auto-assign picker with least workload';
COMMENT ON FUNCTION calculate_order_progress IS 'Calculate picking progress for an order';
