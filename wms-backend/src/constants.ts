// ============================================
// APPLICATION CONSTANTS
// ============================================

// Pagination
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 1000;
export const DEFAULT_PAGE = 1;

// Rate Limiting
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX_REQUESTS = 100;

// Database (optimized for local PostgreSQL via Unix socket)
export const DB_CONNECTION_TIMEOUT_MS = 5000;  // 5 seconds (faster for local)
export const DB_IDLE_TIMEOUT_MS = 10000;       // 10 seconds (shorter idle for less memory)
export const DB_MAX_CONNECTIONS = 10;          // 10 connections (enough for single backend instance)

// Transaction types
export const TRANSACTION_TYPES = {
  IN: 'IN',
  OUT: 'OUT',
} as const;

// Unit types
export const UNIT_TYPES = {
  EACH: 'EACH',
  BOX: 'BOX',
  PALLET: 'PALLET',
} as const;

// Container types
export const CONTAINER_TYPES = {
  BOX: 'BOX',
  PALLET: 'PALLET',
} as const;

// Operation modes
export const OPERATION_MODES = {
  RECEIVING: 'RECEIVING',
  PICKING: 'PICKING',
  TRANSFER: 'TRANSFER',
  COUNT: 'COUNT',
} as const;

// Session statuses
export const SESSION_STATUSES = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

// Location types
export const LOCATION_TYPES = {
  FLOOR: 'FLOOR',
  RACK: 'RACK',
  PALLET: 'PALLET',
  BULK: 'BULK',
} as const;

// Location zones
export const LOCATION_ZONES = {
  RECEIVING: 'RECEIVING',
  STORAGE: 'STORAGE',
  PICKING: 'PICKING',
  SHIPPING: 'SHIPPING',
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Error codes - standardized across all endpoints
export const ERROR_CODES = {
  // Validation errors (4xx)
  VALIDATION_ERROR: 'ERR_VALIDATION',
  INVALID_REQUEST: 'ERR_INVALID_REQUEST',
  MISSING_FIELD: 'ERR_MISSING_FIELD',
  INVALID_FORMAT: 'ERR_INVALID_FORMAT',

  // Auth errors
  AUTH_REQUIRED: 'ERR_AUTH_REQUIRED',
  TOKEN_EXPIRED: 'ERR_TOKEN_EXPIRED',
  TOKEN_INVALID: 'ERR_TOKEN_INVALID',
  ACCESS_DENIED: 'ERR_ACCESS_DENIED',
  INVALID_CREDENTIALS: 'ERR_INVALID_CREDENTIALS',

  // Resource errors
  NOT_FOUND: 'ERR_NOT_FOUND',
  PRODUCT_NOT_FOUND: 'ERR_PRODUCT_NOT_FOUND',
  LOCATION_NOT_FOUND: 'ERR_LOCATION_NOT_FOUND',
  WAREHOUSE_NOT_FOUND: 'ERR_WAREHOUSE_NOT_FOUND',
  USER_NOT_FOUND: 'ERR_USER_NOT_FOUND',
  CONTAINER_NOT_FOUND: 'ERR_CONTAINER_NOT_FOUND',
  TRANSACTION_NOT_FOUND: 'ERR_TRANSACTION_NOT_FOUND',

  // Conflict errors
  DUPLICATE_ENTRY: 'ERR_DUPLICATE',
  DUPLICATE_SKU: 'ERR_DUPLICATE_SKU',
  DUPLICATE_BARCODE: 'ERR_DUPLICATE_BARCODE',
  DUPLICATE_USERNAME: 'ERR_DUPLICATE_USERNAME',
  DUPLICATE_EMAIL: 'ERR_DUPLICATE_EMAIL',

  // Business logic errors
  INSUFFICIENT_STOCK: 'ERR_INSUFFICIENT_STOCK',
  CONTAINER_CLOSED: 'ERR_CONTAINER_CLOSED',
  SESSION_EXPIRED: 'ERR_SESSION_EXPIRED',
  OPERATION_NOT_ALLOWED: 'ERR_OPERATION_NOT_ALLOWED',

  // Server errors (5xx)
  DATABASE_ERROR: 'ERR_DATABASE',
  NETWORK_ERROR: 'ERR_NETWORK',
  INTERNAL_ERROR: 'ERR_INTERNAL',
  SERVICE_UNAVAILABLE: 'ERR_SERVICE_UNAVAILABLE',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'ERR_RATE_LIMIT',
} as const;

// Success messages (Turkish)
export const SUCCESS_MESSAGES = {
  PRODUCT_CREATED: 'Ürün başarıyla oluşturuldu',
  PRODUCT_UPDATED: 'Ürün başarıyla güncellendi',
  PRODUCT_DELETED: 'Ürün başarıyla silindi',
  TRANSACTION_COMPLETED: 'İşlem başarıyla tamamlandı',
  LOCATION_CREATED: 'Lokasyon başarıyla oluşturuldu',
  CONTAINER_CREATED: 'Konteyner başarıyla oluşturuldu',
} as const;

// Error messages (Turkish)
export const ERROR_MESSAGES = {
  PRODUCT_NOT_FOUND: 'Ürün bulunamadı',
  LOCATION_NOT_FOUND: 'Lokasyon bulunamadı',
  WAREHOUSE_NOT_FOUND: 'Depo bulunamadı',
  USER_NOT_FOUND: 'Kullanıcı bulunamadı',
  NOT_FOUND: 'Kayıt bulunamadı',
  INSUFFICIENT_STOCK: 'Yetersiz stok',
  DUPLICATE_SKU: 'Bu SKU kodu zaten mevcut',
  DUPLICATE_BARCODE: 'Bu barkod zaten mevcut',
  INVALID_REQUEST: 'Geçersiz istek',
  INTERNAL_ERROR: 'Sunucu hatası oluştu',
  RATE_LIMIT_EXCEEDED: 'Çok fazla istek gönderildi. Lütfen bekleyin.',
} as const;
