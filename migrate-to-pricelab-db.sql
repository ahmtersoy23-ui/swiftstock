-- ============================================
-- SwiftStock -> PriceLab DB Migration
-- ============================================
-- Bu script SwiftStock'u pricelab_db ile çalışacak şekilde hazırlar
-- Products tablosu paylaşılır, diğer tablolar wms_ prefix ile eklenir
-- ============================================

-- 1. SwiftStock kullanıcısı oluştur
CREATE USER swiftstock WITH PASSWORD 'your_secure_password_here';

-- 2. Gerekli izinleri ver
GRANT CONNECT ON DATABASE pricelab_db TO swiftstock;
GRANT USAGE ON SCHEMA public TO swiftstock;

-- Shared tables (read-only)
GRANT SELECT ON products TO swiftstock;
GRANT SELECT ON sku_master TO swiftstock;

-- 3. SwiftStock-specific tables (wms_ prefix)

-- Warehouses
CREATE TABLE wms_warehouses (
    warehouse_id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,  -- 'USA', 'TUR'
    name VARCHAR(100) NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

GRANT ALL ON wms_warehouses TO swiftstock;
GRANT USAGE, SELECT ON SEQUENCE wms_warehouses_warehouse_id_seq TO swiftstock;

-- Locations
CREATE TABLE wms_locations (
    location_id SERIAL PRIMARY KEY,
    warehouse_id INTEGER REFERENCES wms_warehouses(warehouse_id),
    qr_code VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, qr_code)
);

CREATE INDEX idx_wms_locations_qr ON wms_locations(qr_code);
CREATE INDEX idx_wms_locations_warehouse ON wms_locations(warehouse_id);

GRANT ALL ON wms_locations TO swiftstock;
GRANT USAGE, SELECT ON SEQUENCE wms_locations_location_id_seq TO swiftstock;

-- Containers
CREATE TABLE wms_containers (
    container_id SERIAL PRIMARY KEY,
    barcode VARCHAR(100) UNIQUE NOT NULL,
    container_type VARCHAR(20) NOT NULL,   -- 'BOX', 'PALLET'
    warehouse_id INTEGER REFERENCES wms_warehouses(warehouse_id),
    parent_container_id INTEGER REFERENCES wms_containers(container_id),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    opened_at TIMESTAMP,
    closed_at TIMESTAMP,
    notes TEXT
);

CREATE INDEX idx_wms_containers_barcode ON wms_containers(barcode);
CREATE INDEX idx_wms_containers_status ON wms_containers(status);
CREATE INDEX idx_wms_containers_warehouse ON wms_containers(warehouse_id);

GRANT ALL ON wms_containers TO swiftstock;
GRANT USAGE, SELECT ON SEQUENCE wms_containers_container_id_seq TO swiftstock;

-- Container Contents
CREATE TABLE wms_container_contents (
    content_id SERIAL PRIMARY KEY,
    container_id INTEGER REFERENCES wms_containers(container_id) ON DELETE CASCADE,
    product_sku VARCHAR(50),  -- References products(product_sku)
    quantity INTEGER NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(container_id, product_sku)
);

CREATE INDEX idx_wms_container_contents_container ON wms_container_contents(container_id);
CREATE INDEX idx_wms_container_contents_sku ON wms_container_contents(product_sku);

GRANT ALL ON wms_container_contents TO swiftstock;
GRANT USAGE, SELECT ON SEQUENCE wms_container_contents_content_id_seq TO swiftstock;

-- Inventory
CREATE TABLE wms_inventory (
    inventory_id SERIAL PRIMARY KEY,
    warehouse_id INTEGER REFERENCES wms_warehouses(warehouse_id),
    product_sku VARCHAR(50),  -- References products(product_sku)
    location_id INTEGER REFERENCES wms_locations(location_id),
    quantity INTEGER NOT NULL DEFAULT 0,
    container_id INTEGER REFERENCES wms_containers(container_id),
    last_counted_at TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, product_sku, location_id, container_id)
);

CREATE INDEX idx_wms_inventory_warehouse ON wms_inventory(warehouse_id);
CREATE INDEX idx_wms_inventory_sku ON wms_inventory(product_sku);
CREATE INDEX idx_wms_inventory_location ON wms_inventory(location_id);

GRANT ALL ON wms_inventory TO swiftstock;
GRANT USAGE, SELECT ON SEQUENCE wms_inventory_inventory_id_seq TO swiftstock;

-- Stock Movements
CREATE TABLE wms_stock_movements (
    movement_id SERIAL PRIMARY KEY,
    warehouse_id INTEGER REFERENCES wms_warehouses(warehouse_id),
    product_sku VARCHAR(50),  -- References products(product_sku)
    movement_type VARCHAR(20) NOT NULL,  -- 'IN', 'OUT', 'MOVE', 'COUNT', 'ADJUST'
    quantity INTEGER NOT NULL,
    from_location_id INTEGER REFERENCES wms_locations(location_id),
    to_location_id INTEGER REFERENCES wms_locations(location_id),
    container_id INTEGER REFERENCES wms_containers(container_id),
    reference_number VARCHAR(100),
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wms_movements_warehouse ON wms_stock_movements(warehouse_id);
CREATE INDEX idx_wms_movements_sku ON wms_stock_movements(product_sku);
CREATE INDEX idx_wms_movements_type ON wms_stock_movements(movement_type);
CREATE INDEX idx_wms_movements_date ON wms_stock_movements(created_at);

GRANT ALL ON wms_stock_movements TO swiftstock;
GRANT USAGE, SELECT ON SEQUENCE wms_stock_movements_movement_id_seq TO swiftstock;

-- Users (SwiftStock specific)
CREATE TABLE wms_users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(200),
    email VARCHAR(200) UNIQUE,
    role VARCHAR(50) DEFAULT 'user',  -- 'admin', 'manager', 'user'
    warehouse_id INTEGER REFERENCES wms_warehouses(warehouse_id),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wms_users_username ON wms_users(username);
CREATE INDEX idx_wms_users_email ON wms_users(email);

GRANT ALL ON wms_users TO swiftstock;
GRANT USAGE, SELECT ON SEQUENCE wms_users_user_id_seq TO swiftstock;

-- 4. Initial data
INSERT INTO wms_warehouses (code, name, address) VALUES
('USA', 'USA Warehouse', 'New Jersey, USA'),
('TUR', 'Turkey Warehouse', 'Istanbul, Turkey');

-- ============================================
-- Migration complete!
-- ============================================
-- Next steps:
-- 1. Update SwiftStock backend to use pricelab_db
-- 2. Update table names to wms_* prefix
-- 3. Update products references to use product_sku instead of sku_code
-- 4. Test thoroughly
-- ============================================
