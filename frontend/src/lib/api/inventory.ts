import api from './client';
import type { ApiResponse, InventorySummary } from '../../types';

export const inventoryApi = {
  getSummary: async (warehouse_code?: string) => {
    const response = await api.get<ApiResponse<InventorySummary[]>>('/inventory', {
      params: { warehouse_code },
    });
    return response.data;
  },

  getBySku: async (sku_code: string, warehouse_code?: string) => {
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

  search: async (query: string, warehouse_code?: string) => {
    const response = await api.get<ApiResponse>('/inventory/search', {
      params: { q: query, warehouse_code },
    });
    return response.data;
  },

  getByLocation: async (warehouse_code: string, location_qr: string) => {
    const response = await api.get<ApiResponse>('/inventory/by-location', {
      params: { warehouse_code, location_qr },
    });
    return response.data;
  },
};
