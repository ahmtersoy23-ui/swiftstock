-- Add category column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Make barcode nullable (backward compatibility)
ALTER TABLE products ALTER COLUMN barcode DROP NOT NULL;

-- Create product_eans table for multiple EANs per product
CREATE TABLE IF NOT EXISTS product_eans (
  ean_id SERIAL PRIMARY KEY,
  product_sku VARCHAR(50) NOT NULL REFERENCES products(product_sku) ON DELETE CASCADE,
  ean_code VARCHAR(50) NOT NULL UNIQUE,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for faster lookup
CREATE INDEX IF NOT EXISTS idx_product_eans_ean_code ON product_eans(ean_code);
CREATE INDEX IF NOT EXISTS idx_product_eans_product_sku ON product_eans(product_sku);

COMMENT ON TABLE product_eans IS 'Stores multiple EAN codes for each product (1 product can have N EANs)';
COMMENT ON COLUMN product_eans.is_primary IS 'Indicates the primary/default EAN for this product';
