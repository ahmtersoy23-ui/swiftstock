-- ============================================
-- WMS Database Schema
-- Two warehouses: USA, TUR
-- SKU-based inventory management
-- Container support (boxes, pallets)
-- Location tracking with QR codes
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. WAREHOUSES
-- ============================================
CREATE TABLE warehouses (
    warehouse_id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,  -- 'USA', 'TUR'
    name VARCHAR(100) NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. LOCATIONS (Raflar)
-- ============================================
CREATE TABLE locations (
    location_id SERIAL PRIMARY KEY,
    warehouse_id INTEGER REFERENCES warehouses(warehouse_id),
    qr_code VARCHAR(50) UNIQUE NOT NULL,  -- 'USA-A05-R12-S03'
    description VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, qr_code)
);

-- Index for faster QR lookups
CREATE INDEX idx_locations_qr ON locations(qr_code);

-- ============================================
-- 3. SKU CATALOG (pricelab-uyumlu schema)
-- ============================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_sku VARCHAR(50) UNIQUE NOT NULL,  -- iwasku (pricelab: product_sku)
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    base_cost DECIMAL(12, 4),
    barcode VARCHAR(100) UNIQUE,  -- Product barcode (WMS-specific)
    base_unit VARCHAR(20) DEFAULT 'EACH',  -- 'EACH', 'BOX', 'PALLET'
    units_per_box INTEGER DEFAULT 1,
    boxes_per_pallet INTEGER DEFAULT 1,
    weight_kg DECIMAL(10, 2),
    dimensions_cm VARCHAR(50),  -- '10x20x30'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_product_sku ON products(product_sku);

-- ============================================
-- 4. CONTAINERS (Koliler ve Paletler)
-- ============================================
CREATE TABLE containers (
    container_id SERIAL PRIMARY KEY,
    barcode VARCHAR(100) UNIQUE NOT NULL,  -- 'KOL-00001', 'PAL-00001'
    container_type VARCHAR(20) NOT NULL,   -- 'BOX', 'PALLET'
    warehouse_id INTEGER REFERENCES warehouses(warehouse_id),
    parent_container_id INTEGER REFERENCES containers(container_id),  -- Palet içindeki koli için
    status VARCHAR(20) DEFAULT 'ACTIVE',   -- 'ACTIVE', 'SHIPPED', 'OPENED', 'ARCHIVED'
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    opened_at TIMESTAMP,
    closed_at TIMESTAMP,
    notes TEXT
);

-- Index for container barcode scanning
CREATE INDEX idx_containers_barcode ON containers(barcode);
CREATE INDEX idx_containers_status ON containers(status);

-- ============================================
-- 5. CONTAINER CONTENTS (Koli/Palet İçindekiler)
-- ============================================
CREATE TABLE container_contents (
    content_id SERIAL PRIMARY KEY,
    container_id INTEGER REFERENCES containers(container_id) ON DELETE CASCADE,
    product_sku VARCHAR(50) REFERENCES products(product_sku),
    quantity INTEGER NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(container_id, product_sku)
);

-- Index for faster queries
CREATE INDEX idx_container_contents_container ON container_contents(container_id);

-- ============================================
-- 6. INVENTORY (Mevcut Stok)
-- ============================================
CREATE TABLE inventory (
    inventory_id SERIAL PRIMARY KEY,
    product_sku VARCHAR(50) REFERENCES products(product_sku),
    warehouse_id INTEGER REFERENCES warehouses(warehouse_id),
    location_id INTEGER REFERENCES locations(location_id),
    quantity_each INTEGER DEFAULT 0,  -- En küçük birim cinsinden
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(100),
    UNIQUE(product_sku, warehouse_id, location_id)
);

-- Indexes for inventory queries
CREATE INDEX idx_inventory_sku ON inventory(product_sku);
CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX idx_inventory_location ON inventory(location_id);

