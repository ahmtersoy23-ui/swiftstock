import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Capacitor } from '@capacitor/core';
import type {
  ApiResponse,
  ScanRequest,
  ScanResponse,
  TransactionCreateRequest,
  Transaction,
  Product,
  InventorySummary,
} from '../types';

// API Base URL - Capacitor (Android/iOS) ise gerçek URL, browser ise proxy
const isNative = Capacitor.isNativePlatform();
const API_BASE_URL = isNative
  ? (import.meta.env.VITE_NATIVE_API_URL || '/api')
  : (import.meta.env.VITE_API_URL || '/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Token refresh state
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Helper to get auth state from localStorage
const getAuthState = () => {
  const authStorage = localStorage.getItem('wms-auth-storage');
  if (authStorage) {
    try {
      const { state } = JSON.parse(authStorage);
      return state;
    } catch {
      return null;
    }
  }
  return null;
};

// Helper to update access token in localStorage
const updateAccessToken = (newAccessToken: string) => {
  const authStorage = localStorage.getItem('wms-auth-storage');
  if (authStorage) {
    try {
      const data = JSON.parse(authStorage);
      data.state.accessToken = newAccessToken;
      localStorage.setItem('wms-auth-storage', JSON.stringify(data));
    } catch {
      // Ignore errors
    }
  }
};

// Helper to clear auth and redirect to login
const clearAuthAndRedirect = () => {
  localStorage.removeItem('wms-auth-storage');
  window.location.href = '/login';
};

// Request interceptor - Add auth token if available
api.interceptors.request.use(
  (config) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }

    const state = getAuthState();
    if (state?.accessToken) {
      config.headers.Authorization = `Bearer ${state.accessToken}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - enhanced error handling with auto token refresh
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Network error (no response)
    if (!error.response) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Network Error:', error.message);
      }
      const networkError = {
        success: false,
        error: 'Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.',
        code: 'NETWORK_ERROR',
        originalError: error.message,
      };
      return Promise.reject(networkError);
    }

    const { status, data } = error.response as { status: number; data: { error?: string; code?: string } };

    // Handle 401 - Token expired, try to refresh
    if (status === 401 && !originalRequest._retry) {
      // Skip refresh for auth endpoints
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Wait for the refresh to complete
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const state = getAuthState();
      if (!state?.refreshToken) {
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken: state.refreshToken,
        });

        if (response.data.success && response.data.data?.accessToken) {
          const newAccessToken = response.data.data.accessToken;
          updateAccessToken(newAccessToken);
          processQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } else {
          processQueue(error, null);
          clearAuthAndRedirect();
          return Promise.reject(error);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (process.env.NODE_ENV === 'development') {
      console.error(`API Error [${status}]:`, data?.error || error.message);
    }

    // Create user-friendly error messages
    let userMessage = data?.error || 'Bir hata oluştu';

    switch (status) {
      case 400:
        userMessage = data?.error || 'Geçersiz istek';
        break;
      case 401:
        userMessage = 'Yetkiniz yok. Lütfen giriş yapın.';
        break;
      case 403:
        userMessage = 'Bu işlem için yetkiniz bulunmuyor.';
        break;
      case 404:
        userMessage = data?.error || 'Kayıt bulunamadı';
        break;
      case 409:
        userMessage = data?.error || 'Bu kayıt zaten mevcut';
        break;
      case 429:
        userMessage = 'Çok fazla istek gönderildi. Lütfen bekleyin.';
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        userMessage = 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
        break;
    }

    const enhancedError = {
      success: false,
      error: userMessage,
      code: data?.code || `HTTP_${status}`,
      status,
      originalError: data,
    };

    return Promise.reject(enhancedError);
  }
);

// ============================================
// API FUNCTIONS
// ============================================

export const apiClient = {
  // Health Check
  health: async () => {
    const response = await api.get<ApiResponse>('/health');
    return response.data;
  },

  // Auth endpoints
  login: async (data: { username: string; password: string; device_uuid?: string; device_name?: string }) => {
    const response = await api.post<ApiResponse>('/auth/login', data);
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

  // Scan barcode/QR
  scan: async (data: ScanRequest) => {
    const response = await api.post<ApiResponse<ScanResponse>>('/scan', data);
    return response.data;
  },

  // Lookup by SKU
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

  // Containers (Koli/Palet)
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
    // Support both 'items' and 'contents' field names
    const payload = {
      ...data,
      items: data.items || data.contents,
    };
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

  getAllContainers: async (filters?: {
    warehouse_code?: string;
    status?: string;
    type?: string;
  }) => {
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

export default api;
