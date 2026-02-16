import api from './client';
import type { ApiResponse, ScanRequest, ScanResponse } from '../../types';

export const scanApi = {
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

  // Scan Sessions
  createSession: async (data: {
    warehouse_code: string;
    user_name: string;
    mode_type: 'RECEIVING' | 'PICKING' | 'TRANSFER' | 'COUNT';
    notes?: string;
  }) => {
    const response = await api.post<ApiResponse>('/scan-sessions', data);
    return response.data;
  },

  getSession: async (session_id: number) => {
    const response = await api.get<ApiResponse>(`/scan-sessions/${session_id}`);
    return response.data;
  },

  getActiveSession: async (user_name: string) => {
    const response = await api.get<ApiResponse>('/scan-sessions/active', {
      params: { user_name },
    });
    return response.data;
  },

  completeSession: async (session_id: number, notes?: string) => {
    const response = await api.post<ApiResponse>(`/scan-sessions/${session_id}/complete`, { notes });
    return response.data;
  },

  cancelSession: async (session_id: number, notes?: string) => {
    const response = await api.post<ApiResponse>(`/scan-sessions/${session_id}/cancel`, { notes });
    return response.data;
  },

  // Scan Operations
  addOperation: async (data: {
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
};
