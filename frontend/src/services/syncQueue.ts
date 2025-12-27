/**
 * SyncQueue - Offline-first synchronization queue
 *
 * Queues operations (progress updates, bookmarks, highlights) when offline
 * and synchronizes them when connection is restored.
 *
 * Features:
 * - localStorage persistence
 * - Automatic retry with exponential backoff
 * - Deduplication of duplicate operations
 * - Integration with useOnlineStatus via app:online event
 */

import { ONLINE_EVENT, isOnline } from '@/hooks/useOnlineStatus';

const SYNC_QUEUE_KEY = 'bookreader_sync_queue';
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second base delay

/**
 * Types of operations that can be queued for sync
 */
export type SyncOperationType = 'progress' | 'bookmark' | 'highlight' | 'reading_session';

/**
 * A single sync operation stored in the queue
 */
export interface SyncOperation {
  /** Unique operation ID */
  id: string;
  /** Type of operation */
  type: SyncOperationType;
  /** Associated book ID */
  bookId: string;
  /** Operation-specific data payload */
  data: Record<string, unknown>;
  /** Timestamp when operation was created */
  createdAt: number;
  /** Number of sync attempts */
  retries: number;
  /** Last error message if any */
  lastError?: string;
}

/**
 * Generates a unique ID for sync operations
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * SyncQueue service class
 * Manages offline operation queue and synchronization
 */
class SyncQueueService {
  private queue: SyncOperation[] = [];
  private isProcessing = false;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
    this.setupNetworkListener();
  }

  /**
   * Load queue from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(SYNC_QUEUE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate the data structure
        if (Array.isArray(parsed)) {
          this.queue = parsed.filter(
            (op): op is SyncOperation =>
              op &&
              typeof op.id === 'string' &&
              typeof op.type === 'string' &&
              typeof op.bookId === 'string' &&
              typeof op.createdAt === 'number'
          );
        }
      }
    } catch (e) {
      console.error('[SyncQueue] Failed to load queue from storage:', e);
      this.queue = [];
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.error('[SyncQueue] Failed to save queue to storage:', e);
    }
  }

  /**
   * Notify all listeners of queue changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Add a listener for queue changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Add an operation to the sync queue
   */
  add(
    type: SyncOperationType,
    bookId: string,
    data: Record<string, unknown>
  ): string {
    // For progress updates, replace existing operation for same book to avoid duplicates
    if (type === 'progress') {
      this.queue = this.queue.filter(
        op => !(op.type === 'progress' && op.bookId === bookId)
      );
    }

    const operation: SyncOperation = {
      id: generateId(),
      type,
      bookId,
      data,
      createdAt: Date.now(),
      retries: 0,
    };

    this.queue.push(operation);
    this.saveToStorage();
    this.notifyListeners();

    console.log(`[SyncQueue] Added ${type} operation for book ${bookId}`);

    // Try to process immediately if online
    if (isOnline()) {
      this.processQueue();
    }

    return operation.id;
  }

  /**
   * Process all pending operations in the queue
   */
  async processQueue(): Promise<void> {
    if (!isOnline() || this.queue.length === 0 || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    console.log(`[SyncQueue] Processing ${this.queue.length} pending operations...`);

    // Process operations in order
    const pending = [...this.queue];

    for (const op of pending) {
      try {
        await this.executeOperation(op);

        // Remove successful operation
        this.queue = this.queue.filter(o => o.id !== op.id);
        this.saveToStorage();
        this.notifyListeners();

        console.log(`[SyncQueue] Successfully synced ${op.type} operation ${op.id}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[SyncQueue] Failed to sync operation ${op.id}:`, errorMessage);

        // Update retry count
        const opIndex = this.queue.findIndex(o => o.id === op.id);
        if (opIndex >= 0) {
          this.queue[opIndex].retries++;
          this.queue[opIndex].lastError = errorMessage;

          // Remove if max retries exceeded
          if (this.queue[opIndex].retries >= MAX_RETRIES) {
            console.warn(
              `[SyncQueue] Operation ${op.id} exceeded max retries, removing from queue`
            );
            this.queue = this.queue.filter(o => o.id !== op.id);
          }

          this.saveToStorage();
          this.notifyListeners();
        }

        // Add delay before next operation on error
        await this.delay(RETRY_DELAY_BASE * Math.pow(2, op.retries));
      }
    }

    this.isProcessing = false;
    console.log(`[SyncQueue] Queue processing complete. ${this.queue.length} operations remaining.`);
  }

  /**
   * Execute a single sync operation
   */
  private async executeOperation(op: SyncOperation): Promise<void> {
    // Dynamic import to avoid circular dependencies
    const { booksAPI } = await import('@/api/books');

    switch (op.type) {
      case 'progress':
        await booksAPI.updateProgress(op.bookId, op.data as {
          chapter_number: number;
          position_percent_in_chapter: number;
          reading_location_cfi?: string;
        });
        break;

      case 'bookmark':
        // Future: implement bookmark sync
        console.log('[SyncQueue] Bookmark sync not yet implemented');
        break;

      case 'highlight':
        // Future: implement highlight sync
        console.log('[SyncQueue] Highlight sync not yet implemented');
        break;

      case 'reading_session':
        // Future: implement reading session sync
        console.log('[SyncQueue] Reading session sync not yet implemented');
        break;

      default:
        console.warn(`[SyncQueue] Unknown operation type: ${op.type}`);
    }
  }

  /**
   * Helper for delay between retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Setup listener for network restoration
   */
  private setupNetworkListener(): void {
    window.addEventListener(ONLINE_EVENT, () => {
      console.log('[SyncQueue] Network restored, processing sync queue...');
      this.processQueue();
    });
  }

  /**
   * Get current queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Get all pending operations (for debugging/UI)
   */
  getPendingOperations(): readonly SyncOperation[] {
    return [...this.queue];
  }

  /**
   * Clear all pending operations (use with caution)
   */
  clearQueue(): void {
    this.queue = [];
    this.saveToStorage();
    this.notifyListeners();
    console.log('[SyncQueue] Queue cleared');
  }

  /**
   * Remove a specific operation from the queue
   */
  removeOperation(operationId: string): boolean {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(op => op.id !== operationId);

    if (this.queue.length !== initialLength) {
      this.saveToStorage();
      this.notifyListeners();
      return true;
    }

    return false;
  }
}

// Singleton instance
export const syncQueue = new SyncQueueService();

// Convenience exports
export const addToSyncQueue = syncQueue.add.bind(syncQueue);
export const processSyncQueue = syncQueue.processQueue.bind(syncQueue);
export const getSyncQueueLength = syncQueue.getQueueLength.bind(syncQueue);
export const subscribeSyncQueue = syncQueue.subscribe.bind(syncQueue);
