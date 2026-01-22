// ============================================
// TYPE DEFINITIONS - Updated for pricelab_db
// ============================================

// ============================================
// SHARED TYPES (from pricelab_db)
// ============================================

/**
 * Product - READ-ONLY from pricelab products table
 * SwiftStock cannot modify this table
 */
export interface Product {
  id: number;
  product_sku: string;
  name: string;
  description?: string;
  image?: string;
  category_id?: number;
  created_at: Date;
  updated_at?: Date;
}

// ============================================
// WMS-SPECIFIC TYPES (wms_* tables)
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
  product_sku: string;  // References products(product_sku)
  quantity: number;
  added_at: Date;
}

export interface Inventory {
  inventory_id: number;
  warehouse_id: number;
  product_sku: string;  // References products(product_sku)
  location_id?: number;
  quantity: number;
  container_id?: number;
  last_counted_at?: Date;
  last_updated_at: Date;
}

export interface StockMovement {
  movement_id: number;
  warehouse_id: number;
  product_sku: string;  // References products(product_sku)
  movement_type: 'IN' | 'OUT' | 'MOVE' | 'COUNT' | 'ADJUST';
  quantity: number;
  from_location_id?: number;
  to_location_id?: number;
  container_id?: number;
  reference_number?: string;
  notes?: string;
  created_by: string;
  created_at: Date;
}

export interface User {
  user_id: number;
  username: string;
  password_hash: string;
  full_name?: string;
  email?: string;
  role: 'admin' | 'manager' | 'user';
  warehouse_id?: number;
  is_active: boolean;
  last_login?: Date;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// LEGACY TYPES (for backward compatibility)
// Keep these during transition period
// ============================================

/**
 * @deprecated Use StockMovement instead
 * Transaction type kept for backward compatibility
 */
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

/**
 * @deprecated Use StockMovement with product_sku instead
 * TransactionItem type kept for backward compatibility
 */
export interface TransactionItem {
  item_id: number;
  transaction_id: number;
  product_sku: string;  // Changed from sku_code
  quantity: number;
  unit_type: 'EACH' | 'BOX' | 'PALLET';
  quantity_each: number;
  from_location_id?: number;
  to_location_id?: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LoginResponse {
  success: boolean;
  user?: {
    user_id: number;
    username: string;
    full_name?: string;
    role: string;
    warehouse_id?: number;
  };
  token?: string;
  refreshToken?: string;
  error?: string;
}

// ============================================
// REQUEST TYPES
// ============================================

export interface ScanRequest {
  barcode: string;
  mode?: 'IN' | 'OUT' | 'COUNT' | 'TRANSFER';
  warehouse_code?: string;
  location_qr?: string;
}

export interface CreateContainerRequest {
  container_type: 'BOX' | 'PALLET';
  warehouse_id: number;
  parent_container_id?: number;
}

export interface AddToContainerRequest {
  container_id: number;
  product_sku: string;
  quantity: number;
}

export interface ScanResponse {
  success: boolean;
  type: 'PRODUCT' | 'LOCATION' | 'CONTAINER' | 'MODE';
  data?: any;
  message?: string;
}

export interface TransactionCreateRequest {
  transaction_type: 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER';
  warehouse_id: number;
  location_id?: number;
  items: {
    product_sku: string;
    quantity: number;
  }[];
}

// ============================================
// QUERY FILTER TYPES
// ============================================

export interface InventoryFilters {
  warehouse_id?: number;
  product_sku?: string;
  location_id?: number;
  min_quantity?: number;
}

export interface MovementFilters {
  warehouse_id?: number;
  product_sku?: string;
  movement_type?: string;
  start_date?: string;
  end_date?: string;
}
