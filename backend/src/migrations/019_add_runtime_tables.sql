-- ============================================
-- MIGRATION 019: Runtime tables → proper migration
-- Previously created at app startup via ensureTable pattern.
-- This migration ensures they exist in fresh DB setups.
-- ============================================

-- ── Alerts ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wms_alerts (
  alert_id SERIAL PRIMARY KEY,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
  title VARCHAR(200) NOT NULL,
  message TEXT,
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  warehouse_code VARCHAR(20),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wms_alerts_unread ON wms_alerts (is_read, created_at DESC);

-- ── OMS: Reservations ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wms_reservations (
  reservation_id SERIAL PRIMARY KEY,
  product_sku VARCHAR(100) NOT NULL,
  warehouse_code VARCHAR(20) NOT NULL,
  quantity INTEGER NOT NULL,
  order_reference VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  reserved_by VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wms_reservations_sku ON wms_reservations (product_sku, status);
CREATE INDEX IF NOT EXISTS idx_wms_reservations_warehouse ON wms_reservations (warehouse_code, status);

-- ── OMS: Webhooks ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wms_webhooks (
  webhook_id SERIAL PRIMARY KEY,
  url VARCHAR(500) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  secret VARCHAR(200),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wms_webhook_logs (
  log_id SERIAL PRIMARY KEY,
  webhook_id INTEGER NOT NULL REFERENCES wms_webhooks(webhook_id),
  event_type VARCHAR(50) NOT NULL,
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wms_webhook_logs_webhook ON wms_webhook_logs (webhook_id, attempted_at DESC);

-- ── Kitting / Assembly ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wms_kit_definitions (
  kit_id SERIAL PRIMARY KEY,
  kit_sku VARCHAR(100) NOT NULL UNIQUE,
  kit_name VARCHAR(200) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wms_kit_components (
  component_id SERIAL PRIMARY KEY,
  kit_id INTEGER NOT NULL REFERENCES wms_kit_definitions(kit_id),
  product_sku VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_wms_kit_components_kit ON wms_kit_components (kit_id);

CREATE TABLE IF NOT EXISTS wms_kit_builds (
  build_id SERIAL PRIMARY KEY,
  kit_id INTEGER NOT NULL REFERENCES wms_kit_definitions(kit_id),
  warehouse_code VARCHAR(20) NOT NULL,
  quantity_built INTEGER NOT NULL DEFAULT 1,
  built_by VARCHAR(100),
  built_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Analytics: Marketplace Stock ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wms_marketplace_stock (
  id SERIAL PRIMARY KEY,
  product_sku VARCHAR(100) NOT NULL,
  source VARCHAR(50) NOT NULL,
  depot_name VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  inbound INTEGER NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_sku, source, depot_name)
);
CREATE INDEX IF NOT EXISTS idx_wms_marketplace_stock_sku ON wms_marketplace_stock (product_sku);

-- ── Pick Waves (from orders.routes.ts) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS wms_pick_waves (
  wave_id SERIAL PRIMARY KEY,
  wave_name VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_items INTEGER NOT NULL DEFAULT 0,
  created_by VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wms_pick_wave_orders (
  wave_order_id SERIAL PRIMARY KEY,
  wave_id INTEGER NOT NULL REFERENCES wms_pick_waves(wave_id),
  order_id INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wms_pick_wave_orders_wave ON wms_pick_wave_orders (wave_id);
