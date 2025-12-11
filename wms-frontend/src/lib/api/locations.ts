import api from './client';
import type { ApiResponse } from '../../types';

export const locationApi = {
  getAll: async (warehouse_code?: string, zone?: string) => {
    const response = await api.get<ApiResponse>('/locations', {
      params: { warehouse_code, zone },
    });
    return response.data;
  },

  getById: async (location_id: number) => {
    const response = await api.get<ApiResponse>(`/locations/${location_id}`);
    return response.data;
  },

  getByCode: async (location_code: string) => {
    const response = await api.get<ApiResponse>(`/locations/code/${location_code}`);
    return response.data;
  },

  create: async (data: {
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

  update: async (location_id: number, data: Partial<{
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

  delete: async (location_id: number) => {
    const response = await api.delete<ApiResponse>(`/locations/${location_id}`);
    return response.data;
  },

  getInventory: async (location_id: number) => {
    const response = await api.get<ApiResponse>(`/locations/${location_id}/inventory`);
    return response.data;
  },
};

export const warehouseApi = {
  getAll: async () => {
    const response = await api.get<ApiResponse>('/warehouses');
    return response.data;
  },

  getById: async (warehouse_id: number) => {
    const response = await api.get<ApiResponse>(`/warehouses/${warehouse_id}`);
    return response.data;
  },

  getByCode: async (warehouse_code: string) => {
    const response = await api.get<ApiResponse>(`/warehouses/code/${warehouse_code}`);
    return response.data;
  },
};

export const operationModeApi = {
  getAll: async () => {
    const response = await api.get<ApiResponse>('/operation-modes');
    return response.data;
  },

  getByCode: async (mode_code: string) => {
    const response = await api.get<ApiResponse>(`/operation-modes/${mode_code}`);
    return response.data;
  },
};
