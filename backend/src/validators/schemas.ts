// ============================================
// ZOD VALIDATION SCHEMAS
// ============================================

import { z } from 'zod';

// ============================================
// AUTH SCHEMAS
// ============================================

export const loginSchema = z.object({
  username: z.string().min(1, 'Kullanıcı adı gerekli').max(50),
  password: z.string().min(1, 'Şifre gerekli'),
  device_uuid: z.string().optional(),
  device_name: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mevcut şifre gerekli'),
  newPassword: z.string().min(6, 'Yeni şifre en az 6 karakter olmalı').max(100),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token gerekli'),
});

// ============================================
// USER SCHEMAS
// ============================================

export const createUserSchema = z.object({
  username: z.string()
    .min(3, 'Kullanıcı adı en az 3 karakter olmalı')
    .max(50, 'Kullanıcı adı en fazla 50 karakter olmalı')
    .regex(/^[a-zA-Z0-9_]+$/, 'Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir'),
  email: z.string().email('Geçerli bir email adresi girin'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalı').max(100),
  full_name: z.string().max(100).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'], { message: 'Geçersiz rol' }),
  warehouse_code: z.string().max(20).optional(),
});

export const updateUserSchema = z.object({
  username: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/)
    .optional(),
  email: z.string().email().optional(),
  full_name: z.string().max(100).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER']).optional(),
  warehouse_code: z.string().max(20).nullable().optional(),
  is_active: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  new_password: z.string().min(6, 'Şifre en az 6 karakter olmalı').max(100),
});

// ============================================
// PRODUCT SCHEMAS
// ============================================

export const createProductSchema = z.object({
  sku_code: z.string()
    .min(1, 'SKU kodu gerekli')
    .max(50, 'SKU kodu en fazla 50 karakter olmalı'),
  name: z.string()
    .min(1, 'Ürün adı gerekli')
    .max(200, 'Ürün adı en fazla 200 karakter olmalı'),
  description: z.string().max(1000).optional(),
  barcode: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  brand: z.string().max(100).optional(),
  unit_of_measure: z.string().max(20).default('EACH'),
  weight_kg: z.number().positive().optional(),
  dimensions_cm: z.string().max(50).optional(),
  min_stock_level: z.number().int().nonnegative().default(0),
  max_stock_level: z.number().int().positive().optional(),
  reorder_point: z.number().int().nonnegative().optional(),
  cost_price: z.number().nonnegative().optional(),
  selling_price: z.number().nonnegative().optional(),
  is_serialized: z.boolean().default(false),
  requires_lot_tracking: z.boolean().default(false),
});

export const updateProductSchema = createProductSchema.partial().omit({ sku_code: true });

// ============================================
// TRANSACTION SCHEMAS
// ============================================

export const createTransactionSchema = z.object({
  transaction_type: z.enum(['RECEIVE', 'SHIP', 'ADJUST', 'TRANSFER', 'RETURN', 'COUNT'], { message: 'Geçersiz işlem tipi' }),
  sku_code: z.string().min(1, 'SKU kodu gerekli'),
  warehouse_code: z.string().min(1, 'Depo kodu gerekli'),
  location_id: z.number().int().positive().optional(),
  quantity: z.number().int().positive('Miktar pozitif olmalı'),
  unit_type: z.enum(['EACH', 'BOX', 'PALLET']).default('EACH'),
  reference_number: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  to_location_id: z.number().int().positive().optional(),
  to_warehouse_code: z.string().max(20).optional(),
});

// ============================================
// LOCATION SCHEMAS
// ============================================

export const createLocationSchema = z.object({
  warehouse_code: z.string().min(1, 'Depo kodu gerekli').max(20),
  location_code: z.string().min(1, 'Lokasyon kodu gerekli').max(50),
  qr_code: z.string().min(1, 'QR kod gerekli').max(100),
  description: z.string().max(200).optional(),
  zone: z.string().max(20).optional(),
  aisle: z.string().max(10).optional(),
  bay: z.string().max(10).optional(),
  level: z.string().max(10).optional(),
  location_type: z.enum(['SHELF', 'FLOOR', 'RACK', 'BIN', 'PALLET_LOCATION', 'DOCK', 'STAGING']).default('SHELF'),
  capacity_units: z.number().int().positive().optional(),
  max_weight_kg: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
});

export const updateLocationSchema = createLocationSchema.partial().omit({
  warehouse_code: true,
});

// ============================================
// CONTAINER SCHEMAS
// ============================================

