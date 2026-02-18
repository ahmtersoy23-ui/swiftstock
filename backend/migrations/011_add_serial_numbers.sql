-- Migration: Add Serial Numbers Support
-- Description: Track individual product units with unique serial numbers
-- Barcode format: SKU-SERIAL (e.g., IWA-12345-000001)

-- Serial Numbers Table
CREATE TABLE IF NOT EXISTS serial_numbers (
    serial_id SERIAL PRIMARY KEY,
    product_sku VARCHAR(50) NOT NULL REFERENCES products(product_sku) ON DELETE CASCADE,
    serial_no VARCHAR(20) NOT NULL,           -- 000001, 000002, etc.
    full_barcode VARCHAR(100) NOT NULL,       -- SKU-SERIAL combined
    status VARCHAR(20) DEFAULT 'AVAILABLE',   -- AVAILABLE, IN_STOCK, SHIPPED, USED
    warehouse_id INTEGER REFERENCES warehouses(warehouse_id),
    location_id INTEGER REFERENCES locations(location_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_scanned_at TIMESTAMP,
    last_transaction_id INTEGER REFERENCES transactions(transaction_id),
    notes TEXT,
    UNIQUE(product_sku, serial_no),
    UNIQUE(full_barcode)
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_serial_numbers_sku ON serial_numbers(product_sku);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_barcode ON serial_numbers(full_barcode);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_status ON serial_numbers(status);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_warehouse ON serial_numbers(warehouse_id);

-- Add serial_no column to transaction_items for tracking which serials were used
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS serial_no VARCHAR(20);
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS full_barcode VARCHAR(100);

-- Sequence counter per SKU (for generating next serial number)
CREATE TABLE IF NOT EXISTS serial_counters (
    product_sku VARCHAR(50) PRIMARY KEY REFERENCES products(product_sku) ON DELETE CASCADE,
    last_serial INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Function to get next serial number for a SKU
CREATE OR REPLACE FUNCTION get_next_serial(p_product_sku VARCHAR(50))
RETURNS VARCHAR(20) AS $$
DECLARE
    next_num INTEGER;
BEGIN
    -- Insert or update counter
    INSERT INTO serial_counters (product_sku, last_serial, updated_at)
    VALUES (p_product_sku, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (product_sku) DO UPDATE
    SET last_serial = serial_counters.last_serial + 1,
        updated_at = CURRENT_TIMESTAMP
    RETURNING last_serial INTO next_num;

    -- Return padded serial number (6 digits)
    RETURN LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE serial_numbers IS 'Tracks individual product units with unique serial numbers';
COMMENT ON COLUMN serial_numbers.full_barcode IS 'Combined barcode in format SKU-SERIAL for scanning';
COMMENT ON COLUMN serial_numbers.status IS 'AVAILABLE=printed/ready, IN_STOCK=received in warehouse, SHIPPED=sent out, USED=consumed';
