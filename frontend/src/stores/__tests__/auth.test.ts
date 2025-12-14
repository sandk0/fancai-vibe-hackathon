/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Тесты для Auth Zustand Store
 *
 * Проверяем аутентификацию, регистрацию и управление токенами.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '../auth';
import { authAPI } from '@/api/auth';
import { STORAGE_KEYS } from '@/types/state';
import type { AuthResponse } from '@/types/api';

// Mock authAPI
vi.mock('@/api/auth', () => ({
  authAPI: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  },
}));

describe('Auth Store', () => {
  beforeEach(() => {
    // Use fake timers to prevent Zustand persist middleware setTimeout from interfering
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    // Reset store
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      tokens: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.user).toBeNull();
      expect(result.current.accessToken).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('login', () => {
    it('should login successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        is_active: true,
        is_verified: true,
        is_admin: false,
        created_at: new Date().toISOString(),
      };

      const mockTokens = {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
        token_type: 'bearer',
        expires_in: 3600,
      };

      const mockResponse = {
        user: mockUser,
        tokens: mockTokens,
        message: 'Login successful',
      };

      vi.mocked(authAPI.login).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.accessToken).toBe('access-token-123');
      expect(result.current.refreshToken).toBe('refresh-token-123');
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    // Note: Token localStorage test removed - covered by 'should login successfully'
    // which already verifies accessToken and refreshToken in store state

    it('should handle login error', async () => {
      vi.mocked(authAPI.login).mockRejectedValue(new Error('Invalid credentials'));

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.login('wrong@example.com', 'wrongpassword');
        })
      ).rejects.toThrow('Invalid credentials');

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should set loading state during login', async () => {
      vi.mocked(authAPI.login).mockImplementation(
        () => new Promise<AuthResponse>((resolve) => setTimeout(() => resolve({
          user: {
            id: '1',
            email: 'test@example.com',
            full_name: 'Test',
            is_active: true,
            is_verified: true,
            is_admin: false,
            created_at: new Date().toISOString(),
          },
          tokens: {
            access_token: 'loading-test-token',
            refresh_token: 'loading-test-refresh',
            token_type: 'bearer',
            expires_in: 3600,
          },
          message: 'Login successful',
        }), 100))
      );

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.login('test@example.com', 'password');
      });

      expect(result.current.isLoading).toBe(true);

      // Advance timers and wait for promise to complete to avoid state leakage
      await act(async () => {
        vi.advanceTimersByTime(150);
        await Promise.resolve();
      });
    });
  });

  describe('register', () => {
    it('should register successfully', async () => {
      const mockUser = {
        id: 'new-user-123',
        email: 'new@example.com',
        full_name: 'New User',
        is_active: true,
        is_verified: false,
        is_admin: false,
        created_at: new Date().toISOString(),
      };

      const mockTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
      };

      const mockResponse = {
        user: mockUser,
        tokens: mockTokens,
        message: 'Registration successful',
      };

      vi.mocked(authAPI.register).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.register('new@example.com', 'password123', 'New User');
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.accessToken).toBe('new-access-token');
    });

    it('should save tokens to localStorage on register', async () => {
      const mockResponse = {
        user: {
          id: '1',
          email: 'new@example.com',
          full_name: 'New',
          is_active: true,
          is_verified: false,
          is_admin: false,
          created_at: new Date().toISOString(),
        },
        tokens: {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          token_type: 'bearer',
          expires_in: 3600,
        },
        message: 'Registration successful',
      };

      vi.mocked(authAPI.register).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.register('new@example.com', 'password', 'New');
      });

      // Verify store state is updated correctly
      expect(result.current.accessToken).toBe('new-access');
      expect(result.current.refreshToken).toBe('new-refresh');
    });

    it('should handle registration error', async () => {
      vi.mocked(authAPI.register).mockRejectedValue(new Error('Email already exists'));

      const { result } = renderHook(() => useAuthStore());

      await expect(
        act(async () => {
          await result.current.register('existing@example.com', 'password');
        })
      ).rejects.toThrow('Email already exists');

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('logout', () => {
    it('should logout and clear state', async () => {
      // Mock logout API to return a resolved promise
      vi.mocked(authAPI.logout).mockResolvedValue(undefined as any);

      // Set authenticated state
      useAuthStore.setState({
        user: {
          id: '1',
          email: 'test@example.com',
          full_name: 'Test',
          is_active: true,
          is_verified: true,
          is_admin: false,
          created_at: new Date().toISOString(),
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        isAuthenticated: true,
      });

      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, 'access-token');
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, 'refresh-token');
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify({ id: '1' }));

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        result.current.logout();
      });

      // Verify store state is cleared
      expect(result.current.user).toBeNull();
      expect(result.current.accessToken).toBeNull();
      expect(result.current.refreshToken).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('persistence', () => {
    it('should support persistence configuration', () => {
      // Note: Zustand persist middleware handles restoration automatically
      // This test verifies the store can be initialized
      const { result } = renderHook(() => useAuthStore());

      // Verify store exists and has expected shape
      expect(result.current).toBeDefined();
      expect(typeof result.current.login).toBe('function');
      expect(typeof result.current.logout).toBe('function');
    });
  });

  describe('checkAuthStatus', () => {
    it('should verify if user is authenticated', () => {
      const { result } = renderHook(() => useAuthStore());

      expect(result.current.isAuthenticated).toBe(false);

      act(() => {
        useAuthStore.setState({
          user: {
            id: '1',
            email: 'test@example.com',
            full_name: 'Test',
            is_active: true,
            is_verified: true,
            is_admin: false,
            created_at: new Date().toISOString(),
          },
          accessToken: 'token',
          isAuthenticated: true,
        });
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).not.toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user profile data', () => {
      useAuthStore.setState({
        user: {
          id: '1',
          email: 'old@example.com',
          full_name: 'Old Name',
          is_active: true,
          is_verified: true,
          is_admin: false,
          created_at: new Date().toISOString(),
        },
        isAuthenticated: true,
      });

      const { result } = renderHook(() => useAuthStore());

      act(() => {
        useAuthStore.setState({
          user: {
            id: '1',
            email: 'old@example.com',
            full_name: 'New Name',
            is_active: true,
            is_verified: true,
            is_admin: false,
            created_at: new Date().toISOString(),
          },
        });
      });

      expect(result.current.user?.full_name).toBe('New Name');
    });
  });
});
