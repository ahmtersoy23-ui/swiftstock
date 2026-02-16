import api from './client';
import type { ApiResponse } from '../../types';

export const containerApi = {
  create: async (data: {
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

  getByBarcode: async (barcode: string) => {
    const response = await api.get<ApiResponse>(`/containers/${barcode}`);
    return response.data;
  },

  open: async (barcode: string, data: { location_qr?: string; created_by: string }) => {
    const response = await api.post<ApiResponse>(`/containers/${barcode}/open`, data);
    return response.data;
  },

  getAll: async (filters?: {
    warehouse_code?: string;
    status?: string;
    type?: string;
    search?: string;
  }) => {
    const response = await api.get<ApiResponse>('/containers', { params: filters });
    return response.data;
  },
};
