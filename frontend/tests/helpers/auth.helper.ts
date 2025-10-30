/**
 * Authentication helper utilities for E2E tests
 */

import { Page } from '@playwright/test';
import type { TestUser } from '../fixtures';

/**
 * Login helper - performs login flow
 */
export async function login(page: Page, user: TestUser): Promise<void> {
  await page.goto('/login');

  await page.fill('[data-testid="login-email"]', user.email);
  await page.fill('[data-testid="login-password"]', user.password);

  await page.click('[data-testid="login-submit"]');

  // Wait for navigation to complete
  await page.waitForURL('/library', { timeout: 10000 });
}

/**
 * Register helper - performs registration flow
 */
export async function register(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register');

  await page.fill('[data-testid="register-email"]', user.email);
  await page.fill('[data-testid="register-username"]', user.username);
  await page.fill('[data-testid="register-password"]', user.password);
  await page.fill('[data-testid="register-confirm-password"]', user.password);

  if (user.firstName) {
    await page.fill('[data-testid="register-firstname"]', user.firstName);
  }
  if (user.lastName) {
    await page.fill('[data-testid="register-lastname"]', user.lastName);
  }

  await page.click('[data-testid="register-submit"]');

  // Wait for successful registration
  await page.waitForSelector('[data-testid="registration-success"]', { timeout: 10000 });
}

/**
 * Logout helper - performs logout
 */
export async function logout(page: Page): Promise<void> {
  // Open user menu
  await page.click('[data-testid="user-menu-trigger"]');

  // Click logout
  await page.click('[data-testid="logout-button"]');

  // Wait for redirect to login
  await page.waitForURL('/login', { timeout: 5000 });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector('[data-testid="user-menu-trigger"]', { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get auth token from localStorage
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    return localStorage.getItem('auth_token');
  });
}

/**
 * Set auth token in localStorage
 */
export async function setAuthToken(page: Page, token: string): Promise<void> {
  await page.evaluate((authToken) => {
    localStorage.setItem('auth_token', authToken);
  }, token);
}

/**
 * Clear authentication data
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}
