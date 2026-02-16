#!/bin/bash

# ============================================
# SwiftStock DB Schema Refactoring Script
# ============================================
# This script updates all TypeScript files to use:
# 1. wms_ prefix for table names
# 2. product_sku instead of sku_code
# ============================================

echo "🔄 Starting database schema refactoring..."
echo ""

# Find all TypeScript files in src directory
SRC_DIR="/Users/ahmetersoy/Desktop/swiftstock/wms-backend/src"

# Create backup directory
BACKUP_DIR="/Users/ahmetersoy/Desktop/swiftstock/wms-backend/backup_$(date +%Y%m%d_%H%M%S)"
echo "📦 Creating backup at: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
cp -r "$SRC_DIR" "$BACKUP_DIR/"
echo "✅ Backup created"
echo ""

# Table name replacements (wms_ prefix)
# Exclude: products, sku_master (shared tables)
echo "📝 Updating table names..."

# Note: Order matters! More specific patterns first
sed -i '' 's/FROM warehouses/FROM wms_warehouses/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/INTO warehouses/INTO wms_warehouses/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/UPDATE warehouses/UPDATE wms_warehouses/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/JOIN warehouses/JOIN wms_warehouses/g' $(find "$SRC_DIR" -name "*.ts")

sed -i '' 's/FROM locations/FROM wms_locations/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/INTO locations/INTO wms_locations/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/UPDATE locations/UPDATE wms_locations/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/JOIN locations/JOIN wms_locations/g' $(find "$SRC_DIR" -name "*.ts")

sed -i '' 's/FROM containers /FROM wms_containers /g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/INTO containers/INTO wms_containers/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/UPDATE containers/UPDATE wms_containers/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/JOIN containers/JOIN wms_containers/g' $(find "$SRC_DIR" -name "*.ts")

sed -i '' 's/FROM container_contents/FROM wms_container_contents/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/INTO container_contents/INTO wms_container_contents/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/UPDATE container_contents/UPDATE wms_container_contents/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/JOIN container_contents/JOIN wms_container_contents/g' $(find "$SRC_DIR" -name "*.ts")

sed -i '' 's/FROM inventory /FROM wms_inventory /g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/INTO inventory/INTO wms_inventory/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/UPDATE inventory/UPDATE wms_inventory/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/JOIN inventory/JOIN wms_inventory/g' $(find "$SRC_DIR" -name "*.ts")

sed -i '' 's/FROM stock_movements/FROM wms_stock_movements/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/INTO stock_movements/INTO wms_stock_movements/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/UPDATE stock_movements/UPDATE wms_stock_movements/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/JOIN stock_movements/JOIN wms_stock_movements/g' $(find "$SRC_DIR" -name "*.ts")

sed -i '' 's/FROM users /FROM wms_users /g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/INTO users/INTO wms_users/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/UPDATE users/UPDATE wms_users/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/JOIN users/JOIN wms_users/g' $(find "$SRC_DIR" -name "*.ts")

echo "✅ Table names updated"
echo ""

# Field name replacements (sku_code -> product_sku)
echo "📝 Updating field names (sku_code -> product_sku)..."

# In SQL queries
sed -i '' 's/sku_code = /product_sku = /g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/sku_code,/product_sku,/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/sku_code FROM/product_sku FROM/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/sku_code WHERE/product_sku WHERE/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/sku_code ASC/product_sku ASC/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/sku_code DESC/product_sku DESC/g' $(find "$SRC_DIR" -name "*.ts")

# In TypeScript interfaces/types
sed -i '' 's/sku_code:/product_sku:/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/sku_code;/product_sku;/g' $(find "$SRC_DIR" -name "*.ts")
sed -i '' 's/sku_code?:/product_sku?:/g' $(find "$SRC_DIR" -name "*.ts")

# In object destructuring
sed -i '' 's/{.*sku_code.*}/{...product_sku...}/g' $(find "$SRC_DIR" -name "*.ts")

echo "✅ Field names updated"
echo ""

echo "🎉 Refactoring complete!"
echo ""
echo "⚠️  IMPORTANT: Manual review required for:"
echo "  - Route parameters (/products/:sku_code -> /products/:product_sku)"
echo "  - Variable names (const sku_code -> const product_sku)"
echo "  - Frontend API calls"
echo ""
echo "📁 Backup location: $BACKUP_DIR"
echo ""
echo "🔍 To check changes:"
echo "  git diff"
echo ""
echo "♻️  To rollback:"
echo "  rm -rf $SRC_DIR && cp -r $BACKUP_DIR/src $SRC_DIR"
