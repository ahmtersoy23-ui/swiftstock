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
