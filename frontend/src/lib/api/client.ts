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

// Helper to get SSO token from localStorage
const getSSOToken = () => {
  const ssoStorage = localStorage.getItem('swiftstock-sso-storage');
  if (ssoStorage) {
    try {
      const { state } = JSON.parse(ssoStorage);
      return state?.accessToken;
    } catch {
      return null;
    }
  }
  return null;
};

// Helper to clear auth and redirect to SSO
const clearAuthAndRedirect = () => {
  localStorage.removeItem('swiftstock-sso-storage');
  const returnUrl = encodeURIComponent(window.location.href);
  window.location.href = `https://apps.iwa.web.tr?returnUrl=${returnUrl}&app=swiftstock`;
};

// Request interceptor - Add SSO token if available
api.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }

    const token = getSSOToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

    // Handle 401 - Token expired or invalid, redirect to SSO
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      clearAuthAndRedirect();
      return Promise.reject(error);
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
