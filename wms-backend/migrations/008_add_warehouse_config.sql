-- ============================================
-- WAREHOUSE CONFIGURATION SYSTEM
-- ============================================
-- This migration adds warehouse-specific configuration for USA vs Turkey operations

-- Warehouse configuration table - Store warehouse-specific settings
CREATE TABLE IF NOT EXISTS warehouse_config (
  config_id SERIAL PRIMARY KEY,
  warehouse_code VARCHAR(10) NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  config_value TEXT,
  value_type VARCHAR(20) DEFAULT 'STRING',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(50),

  CONSTRAINT chk_value_type CHECK (value_type IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'ARRAY')),
  CONSTRAINT fk_config_warehouse FOREIGN KEY (warehouse_code)
    REFERENCES warehouses(code) ON DELETE CASCADE,
  CONSTRAINT unique_warehouse_config UNIQUE (warehouse_code, config_key)
);

-- Warehouse features table - Enable/disable features per warehouse
CREATE TABLE IF NOT EXISTS warehouse_features (
  feature_id SERIAL PRIMARY KEY,
  warehouse_code VARCHAR(10) NOT NULL,
  feature_name VARCHAR(100) NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  configuration JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_feature_warehouse FOREIGN KEY (warehouse_code)
    REFERENCES warehouses(code) ON DELETE CASCADE,
  CONSTRAINT unique_warehouse_feature UNIQUE (warehouse_code, feature_name)
);

-- Warehouse operation modes - Define which operations are allowed
CREATE TABLE IF NOT EXISTS warehouse_operation_modes (
  operation_mode_id SERIAL PRIMARY KEY,
  warehouse_code VARCHAR(10) NOT NULL,
  operation_type VARCHAR(50) NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  default_settings JSONB,
  notes TEXT,

  CONSTRAINT fk_opmode_warehouse FOREIGN KEY (warehouse_code)
    REFERENCES warehouses(code) ON DELETE CASCADE,
  CONSTRAINT unique_warehouse_operation UNIQUE (warehouse_code, operation_type),
  CONSTRAINT chk_operation_type CHECK (operation_type IN (
    'RECEIVING', 'PICKING', 'PACKING', 'SHIPPING',
    'TRANSFER', 'ADJUSTMENT', 'CYCLE_COUNT', 'RETURNS'
  ))
);

-- ============================================
-- UPDATE WAREHOUSES TABLE
-- ============================================

-- Add additional columns to warehouses table
DO $$
BEGIN
  -- Add country_code
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouses' AND column_name = 'country_code'
  ) THEN
    ALTER TABLE warehouses ADD COLUMN country_code VARCHAR(2);
    COMMENT ON COLUMN warehouses.country_code IS 'ISO 3166-1 alpha-2 country code (e.g., US, TR)';
  END IF;

  -- Add warehouse_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouses' AND column_name = 'warehouse_type'
  ) THEN
    ALTER TABLE warehouses ADD COLUMN warehouse_type VARCHAR(30) DEFAULT 'STANDARD';
    ALTER TABLE warehouses ADD CONSTRAINT chk_warehouse_type
      CHECK (warehouse_type IN ('STANDARD', 'FULFILLMENT', 'DISTRIBUTION', 'RETURNS'));
    COMMENT ON COLUMN warehouses.warehouse_type IS 'Type of warehouse operations';
  END IF;

  -- Add timezone
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouses' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE warehouses ADD COLUMN timezone VARCHAR(50);
    COMMENT ON COLUMN warehouses.timezone IS 'IANA timezone (e.g., America/New_York, Europe/Istanbul)';
  END IF;

  -- Add currency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouses' AND column_name = 'currency'
  ) THEN
    ALTER TABLE warehouses ADD COLUMN currency VARCHAR(3);
    COMMENT ON COLUMN warehouses.currency IS 'ISO 4217 currency code (e.g., USD, TRY)';
  END IF;

  -- Add business_hours
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouses' AND column_name = 'business_hours'
  ) THEN
    ALTER TABLE warehouses ADD COLUMN business_hours JSONB;
    COMMENT ON COLUMN warehouses.business_hours IS 'Operating hours in JSON format';
  END IF;
