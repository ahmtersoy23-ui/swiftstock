-- ============================================
-- COMPOSITE INDEX OPTIMIZATION
-- ============================================
-- These indexes improve query performance for common access patterns

-- Products table - Active products by category (for getAllProducts with filters)
CREATE INDEX IF NOT EXISTS idx_products_active_category
  ON products(is_active, category, product_name);

-- Products table - Active products search optimization
CREATE INDEX IF NOT EXISTS idx_products_active_search
  ON products(is_active, product_name);

-- Inventory table - SKU and warehouse lookup (most common query)
CREATE INDEX IF NOT EXISTS idx_inventory_sku_warehouse
  ON inventory(sku_code, warehouse_id, location_id);

-- Inventory table - Warehouse and location lookup
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_location
  ON inventory(warehouse_id, location_id, sku_code);

-- Location inventory table - Location and SKU lookup
CREATE INDEX IF NOT EXISTS idx_location_inventory_location_sku
  ON location_inventory(location_id, sku_code);

-- Location inventory table - SKU across locations
CREATE INDEX IF NOT EXISTS idx_location_inventory_sku
  ON location_inventory(sku_code, location_id);

-- Transactions table - Date range queries with warehouse filter
CREATE INDEX IF NOT EXISTS idx_transactions_warehouse_date
  ON transactions(warehouse_id, created_at DESC);

-- Transaction items table - Transaction lookup
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction
  ON transaction_items(transaction_id, sku_code);

-- Container contents - Container lookup
CREATE INDEX IF NOT EXISTS idx_container_contents_container
  ON container_contents(container_id, sku_code);

-- Locations table - Warehouse and zone lookup (for location filtering)
CREATE INDEX IF NOT EXISTS idx_locations_warehouse_zone
  ON locations(warehouse_id, zone, is_active);

-- Scan sessions table - User and status lookup
CREATE INDEX IF NOT EXISTS idx_scan_sessions_user_status
  ON scan_sessions(user_name, status, started_at DESC);

-- Scan operations table - Session and timestamp
CREATE INDEX IF NOT EXISTS idx_scan_operations_session_time
  ON scan_operations(session_id, scanned_at DESC);

COMMENT ON INDEX idx_products_active_category IS 'Optimize product filtering by active status and category';
COMMENT ON INDEX idx_inventory_sku_warehouse IS 'Optimize inventory lookups by SKU and warehouse';
COMMENT ON INDEX idx_location_inventory_location_sku IS 'Optimize location inventory queries';
COMMENT ON INDEX idx_transactions_warehouse_date IS 'Optimize transaction history queries';
