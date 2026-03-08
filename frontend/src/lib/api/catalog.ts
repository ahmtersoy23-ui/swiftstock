import api from './client';
import type { ApiResponse } from '../../types';

export const catalogApi = {
  getCategoryZone: async (product_sku: string, warehouse_code: string) => {
    const response = await api.get<ApiResponse<{ category: string | null; suggested_zone: string | null }>>(
      '/category-zone',
      { params: { product_sku, warehouse_code } },
    );
    return response.data;
  },
};
