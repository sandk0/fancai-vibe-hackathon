// Authentication Store

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '@/api/auth';
import type { AuthState } from '@/types/state';
import { STORAGE_KEYS } from '@/types/state';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      // Actions
      login: async (email: string, password: string) => {
        set({ isLoading: true });
        
        try {
          const response = await authAPI.login({ email, password });
          const { user, tokens } = response;

          // Store tokens in localStorage
          localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, tokens.access_token);
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);

          set({
            user,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (email: string, password: string, fullName?: string) => {
        set({ isLoading: true });
        
        try {
          const response = await authAPI.register({ 
            email, 
            password, 
            full_name: fullName 
          });
          const { user, tokens } = response;

          // Store tokens in localStorage
          localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, tokens.access_token);
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);

          set({
            user,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        // Call logout API
        authAPI.logout().catch(console.error);

        // Clear localStorage
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER_DATA);

        // Reset state
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        try {
          const response = await authAPI.refreshToken(refreshToken);
          const { tokens } = response;

          // Update tokens in localStorage
          localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, tokens.access_token);
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);

          set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
          });
        } catch (error) {
          // Refresh failed, logout user
          get().logout();
          throw error;
        }
      },

      updateUser: (user) => {
        set({ user });
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
      },

      loadUserFromStorage: () => {
        try {
          const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
          const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
          const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);

          if (token && refreshToken) {
            const user = userData ? JSON.parse(userData) : null;
            set({
              accessToken: token,
              refreshToken: refreshToken,
              user,
              isAuthenticated: true,
            });

            // Try to refresh user data
            if (user) {
              authAPI.getCurrentUser()
                .then((response) => {
                  get().updateUser(response.user);
                })
                .catch((error) => {
                  console.warn('Failed to refresh user data:', error);
                  // If token is invalid, logout
                  if (error.response?.status === 401) {
                    get().logout();
                  }
                });
            }
          }
        } catch (error) {
          console.error('Failed to load user from storage:', error);
          get().logout();
        }
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);