export const createContainerSchema = z.object({
  container_type: z.enum(['BOX', 'PALLET'], { message: 'Geçersiz konteyner tipi' }),
  warehouse_code: z.string().min(1, 'Depo kodu gerekli').max(20),
  location_qr: z.string().max(100).optional(),
  items: z.array(z.object({
    sku_code: z.string().min(1),
    quantity: z.number().int().positive(),
  })).optional(),
  contents: z.array(z.object({
    sku_code: z.string().min(1),
    quantity: z.number().int().positive(),
  })).optional(),
  created_by: z.string().min(1, 'Oluşturan kullanıcı gerekli'),
  notes: z.string().max(500).optional(),
  parent_container_id: z.number().int().positive().optional(),
});

export const openContainerSchema = z.object({
  location_qr: z.string().max(100).optional(),
  created_by: z.string().min(1, 'Kullanıcı gerekli'),
});

// ============================================
// SCAN SCHEMAS
// ============================================

export const scanSchema = z.object({
  barcode: z.string().min(1, 'Barkod gerekli').max(200),
  scan_type: z.enum(['PRODUCT', 'LOCATION', 'CONTAINER', 'AUTO']).default('AUTO'),
  warehouse_code: z.string().max(20).optional(),
});

// ============================================
// SCAN SESSION SCHEMAS
// ============================================

export const createScanSessionSchema = z.object({
  warehouse_code: z.string().min(1, 'Depo kodu gerekli').max(20),
  user_name: z.string().min(1, 'Kullanıcı adı gerekli'),
  mode_type: z.enum(['RECEIVING', 'PICKING', 'TRANSFER', 'COUNT'], { message: 'Geçersiz mod tipi' }),
  notes: z.string().max(500).optional(),
});

export const addScanOperationSchema = z.object({
  session_id: z.number().int().positive('Oturum ID gerekli'),
  operation_type: z.enum(['SCAN_PRODUCT', 'SCAN_LOCATION', 'SCAN_MODE', 'QUANTITY_INPUT'], { message: 'Geçersiz işlem tipi' }),
  sku_code: z.string().max(50).optional(),
  location_id: z.number().int().positive().optional(),
  from_location_id: z.number().int().positive().optional(),
  to_location_id: z.number().int().positive().optional(),
  quantity: z.number().int().positive().optional(),
  unit_type: z.enum(['EACH', 'BOX', 'PALLET']).optional(),
  notes: z.string().max(500).optional(),
});

// ============================================
// SERIAL NUMBER SCHEMAS
// ============================================

export const generateSerialsSchema = z.object({
  sku_code: z.string().min(1, 'SKU kodu gerekli'),
  quantity: z.number().int().positive('Miktar pozitif olmalı').max(1000, 'Bir seferde en fazla 1000 seri numarası oluşturulabilir'),
});

export const updateSerialStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'RESERVED', 'SOLD', 'RETURNED', 'DAMAGED', 'IN_TRANSIT'], { message: 'Geçersiz durum' }),
  warehouse_id: z.number().int().positive().optional(),
  location_id: z.number().int().positive().optional(),
  transaction_id: z.number().int().positive().optional(),
});

// ============================================
// COMMON QUERY SCHEMAS
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Arama terimi gerekli').max(100),
  warehouse_code: z.string().max(20).optional(),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('Geçersiz ID'),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type CreateLocationInput = z.infer<typeof createLocationSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
export type CreateContainerInput = z.infer<typeof createContainerSchema>;
export type ScanInput = z.infer<typeof scanSchema>;
export type CreateScanSessionInput = z.infer<typeof createScanSessionSchema>;

// ============================================
// ORDER SCHEMAS
// ============================================

export const createOrderSchema = z.object({
  order_number: z.string().min(1, 'Sipariş numarası gerekli').max(100),
  marketplace: z.string().max(50).optional(),
  customer_name: z.string().max(200).optional(),
  warehouse_code: z.string().min(1, 'Depo kodu gerekli').max(20),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  notes: z.string().max(1000).optional(),
  items: z.array(z.object({
    product_sku: z.string().min(1, 'SKU gerekli'),
    quantity: z.number().int().positive('Miktar pozitif olmalı'),
  })).min(1, 'En az bir ürün gerekli'),
});

export const assignPickerSchema = z.object({
  user_id: z.number().int().positive('Kullanıcı ID gerekli'),
});

