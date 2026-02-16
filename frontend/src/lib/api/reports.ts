import api from './client';
import type { ApiResponse } from '../../types';

export const reportApi = {
  // Save count report from Operations page
  saveCountReport: async (data: {
    warehouse_id: number;
    warehouse_code: string;
    locations: Array<{
      location: {
        location_id?: number;
        location_code: string;
        qr_code?: string;
      };
      items: Array<{
        sku_code: string;
        product_name: string;
        expected_quantity: number;
        counted_quantity: number;
        variance: number;
        scanned_barcodes: string[];
      }>;
      unexpectedItems: Array<{
        sku_code: string;
        product_name: string;
        expected_quantity: number;
        counted_quantity: number;
        variance: number;
        scanned_barcodes: string[];
      }>;
      totalExpected: number;
      totalCounted: number;
      totalVariance: number;
    }>;
    notes?: string;
  }) => {
    const response = await api.post<ApiResponse>('/reports/count', data);
    return response.data;
  },

  // Get all count reports
  getCountReports: async (params?: {
    warehouse_id?: number;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }) => {
    const response = await api.get<ApiResponse>('/reports/count', { params });
    return response.data;
  },

  // Get count report by ID
  getCountReportById: async (report_id: number) => {
    const response = await api.get<ApiResponse>(`/reports/count/${report_id}`);
    return response.data;
  },

  // Delete count report
  deleteCountReport: async (report_id: number) => {
    const response = await api.delete<ApiResponse>(`/reports/count/${report_id}`);
    return response.data;
  },

  // Get inventory report by warehouse
  getInventoryReport: async (warehouse_id: number, params?: { group_by?: 'product' | 'location' }) => {
    const response = await api.get<ApiResponse>(`/reports/inventory/${warehouse_id}`, { params });
    return response.data;
  },
};
