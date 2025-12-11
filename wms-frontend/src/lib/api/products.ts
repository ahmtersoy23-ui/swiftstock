import api from './client';
import type { ApiResponse, Product } from '../../types';

export const productApi = {
  getAll: async () => {
    const response = await api.get<ApiResponse<Product[]>>('/products');
    return response.data;
  },

  getBySku: async (sku_code: string) => {
    const response = await api.get<ApiResponse<Product>>(`/products/${sku_code}`);
    return response.data;
  },

  create: async (data: Partial<Product>) => {
    const response = await api.post<ApiResponse<Product>>('/products', data);
    return response.data;
  },

  update: async (sku_code: string, data: Partial<Product>) => {
    const response = await api.put<ApiResponse<Product>>(`/products/${sku_code}`, data);
    return response.data;
  },

  delete: async (sku_code: string) => {
    const response = await api.delete<ApiResponse>(`/products/${sku_code}`);
    return response.data;
  },

  search: async (query: string) => {
    const response = await api.get<ApiResponse<Product[]>>('/products/search', {
      params: { q: query },
    });
    return response.data;
  },
};
