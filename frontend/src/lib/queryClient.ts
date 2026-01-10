/**
 * Shared QueryClient Instance
 *
 * Exports the TanStack Query client as a singleton module.
 * This allows other modules (like auth store) to access the query cache
 * for clearing on logout/login.
 *
 * Features:
 * - Offline-first mode for PWA support
 * - Exponential backoff retry with jitter
 * - Configurable retry behavior based on error type
 * - Extended cache times for offline support
 * - Custom focusManager for PWA resume handling
 *
 * @module lib/queryClient
 */

import { QueryClient, focusManager } from '@tanstack/react-query';
import {
  createTanStackRetry,
  createTanStackRetryDelay,
  RETRY_PRESETS,
} from '@/utils/retryWithBackoff';

// ============================================================================
// FocusManager Configuration for PWA
// ============================================================================

/**
 * Custom focus handler for PWA resume handling.
 *
 * This integrates with:
 * - Standard visibility change events (document.visibilityState)
 * - Custom app:online event from useOnlineStatus hook
 *
 * The usePWAResumeGuard hook can temporarily disable focus via focusManager.setFocused(false)
 * to prevent premature refetches before auth state is ready.
 */
focusManager.setEventListener((handleFocus) => {
  // Standard visibility change handler
  const visibilityHandler = () => {
    handleFocus(document.visibilityState === 'visible');
  };

  document.addEventListener('visibilitychange', visibilityHandler, false);

  // Also listen for custom app events (dispatched by useOnlineStatus)
  const onlineHandler = () => handleFocus(true);
  window.addEventListener('app:online', onlineHandler);

  return () => {
    document.removeEventListener('visibilitychange', visibilityHandler);
    window.removeEventListener('app:online', onlineHandler);
  };
});

/**
 * Default retry configuration for API queries
 *
 * Uses exponential backoff with jitter to prevent thundering herd.
 * Retries on network errors, timeouts, and 5xx server errors.
 * Does NOT retry on 4xx client errors (except 408, 429).
 */
const defaultRetry = createTanStackRetry(RETRY_PRESETS.api);
const defaultRetryDelay = createTanStackRetryDelay(RETRY_PRESETS.api);

/**
 * Custom retry function that skips 4xx errors
 * except for 408 (Timeout) and 429 (Too Many Requests)
 */
function offlineFirstRetry(failureCount: number, error: unknown): boolean {
  // Check for HTTP error status
  if (error instanceof Error && 'status' in error) {
    const status = (error as Error & { status: number }).status;
    // Don't retry on 4xx client errors (except 408 Timeout and 429 Rate Limit)
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
      return false;
    }
  }
  // Delegate to default retry logic
  return defaultRetry(failureCount, error);
}

/**
 * Singleton QueryClient instance
 *
 * Configuration for PWA offline-first support:
 * - networkMode: 'offlineFirst' - Return cached data immediately, then fetch
 * - retry: Custom retry that skips 4xx errors
 * - retryDelay: Exponential delay calculation with jitter
 * - refetchOnWindowFocus: true - Refetch when tab becomes active (sync fresh data)
 * - refetchOnReconnect: true - Refetch when network is restored
 * - staleTime: 5 minutes - Data considered fresh for offline scenarios
 * - gcTime: 24 hours - Extended cache for offline support
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Critical for PWA offline-first!
      networkMode: 'offlineFirst',

      // Custom retry that skips 4xx client errors
      retry: offlineFirstRetry,
      retryDelay: defaultRetryDelay,

      // Refetch on window focus and network reconnect for data sync
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,

      // Data considered fresh for 5 minutes (optimized for offline)
      staleTime: 5 * 60 * 1000, // 5 minutes

      // Extended cache time for offline support (24 hours)
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
    },
    mutations: {
      // Mutations also in offline-first mode
      networkMode: 'offlineFirst',

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

/**
 * Export focusManager for use in PWA resume handling
 *
 * @example
 * ```typescript
 * import { focusManager } from '@/lib/queryClient';
 *
 * // Temporarily disable focus to prevent premature refetch
 * focusManager.setFocused(false);
 *
 * // Re-enable after auth is ready
 * focusManager.setFocused(true);
 * ```
 */
export { focusManager };
