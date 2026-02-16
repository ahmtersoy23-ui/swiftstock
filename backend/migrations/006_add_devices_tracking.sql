-- ============================================
-- DEVICE MANAGEMENT & TRACKING
-- ============================================
-- This migration adds device registration and tracking capabilities

-- Devices table - Register mobile devices/scanners
CREATE TABLE IF NOT EXISTS devices (
  device_id SERIAL PRIMARY KEY,
  device_uuid VARCHAR(100) NOT NULL UNIQUE,
  device_name VARCHAR(100),
  device_type VARCHAR(20) NOT NULL DEFAULT 'MOBILE',
  device_model VARCHAR(100),
  os_type VARCHAR(20),
  os_version VARCHAR(50),
  app_version VARCHAR(20),
  warehouse_code VARCHAR(10),
  assigned_user_id INTEGER,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  last_seen TIMESTAMP,
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  registered_by VARCHAR(50),
  notes TEXT,

  CONSTRAINT chk_device_type CHECK (device_type IN ('MOBILE', 'TABLET', 'HANDHELD_SCANNER', 'DESKTOP', 'OTHER')),
  CONSTRAINT chk_device_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOST', 'RETIRED')),
  CONSTRAINT chk_os_type CHECK (os_type IN ('IOS', 'ANDROID', 'WINDOWS', 'WEB', 'OTHER')),
  CONSTRAINT fk_device_warehouse FOREIGN KEY (warehouse_code)
    REFERENCES warehouses(code) ON DELETE SET NULL,
  CONSTRAINT fk_device_user FOREIGN KEY (assigned_user_id)
    REFERENCES users(user_id) ON DELETE SET NULL
);

-- Device sessions table - Track login sessions per device
CREATE TABLE IF NOT EXISTS device_sessions (
  session_id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  location_data JSONB,
  is_active BOOLEAN DEFAULT true,

  CONSTRAINT fk_session_device FOREIGN KEY (device_id)
    REFERENCES devices(device_id) ON DELETE CASCADE,
  CONSTRAINT fk_session_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE CASCADE
);

-- Device health metrics - Monitor device performance
CREATE TABLE IF NOT EXISTS device_health (
  health_id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL,
  battery_level INTEGER,
  signal_strength INTEGER,
  memory_available_mb INTEGER,
  storage_available_mb INTEGER,
  network_type VARCHAR(20),
  is_charging BOOLEAN,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_health_device FOREIGN KEY (device_id)
    REFERENCES devices(device_id) ON DELETE CASCADE,
  CONSTRAINT chk_battery CHECK (battery_level >= 0 AND battery_level <= 100),
  CONSTRAINT chk_signal CHECK (signal_strength >= -120 AND signal_strength <= 0)
);

-- Device location history - Track device movements
CREATE TABLE IF NOT EXISTS device_locations (
  location_record_id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL,
  warehouse_code VARCHAR(10),
  zone VARCHAR(50),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  accuracy_meters DECIMAL(6, 2),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_location_device FOREIGN KEY (device_id)
    REFERENCES devices(device_id) ON DELETE CASCADE,
  CONSTRAINT fk_location_warehouse FOREIGN KEY (warehouse_code)
    REFERENCES warehouses(code) ON DELETE SET NULL
);

-- ============================================
-- UPDATE EXISTING TABLES
-- ============================================

-- Add device_id to scan_sessions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_sessions' AND column_name = 'device_id'
  ) THEN
    ALTER TABLE scan_sessions ADD COLUMN device_id INTEGER;
    ALTER TABLE scan_sessions ADD CONSTRAINT fk_scan_session_device
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add device_id to transactions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'device_uuid'
  ) THEN
    ALTER TABLE transactions ADD COLUMN device_uuid VARCHAR(100);
  END IF;
END $$;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Devices indexes
CREATE INDEX IF NOT EXISTS idx_devices_uuid ON devices(device_uuid);
CREATE INDEX IF NOT EXISTS idx_devices_warehouse ON devices(warehouse_code, status);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status, last_seen);

-- Device sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_device ON device_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON device_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON device_sessions(is_active, last_activity);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON device_sessions(session_token);

