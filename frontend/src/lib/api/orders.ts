import api from './client';
import type { ApiResponse } from '../../types';

export interface OrderFilters {
  status?: string;
  priority?: string;
  warehouse_code?: string;
  assigned_picker_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const orderApi = {
  getAll: async (filters?: OrderFilters) => {
    const response = await api.get<ApiResponse>('/orders', { params: filters });
    return response.data;
  },

  getById: async (orderId: number) => {
    const response = await api.get<ApiResponse>(`/orders/${orderId}`);
    return response.data;
  },

  create: async (data: {
    order_number: string;
    warehouse_code: string;
    customer_name: string;
    customer_address?: string;
    customer_email?: string;
    customer_phone?: string;
    requested_ship_date?: string;
    priority?: string;
    items: Array<{ product_sku: string; quantity: number }>;
    notes?: string;
  }) => {
    const response = await api.post<ApiResponse>('/orders', data);
    return response.data;
  },

  assignPicker: async (orderId: number, pickerId: number) => {
    const response = await api.post<ApiResponse>(`/orders/${orderId}/assign-picker`, {
      picker_id: pickerId,
    });
    return response.data;
  },

  startPicking: async (orderId: number) => {
    const response = await api.post<ApiResponse>(`/orders/${orderId}/start-picking`);
    return response.data;
  },

  recordPick: async (orderId: number, data: {
    item_id: number;
    product_sku: string;
    location_id?: number;
    quantity_picked: number;
  }) => {
    const response = await api.post<ApiResponse>(`/orders/${orderId}/record-pick`, data);
    return response.data;
  },

  completePicking: async (orderId: number) => {
    const response = await api.post<ApiResponse>(`/orders/${orderId}/complete-picking`);
    return response.data;
  },

  cancel: async (orderId: number, reason?: string) => {
    const response = await api.post<ApiResponse>(`/orders/${orderId}/cancel`, { reason });
    return response.data;
  },

  getPickerPerformance: async (pickerId: number, startDate?: string, endDate?: string) => {
    const response = await api.get<ApiResponse>(`/orders/picker/${pickerId}/performance`, {
      params: { start_date: startDate, end_date: endDate },
    });
    return response.data;
  },
};