END $$;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_config_warehouse ON warehouse_config(warehouse_code);
CREATE INDEX IF NOT EXISTS idx_config_key ON warehouse_config(config_key, is_active);
CREATE INDEX IF NOT EXISTS idx_features_warehouse ON warehouse_features(warehouse_code);
CREATE INDEX IF NOT EXISTS idx_features_name ON warehouse_features(feature_name, is_enabled);
CREATE INDEX IF NOT EXISTS idx_opmodes_warehouse ON warehouse_operation_modes(warehouse_code);

-- ============================================
-- DEFAULT CONFIGURATIONS
-- ============================================

-- USA Warehouse Default Configuration
INSERT INTO warehouse_config (warehouse_code, config_key, config_value, value_type, description)
SELECT 'USA', key, value, type, desc FROM (VALUES
  ('default_operation_mode', 'PICKING', 'STRING', 'Primary operation mode for this warehouse'),
  ('picking_enabled', 'true', 'BOOLEAN', 'Enable order picking operations'),
  ('require_location_scan', 'true', 'BOOLEAN', 'Require location scan during picking'),
  ('allow_partial_picks', 'true', 'BOOLEAN', 'Allow picking less than ordered quantity'),
  ('auto_assign_picker', 'true', 'BOOLEAN', 'Automatically assign pickers to orders'),
  ('packing_station_required', 'true', 'BOOLEAN', 'Require packing station for orders'),
  ('shipping_label_auto_print', 'true', 'BOOLEAN', 'Auto-print shipping labels'),
  ('min_pick_batch_size', '5', 'NUMBER', 'Minimum orders in a pick batch'),
  ('max_pick_batch_size', '20', 'NUMBER', 'Maximum orders in a pick batch'),
  ('pick_accuracy_target', '99.5', 'NUMBER', 'Target pick accuracy percentage'),
  ('language', 'en', 'STRING', 'Default language (en, tr)'),
  ('weight_unit', 'lb', 'STRING', 'Weight measurement unit (kg, lb)'),
  ('dimension_unit', 'in', 'STRING', 'Dimension unit (cm, in)')
) AS t(key, value, type, desc)
WHERE EXISTS (SELECT 1 FROM warehouses WHERE code = 'USA')
ON CONFLICT (warehouse_code, config_key) DO NOTHING;

-- Turkey Warehouse Default Configuration
INSERT INTO warehouse_config (warehouse_code, config_key, config_value, value_type, description)
SELECT 'TR', key, value, type, desc FROM (VALUES
  ('default_operation_mode', 'RECEIVING', 'STRING', 'Primary operation mode for this warehouse'),
  ('picking_enabled', 'false', 'BOOLEAN', 'Enable order picking operations'),
  ('receiving_enabled', 'true', 'BOOLEAN', 'Enable receiving operations'),
  ('shipping_enabled', 'true', 'BOOLEAN', 'Enable simple shipping (non-picking)'),
  ('require_location_scan', 'true', 'BOOLEAN', 'Require location scan during operations'),
  ('allow_quick_transfer', 'true', 'BOOLEAN', 'Allow quick transfer between locations'),
  ('container_tracking', 'true', 'BOOLEAN', 'Enable container (box/pallet) tracking'),
  ('language', 'tr', 'STRING', 'Default language (en, tr)'),
  ('weight_unit', 'kg', 'STRING', 'Weight measurement unit (kg, lb)'),
  ('dimension_unit', 'cm', 'STRING', 'Dimension unit (cm, in)')
) AS t(key, value, type, desc)
WHERE EXISTS (SELECT 1 FROM warehouses WHERE code = 'TR')
ON CONFLICT (warehouse_code, config_key) DO NOTHING;

