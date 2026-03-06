// ============================================
// SHARED MODULE — Public API
// Tüm modüller buradan import eder, direkt servis dosyalarına değil.
// ============================================

export { productService } from './services/product.service';
export { warehouseService } from './services/warehouse.service';
export { userService } from './services/user.service';
export { eventBus } from './events/event-bus';
export type { WmsEvents } from './events/event-bus';
export type { Product, Warehouse, UserProfile, ApiResponse } from './types';
