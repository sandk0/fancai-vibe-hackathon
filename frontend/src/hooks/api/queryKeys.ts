/**
 * Centralized Query Keys для TanStack Query
 *
 * Все query keys для BookReader AI в одном месте.
 * Позволяет легко управлять инвалидацией и предотвращает опечатки.
 *
 * Паттерн: иерархические массивы для точного контроля
 * Пример: ['books'] -> ['books', bookId] -> ['books', bookId, 'chapters', chapterNumber]
 *
 * @module hooks/api/queryKeys
 */

/**
 * Query keys для работы с книгами
 */
export const bookKeys = {
  /**
   * Базовый ключ для всех книг
   */
  all: ['books'] as const,

  /**
   * Список книг с опциональными параметрами
   * @param params - Параметры пагинации и сортировки
   */
  list: (params?: { skip?: number; limit?: number; sort_by?: string }) =>
    [...bookKeys.all, 'list', params] as const,

  /**
   * Детали конкретной книги
   * @param bookId - ID книги
   */
  detail: (bookId: string) => [...bookKeys.all, bookId] as const,

  /**
   * Прогресс чтения книги
   * @param bookId - ID книги
   */
  progress: (bookId: string) => [...bookKeys.all, bookId, 'progress'] as const,

  /**
   * Статус парсинга книги
   * @param bookId - ID книги
   */
  parsingStatus: (bookId: string) =>
    [...bookKeys.all, bookId, 'parsing-status'] as const,

  /**
   * Статистика пользователя по чтению
   */
  statistics: () => [...bookKeys.all, 'statistics'] as const,

  /**
   * URL файла книги для EPUB reader
   * @param bookId - ID книги
   */
  fileUrl: (bookId: string) => [...bookKeys.all, bookId, 'file'] as const,
};

/**
 * Query keys для работы с главами
 */
export const chapterKeys = {
  /**
   * Базовый ключ для всех глав
   */
  all: ['chapters'] as const,

  /**
   * Главы конкретной книги
   * @param bookId - ID книги
   */
  byBook: (bookId: string) => [...chapterKeys.all, 'book', bookId] as const,

  /**
   * Конкретная глава
   * @param bookId - ID книги
   * @param chapterNumber - Номер главы
   */
  detail: (bookId: string, chapterNumber: number) =>
    [...chapterKeys.byBook(bookId), chapterNumber] as const,

  /**
   * Навигация по главам
   * @param bookId - ID книги
   * @param chapterNumber - Номер главы
   */
  navigation: (bookId: string, chapterNumber: number) =>
    [...chapterKeys.detail(bookId, chapterNumber), 'navigation'] as const,
};

/**
 * Query keys для работы с описаниями
 */
export const descriptionKeys = {
  /**
   * Базовый ключ для всех описаний
   */
  all: ['descriptions'] as const,

  /**
   * Описания конкретной главы
   * @param bookId - ID книги
   * @param chapterNumber - Номер главы
   */
  byChapter: (bookId: string, chapterNumber: number) =>
    [...descriptionKeys.all, 'book', bookId, 'chapter', chapterNumber] as const,

  /**
   * Описания книги (все главы)
   * @param bookId - ID книги
   */
  byBook: (bookId: string) =>
    [...descriptionKeys.all, 'book', bookId] as const,

  /**
   * NLP анализ главы
   * @param bookId - ID книги
   * @param chapterNumber - Номер главы
   */
  nlpAnalysis: (bookId: string, chapterNumber: number) =>
    [...descriptionKeys.byChapter(bookId, chapterNumber), 'nlp'] as const,
};

/**
 * Query keys для работы с изображениями
 */
export const imageKeys = {
  /**
   * Базовый ключ для всех изображений
   */
  all: ['images'] as const,

  /**
   * Изображения конкретной книги
   * @param bookId - ID книги
   * @param chapterNumber - Опциональный номер главы для фильтрации
   */
  byBook: (bookId: string, chapterNumber?: number) =>
    chapterNumber !== undefined
      ? [...imageKeys.all, 'book', bookId, 'chapter', chapterNumber] as const
      : [...imageKeys.all, 'book', bookId] as const,

  /**
   * Изображение для конкретного описания
   * @param descriptionId - ID описания
   */
  byDescription: (descriptionId: string) =>
    [...imageKeys.all, 'description', descriptionId] as const,

  /**
   * Статус генерации изображений
   */
  generationStatus: () => [...imageKeys.all, 'generation', 'status'] as const,

  /**
   * Статистика пользователя по изображениям
   */
  userStats: () => [...imageKeys.all, 'user', 'stats'] as const,

  /**
   * Админ-статистика по изображениям
   */
  adminStats: () => [...imageKeys.all, 'admin', 'stats'] as const,
};

/**
 * Utility функции для работы с query keys
 */
export const queryKeyUtils = {
  /**
   * Инвалидация всех запросов связанных с книгой
   * @param bookId - ID книги
   */
  invalidateBook: (bookId: string) => [
    bookKeys.detail(bookId),
    bookKeys.progress(bookId),
    chapterKeys.byBook(bookId),
    descriptionKeys.byBook(bookId),
    imageKeys.byBook(bookId),
  ],

  /**
   * Инвалидация всех запросов связанных с главой
   * @param bookId - ID книги
   * @param chapterNumber - Номер главы
   */
  invalidateChapter: (bookId: string, chapterNumber: number) => [
    chapterKeys.detail(bookId, chapterNumber),
    descriptionKeys.byChapter(bookId, chapterNumber),
  ],

  /**
   * Инвалидация после загрузки новой книги
   */
  invalidateAfterUpload: () => [bookKeys.list(), bookKeys.statistics()],

  /**
   * Инвалидация после удаления книги
   * @param bookId - ID удаленной книги
   */
  invalidateAfterDelete: (bookId: string) => [
    bookKeys.list(),
    bookKeys.detail(bookId),
    bookKeys.statistics(),
    chapterKeys.byBook(bookId),
    descriptionKeys.byBook(bookId),
    imageKeys.byBook(bookId),
  ],

  /**
   * Инвалидация после генерации изображения
   * @param bookId - ID книги
   * @param descriptionId - ID описания
   */
  invalidateAfterImageGeneration: (bookId: string, descriptionId: string) => [
    imageKeys.byBook(bookId),
    imageKeys.byDescription(descriptionId),
    imageKeys.userStats(),
  ],
};