-- USA Warehouse Features
INSERT INTO warehouse_features (warehouse_code, feature_name, is_enabled, configuration)
SELECT 'USA', feature, enabled, config::JSONB FROM (VALUES
  ('ORDER_PICKING', true, '{"method": "batch", "zones": ["A", "B", "C"]}'),
  ('WAVE_PICKING', true, '{"wave_interval_minutes": 60, "auto_release": true}'),
  ('PACKING_STATIONS', true, '{"stations": 10, "require_weight": true}'),
  ('SHIPPING_INTEGRATION', true, '{"carriers": ["USPS", "UPS", "FEDEX"]}'),
  ('BARCODE_SCANNING', true, '{"types": ["1D", "2D", "QR"]}'),
  ('INVENTORY_TRACKING', true, '{"real_time": true, "location_based": true}'),
  ('CYCLE_COUNTING', true, '{"frequency_days": 90}'),
  ('RETURNS_PROCESSING', true, '{"auto_restock": false}')
) AS t(feature, enabled, config)
WHERE EXISTS (SELECT 1 FROM warehouses WHERE code = 'USA')
ON CONFLICT (warehouse_code, feature_name) DO NOTHING;

-- Turkey Warehouse Features
INSERT INTO warehouse_features (warehouse_code, feature_name, is_enabled, configuration)
SELECT 'TR', feature, enabled, config::JSONB FROM (VALUES
  ('ORDER_PICKING', false, '{"method": "none"}'),
  ('RECEIVING', true, '{"require_po": false, "container_based": true}'),
  ('SIMPLE_SHIPPING', true, '{"require_destination": true}'),
  ('CONTAINER_MANAGEMENT', true, '{"types": ["BOX", "PALLET"], "nesting": true}'),
  ('BARCODE_SCANNING', true, '{"types": ["1D", "2D", "QR"]}'),
  ('INVENTORY_TRACKING', true, '{"real_time": true, "location_based": true}'),
  ('LOCATION_TRANSFER', true, '{"require_approval": false}'),
  ('CYCLE_COUNTING', true, '{"frequency_days": 30}')
) AS t(feature, enabled, config)
WHERE EXISTS (SELECT 1 FROM warehouses WHERE code = 'TR')
ON CONFLICT (warehouse_code, feature_name) DO NOTHING;

-- USA Operation Modes
INSERT INTO warehouse_operation_modes (warehouse_code, operation_type, is_enabled, requires_approval, default_settings)
SELECT 'USA', op_type, enabled, approval, settings::JSONB FROM (VALUES
  ('RECEIVING', true, false, '{"require_po": false, "auto_putaway": true}'),
  ('PICKING', true, false, '{"batch_mode": true, "zone_based": true}'),
  ('PACKING', true, false, '{"require_weight": true, "print_label": true}'),
  ('SHIPPING', true, false, '{"carrier_integration": true}'),
  ('TRANSFER', true, false, '{"require_location_scan": true}'),
  ('ADJUSTMENT', true, true, '{"require_reason": true, "manager_approval": true}'),
  ('CYCLE_COUNT', true, false, '{"blind_count": true}'),
  ('RETURNS', true, false, '{"inspection_required": true}')
) AS t(op_type, enabled, approval, settings)
WHERE EXISTS (SELECT 1 FROM warehouses WHERE code = 'USA')
ON CONFLICT (warehouse_code, operation_type) DO NOTHING;

-- Turkey Operation Modes
INSERT INTO warehouse_operation_modes (warehouse_code, operation_type, is_enabled, requires_approval, default_settings)
SELECT 'TR', op_type, enabled, approval, settings::JSONB FROM (VALUES
  ('RECEIVING', true, false, '{"container_based": true, "location_required": true}'),
  ('PICKING', false, false, '{}'),
  ('PACKING', false, false, '{}'),
  ('SHIPPING', true, false, '{"simple_mode": true, "require_destination": true}'),
  ('TRANSFER', true, false, '{"require_location_scan": true}'),
  ('ADJUSTMENT', true, true, '{"require_reason": true, "manager_approval": true}'),
  ('CYCLE_COUNT', true, false, '{"location_based": true}'),
  ('RETURNS', false, false, '{}')
) AS t(op_type, enabled, approval, settings)
WHERE EXISTS (SELECT 1 FROM warehouses WHERE code = 'TR')
ON CONFLICT (warehouse_code, operation_type) DO NOTHING;

-- Update existing warehouse records with defaults
UPDATE warehouses
SET
  country_code = 'US',
  warehouse_type = 'FULFILLMENT',
  timezone = 'America/New_York',
  currency = 'USD',
  business_hours = '{"monday": "08:00-17:00", "tuesday": "08:00-17:00", "wednesday": "08:00-17:00", "thursday": "08:00-17:00", "friday": "08:00-17:00"}'::JSONB
