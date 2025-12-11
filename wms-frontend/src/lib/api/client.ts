import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { Capacitor } from '@capacitor/core';

// API Base URL - Capacitor (Android/iOS) ise gerçek URL, browser ise proxy
const isNative = Capacitor.isNativePlatform();
export const API_BASE_URL = isNative
  ? (import.meta.env.VITE_NATIVE_API_URL || '/api')
  : (import.meta.env.VITE_API_URL || '/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Token refresh state
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Helper to get auth state from localStorage
const getAuthState = () => {
  const authStorage = localStorage.getItem('wms-auth-storage');
  if (authStorage) {
    try {
      const { state } = JSON.parse(authStorage);
      return state;
    } catch {
      return null;
    }
  }
  return null;
};

// Helper to update access token in localStorage
const updateAccessToken = (newAccessToken: string) => {
  const authStorage = localStorage.getItem('wms-auth-storage');
  if (authStorage) {
    try {
      const data = JSON.parse(authStorage);
      data.state.accessToken = newAccessToken;
      localStorage.setItem('wms-auth-storage', JSON.stringify(data));
    } catch {
      // Ignore errors
    }
  }
};

// Helper to clear auth and redirect to login
const clearAuthAndRedirect = () => {
  localStorage.removeItem('wms-auth-storage');
  window.location.href = '/login';
};

// Request interceptor - Add auth token if available
api.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }

    const state = getAuthState();
    if (state?.accessToken) {
      config.headers.Authorization = `Bearer ${state.accessToken}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - enhanced error handling with auto token refresh
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Network error (no response)
    if (!error.response) {
      if (import.meta.env.DEV) {
        console.error('Network Error:', error.message);
      }
      const networkError = {
        success: false,
        error: 'Ağ bağlantısı hatası. İnternet bağlantınızı kontrol edin.',
        code: 'NETWORK_ERROR',
        originalError: error.message,
      };
      return Promise.reject(networkError);
    }

    const { status, data } = error.response as { status: number; data: { error?: string; code?: string } };

    // Handle 401 - Token expired, try to refresh
    if (status === 401 && !originalRequest._retry) {
      // Skip refresh for auth endpoints
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Wait for the refresh to complete
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const state = getAuthState();
      if (!state?.refreshToken) {
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken: state.refreshToken,
        });

        if (response.data.success && response.data.data?.accessToken) {
          const newAccessToken = response.data.data.accessToken;
          updateAccessToken(newAccessToken);
          processQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } else {
          processQueue(error, null);
          clearAuthAndRedirect();
          return Promise.reject(error);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (import.meta.env.DEV) {
      console.error(`API Error [${status}]:`, data?.error || error.message);
    }

    // Create user-friendly error messages
    let userMessage = data?.error || 'Bir hata oluştu';

    switch (status) {
      case 400:
        userMessage = data?.error || 'Geçersiz istek';
        break;
      case 401:
        userMessage = 'Yetkiniz yok. Lütfen giriş yapın.';
        break;
      case 403:
        userMessage = 'Bu işlem için yetkiniz bulunmuyor.';
        break;
      case 404:
        userMessage = data?.error || 'Kayıt bulunamadı';
        break;
      case 409:
        userMessage = data?.error || 'Bu kayıt zaten mevcut';
        break;
      case 429:
        userMessage = 'Çok fazla istek gönderildi. Lütfen bekleyin.';
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        userMessage = 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
        break;
    }

    const enhancedError = {
      success: false,
      error: userMessage,
      code: data?.code || `HTTP_${status}`,
      status,
      originalError: data,
    };

    return Promise.reject(enhancedError);
  }
);

export default api;
