// ============================================
// IMPORTS
// ============================================

import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import pool from './config/database';

console.log('🔍 Loading WMS Backend...');

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface Warehouse {
  warehouse_id: number;
  code: string;
  name: string;
  address?: string;
  is_active: boolean;
  created_at: Date;
}

export interface Location {
  location_id: number;
  warehouse_id: number;
  qr_code: string;
  description?: string;
  is_active: boolean;
  created_at: Date;
}

export interface Product {
  sku_code: string;
  product_name: string;
  description?: string;
  barcode: string;
  base_unit: 'EACH' | 'BOX' | 'PALLET';
  units_per_box: number;
  boxes_per_pallet: number;
  weight_kg?: number;
  dimensions_cm?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Container {
  container_id: number;
  barcode: string;
  container_type: 'BOX' | 'PALLET';
  warehouse_id: number;
  parent_container_id?: number;
  status: 'ACTIVE' | 'SHIPPED' | 'OPENED' | 'ARCHIVED';
  created_by: string;
  created_at: Date;
  opened_at?: Date;
  closed_at?: Date;
  notes?: string;
}

export interface ContainerContent {
  content_id: number;
  container_id: number;
  sku_code: string;
  quantity: number;
  added_at: Date;
}

export interface Inventory {
  inventory_id: number;
  sku_code: string;
  warehouse_id: number;
  location_id?: number;
  quantity_each: number;
  last_updated: Date;
  updated_by?: string;
}

export interface Transaction {
  transaction_id: number;
  transaction_uuid: string;
  transaction_type: 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER';
  warehouse_id: number;
  location_id?: number;
  container_id?: number;
  reference_no?: string;
  notes?: string;
  created_by: string;
  device_id?: string;
  created_at: Date;
}

export interface TransactionItem {
  item_id: number;
  transaction_id: number;
  sku_code: string;
  quantity: number;
  unit_type: 'EACH' | 'BOX' | 'PALLET';
  quantity_each: number;
  from_location_id?: number;
  to_location_id?: number;
}

export interface User {
  user_id: number;
  username: string;
  email?: string;
  full_name?: string;
  role: 'ADMIN' | 'USER' | 'VIEWER';
  is_active: boolean;
  created_at: Date;
  last_login?: Date;
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export interface ScanRequest {
  barcode: string;
  warehouse_code: string;
  location_qr?: string;
  user: string;
}

export interface ScanResponse {
  type: 'PRODUCT' | 'CONTAINER' | 'LOCATION';
  product?: Product;
  container?: Container;
  location?: Location;
  inventory?: Inventory | Inventory[];
  contents?: any[];
}

export interface TransactionCreateRequest {
  transaction_type: 'IN' | 'OUT';
  warehouse_code: string;
  location_qr?: string;
  items: Array<{
    sku_code?: string;
    barcode?: string;
    quantity: number;
    unit_type?: 'EACH' | 'BOX' | 'PALLET';
  }>;
  reference_no?: string;
  notes?: string;
  created_by: string;
  device_id?: string;
}

export interface ContainerCreateRequest {
  container_type: 'BOX' | 'PALLET';
  warehouse_code: string;
  items: Array<{
    sku_code: string;
    quantity: number;
  }>;
  created_by: string;
  notes?: string;
}

export interface InventorySummary {
  sku_code: string;
  product_name: string;
  barcode: string;
  warehouse_code: string;
  location_code?: string;
  quantity_each: number;
  quantity_boxes: number;
  quantity_pallets: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// EXPRESS APP SETUP
// ============================================

const app = createApp();
const PORT = process.env.PORT || 3000;

// ============================================
// START SERVER
// ============================================

async function startServer() {
  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Start Express server
    app.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════╗');
      console.log('║   🚀 WMS Backend Server Started     ║');
      console.log('╚══════════════════════════════════════╝');
      console.log('');
      console.log(`📡 Server running on: http://localhost:${PORT}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📚 API Base: http://localhost:${PORT}/api`);
      console.log('');
      console.log('Press CTRL+C to stop');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();