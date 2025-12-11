import api from './client';
import type { ApiResponse } from '../../types';

export const authApi = {
  login: async (data: { username: string; password: string; device_uuid?: string; device_name?: string }) => {
    const response = await api.post<ApiResponse>('/auth/login', data);
    return response.data;
  },

  googleLogin: async (data: { credential: string; device_uuid?: string; device_name?: string }) => {
    const response = await api.post<ApiResponse>('/auth/google', data);
    return response.data;
  },

  logout: async (refreshToken?: string) => {
    const response = await api.post<ApiResponse>('/auth/logout', { refreshToken });
    return response.data;
  },

  refreshToken: async (refreshToken: string) => {
    const response = await api.post<ApiResponse>('/auth/refresh', { refreshToken });
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get<ApiResponse>('/auth/profile');
    return response.data;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const response = await api.post<ApiResponse>('/auth/change-password', data);
    return response.data;
  },
};
