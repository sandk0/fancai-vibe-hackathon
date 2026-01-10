// src/services/db.ts
// Централизованная база данных Dexie.js для offline функциональности PWA
import Dexie, { type EntityTable } from 'dexie'

// ============================================================================
// Типы сущностей
// ============================================================================

/** Метаданные книги для offline хранения */
export interface BookMetadata {
  title: string
  author: string
  coverUrl: string | null
  totalChapters: number
  fileSize: number
  genre: string | null
  language: string
}

/** Книга, доступная offline */
export interface OfflineBook {
  /** Композитный ключ: `${userId}:${bookId}` */
  id: string
  userId: string
  bookId: string
  metadata: BookMetadata
  downloadedAt: number
  lastAccessedAt: number
  /** Прогресс загрузки 0-100 */
  downloadProgress: number
  status: 'downloading' | 'complete' | 'partial' | 'error'
}

/** Описание из книги */
export interface CachedDescription {
  id: string
  content: string
  type: 'scene' | 'character' | 'setting' | 'object'
  confidence: number
  imageUrl: string | null
  imageStatus: 'none' | 'pending' | 'generated' | 'error'
}

/** Кэшированная глава книги */
export interface CachedChapter {
  /** Композитный ключ: `${userId}:${bookId}:${chapterNumber}` */
  id: string
  userId: string
  bookId: string
  chapterNumber: number
  title: string
  /** HTML контент главы */
  content: string
  /** Извлечённые описания */
  descriptions: CachedDescription[]
  wordCount: number
  cachedAt: number
  lastAccessedAt: number
}

/** Кэшированное изображение (blob) */
export interface CachedImage {
  /** Композитный ключ: `${userId}:${descriptionId}` */
  id: string
  userId: string
  descriptionId: string
  bookId: string
  /** Бинарные данные изображения */
  blob: Blob
  mimeType: string
  /** Размер в байтах */
  size: number
  cachedAt: number
}

/** Тип операции синхронизации */
export type SyncOperationType =
  | 'progress' // Позиция чтения
  | 'bookmark' // Закладки
  | 'highlight' // Выделения
  | 'reading_session' // Сессии чтения
  | 'image_generation' // Запросы генерации изображений

/** Приоритет операции синхронизации */
export type SyncPriority = 'critical' | 'high' | 'normal' | 'low'

/** Статус операции синхронизации */
export type SyncStatus = 'pending' | 'syncing' | 'failed'

/** Операция в очереди синхронизации */
export interface SyncOperation {
  id: string
  type: SyncOperationType
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  userId: string
  bookId?: string
  priority: SyncPriority
  createdAt: number
  retries: number
  maxRetries: number
  lastError?: string
  status: SyncStatus
}

/** Прогресс чтения для offline */
export interface OfflineReadingProgress {
  /** Композитный ключ: `${userId}:${bookId}` */
  id: string
  userId: string
  bookId: string
  chapterNumber: number
  /** CFI позиция в EPUB */
  cfi: string | null
  /** Процент прокрутки */
  scrollPercent: number
  updatedAt: number
  /** Синхронизирован с сервером */
  synced: boolean
}

// ============================================================================
// База данных Dexie
// ============================================================================

/**
 * Централизованная база данных для PWA offline функциональности.
 *
 * Таблицы:
 * - offlineBooks: Метаданные книг для offline
 * - chapters: Кэшированный контент глав
 * - images: Кэшированные изображения (blob)
 * - syncQueue: Очередь операций для синхронизации
 * - readingProgress: Offline прогресс чтения
 */
class FancaiDatabase extends Dexie {
  offlineBooks!: EntityTable<OfflineBook, 'id'>
  chapters!: EntityTable<CachedChapter, 'id'>
  images!: EntityTable<CachedImage, 'id'>
  syncQueue!: EntityTable<SyncOperation, 'id'>
  readingProgress!: EntityTable<OfflineReadingProgress, 'id'>