-- Device health indexes
CREATE INDEX IF NOT EXISTS idx_health_device ON device_health(device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_battery ON device_health(battery_level, recorded_at DESC);

-- Device locations indexes
CREATE INDEX IF NOT EXISTS idx_locations_device ON device_locations(device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_locations_warehouse ON device_locations(warehouse_code, recorded_at DESC);

-- ============================================
-- VIEWS FOR EASY QUERYING
-- ============================================

-- Active devices view
CREATE OR REPLACE VIEW v_active_devices AS
SELECT
  d.device_id,
  d.device_uuid,
  d.device_name,
  d.device_type,
  d.warehouse_code,
  w.name AS warehouse_name,
  d.assigned_user_id,
  u.username,
  u.full_name,
  d.status,
  d.last_seen,
  ds.is_active AS has_active_session,
  ds.last_activity AS last_session_activity,
  dh.battery_level,
  dh.signal_strength
FROM devices d
LEFT JOIN warehouses w ON d.warehouse_code = w.code
LEFT JOIN users u ON d.assigned_user_id = u.user_id
LEFT JOIN LATERAL (
  SELECT is_active, last_activity
  FROM device_sessions
  WHERE device_id = d.device_id AND is_active = true
  ORDER BY started_at DESC
  LIMIT 1
) ds ON true
LEFT JOIN LATERAL (
  SELECT battery_level, signal_strength
  FROM device_health
  WHERE device_id = d.device_id
  ORDER BY recorded_at DESC
  LIMIT 1
) dh ON true
WHERE d.status IN ('ACTIVE', 'INACTIVE');

-- Device usage statistics view
CREATE OR REPLACE VIEW v_device_stats AS
SELECT
  d.device_id,
  d.device_uuid,
  d.device_name,
  d.warehouse_code,
  COUNT(DISTINCT ds.session_id) AS total_sessions,
  COUNT(DISTINCT ds.user_id) AS unique_users,
  MAX(ds.last_activity) AS last_activity,
  AVG(EXTRACT(EPOCH FROM (ds.ended_at - ds.started_at)) / 3600)::DECIMAL(10,2) AS avg_session_hours,
  COUNT(CASE WHEN ds.started_at > CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 1 END) AS sessions_last_24h
FROM devices d
LEFT JOIN device_sessions ds ON d.device_id = ds.device_id
GROUP BY d.device_id, d.device_uuid, d.device_name, d.warehouse_code;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update device last_seen
CREATE OR REPLACE FUNCTION update_device_last_seen(p_device_uuid VARCHAR)
RETURNS void AS $$
BEGIN
  UPDATE devices
  SET last_seen = CURRENT_TIMESTAMP
  WHERE device_uuid = p_device_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to close inactive sessions
CREATE OR REPLACE FUNCTION close_inactive_sessions()
RETURNS INTEGER AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE device_sessions
  SET
    is_active = false,
    ended_at = CURRENT_TIMESTAMP
  WHERE
    is_active = true
    AND last_activity < CURRENT_TIMESTAMP - INTERVAL '24 hours';

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$ LANGUAGE plpgsql;

-- Function to get device health status
CREATE OR REPLACE FUNCTION get_device_health_status(p_device_id INTEGER)
RETURNS TABLE (
  device_id INTEGER,
  battery_level INTEGER,
  battery_status VARCHAR,
  signal_strength INTEGER,
  signal_status VARCHAR,
  last_check TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dh.device_id,
    dh.battery_level,
    CASE
      WHEN dh.battery_level IS NULL THEN 'UNKNOWN'
      WHEN dh.battery_level < 20 THEN 'LOW'
      WHEN dh.battery_level < 50 THEN 'MEDIUM'
      ELSE 'GOOD'
    END AS battery_status,
    dh.signal_strength,
    CASE
      WHEN dh.signal_strength IS NULL THEN 'UNKNOWN'
      WHEN dh.signal_strength < -90 THEN 'POOR'
      WHEN dh.signal_strength < -70 THEN 'FAIR'
      WHEN dh.signal_strength < -50 THEN 'GOOD'
      ELSE 'EXCELLENT'
    END AS signal_status,
    dh.recorded_at AS last_check
  FROM device_health dh
  WHERE dh.device_id = p_device_id
  ORDER BY dh.recorded_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to update device last_seen on session activity
CREATE OR REPLACE FUNCTION trigger_update_device_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE devices
  SET last_seen = NEW.last_activity
  WHERE device_id = NEW.device_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_device_last_seen_on_session
  AFTER INSERT OR UPDATE OF last_activity ON device_sessions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_device_last_seen();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE devices IS 'Registered mobile devices and scanners';
COMMENT ON TABLE device_sessions IS 'User login sessions per device';
COMMENT ON TABLE device_health IS 'Device health metrics (battery, signal, etc.)';
COMMENT ON TABLE device_locations IS 'GPS tracking history for devices';

COMMENT ON VIEW v_active_devices IS 'Real-time view of active devices with latest status';
COMMENT ON VIEW v_device_stats IS 'Device usage statistics and metrics';

COMMENT ON FUNCTION update_device_last_seen IS 'Updates device last_seen timestamp';
COMMENT ON FUNCTION close_inactive_sessions IS 'Closes device sessions inactive for 24+ hours';
COMMENT ON FUNCTION get_device_health_status IS 'Gets latest health status with interpretations';
