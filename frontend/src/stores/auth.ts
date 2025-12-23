// Authentication Store

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '@/api/auth';
import type { AuthState } from '@/types/state';
import { STORAGE_KEYS } from '@/types/state';
import { clearAllCaches } from '@/utils/cacheManager';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true, // Start with loading=true to prevent premature redirects
      tokens: null,

      // Actions
      login: async (email: string, password: string) => {
        set({ isLoading: true });

        try {
          // Clear any stale caches from previous session BEFORE login
          console.log('🧹 Clearing stale caches before login...');
          await clearAllCaches();

          const response = await authAPI.login({ email, password });
          const { user, tokens } = response;

          console.log('🔐 Login successful for:', user.email);
          console.log('🔑 Saving tokens to localStorage...');

          // Store tokens in localStorage
          localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, tokens.access_token);
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
          localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));

          console.log('💾 Data saved to localStorage');

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
          // Clear any stale caches from previous session BEFORE register
          console.log('🧹 Clearing stale caches before registration...');
          await clearAllCaches();

          const response = await authAPI.register({
            email,
            password,
            full_name: fullName
          });
          const { user, tokens } = response;

          // Store tokens and user data in localStorage
          localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, tokens.access_token);
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);
          localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));

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

      logout: async () => {
        console.log('🚪 Logging out...');

        // Call logout API
        authAPI.logout().catch(console.error);

        // Clear localStorage
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER_DATA);

        // CRITICAL: Clear all caches to prevent data leakage to next user
        console.log('🧹 Clearing all caches on logout...');
        try {
          await clearAllCaches();
          console.log('✅ All caches cleared on logout');
        } catch (error) {
          console.error('❌ Failed to clear some caches on logout:', error);
        }

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

      loadUserFromStorage: async () => {
        console.log('📱 Loading user from storage...');
        set({ isLoading: true }); // Start loading

        try {
          const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
          const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
          const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);

          console.log('🔑 Token found:', !!token);
          console.log('🔄 Refresh token found:', !!refreshToken);
          console.log('👤 User data found:', !!userData);

          if (token && refreshToken) {
            const user = userData ? JSON.parse(userData) : null;
            console.log('✅ Restoring user session for:', user?.email);

            // Set token and user data first
            set({
              accessToken: token,
              refreshToken: refreshToken,
              user,
              isAuthenticated: true,
              // Keep isLoading true until we verify token
            });

            // Verify token with API call before allowing page to render
            if (user) {
              try {
                const response = await authAPI.getCurrentUser();
                console.log('✅ Token verified, user data refreshed successfully');
                get().updateUser(response.user);
                set({ isLoading: false }); // Stop loading after successful verification
              } catch (error) {
                console.warn('⚠️ Token verification failed:', error);
                // Token is invalid - clear auth state
                get().logout();
                set({ isLoading: false });
              }
            } else {
              // No user data but have tokens - still set loading false
              set({ isLoading: false });
            }
          } else {
            console.log('❌ No valid tokens found, user not authenticated');
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              isAuthenticated: false,
              isLoading: false, // Stop loading - no tokens to verify
            });
          }
        } catch (error) {
          console.error('💥 Failed to load user from storage:', error);
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
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
      onRehydrateStorage: () => (state) => {
        console.log('🔄 Zustand rehydrating auth store...', state);
        if (state) {
          console.log('✅ Auth store rehydrated with user:', state.user?.email);
          // Force load from localStorage after rehydration to ensure consistency
          setTimeout(() => {
            console.log('🔄 Post-rehydration loadUserFromStorage...');
            useAuthStore.getState().loadUserFromStorage();
          }, 100);
        } else {
          console.log('⚠️ No persisted state found, loading from localStorage...');
          setTimeout(() => {
            useAuthStore.getState().loadUserFromStorage();
          }, 100);
        }
      },
    }
  )
);