WHERE code = 'USA' AND country_code IS NULL;

UPDATE warehouses
SET
  country_code = 'TR',
  warehouse_type = 'DISTRIBUTION',
  timezone = 'Europe/Istanbul',
  currency = 'TRY',
  business_hours = '{"monday": "09:00-18:00", "tuesday": "09:00-18:00", "wednesday": "09:00-18:00", "thursday": "09:00-18:00", "friday": "09:00-18:00"}'::JSONB
WHERE code = 'TR' AND country_code IS NULL;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get warehouse config value
CREATE OR REPLACE FUNCTION get_warehouse_config(
  p_warehouse_code VARCHAR,
  p_config_key VARCHAR,
  p_default_value TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT config_value INTO v_value
  FROM warehouse_config
  WHERE warehouse_code = p_warehouse_code
    AND config_key = p_config_key
    AND is_active = true;

  RETURN COALESCE(v_value, p_default_value);
END;
$$ LANGUAGE plpgsql;

-- Function to check if feature is enabled
CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_warehouse_code VARCHAR,
  p_feature_name VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT is_enabled INTO v_enabled
  FROM warehouse_features
  WHERE warehouse_code = p_warehouse_code
    AND feature_name = p_feature_name;

  RETURN COALESCE(v_enabled, false);
END;
$$ LANGUAGE plpgsql;

-- Function to check if operation is allowed
CREATE OR REPLACE FUNCTION is_operation_allowed(
  p_warehouse_code VARCHAR,
  p_operation_type VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT is_enabled INTO v_enabled
  FROM warehouse_operation_modes
  WHERE warehouse_code = p_warehouse_code
    AND operation_type = p_operation_type;

  RETURN COALESCE(v_enabled, false);
END;
$$ LANGUAGE plpgsql;

-- Function to get warehouse operation settings
CREATE OR REPLACE FUNCTION get_operation_settings(
  p_warehouse_code VARCHAR,
  p_operation_type VARCHAR
)
RETURNS JSONB AS $$
DECLARE
  v_settings JSONB;
BEGIN
  SELECT default_settings INTO v_settings
  FROM warehouse_operation_modes
  WHERE warehouse_code = p_warehouse_code
    AND operation_type = p_operation_type
    AND is_enabled = true;

  RETURN COALESCE(v_settings, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS
-- ============================================

-- Warehouse capabilities view
CREATE OR REPLACE VIEW v_warehouse_capabilities AS
SELECT
  w.warehouse_id,
  w.code AS warehouse_code,
  w.name AS warehouse_name,
  w.country_code,
  w.warehouse_type,
  w.timezone,
  w.currency,
  (
    SELECT json_object_agg(wf.feature_name, wf.is_enabled)
    FROM warehouse_features wf
    WHERE wf.warehouse_code = w.code
  ) AS features,
  (
    SELECT json_object_agg(wom.operation_type, wom.is_enabled)
    FROM warehouse_operation_modes wom
    WHERE wom.warehouse_code = w.code
  ) AS operations,
  w.is_active
FROM warehouses w;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_config_updated_at
  BEFORE UPDATE ON warehouse_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_features_updated_at
  BEFORE UPDATE ON warehouse_features
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE warehouse_config IS 'Warehouse-specific configuration key-value pairs';
COMMENT ON TABLE warehouse_features IS 'Enable/disable features per warehouse';
COMMENT ON TABLE warehouse_operation_modes IS 'Allowed operations per warehouse';

COMMENT ON FUNCTION get_warehouse_config IS 'Get configuration value for warehouse';
COMMENT ON FUNCTION is_feature_enabled IS 'Check if feature is enabled for warehouse';
COMMENT ON FUNCTION is_operation_allowed IS 'Check if operation is allowed for warehouse';
COMMENT ON FUNCTION get_operation_settings IS 'Get operation settings JSON for warehouse';

COMMENT ON VIEW v_warehouse_capabilities IS 'Complete view of warehouse features and capabilities';
