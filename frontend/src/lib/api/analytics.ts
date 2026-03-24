import api from './client';
import type { ApiResponse } from '../../types';

export const analyticsApi = {
  getUnifiedStock: async (params?: { search?: string; category?: string; page?: number; limit?: number }) => {
    const response = await api.get<ApiResponse>('/analytics/unified-stock', { params });
    return response.data;
  },

  getDeadStock: async (params?: { days?: number; warehouse_code?: string; limit?: number }) => {
    const response = await api.get<ApiResponse>('/analytics/dead-stock', { params });
    return response.data;
  },

  getTurnover: async (params?: { days?: number; warehouse_code?: string; limit?: number }) => {
    const response = await api.get<ApiResponse>('/analytics/turnover', { params });
    return response.data;
  },

  getPerformance: async (params?: { days?: number; warehouse_code?: string }) => {
    const response = await api.get<ApiResponse>('/analytics/performance', { params });
    return response.data;
  },

  getSlotting: async (warehouseCode: string, days?: number) => {
    const response = await api.get<ApiResponse>('/analytics/slotting', {
      params: { warehouse_code: warehouseCode, days },
    });
    return response.data;
  },

  getReplenishment: async (warehouseCode: string, minThreshold?: number) => {
    const response = await api.get<ApiResponse>('/analytics/replenishment', {
      params: { warehouse_code: warehouseCode, min_threshold: minThreshold },
    });
    return response.data;
  },

  getMarketplaceStock: async (params?: { source?: string; product_sku?: string }) => {
    const response = await api.get<ApiResponse>('/analytics/marketplace-stock', { params });
    return response.data;
  },

  pushMarketplaceStock: async (source: string, items: Array<{
    product_sku: string;
    depot_name: string;
    quantity: number;
    reserved?: number;
    inbound?: number;
  }>) => {
    const response = await api.post<ApiResponse>('/analytics/marketplace-stock', { source, items });
    return response.data;
  },
};
