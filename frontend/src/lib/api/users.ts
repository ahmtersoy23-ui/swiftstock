import api from './client';
import type { ApiResponse } from '../../types';

export const userApi = {
  getAll: async () => {
    const response = await api.get<ApiResponse>('/users');
    return response.data;
  },

  getById: async (user_id: number) => {
    const response = await api.get<ApiResponse>(`/users/${user_id}`);
    return response.data;
  },

  create: async (data: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
    role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
    warehouse_code?: string;
  }) => {
    const response = await api.post<ApiResponse>('/users', data);
    return response.data;
  },

  update: async (user_id: number, data: {
    username?: string;
    email?: string;
    full_name?: string;
    role?: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
    warehouse_code?: string;
    is_active?: boolean;
  }) => {
    const response = await api.put<ApiResponse>(`/users/${user_id}`, data);
    return response.data;
  },

  delete: async (user_id: number) => {
    const response = await api.delete<ApiResponse>(`/users/${user_id}`);
    return response.data;
  },

  resetPassword: async (user_id: number, new_password: string) => {
    const response = await api.post<ApiResponse>(`/users/${user_id}/reset-password`, { new_password });
    return response.data;
  },
};
