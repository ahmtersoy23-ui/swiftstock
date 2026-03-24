import api from './client';
import type { ApiResponse } from '../../types';

export interface RMAFilters {
  warehouse_id?: number;
  status?: string;
  limit?: number;
  offset?: number;
}

export const rmaApi = {
  getAll: async (filters?: RMAFilters) => {
    const response = await api.get<ApiResponse>('/rma', { params: filters });
    return response.data;
  },

  getById: async (rmaId: number) => {
    const response = await api.get<ApiResponse>(`/rma/${rmaId}`);
    return response.data;
  },

  create: async (data: {
    warehouse_id: number;
    customer_name?: string;
    customer_email?: string;
    order_number?: string;
    reason: string;
    priority?: string;
    notes?: string;
    items: Array<{
      product_sku: string;
      quantity_requested: number;
      unit_price?: number;
      action: string;
    }>;
  }) => {
    const response = await api.post<ApiResponse>('/rma', data);
    return response.data;
  },

  approve: async (rmaId: number, notes?: string) => {
    const response = await api.post<ApiResponse>(`/rma/${rmaId}/approve`, { notes });
    return response.data;
  },

  receiveItem: async (itemId: number, data: {
    quantity_received: number;
    condition: string;
    location_id?: number;
    notes?: string;
  }) => {
    const response = await api.post<ApiResponse>(`/rma/items/${itemId}/receive`, data);
    return response.data;
  },

  complete: async (rmaId: number) => {
    const response = await api.post<ApiResponse>(`/rma/${rmaId}/complete`);
    return response.data;
  },
};
