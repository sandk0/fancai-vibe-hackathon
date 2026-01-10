/**
 * SyncQueue - Offline-first synchronization queue with Dexie.js + Background Sync API
 *
 * Queues operations (progress updates, bookmarks, highlights, image generation) when offline
 * and synchronizes them when connection is restored.
 *
 * Features:
 * - Dexie.js (IndexedDB) persistence for reliable storage
 * - Workbox BackgroundSyncPlugin for automatic retry via Service Worker
 * - iOS fallback via visibilitychange (Background Sync not supported on iOS)
 * - Priority-based processing (critical > high > normal > low)
 * - Exponential backoff with max retries
 * - Deduplication of duplicate operations
 *
 * Architecture:
 * - Service Worker handles BackgroundSyncPlugin routes for /api/v1/books/.../progress,
 *   /api/v1/reading-sessions, and /api/v1/images/generate
 * - This service manages a custom Dexie-based queue for more complex operations
 *   and iOS fallback
 */

import {
  db,
  type SyncOperation,
  type SyncOperationType,
  type SyncPriority,
  type SyncStatus,
  MAX_SYNC_RETRIES,
} from './db'
import { STORAGE_KEYS } from '@/types/state'

/**
 * Get authorization headers for API requests
 * Uses localStorage token (not cookies) for Docker compatibility
 */
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

// ============================================================================
// Types
// ============================================================================

interface AddOperationOptions {
  type: SyncOperationType
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  userId: string
  bookId?: string
  priority?: SyncPriority
  maxRetries?: number
}

interface SyncEventDetail {
  operation: SyncOperation
  success?: boolean
  error?: string
}

// ============================================================================
// SyncQueue Service
// ============================================================================

class SyncQueue {
  private isProcessing = false
  private processingPromise: Promise<void> | null = null
  private listeners: Set<() => void> = new Set()

  constructor() {
    this.setupEventListeners()
  }

