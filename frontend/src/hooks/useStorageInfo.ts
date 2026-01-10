/**
 * React hooks for storage management
 *
 * Provides reactive access to storage information, cleanup operations,
 * and persistent storage management using TanStack Query.
 *
 * @module hooks/useStorageInfo
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  storageManager,
  type StorageInfo,
  type StorageBreakdown,
  type CleanupResult,
} from '@/services/storageManager'

// ============================================================================
// Query Keys
// ============================================================================

export const storageQueryKeys = {
  all: ['storage'] as const,
  info: () => [...storageQueryKeys.all, 'info'] as const,
  breakdown: () => [...storageQueryKeys.all, 'breakdown'] as const,
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook for getting storage information
 * Auto-refreshes every 30 seconds
 *
 * @returns Query result with storage info
 */
export function useStorageInfo() {
  return useQuery({
    queryKey: storageQueryKeys.info(),
    queryFn: () => storageManager.getStorageInfo(),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider fresh for 10 seconds
    gcTime: 60000, // Keep in cache for 1 minute
  })
}

/**
 * Hook for getting storage breakdown by data type
 *
 * @returns Query result with storage breakdown
 */
export function useStorageBreakdown() {
  return useQuery({
    queryKey: storageQueryKeys.breakdown(),
    queryFn: () => storageManager.getStorageBreakdown(),
    staleTime: 30000,
    gcTime: 120000,
  })
}

/**
 * Hook for checking if download is possible
 *
 * @param estimatedSizeBytes - Estimated size of download in bytes
 * @returns Query result with boolean
 */
export function useCanDownload(estimatedSizeBytes: number) {
  return useQuery({
    queryKey: [...storageQueryKeys.all, 'canDownload', estimatedSizeBytes],
    queryFn: () => storageManager.canDownload(estimatedSizeBytes),
    enabled: estimatedSizeBytes > 0,
    staleTime: 5000,
  })
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook for requesting persistent storage
 * Important for iOS to prevent data eviction
 *
 * @returns Mutation for requesting persistence
 */
export function useRequestPersistence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => storageManager.requestPersistentStorage(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageQueryKeys.info() })
    },
  })
}

/**
 * Hook for clearing all offline data
 * WARNING: This will delete all cached books, chapters, and images
 *
 * @returns Mutation for clearing all data
 */
export function useClearOfflineData() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => storageManager.clearAllOfflineData(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: ['books'] })
      queryClient.invalidateQueries({ queryKey: ['offline-books'] })
    },
  })
}

/**
 * Hook for clearing data of a specific book
 *
 * @returns Mutation for clearing book data
 */
export function useClearBookData() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, bookId }: { userId: string; bookId: string }) =>
      storageManager.clearBookData(userId, bookId),
    onSuccess: (_freedBytes, variables) => {
      queryClient.invalidateQueries({ queryKey: storageQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: ['books', variables.bookId] })
      queryClient.invalidateQueries({ queryKey: ['offline-books'] })
    },
  })
}

/**
 * Hook for LRU cleanup
 *
 * @returns Mutation for performing cleanup
 */
export function usePerformCleanup() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (targetFreeBytes: number) =>
      storageManager.performCleanup(targetFreeBytes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageQueryKeys.all })
      queryClient.invalidateQueries({ queryKey: ['offline-books'] })
    },
  })
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format bytes to human-readable string
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number): string {
  return storageManager.formatBytes(bytes)
}

/**
 * Calculate percentage used from storage info
 *
 * @param info - Storage info object
 * @returns Percentage (0-100) or 0 if info is undefined
 */
export function getStoragePercentage(info: StorageInfo | undefined): number {
  if (!info) return 0
  return Math.round(info.percentUsed * 100) / 100
}

/**
 * Get storage status color class
 *
 * @param info - Storage info object
 * @returns Tailwind color class
 */
export function getStorageStatusColor(
  info: StorageInfo | undefined
): 'destructive' | 'warning' | 'default' {
  if (!info) return 'default'
  if (info.isCritical) return 'destructive'
  if (info.isWarning) return 'warning'
  return 'default'
}

/**
 * Get storage status label
 *
 * @param info - Storage info object
 * @returns Status label
 */
export function getStorageStatusLabel(info: StorageInfo | undefined): string {
  if (!info) return 'Loading...'
  if (info.isCritical) return 'Critical'
  if (info.isWarning) return 'Warning'
  return 'Normal'
}

// ============================================================================
// Type Exports
// ============================================================================

export type { StorageInfo, StorageBreakdown, CleanupResult }