export const recordPickSchema = z.object({
  product_sku: z.string().min(1, 'SKU gerekli'),
  quantity_picked: z.number().int().positive('Toplanan miktar pozitif olmalı'),
  location_id: z.number().int().positive().optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ============================================
// CYCLE COUNT SCHEMAS
// ============================================

export const createCycleCountSchema = z.object({
  warehouse_code: z.string().min(1, 'Depo kodu gerekli').max(20),
  count_type: z.enum(['FULL', 'PARTIAL', 'SPOT']).default('PARTIAL'),
  location_ids: z.array(z.number().int().positive()).min(1, 'En az bir lokasyon gerekli').optional(),
  product_skus: z.array(z.string()).optional(),
  notes: z.string().max(500).optional(),
});

export const recordCountSchema = z.object({
  counted_quantity: z.number().int().min(0, 'Sayım miktarı negatif olamaz'),
  notes: z.string().max(500).optional(),
});

// ============================================
// RMA SCHEMAS
// ============================================

export const createRMASchema = z.object({
  order_number: z.string().min(1, 'Sipariş numarası gerekli').max(100),
  customer_name: z.string().max(200).optional(),
  reason: z.string().min(1, 'İade nedeni gerekli').max(500),
  warehouse_code: z.string().min(1, 'Depo kodu gerekli').max(20),
  notes: z.string().max(1000).optional(),
  items: z.array(z.object({
    product_sku: z.string().min(1, 'SKU gerekli'),
    quantity: z.number().int().positive('Miktar pozitif olmalı'),
    reason: z.string().max(200).optional(),
  })).min(1, 'En az bir ürün gerekli'),
});

export const approveRMASchema = z.object({
  approved: z.boolean(),
  notes: z.string().max(500).optional(),
});

export const receiveReturnSchema = z.object({
  quantity_received: z.number().int().positive('Alınan miktar pozitif olmalı'),
  condition: z.enum(['GOOD', 'DAMAGED', 'DEFECTIVE']).default('GOOD'),
  location_id: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

// ============================================
// SHIPMENT SCHEMAS
// ============================================

export const createShipmentSchema = z.object({
  order_id: z.number().int().positive('Sipariş ID gerekli').optional(),
  warehouse_code: z.string().min(1, 'Depo kodu gerekli').max(20),
  carrier: z.string().max(100).optional(),
  tracking_number: z.string().max(100).optional(),
  destination_country: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
});

export const createBoxSchema = z.object({
  box_number: z.string().min(1, 'Kutu numarası gerekli').max(50),
  weight_kg: z.number().positive().optional(),
  dimensions_cm: z.string().max(50).optional(),
});

export const addItemToBoxSchema = z.object({
  product_sku: z.string().min(1, 'SKU gerekli'),
  quantity: z.number().int().positive('Miktar pozitif olmalı'),
});

export const updateBoxDestinationSchema = z.object({
  destination_country: z.string().min(1, 'Hedef ülke gerekli').max(50),
  destination_address: z.string().max(500).optional(),
});

export const shipShipmentSchema = z.object({
  carrier: z.string().min(1, 'Kargo firması gerekli').max(100),
  tracking_number: z.string().min(1, 'Takip numarası gerekli').max(100),
  shipped_date: z.string().optional(),
});

// ============================================
// REPORT SCHEMAS
// ============================================

export const saveCountReportSchema = z.object({
  report_type: z.enum(['CYCLE_COUNT', 'INVENTORY', 'DISCREPANCY']),
  warehouse_code: z.string().min(1, 'Depo kodu gerekli').max(20),
  data: z.record(z.string(), z.unknown()),
  notes: z.string().max(1000).optional(),
});

// ============================================
// PARAM SCHEMAS
// ============================================

export const orderIdParamSchema = z.object({
  order_id: z.coerce.number().int().positive('Geçersiz sipariş ID'),
});

export const transactionIdParamSchema = z.object({
  transaction_id: z.coerce.number().int().positive('Geçersiz işlem ID'),
});

export const sessionIdParamSchema = z.object({
  session_id: z.coerce.number().int().positive('Geçersiz oturum ID'),
});

export const itemIdParamSchema = z.object({
  item_id: z.coerce.number().int().positive('Geçersiz öğe ID'),
});

export const rmaIdParamSchema = z.object({
  rma_id: z.coerce.number().int().positive('Geçersiz RMA ID'),
});

export const shipmentIdParamSchema = z.object({
  shipment_id: z.coerce.number().int().positive('Geçersiz sevkiyat ID'),
});

export const boxIdParamSchema = z.object({
  box_id: z.coerce.number().int().positive('Geçersiz kutu ID'),
});

export const barcodeParamSchema = z.object({
  barcode: z.string().min(1, 'Barkod gerekli').max(200),
});
