// Authentication API methods

import { apiClient } from './client';
import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
  UserProfile,
} from '@/types/api';

export const authAPI = {
  // Authentication
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return apiClient.post('/auth/login', credentials);
  },

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    return apiClient.post('/auth/register', userData);
  },

  async logout(): Promise<{ message: string }> {
    return apiClient.post('/auth/logout');
  },

  async refreshToken(refreshToken: string): Promise<{ tokens: any }> {
    return apiClient.post('/auth/refresh', { refresh_token: refreshToken });
  },

  // Current user
  async getCurrentUser(): Promise<{ user: User }> {
    return apiClient.get('/auth/me');
  },

  async updateProfile(data: {
    full_name?: string;
    current_password?: string;
    new_password?: string;
  }): Promise<{ message: string }> {
    return apiClient.put('/auth/profile', data);
  },

  async deactivateAccount(): Promise<{ message: string }> {
    return apiClient.delete('/auth/deactivate');
  },

  // User profile and subscription info
  async getUserProfile(): Promise<UserProfile> {
    return apiClient.get('/users/profile');
  },

  async getUserSubscription(): Promise<any> {
    return apiClient.get('/users/subscription');
  },

  // Test database connection (for debugging)
  async testDatabaseConnection(): Promise<any> {
    return apiClient.get('/users/test-db');
  },
};