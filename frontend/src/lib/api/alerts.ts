import api from './client';
import type { ApiResponse } from '../../types';

export const alertApi = {
  getAll: async (unreadOnly = false) => {
    const response = await api.get<ApiResponse>('/alerts', {
      params: { unread_only: unreadOnly ? 'true' : undefined },
    });
    return response.data;
  },

  markRead: async (alertId: number) => {
    const response = await api.post<ApiResponse>(`/alerts/${alertId}/read`);
    return response.data;
  },

  markAllRead: async () => {
    const response = await api.post<ApiResponse>('/alerts/read-all');
    return response.data;
  },

  generate: async (warehouseCode?: string) => {
    const response = await api.post<ApiResponse>('/alerts/generate', null, {
      params: { warehouse_code: warehouseCode },
    });
    return response.data;
  },
};
