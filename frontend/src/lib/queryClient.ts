/**
 * Shared QueryClient Instance
 *
 * Exports the TanStack Query client as a singleton module.
 * This allows other modules (like auth store) to access the query cache
 * for clearing on logout/login.
 *
 * @module lib/queryClient
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Singleton QueryClient instance
 *
 * Configuration:
 * - retry: 1 - Single retry on failure
 * - refetchOnWindowFocus: false - Don't refetch when tab becomes active
 * - staleTime: 10s - Aligned with backend cache for fresh data
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10 * 1000, // 10 seconds
    },
  },
});