-- ============================================
-- 7. TRANSACTIONS (Tüm Hareketler)
-- ============================================
CREATE TABLE transactions (
    transaction_id SERIAL PRIMARY KEY,
    transaction_uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
    transaction_type VARCHAR(20) NOT NULL,  -- 'IN', 'OUT', 'ADJUST', 'TRANSFER'
    warehouse_id INTEGER REFERENCES warehouses(warehouse_id),
    location_id INTEGER REFERENCES locations(location_id),
    container_id INTEGER REFERENCES containers(container_id),
    reference_no VARCHAR(100),  -- Sipariş/sevkiyat numarası
    notes TEXT,
    created_by VARCHAR(100) NOT NULL,
    device_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for transaction queries
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_warehouse ON transactions(warehouse_id);
CREATE INDEX idx_transactions_date ON transactions(created_at DESC);

-- ============================================
-- 8. TRANSACTION ITEMS (Hareket Detayları)
-- ============================================
CREATE TABLE transaction_items (
    item_id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(transaction_id) ON DELETE CASCADE,
    product_sku VARCHAR(50) REFERENCES products(product_sku),
    quantity INTEGER NOT NULL,
    unit_type VARCHAR(20) DEFAULT 'EACH',  -- 'EACH', 'BOX', 'PALLET'
    quantity_each INTEGER NOT NULL,  -- En küçük birime çevrilmiş miktar
    from_location_id INTEGER REFERENCES locations(location_id),
    to_location_id INTEGER REFERENCES locations(location_id)
);

-- Index for transaction item queries
CREATE INDEX idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_sku ON transaction_items(product_sku);

-- ============================================
-- 9. USERS (Basit kullanıcı yönetimi)
-- ============================================
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'USER',  -- 'ADMIN', 'USER', 'VIEWER'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update inventory after transaction
CREATE OR REPLACE FUNCTION update_inventory_after_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Get transaction type
        DECLARE
            trans_type VARCHAR(20);
            trans_warehouse_id INTEGER;
            trans_location_id INTEGER;
        BEGIN
            SELECT transaction_type, warehouse_id, location_id 
            INTO trans_type, trans_warehouse_id, trans_location_id
            FROM transactions 
            WHERE transaction_id = NEW.transaction_id;
            
            -- Update or insert inventory
            IF trans_type = 'IN' THEN
                INSERT INTO inventory (product_sku, warehouse_id, location_id, quantity_each)
                VALUES (NEW.product_sku, trans_warehouse_id, trans_location_id, NEW.quantity_each)
                ON CONFLICT (product_sku, warehouse_id, location_id)
                DO UPDATE SET 
                    quantity_each = inventory.quantity_each + NEW.quantity_each,
                    last_updated = CURRENT_TIMESTAMP;
                    
            ELSIF trans_type = 'OUT' THEN
                UPDATE inventory 
                SET 
                    quantity_each = quantity_each - NEW.quantity_each,
                    last_updated = CURRENT_TIMESTAMP
                WHERE product_sku = NEW.product_sku
                    AND warehouse_id = trans_warehouse_id
                    AND location_id = trans_location_id;
            END IF;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inventory
AFTER INSERT ON transaction_items
FOR EACH ROW
EXECUTE FUNCTION update_inventory_after_transaction();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert warehouses
INSERT INTO warehouses (code, name, address) VALUES
('USA', 'USA Warehouse', '123 Main St, New York, NY'),
('TUR', 'Turkey Warehouse', 'Isparta, Turkey');

-- Insert default locations (main areas)
INSERT INTO locations (warehouse_id, qr_code, description) VALUES
(1, 'USA-MAIN', 'Main storage area'),
(2, 'TUR-MAIN', 'Main storage area');

-- Insert sample admin user (password: admin123)
INSERT INTO users (username, email, password_hash, full_name, role) VALUES
('admin', 'admin@warehouse.com', '$2b$10$rKvqLZZZZZZZZZZZZZZZZuGK7s8K8K8K8K8K8K8K8K8K8K', 'Admin User', 'ADMIN');

-- ============================================
-- VIEWS
-- ============================================

-- Current inventory summary by warehouse
CREATE VIEW v_inventory_summary AS
SELECT 
    i.warehouse_id,
    w.code as warehouse_code,
    w.name as warehouse_name,
    i.product_sku,
    p.name as product_name,
    p.barcode,
    i.quantity_each,
    FLOOR(i.quantity_each / NULLIF(p.units_per_box, 0)) as quantity_boxes,
    FLOOR(i.quantity_each / NULLIF(p.units_per_box * p.boxes_per_pallet, 0)) as quantity_pallets,
    l.qr_code as location_code,
    i.last_updated
FROM inventory i
JOIN products p ON i.product_sku = p.product_sku
JOIN warehouses w ON i.warehouse_id = w.warehouse_id
LEFT JOIN locations l ON i.location_id = l.location_id
WHERE i.quantity_each > 0
ORDER BY w.code, p.name;

-- Recent transactions with details
CREATE VIEW v_recent_transactions AS
SELECT 
    t.transaction_id,
    t.transaction_uuid,
    t.transaction_type,
    w.code as warehouse_code,
    t.reference_no,
    t.created_by,
    t.created_at,
    COUNT(ti.item_id) as item_count,
    STRING_AGG(DISTINCT p.name, ', ') as products
FROM transactions t
JOIN warehouses w ON t.warehouse_id = w.warehouse_id
LEFT JOIN transaction_items ti ON t.transaction_id = ti.transaction_id
LEFT JOIN products p ON ti.product_sku = p.product_sku
GROUP BY t.transaction_id, w.code
ORDER BY t.created_at DESC;

-- Container details with contents
CREATE VIEW v_container_details AS
SELECT 
    c.container_id,
    c.barcode,
    c.container_type,
    c.status,
    w.code as warehouse_code,
    c.created_at,
    COUNT(cc.content_id) as item_types,
    SUM(cc.quantity) as total_quantity,
    STRING_AGG(p.name || ' (' || cc.quantity || ')', ', ') as contents
FROM containers c
JOIN warehouses w ON c.warehouse_id = w.warehouse_id
LEFT JOIN container_contents cc ON c.container_id = cc.container_id
LEFT JOIN products p ON cc.product_sku = p.product_sku
GROUP BY c.container_id, w.code;

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Function to convert units
CREATE OR REPLACE FUNCTION convert_to_each(
    p_product_sku VARCHAR(50),
    p_quantity INTEGER,
    p_unit_type VARCHAR(20)
)
RETURNS INTEGER AS $$
DECLARE
    v_units_per_box INTEGER;
    v_boxes_per_pallet INTEGER;
    v_result INTEGER;
BEGIN
    SELECT units_per_box, boxes_per_pallet
    INTO v_units_per_box, v_boxes_per_pallet
    FROM products
    WHERE product_sku = p_product_sku;
    
    CASE p_unit_type
        WHEN 'EACH' THEN v_result := p_quantity;
        WHEN 'BOX' THEN v_result := p_quantity * v_units_per_box;
        WHEN 'PALLET' THEN v_result := p_quantity * v_units_per_box * v_boxes_per_pallet;
        ELSE v_result := p_quantity;
    END CASE;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE warehouses IS 'Physical warehouse locations (USA, TUR)';
COMMENT ON TABLE locations IS 'Storage locations within warehouses (QR code based)';
COMMENT ON TABLE products IS 'SKU catalog - pricelab-compatible schema with WMS extensions';
COMMENT ON TABLE containers IS 'Boxes and pallets that contain multiple products';
COMMENT ON TABLE container_contents IS 'Products inside containers';
COMMENT ON TABLE inventory IS 'Current stock levels by location';
COMMENT ON TABLE transactions IS 'Stock movements (IN/OUT/ADJUST/TRANSFER)';
COMMENT ON TABLE transaction_items IS 'Individual items in each transaction';