  constructor() {
    super('FancaiDB')

    this.version(1).stores({
      // Книги: поиск по userId, bookId, статусу, дате доступа
      offlineBooks: 'id, userId, bookId, status, lastAccessedAt',

      // Главы: поиск по userId+bookId, полный ключ, дата доступа
      chapters: 'id, [userId+bookId], [userId+bookId+chapterNumber], lastAccessedAt',

      // Изображения: поиск по userId, bookId, descriptionId, дате кэширования
      images: 'id, userId, bookId, descriptionId, cachedAt',

      // Очередь синхронизации: поиск по userId, типу, приоритету, статусу, дате
      syncQueue: 'id, userId, type, priority, status, createdAt',

      // Прогресс чтения: поиск по userId, bookId
      readingProgress: 'id, userId, bookId, updatedAt, synced',
    })
  }
}

// ============================================================================
// Экспорт singleton
// ============================================================================

/** Singleton экземпляр базы данных */
export const db = new FancaiDatabase()

// ============================================================================
// Обработчики событий базы данных
// ============================================================================

const DB_NAME = 'FancaiDB'
const isDev = import.meta.env.DEV

/**
 * Handle database blocked event.
 * Occurs when another tab has an older version of the database open.
 */
db.on('blocked', () => {
  console.warn('[DB] Database blocked - please close other tabs with this app')
  // In production, could show a toast notification to the user
})

/**
 * Handle version change event.
 * Occurs when another tab upgraded the database schema.
 */
db.on('versionchange', () => {
  console.warn('[DB] Database version change detected - reloading')
  db.close()
  window.location.reload()
})

/**
 * Open the database and handle errors with recovery.
 * This ensures the database is ready before use.
 */
db.open().catch((err: Error & { name?: string }) => {
  console.error('[DB] Failed to open database:', err)

  // Try to recover from version/state errors
  if (err.name === 'VersionError' || err.name === 'InvalidStateError') {
    if (isDev) {
      console.warn('[DB] Attempting recovery by deleting and recreating database')
    }
    // Note: This is a last resort - user will lose local data
    indexedDB.deleteDatabase(DB_NAME)
    window.location.reload()
  }
})

// ============================================================================
// Вспомогательные функции
// ============================================================================

/**
 * Генерирует ID для OfflineBook
 */
export function createOfflineBookId(userId: string, bookId: string): string {
  return `${userId}:${bookId}`
}

/**
 * Генерирует ID для CachedChapter
 */
export function createChapterId(
  userId: string,
  bookId: string,
  chapterNumber: number
): string {
  return `${userId}:${bookId}:${chapterNumber}`
}

/**
 * Генерирует ID для CachedImage
 */
export function createImageId(userId: string, descriptionId: string): string {
  return `${userId}:${descriptionId}`
}

/**
 * Генерирует ID для ReadingProgress
 */
export function createProgressId(userId: string, bookId: string): string {
  return `${userId}:${bookId}`
}

/**
 * Парсит композитный ID книги
 */
export function parseOfflineBookId(
  id: string
): { userId: string; bookId: string } | null {
  const parts = id.split(':')
  if (parts.length !== 2) return null
  return { userId: parts[0], bookId: parts[1] }
}

/**
 * Парсит композитный ID главы
 */
export function parseChapterId(
  id: string
): { userId: string; bookId: string; chapterNumber: number } | null {
  const parts = id.split(':')
  if (parts.length !== 3) return null
  const chapterNumber = parseInt(parts[2], 10)
  if (isNaN(chapterNumber)) return null
  return { userId: parts[0], bookId: parts[1], chapterNumber }
}

// ============================================================================
// Константы
// ============================================================================

/** Максимальный размер кэша в байтах (1 ГБ) */
export const MAX_CACHE_SIZE = 1 * 1024 * 1024 * 1024

/** Порог предупреждения (80%) */
export const STORAGE_WARNING_THRESHOLD = 0.8

/** Критический порог (95%) */
export const STORAGE_CRITICAL_THRESHOLD = 0.95

/** Максимальное количество повторных попыток синхронизации */
export const MAX_SYNC_RETRIES = 5

/** TTL для кэша глав (7 дней в мс) */
export const CHAPTER_CACHE_TTL = 7 * 24 * 60 * 60 * 1000

/** TTL для кэша изображений (30 дней в мс) */
export const IMAGE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000
