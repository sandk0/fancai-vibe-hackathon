// API Client for BookReader AI

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { STORAGE_KEYS } from '@/types/state';
import type { ApiError } from '@/types/api';

class ApiClient {
  public client: AxiosInstance;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🌐 [AXIOS] Outgoing ${config.method?.toUpperCase()} request to ${config.url}`);
        console.log('🌐 [AXIOS] Request config:', {
          url: config.url,
          method: config.method,
          headers: config.headers,
          hasData: !!config.data,
        });

        // КРИТИЧЕСКИ ВАЖНО: Если data это FormData, удаляем Content-Type
        // чтобы браузер сам установил multipart/form-data с boundary
        if (config.data instanceof FormData) {
          console.log('🌐 [AXIOS] Detected FormData, removing Content-Type header');
          if (config.headers) {
            delete config.headers['Content-Type'];
          }
        }

        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
          console.log('🌐 [AXIOS] Added Authorization header');
        }
        return config;
      },
      (error) => {
        console.error('🌐 [AXIOS] Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => {
        console.log(`🌐 [AXIOS] Response received for ${response.config.url}:`, response.status);
        return response;
      },
      async (error) => {
        console.error('🌐 [AXIOS] Response error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
        });

        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          console.log('🌐 [AXIOS] 401 error, attempting token refresh...');
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            console.log('🌐 [AXIOS] Token refreshed, retrying request...');
            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed, clear auth data but don't redirect immediately
            console.warn('🔄 Token refresh failed:', refreshError);
            this.clearAuthData();

            // Only redirect to login if not already on login page
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }

            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(this.handleError(error));
      }
    );
  }

  private async refreshToken(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    this.refreshPromise = this.client
      .post('/auth/refresh', { refresh_token: refreshToken })
      .then((response) => {
        const { tokens } = response.data;
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, tokens.access_token);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
        return tokens.access_token;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  private clearAuthData() {
    console.log('🧹 Clearing auth data...');
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);

    // Also clear Zustand store (async import)
    import('@/stores/auth')
      .then(({ useAuthStore }) => {
        useAuthStore.getState().logout();
      })
      .catch((error) => {
        console.warn('Failed to clear auth store:', error);
      });
  }

  private handleError(error: unknown): ApiError {
    if (this.isAxiosError(error)) {
      if (error.response) {
        // Server responded with error
        const responseData = error.response.data as Record<string, unknown> | undefined;
        return {
          error: (responseData?.error as string) || 'Server Error',
          message: (responseData?.detail as string) || (responseData?.message as string) || 'An error occurred',
          details: responseData,
          timestamp: new Date().toISOString(),
        };
      } else if (error.request) {
        // Network error
        return {
          error: 'Network Error',
          message: 'Unable to connect to server. Please check your internet connection.',
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Other error
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return {
      error: 'Client Error',
      message: errorMessage,
      timestamp: new Date().toISOString(),
    };
  }

  private isAxiosError(error: unknown): error is AxiosError {
    return error !== null && typeof error === 'object' && 'isAxiosError' in error;
  }

  // Generic request methods
  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    // Add cache-busting headers to prevent browser caching API responses
    const response: AxiosResponse<T> = await this.client.get(url, {
      ...config,
      headers: {
        ...config?.headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
    return response.data;
  }

  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return response.data;
  }

  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return response.data;
  }

  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return response.data;
  }

  // Upload file with progress
  async upload<T = unknown>(
    url: string,
    file: File,
    onUploadProgress?: (progressEvent: { loaded: number; total?: number }) => void
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    const response: AxiosResponse<T> = await this.client.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });

    return response.data;
  }

  // Download file
  async download(url: string, filename?: string): Promise<Blob> {
    const response = await this.client.get(url, {
      responseType: 'blob',
    });

    // Create download link if filename provided
    if (filename) {
      const blob = response.data;
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    }

    return response.data;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; version: string }> {
    return this.get('/health');
  }

  // Get API info
  async getApiInfo(): Promise<{
    name: string;
    version: string;
    description?: string;
    environment?: string;
  }> {
    return this.get('/info');
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export for direct usage
export default apiClient;