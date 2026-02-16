-- ============================================
-- SERIAL NUMBER HISTORY TABLE
-- Tracks all operations/events for serial numbers
-- ============================================

CREATE TABLE IF NOT EXISTS serial_history (
  history_id SERIAL PRIMARY KEY,
  serial_id INTEGER NOT NULL REFERENCES serial_numbers(serial_id) ON DELETE CASCADE,
  full_barcode VARCHAR(100) NOT NULL,
  event_type VARCHAR(50) NOT NULL,  -- CREATED, RECEIVED, TRANSFERRED, PICKED, SHIPPED, STATUS_CHANGE
  from_status VARCHAR(20),
  to_status VARCHAR(20),
  from_location_id INTEGER REFERENCES locations(location_id),
  to_location_id INTEGER REFERENCES locations(location_id),
  from_warehouse_id INTEGER REFERENCES warehouses(warehouse_id),
  to_warehouse_id INTEGER REFERENCES warehouses(warehouse_id),
  session_id INTEGER REFERENCES scan_sessions(session_id),
  transaction_id INTEGER,
  user_id INTEGER REFERENCES users(user_id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_serial_history_serial_id ON serial_history(serial_id);
CREATE INDEX idx_serial_history_barcode ON serial_history(full_barcode);
CREATE INDEX idx_serial_history_event_type ON serial_history(event_type);
CREATE INDEX idx_serial_history_created_at ON serial_history(created_at);

COMMENT ON TABLE serial_history IS 'Tracks complete history of all operations on serial numbers';
COMMENT ON COLUMN serial_history.event_type IS 'Type of event: CREATED, RECEIVED, TRANSFERRED, PICKED, SHIPPED, STATUS_CHANGE, COUNTED';
