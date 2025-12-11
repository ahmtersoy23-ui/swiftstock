// ============================================
// DATABASE TYPES
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
  location_code: string;
  description?: string;
  zone?: 'RECEIVING' | 'STORAGE' | 'PICKING' | 'SHIPPING' | 'CATEGORY';
  aisle?: string;
  bay?: string;
  level?: string;
  location_type?: 'FLOOR' | 'RACK' | 'PALLET' | 'BULK';
  capacity_units?: number;
  max_weight_kg?: number;
  is_active: boolean;
  notes?: string;
  created_at: Date;
  updated_at?: Date;
}

export interface Product {
  sku_code: string;
  product_name: string;
  description?: string;
  barcode: string;
  category?: string;
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
  location_id?: number;
  status: 'ACTIVE' | 'SHIPPED' | 'OPENED' | 'ARCHIVED';
  created_by: string;
  created_at: Date;
  opened_at?: Date;
  closed_at?: Date;
  notes?: string;
  // Extended fields from getAllContainers
  warehouse_code?: string;
  warehouse_name?: string;
  location_code?: string;
  location_qr?: string;
  current_items?: number;
  original_items?: number;
  calculated_status?: 'SEALED' | 'PARTIAL' | 'OPENED' | 'EMPTY';
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

export interface LocationInventory {
  location_inventory_id: number;
  location_id: number;
  sku_code: string;
  quantity_each: number;
  quantity_box: number;
  quantity_pallet: number;
  last_counted_at?: Date;
  last_moved_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface OperationMode {
  mode_id: number;
  mode_code: string;
  mode_type: 'RECEIVING' | 'PICKING' | 'TRANSFER' | 'COUNT';
  mode_name: string;
  description?: string;
  workflow_steps?: string[];
  is_active: boolean;
  created_at?: Date;
}

export interface ScanSession {
  session_id: number;
  session_code: string;
  warehouse_id: number;
  user_name: string;
  mode_type: 'RECEIVING' | 'PICKING' | 'TRANSFER' | 'COUNT';
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  started_at: Date;
  completed_at?: Date;
  notes?: string;
  created_at: Date;
}

export interface ScanOperation {
  operation_id: number;
  session_id: number;
  operation_type: 'SCAN_PRODUCT' | 'SCAN_LOCATION' | 'SCAN_MODE' | 'QUANTITY_INPUT';
  sku_code?: string;
  location_id?: number;
  from_location_id?: number;
  to_location_id?: number;
  quantity?: number;
  unit_type?: 'EACH' | 'BOX' | 'PALLET';
  scanned_at: Date;
  notes?: string;
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
  type: 'PRODUCT' | 'CONTAINER' | 'LOCATION' | 'OPERATION_MODE';
  product?: Product;
  container?: Container;
  location?: Location;
  operationMode?: OperationMode;
  inventory?: Inventory | Inventory[];
  contents?: any[];
  serial?: {
    serial_no: string;
    full_barcode: string;
    status: string;
  };
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
  location_qr?: string;
  items: Array<{
    sku_code: string;
    quantity: number;
  }>;
  created_by: string;
  notes?: string;
  parent_container_id?: number;
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
// VIRTUAL SHIPMENT TYPES (Sevkiyat)
// ============================================

export type ShipmentStatus = 'OPEN' | 'CLOSED' | 'SHIPPED' | 'CANCELLED';
export type BoxDestination = 'USA' | 'FBA';
export type BoxStatus = 'OPEN' | 'CLOSED' | 'SHIPPED';

export interface VirtualShipment {
  shipment_id: number;
  prefix: string;
  name: string;
  source_warehouse_id: number;
  source_warehouse_code?: string;
  source_warehouse_name?: string;
  default_destination: BoxDestination;
  status: ShipmentStatus;
  total_boxes: number;
  total_items: number;
  usa_boxes?: number;
  fba_boxes?: number;
  notes?: string;
  created_by: string;
  created_at: Date;
  closed_at?: Date;
  shipped_at?: Date;
  boxes?: ShipmentBox[];
}

export interface ShipmentBox {
  box_id: number;
  shipment_id: number;
  barcode: string;
  box_number: number;
  destination: BoxDestination;
  status: BoxStatus;
  total_items: number;
  total_quantity: number;
  weight_kg?: number;
  notes?: string;
  created_by: string;
  created_at: Date;
  closed_at?: Date;
  // Extended fields
  prefix?: string;
  shipment_name?: string;
  shipment_status?: ShipmentStatus;
  contents?: ShipmentBoxContent[];
}

export interface ShipmentBoxContent {
  content_id: number;
  box_id: number;
  sku_code: string;
  quantity: number;
  product_name?: string;
  product_barcode?: string;
  added_by: string;
  added_at: Date;
}

export interface CreateShipmentRequest {
  prefix: string;
  name: string;
  source_warehouse_id: number;
  default_destination?: BoxDestination;
  notes?: string;
  created_by: string;
}

export interface CreateBoxRequest {
  destination?: BoxDestination;
  notes?: string;
  created_by: string;
}

export interface AddItemToBoxRequest {
  sku_code: string;
  quantity: number;
  added_by: string;
}
