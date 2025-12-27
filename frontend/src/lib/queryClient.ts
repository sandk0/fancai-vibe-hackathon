/**
 * Shared QueryClient Instance
 *
 * Exports the TanStack Query client as a singleton module.
 * This allows other modules (like auth store) to access the query cache
 * for clearing on logout/login.
 *
 * Features:
 * - Exponential backoff retry with jitter
 * - Configurable retry behavior based on error type
 * - Aligned stale times with backend cache
 *
 * @module lib/queryClient
 */

import { QueryClient } from '@tanstack/react-query';
import {
  createTanStackRetry,
  createTanStackRetryDelay,
  RETRY_PRESETS,
} from '@/utils/retryWithBackoff';

/**
 * Default retry configuration for API queries
 *
 * Uses exponential backoff with jitter to prevent thundering herd.
 * Retries on network errors, timeouts, and 5xx server errors.
 */
const defaultRetry = createTanStackRetry(RETRY_PRESETS.api);
const defaultRetryDelay = createTanStackRetryDelay(RETRY_PRESETS.api);

/**
 * Singleton QueryClient instance
 *
 * Configuration:
 * - retry: Exponential backoff with jitter (3 retries, 1-10s delays)
 * - retryDelay: Exponential delay calculation with jitter
 * - refetchOnWindowFocus: false - Don't refetch when tab becomes active
 * - staleTime: 10s - Aligned with backend cache for fresh data
 * - gcTime: 5 minutes - Keep unused data in cache for 5 minutes
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: defaultRetry,
      retryDelay: defaultRetryDelay,
      refetchOnWindowFocus: false,
      staleTime: 10 * 1000, // 10 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    },
    mutations: {
      // Mutations use fast retry preset (2 retries, 0.3-3s delays)
      retry: createTanStackRetry(RETRY_PRESETS.fast),
      retryDelay: createTanStackRetryDelay(RETRY_PRESETS.fast),
    },
  },
});

/**
 * Export retry presets for use in individual queries
 *
 * @example
 * ```typescript
 * import { QUERY_RETRY_PRESETS } from '@/lib/queryClient';
 *
 * const { data } = useQuery({
 *   queryKey: ['images', bookId],
 *   queryFn: () => fetchImages(bookId),
 *   ...QUERY_RETRY_PRESETS.imageGeneration,
 * });
 * ```
 */
export const QUERY_RETRY_PRESETS = {
  /** Default API retry (3 retries, 1-10s) */
  api: {
    retry: createTanStackRetry(RETRY_PRESETS.api),
    retryDelay: createTanStackRetryDelay(RETRY_PRESETS.api),
  },
  /** Image generation (4 retries, 2-60s) */
  imageGeneration: {
    retry: createTanStackRetry(RETRY_PRESETS.imageGeneration),
    retryDelay: createTanStackRetryDelay(RETRY_PRESETS.imageGeneration),
  },
  /** Description extraction (3 retries, 0.5-5s) */
  descriptionExtraction: {
    retry: createTanStackRetry(RETRY_PRESETS.descriptionExtraction),
    retryDelay: createTanStackRetryDelay(RETRY_PRESETS.descriptionExtraction),
  },
  /** Critical operations (5 retries, 1-60s) */
  critical: {
    retry: createTanStackRetry(RETRY_PRESETS.critical),
    retryDelay: createTanStackRetryDelay(RETRY_PRESETS.critical),
  },
  /** Fast/non-critical (2 retries, 0.3-3s) */
  fast: {
    retry: createTanStackRetry(RETRY_PRESETS.fast),
    retryDelay: createTanStackRetryDelay(RETRY_PRESETS.fast),
  },
  /** No retry */
  none: {
    retry: false as const,
  },
} as const;
