// API Modules - Clean, modular API organization
export { default as api } from './client';
export { API_BASE_URL } from './client';

// Individual API modules
export { authApi } from './auth';
export { productApi } from './products';
export { inventoryApi } from './inventory';
export { transactionApi } from './transactions';
export { locationApi, warehouseApi, operationModeApi } from './locations';
export { containerApi } from './containers';
export { scanApi } from './scan';
export { serialApi } from './serials';
export { userApi } from './users';
export { reportApi } from './reports';
export { shipmentApi } from './shipments';

// ============================================
// BACKWARD COMPATIBILITY - apiClient
// ============================================
// Bu obje eski kodlarla uyumluluk için korunuyor.
// Yeni kod yazarken yukarıdaki modüler API'leri tercih edin.
// ============================================

import api from './client';
import type {
  ApiResponse,
  ScanRequest,
  ScanResponse,
  TransactionCreateRequest,
  Transaction,
  Product,
  InventorySummary,
} from '../../types';

export const apiClient = {
  // Health Check
  health: async () => {
    const response = await api.get<ApiResponse>('/health');
    return response.data;
  },

  // Auth endpoints (use authApi for new code)
  login: async (data: { username: string; password: string; device_uuid?: string; device_name?: string }) => {
    const response = await api.post<ApiResponse>('/auth/login', data);
    return response.data;
  },
  googleLogin: async (data: { credential: string; device_uuid?: string; device_name?: string }) => {
    const response = await api.post<ApiResponse>('/auth/google', data);
    return response.data;
  },
  logout: async (refreshToken?: string) => {
    const response = await api.post<ApiResponse>('/auth/logout', { refreshToken });
    return response.data;
  },
  refreshToken: async (refreshToken: string) => {
    const response = await api.post<ApiResponse>('/auth/refresh', { refreshToken });
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get<ApiResponse>('/auth/profile');
    return response.data;
  },
  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const response = await api.post<ApiResponse>('/auth/change-password', data);
    return response.data;
  },

  // Scan
  scan: async (data: ScanRequest) => {
    const response = await api.post<ApiResponse<ScanResponse>>('/scan', data);
    return response.data;
  },
  lookupBySku: async (sku_code: string, warehouse_code: string) => {
    const response = await api.get<ApiResponse>('/lookup', {
      params: { sku_code, warehouse_code },
    });
    return response.data;
  },

  // Transactions
  createTransaction: async (data: TransactionCreateRequest) => {
    const response = await api.post<ApiResponse<Transaction>>('/transactions', data);
    return response.data;
  },
  getRecentTransactions: async (limit = 20) => {
    const response = await api.get<ApiResponse<Transaction[]>>('/transactions', {
      params: { limit },
    });
    return response.data;
  },
  getTransactionDetails: async (transaction_id: number) => {
    const response = await api.get<ApiResponse>(`/transactions/${transaction_id}`);
    return response.data;
  },
  undoTransaction: async (transaction_id: number) => {
    const response = await api.post<ApiResponse>(`/transactions/${transaction_id}/undo`);
    return response.data;
  },

  // Inventory
  getInventorySummary: async (warehouse_code?: string) => {
    const response = await api.get<ApiResponse<InventorySummary[]>>('/inventory', {
      params: { warehouse_code },
    });
    return response.data;
  },
  getInventoryBySku: async (sku_code: string, warehouse_code?: string) => {
    const response = await api.get<ApiResponse>(`/inventory/sku/${sku_code}`, {
      params: { warehouse_code },
    });
    return response.data;
  },
  getLowStock: async (threshold = 10, warehouse_code?: string) => {
    const response = await api.get<ApiResponse>('/inventory/low-stock', {
      params: { threshold, warehouse_code },
    });
    return response.data;
  },
  searchInventory: async (query: string, warehouse_code?: string) => {
    const response = await api.get<ApiResponse>('/inventory/search', {
      params: { q: query, warehouse_code },
    });
    return response.data;
  },

  // Products
  getAllProducts: async () => {
    const response = await api.get<ApiResponse<Product[]>>('/products');
    return response.data;
  },
  getProductBySku: async (sku_code: string) => {
    const response = await api.get<ApiResponse<Product>>(`/products/${sku_code}`);
    return response.data;
  },
  createProduct: async (data: Partial<Product>) => {
    const response = await api.post<ApiResponse<Product>>('/products', data);
    return response.data;
  },
  updateProduct: async (sku_code: string, data: Partial<Product>) => {
    const response = await api.put<ApiResponse<Product>>(`/products/${sku_code}`, data);
    return response.data;
  },
  deleteProduct: async (sku_code: string) => {
    const response = await api.delete<ApiResponse>(`/products/${sku_code}`);
    return response.data;
  },
  searchProducts: async (query: string) => {
    const response = await api.get<ApiResponse<Product[]>>('/products/search', {
      params: { q: query },
    });
    return response.data;
  },

  // Containers
  createContainer: async (data: {
    container_type: 'BOX' | 'PALLET';
    warehouse_code: string;
    location_qr?: string;
    items?: Array<{ sku_code: string; quantity: number }>;
    contents?: Array<{ sku_code: string; quantity: number }>;
    created_by: string;
    notes?: string;
    parent_container_id?: number;
  }) => {
    const payload = { ...data, items: data.items || data.contents };
    const response = await api.post<ApiResponse>('/containers', payload);
    return response.data;
  },
  getContainerByBarcode: async (barcode: string) => {
    const response = await api.get<ApiResponse>(`/containers/${barcode}`);
    return response.data;
  },
  openContainer: async (barcode: string, data: { location_qr?: string; created_by: string }) => {
    const response = await api.post<ApiResponse>(`/containers/${barcode}/open`, data);
    return response.data;
  },
  getAllContainers: async (filters?: { warehouse_code?: string; status?: string; type?: string; search?: string }) => {
    const response = await api.get<ApiResponse>('/containers', { params: filters });
    return response.data;
  },

  // Warehouses
  getAllWarehouses: async () => {
    const response = await api.get<ApiResponse>('/warehouses');
    return response.data;
  },
  getWarehouseById: async (warehouse_id: number) => {
    const response = await api.get<ApiResponse>(`/warehouses/${warehouse_id}`);
    return response.data;
  },
  getWarehouseByCode: async (warehouse_code: string) => {
    const response = await api.get<ApiResponse>(`/warehouses/code/${warehouse_code}`);
    return response.data;
  },

  // Locations
  getAllLocations: async (warehouse_code?: string, zone?: string) => {
    const response = await api.get<ApiResponse>('/locations', {
      params: { warehouse_code, zone },
    });
    return response.data;
  },
  getLocationById: async (location_id: number) => {
    const response = await api.get<ApiResponse>(`/locations/${location_id}`);
    return response.data;
  },
  getLocationByCode: async (location_code: string) => {
    const response = await api.get<ApiResponse>(`/locations/code/${location_code}`);
    return response.data;
  },
  createLocation: async (data: {
    warehouse_code: string;
    location_code: string;
    qr_code: string;
    description?: string;
    zone?: string;
    aisle?: string;
    bay?: string;
    level?: string;
    location_type?: string;
    capacity_units?: number;
    max_weight_kg?: number;
    notes?: string;
  }) => {
    const response = await api.post<ApiResponse>('/locations', data);
    return response.data;
  },
  updateLocation: async (location_id: number, data: Partial<{
    location_code: string;
    qr_code: string;
    description: string;
    zone: string;
    aisle: string;
    bay: string;
    level: string;
    location_type: string;
    capacity_units: number;
    max_weight_kg: number;
    is_active: boolean;
    notes: string;
  }>) => {
    const response = await api.put<ApiResponse>(`/locations/${location_id}`, data);
    return response.data;
  },
  deleteLocation: async (location_id: number) => {
    const response = await api.delete<ApiResponse>(`/locations/${location_id}`);
    return response.data;
  },
  getLocationInventory: async (location_id: number) => {
    const response = await api.get<ApiResponse>(`/locations/${location_id}/inventory`);
    return response.data;
  },

  // Operation Modes
  getAllOperationModes: async () => {
    const response = await api.get<ApiResponse>('/operation-modes');
    return response.data;
  },
  getOperationModeByCode: async (mode_code: string) => {
    const response = await api.get<ApiResponse>(`/operation-modes/${mode_code}`);
    return response.data;
  },

  // Scan Sessions
  createScanSession: async (data: {
    warehouse_code: string;
    user_name: string;
    mode_type: 'RECEIVING' | 'PICKING' | 'TRANSFER' | 'COUNT';
    notes?: string;
  }) => {
    const response = await api.post<ApiResponse>('/scan-sessions', data);
    return response.data;
  },
  getScanSession: async (session_id: number) => {
    const response = await api.get<ApiResponse>(`/scan-sessions/${session_id}`);
    return response.data;
  },
  getActiveScanSession: async (user_name: string) => {
    const response = await api.get<ApiResponse>('/scan-sessions/active', {
      params: { user_name },
    });
    return response.data;
  },
  completeScanSession: async (session_id: number, notes?: string) => {
    const response = await api.post<ApiResponse>(`/scan-sessions/${session_id}/complete`, { notes });
    return response.data;
  },
  cancelScanSession: async (session_id: number, notes?: string) => {
    const response = await api.post<ApiResponse>(`/scan-sessions/${session_id}/cancel`, { notes });
    return response.data;
  },

  // Scan Operations
  addScanOperation: async (data: {
    session_id: number;
    operation_type: 'SCAN_PRODUCT' | 'SCAN_LOCATION' | 'SCAN_MODE' | 'QUANTITY_INPUT';
    sku_code?: string;
    location_id?: number;
    from_location_id?: number;
    to_location_id?: number;
    quantity?: number;
    unit_type?: 'EACH' | 'BOX' | 'PALLET';
    notes?: string;
  }) => {
    const response = await api.post<ApiResponse>('/scan-operations', data);
    return response.data;
  },
  getSessionOperations: async (session_id: number) => {
    const response = await api.get<ApiResponse>(`/scan-sessions/${session_id}/operations`);
    return response.data;
  },

  // Serial Numbers
  generateSerialNumbers: async (sku_code: string, quantity: number) => {
    const response = await api.post<ApiResponse>('/serials/generate', { sku_code, quantity });
    return response.data;
  },
  getSerialNumbers: async (sku_code: string, params?: { status?: string; limit?: number; offset?: number }) => {
    const response = await api.get<ApiResponse>(`/serials/sku/${sku_code}`, { params });
    return response.data;
  },
  lookupSerialBarcode: async (barcode: string) => {
    const response = await api.get<ApiResponse>(`/serials/barcode/${barcode}`);
    return response.data;
  },
  updateSerialStatus: async (barcode: string, data: { status: string; warehouse_id?: number; location_id?: number; transaction_id?: number }) => {
    const response = await api.put<ApiResponse>(`/serials/barcode/${barcode}`, data);
    return response.data;
  },
  getSerialStats: async (sku_code: string) => {
    const response = await api.get<ApiResponse>(`/serials/stats/${sku_code}`);
    return response.data;
  },
  getSerialHistory: async (barcode: string) => {
    const response = await api.get<ApiResponse>(`/serials/barcode/${barcode}/history`);
    return response.data;
  },

  // Cycle Count / Location Inventory
  getInventoryByLocation: async (warehouse_code: string, location_qr: string) => {
    const response = await api.get<ApiResponse>('/inventory/by-location', {
      params: { warehouse_code, location_qr },
    });
    return response.data;
  },

  // User Management (Admin)
  getAllUsers: async () => {
    const response = await api.get<ApiResponse>('/users');
    return response.data;
  },
  getUserById: async (user_id: number) => {
    const response = await api.get<ApiResponse>(`/users/${user_id}`);
    return response.data;
  },
  createUser: async (data: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
    role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
    warehouse_code?: string;
  }) => {
    const response = await api.post<ApiResponse>('/users', data);
    return response.data;
  },
  updateUser: async (user_id: number, data: {
    username?: string;
    email?: string;
    full_name?: string;
    role?: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
    warehouse_code?: string;
    is_active?: boolean;
  }) => {
    const response = await api.put<ApiResponse>(`/users/${user_id}`, data);
    return response.data;
  },
  deleteUser: async (user_id: number) => {
    const response = await api.delete<ApiResponse>(`/users/${user_id}`);
    return response.data;
  },
  resetUserPassword: async (user_id: number, new_password: string) => {
    const response = await api.post<ApiResponse>(`/users/${user_id}/reset-password`, { new_password });
    return response.data;
  },
};

// Default export for backward compatibility
export default api;