  /**
   * Setup event listeners for network and visibility changes
   */
  private setupEventListeners(): void {
    // iOS does not support Background Sync - use visibilitychange as fallback
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[SyncQueue] App visible, processing queue...')
        this.processQueue()
      }
    })

    // Process when network is restored
    window.addEventListener('online', () => {
      console.log('[SyncQueue] Online, processing queue...')
      this.processQueue()
    })

    // Listen for messages from Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_SUCCESS') {
          console.log('[SyncQueue] SW sync success:', event.data.url)
          window.dispatchEvent(
            new CustomEvent('sync:success', {
              detail: event.data,
            })
          )
          this.notifyListeners()
        } else if (event.data?.type === 'SYNC_REQUESTED') {
          // Service Worker requested queue processing
          console.log('[SyncQueue] SW requested sync:', event.data.tag)
          this.processQueue()
        }
      })
    }

    // Also listen to custom app:online event from useOnlineStatus
    window.addEventListener('app:online', () => {
      console.log('[SyncQueue] App online event, processing queue...')
      this.processQueue()
    })
  }

  /**
   * Add a listener for queue changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Notify all listeners of queue changes
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener())
  }

  /**
   * Add an operation to the sync queue
   */
  async addOperation(options: AddOperationOptions): Promise<string> {
    const operation: SyncOperation = {
      id: crypto.randomUUID(),
      type: options.type,
      endpoint: options.endpoint,
      method: options.method,
      body: options.body,
      headers: options.headers,
      userId: options.userId,
      bookId: options.bookId,
      priority: options.priority || 'normal',
      createdAt: Date.now(),
      retries: 0,
      maxRetries: options.maxRetries || MAX_SYNC_RETRIES,
      status: 'pending',
    }

    // For progress updates, remove existing operations for the same book to avoid duplicates
    if (options.type === 'progress' && options.bookId) {
      await db.syncQueue
        .where('userId')
        .equals(options.userId)
        .filter(
          (op) =>
            op.bookId === options.bookId &&
            op.type === 'progress' &&
            op.status === 'pending'
        )
        .delete()
    }

    await db.syncQueue.add(operation)
    console.log('[SyncQueue] Added operation:', operation.type, operation.endpoint)

    this.notifyListeners()

    // If online - try to send immediately
    if (navigator.onLine) {
      this.processQueue()
    } else {
      // Try to register Background Sync
      this.registerBackgroundSync()
    }

    return operation.id
  }

  /**
   * Register Background Sync (for Android/Chrome)
   * Note: iOS Safari does not support Background Sync API
   */
  private async registerBackgroundSync(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return
    }

    try {
      const registration = await navigator.serviceWorker.ready
      // Check if SyncManager is available (not on iOS)
      if ('sync' in registration) {
        await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('fancai-sync')
        console.log('[SyncQueue] Background Sync registered')
      }
    } catch (error) {
      console.warn('[SyncQueue] Background Sync registration failed:', error)
    }
  }

  /**
   * Process the queue
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return this.processingPromise || Promise.resolve()
    }

    this.isProcessing = true
    this.processingPromise = this.doProcessQueue()

    try {
      await this.processingPromise
    } finally {
      this.isProcessing = false
      this.processingPromise = null
    }
  }

  private async doProcessQueue(): Promise<void> {
    if (!navigator.onLine) {
      console.log('[SyncQueue] Offline, skipping queue processing')
      return
    }

    // Get pending operations
    const operations = await db.syncQueue.where('status').equals('pending').toArray()

    if (operations.length === 0) {
      return
    }

    // Sort by priority and creation date
    const priorityOrder: Record<SyncPriority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    }

    operations.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (priorityDiff !== 0) return priorityDiff
      return a.createdAt - b.createdAt
    })

    console.log(`[SyncQueue] Processing ${operations.length} operations...`)

    for (const op of operations) {
      await this.processOperation(op)
    }

    this.notifyListeners()
  }

  /**
   * Process a single operation
   */
  private async processOperation(op: SyncOperation): Promise<void> {
    // Mark as syncing
    await db.syncQueue.update(op.id, { status: 'syncing' as SyncStatus })

    try {
      const response = await fetch(op.endpoint, {
        method: op.method,
        headers: {
          ...getAuthHeaders(),
          ...op.headers,
        },
        body: op.body ? JSON.stringify(op.body) : undefined,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      // Success - remove from queue
      await db.syncQueue.delete(op.id)
      console.log('[SyncQueue] Operation completed:', op.type, op.endpoint)

      // Notify UI
      window.dispatchEvent(
        new CustomEvent<SyncEventDetail>('sync:operation-complete', {
          detail: { operation: op, success: true },
        })
      )
    } catch (error) {
      const newRetries = op.retries + 1
      const errorMessage = (error as Error).message

      console.warn('[SyncQueue] Operation failed:', op.type, errorMessage)

      if (newRetries >= op.maxRetries) {
        // Max retries exceeded
        await db.syncQueue.update(op.id, {
          status: 'failed' as SyncStatus,
          lastError: errorMessage,
          retries: newRetries,
        })

        window.dispatchEvent(
          new CustomEvent<SyncEventDetail>('sync:operation-failed', {
            detail: { operation: op, error: errorMessage },
          })
        )
      } else {
        // Return to pending with increased retry count
        await db.syncQueue.update(op.id, {
          status: 'pending' as SyncStatus,
          lastError: errorMessage,
          retries: newRetries,
        })
      }
    }
  }

  /**
   * Get pending operations count
   */
  async getPendingCount(): Promise<number> {
    return db.syncQueue.where('status').equals('pending').count()
  }

  /**
   * Get failed operations count
   */
  async getFailedCount(): Promise<number> {
    return db.syncQueue.where('status').equals('failed').count()
  }

  /**
   * Get all operations for a user
   */
  async getUserOperations(userId: string): Promise<SyncOperation[]> {
    return db.syncQueue.where('userId').equals(userId).toArray()
  }

  /**
   * Get pending operations (for UI display)
   */
  async getPendingOperations(): Promise<SyncOperation[]> {
    return db.syncQueue.where('status').equals('pending').toArray()
  }

  /**
   * Retry all failed operations
   */
  async retryFailed(): Promise<void> {
    await db.syncQueue
      .where('status')
      .equals('failed')
      .modify({ status: 'pending' as SyncStatus, retries: 0 })

    this.notifyListeners()
    this.processQueue()
  }

  /**
   * Remove an operation
   */
  async removeOperation(id: string): Promise<boolean> {
    const count = await db.syncQueue.where('id').equals(id).delete()
    if (count > 0) {
      this.notifyListeners()
      return true
    }
    return false
  }

  /**
   * Clear all failed operations
   */
  async clearFailed(): Promise<number> {
    const count = await db.syncQueue.where('status').equals('failed').delete()
    this.notifyListeners()
    return count
  }

  /**
   * Clear all operations for a user
   */
  async clearUserQueue(userId: string): Promise<number> {
    const count = await db.syncQueue.where('userId').equals(userId).delete()
    this.notifyListeners()
    return count
  }

  /**
   * Get current queue length (sync version for compatibility)
   */
  getQueueLength(): number {
    // Note: This is a sync method for backward compatibility
    // For accurate count, use getPendingCount() async method
    return 0 // Will be updated via listeners
  }

  /**
   * Clear all pending operations (use with caution)
   */
  async clearQueue(): Promise<void> {
    await db.syncQueue.clear()
    this.notifyListeners()
    console.log('[SyncQueue] Queue cleared')
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const syncQueue = new SyncQueue()

// ============================================================================
// Convenience Functions (Backward Compatible API)
// ============================================================================

/**
 * Add a sync operation (backward compatible)
 * @deprecated Use syncQueue.addOperation() instead
 */
export function addToSyncQueue(
  type: SyncOperationType,
  bookId: string,
  data: Record<string, unknown>
): string {
  // Generate a temporary ID - the real ID will be assigned async
  const tempId = crypto.randomUUID()

  // Get userId from data or use a placeholder
  const userId = (data.userId as string) || 'anonymous'

  // Map old format to new format
  const endpoint = mapTypeToEndpoint(type, bookId, data)
  const method = mapTypeToMethod(type)

  syncQueue.addOperation({
    type,
    endpoint,
    method,
    body: data,
    userId,
    bookId,
    priority: type === 'progress' || type === 'reading_session' ? 'critical' : 'normal',
  })

  return tempId
}

function mapTypeToEndpoint(
  type: SyncOperationType,
  bookId: string,
  data: Record<string, unknown>
): string {
  switch (type) {
    case 'progress':
      return `/api/v1/books/${bookId}/progress`
    case 'reading_session':
      return data.sessionId
        ? `/api/v1/reading-sessions/${data.sessionId}`
        : '/api/v1/reading-sessions'
    case 'bookmark':
      return `/api/v1/books/${bookId}/bookmarks`
    case 'highlight':
      return `/api/v1/books/${bookId}/highlights`
    case 'image_generation':
      return `/api/v1/images/generate/${data.descriptionId}`
    default:
      return `/api/v1/books/${bookId}`
  }
}

function mapTypeToMethod(type: SyncOperationType): 'POST' | 'PUT' {
  switch (type) {
    case 'progress':
      return 'PUT'
    case 'reading_session':
      return 'POST' // Will be PUT if sessionId exists
    default:
      return 'POST'
  }
}

export const processSyncQueue = syncQueue.processQueue.bind(syncQueue)
export const getSyncQueueLength = syncQueue.getQueueLength.bind(syncQueue)
export const subscribeSyncQueue = syncQueue.subscribe.bind(syncQueue)

// ============================================================================
// Specialized Queue Functions
// ============================================================================

/**
 * Queue a reading progress update
 */
export async function queueProgressUpdate(
  userId: string,
  bookId: string,
  data: { chapter: number; cfi?: string; scrollPercent?: number }
): Promise<string> {
  return syncQueue.addOperation({
    type: 'progress',
    endpoint: `/api/v1/books/${bookId}/progress`,
    method: 'PUT',
    body: {
      chapter_number: data.chapter,
      reading_location_cfi: data.cfi,
      scroll_offset_percent: data.scrollPercent,
    },
    userId,
    bookId,
    priority: 'critical',
  })
}

/**
 * Queue a reading session operation
 */
export async function queueReadingSession(
  userId: string,
  bookId: string,
  action: 'start' | 'update' | 'end',
  data?: { sessionId?: string; duration?: number; pagesRead?: number }
): Promise<string> {
  const endpoint =
    action === 'start'
      ? '/api/v1/reading-sessions'
      : `/api/v1/reading-sessions/${data?.sessionId}`

  return syncQueue.addOperation({
    type: 'reading_session',
    endpoint,
    method: action === 'start' ? 'POST' : 'PUT',
    body: {
      book_id: bookId,
      action,
      ...data,
    },
    userId,
    bookId,
    priority: 'critical',
  })
}

/**
 * Queue an image generation request
 */
export async function queueImageGeneration(
  userId: string,
  bookId: string,
  descriptionId: string
): Promise<string> {
  return syncQueue.addOperation({
    type: 'image_generation',
    endpoint: `/api/v1/images/generate/${descriptionId}`,
    method: 'POST',
    userId,
    bookId,
    priority: 'low',
  })
}

// ============================================================================
// Re-export Types
// ============================================================================

export type { SyncOperation, SyncOperationType, SyncPriority, SyncStatus }
