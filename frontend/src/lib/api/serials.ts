import api from './client';
import type { ApiResponse } from '../../types';

export const serialApi = {
  generate: async (sku_code: string, quantity: number) => {
    const response = await api.post<ApiResponse>('/serials/generate', { sku_code, quantity });
    return response.data;
  },

  getBySku: async (sku_code: string, params?: { status?: string; limit?: number; offset?: number }) => {
    const response = await api.get<ApiResponse>(`/serials/sku/${sku_code}`, { params });
    return response.data;
  },

  lookupBarcode: async (barcode: string) => {
    const response = await api.get<ApiResponse>(`/serials/barcode/${barcode}`);
    return response.data;
  },

  updateStatus: async (barcode: string, data: { status: string; warehouse_id?: number; location_id?: number; transaction_id?: number }) => {
    const response = await api.put<ApiResponse>(`/serials/barcode/${barcode}`, data);
    return response.data;
  },

  getStats: async (sku_code: string) => {
    const response = await api.get<ApiResponse>(`/serials/stats/${sku_code}`);
    return response.data;
  },

  getHistory: async (barcode: string) => {
    const response = await api.get<ApiResponse>(`/serials/barcode/${barcode}/history`);
    return response.data;
  },
};
