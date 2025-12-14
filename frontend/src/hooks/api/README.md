# React Query Hooks для BookReader AI

Современные React Query хуки для управления server state в BookReader AI frontend.

## Особенности

- ✅ **Автоматическое кэширование** - данные кэшируются в памяти с настраиваемым `staleTime`
- ✅ **Offline поддержка** - интеграция с IndexedDB (chapterCache, imageCache)
- ✅ **Оптимистичные обновления** - UI обновляется мгновенно при мутациях
- ✅ **Prefetching** - автоматическая предзагрузка следующих данных
- ✅ **TypeScript** - полная типизация с type inference
- ✅ **Централизованные query keys** - управление инвалидацией

## Установка

Хуки уже установлены и готовы к использованию. TanStack Query настроен в `App.tsx`.

## Использование

### Импорт

```tsx
import {
  useBooks,
  useBook,
  useChapter,
  useGenerateImage,
  // ... и другие
} from '@/hooks/api';
```

### Примеры

#### 1. Получение списка книг

```tsx
import { useBooks } from '@/hooks/api';

function LibraryPage() {
  const { data, isLoading, error } = useBooks({
    skip: 0,
    limit: 20,
    sort_by: 'created_desc',
  });

  if (isLoading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error.message}</div>;

  return (
    <div>
      <h1>Библиотека ({data.total} книг)</h1>
      {data.books.map(book => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}
```

#### 2. Infinite scroll для книг

```tsx
import { useBooksInfinite } from '@/hooks/api';

function LibraryInfinite() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useBooksInfinite({ limit: 20 });

  return (
    <div>
      {data?.pages.map((page, i) => (
        <div key={i}>
          {page.books.map(book => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      ))}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Загрузка...' : 'Загрузить ещё'}
        </button>
      )}
    </div>
  );
}
```

#### 3. Загрузка книги (мутация)

```tsx
import { useUploadBook } from '@/hooks/api';
import { useState } from 'react';

function UploadButton() {
  const [progress, setProgress] = useState(0);
  const uploadMutation = useUploadBook();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadMutation.mutateAsync({
        file,
        onProgress: (percent) => setProgress(percent),
      });
      console.log('Книга загружена:', result.book.title);
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    }
  };

  return (
    <div>
      <input type="file" accept=".epub,.fb2" onChange={handleFileSelect} />
      {uploadMutation.isPending && <div>Прогресс: {progress}%</div>}
      {uploadMutation.isError && <div>Ошибка: {uploadMutation.error.message}</div>}
    </div>
  );
}
```

#### 4. Чтение главы с prefetching

```tsx
import { useChapter } from '@/hooks/api';

function ChapterViewer({ bookId, chapterNumber }: Props) {
  const { data, isLoading } = useChapter(bookId, chapterNumber);

  if (isLoading) return <div>Загрузка главы...</div>;
  if (!data) return null;

  // Автоматически prefetch'атся соседние главы!
  return (
    <div>
      <h1>{data.chapter.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: data.chapter.content }} />

      {/* Navigation */}
      {data.navigation.has_previous && (
        <button onClick={() => navigate(data.navigation.previous_chapter!)}>
          Предыдущая глава
        </button>
      )}
      {data.navigation.has_next && (
        <button onClick={() => navigate(data.navigation.next_chapter!)}>
          Следующая глава
        </button>
      )}
    </div>
  );
}
```

#### 5. Генерация изображения

```tsx
import { useGenerateImage } from '@/hooks/api';

function GenerateImageButton({ descriptionId }: Props) {
  const generateMutation = useGenerateImage();

  const handleGenerate = async () => {
    try {
      const result = await generateMutation.mutateAsync({
        descriptionId,
        params: {
          style_prompt: 'oil painting, realistic',
          negative_prompt: 'blurry, low quality',
        },
      });
      console.log('Изображение сгенерировано:', result.image_url);
    } catch (error) {
      console.error('Ошибка генерации:', error);
    }
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={generateMutation.isPending}
    >
      {generateMutation.isPending ? 'Генерация...' : 'Сгенерировать изображение'}
    </button>
  );
}
```

#### 6. Удаление книги с оптимистичным обновлением

```tsx
import { useDeleteBook } from '@/hooks/api';

function DeleteBookButton({ bookId }: Props) {
  const deleteMutation = useDeleteBook();

  const handleDelete = async () => {
    if (!confirm('Удалить книгу?')) return;

    // UI обновится мгновенно (оптимистично)
    // Если произойдет ошибка, изменения откатятся
    try {
      await deleteMutation.mutateAsync(bookId);
    } catch (error) {
      console.error('Ошибка удаления:', error);
    }
  };

  return (
    <button onClick={handleDelete} disabled={deleteMutation.isPending}>
      Удалить
    </button>
  );
}
```

#### 7. Обновление прогресса чтения

```tsx
import { useUpdateReadingProgress } from '@/hooks/api';
import { useEffect } from 'react';

function EPUBReader({ bookId }: Props) {
  const updateProgressMutation = useUpdateReadingProgress();

  // Сохраняем прогресс при изменении позиции
  const handlePositionChange = async (cfi: string, chapter: number) => {
    await updateProgressMutation.mutateAsync({
      bookId,
      current_chapter: chapter,
      current_position_percent: 50, // Пример
      reading_location_cfi: cfi,
    });
  };

  // Прогресс обновится оптимистично
  // Кэш автоматически синхронизируется
  return (
    <div>
      {/* EPUB reader implementation */}
    </div>
  );
}
```

## Доступные хуки

### Books

- `useBooks(params?, options?)` - список книг с пагинацией
- `useBooksInfinite(params?, options?)` - infinite scroll
- `useBook(bookId, options?)` - детали книги
- `useReadingProgress(bookId, options?)` - прогресс чтения
- `useUserStatistics(options?)` - статистика пользователя
- `useUploadBook(options?)` - загрузка книги (мутация)
- `useDeleteBook(options?)` - удаление книги (мутация)
- `useUpdateReadingProgress(options?)` - обновление прогресса (мутация)
- `useBookFileUrl(bookId)` - URL файла книги

### Chapters

- `useChapter(bookId, chapterNumber, options?)` - глава с автоматическим prefetch
- `useChapterContent(bookId, chapterNumber, options?)` - только контент главы
- `useChapterNavigation(bookId, chapterNumber, options?)` - навигация
- `usePrefetchChapter()` - утилита для ручного prefetch

### Descriptions

- `useChapterDescriptions(bookId, chapterNumber, options?)` - описания главы
- `useDescriptionsList(bookId, chapterNumber, options?)` - только массив
- `useDescriptionsByType(bookId, chapterNumber, types, options?)` - фильтрация по типу
- `useNLPAnalysis(bookId, chapterNumber, options?)` - NLP анализ
- `useBookDescriptions(bookId, options?)` - все описания книги
- `useReextractDescriptions(bookId, chapterNumber, options?)` - переэкстракция

### Images

- `useBookImages(bookId, chapterNumber?, pagination?, options?)` - изображения книги
- `useImageForDescription(descriptionId, options?)` - изображение для описания
- `useGenerateImage(options?)` - генерация изображения (мутация)
- `useBatchGenerateImages(options?)` - batch генерация (мутация)
- `useDeleteImage(options?)` - удаление изображения (мутация)
- `useRegenerateImage(options?)` - регенерация изображения (мутация)
- `useGenerationStatus(options?)` - статус генерации
- `useImageUserStats(options?)` - статистика пользователя

## Query Keys

Централизованное управление через `queryKeys`:

```tsx
import { bookKeys, chapterKeys, descriptionKeys, imageKeys, queryKeyUtils } from '@/hooks/api';

// Примеры использования query keys
const bookListKey = bookKeys.list({ skip: 0, limit: 20 });
const bookDetailKey = bookKeys.detail('book-123');
const chapterKey = chapterKeys.detail('book-123', 5);

// Утилиты для инвалидации
queryClient.invalidateQueries({ queryKey: bookKeys.all });
queryClient.invalidateQueries({ queryKey: chapterKeys.byBook('book-123') });

// Групповая инвалидация
queryKeyUtils.invalidateBook('book-123').forEach(key => {
  queryClient.invalidateQueries({ queryKey: key });
});
```

## Настройки кэша

### Текущие staleTime значения:

- **Books list**: 30 секунд (часто обновляется)
- **Book details**: 5 минут (редко меняется)
- **Chapters**: 10 минут (почти не меняются)
- **Descriptions**: 15 минут (статичные данные)
- **Images**: 30 минут (не меняются после создания)
- **Reading progress**: 1 минута (часто обновляется)

### Кастомизация:

```tsx
const { data } = useBooks(
  { limit: 20 },
  {
    staleTime: 60 * 1000, // 1 минута
    cacheTime: 5 * 60 * 1000, // 5 минут
    refetchOnMount: true,
  }
);
```

## Offline поддержка

Хуки автоматически интегрируются с IndexedDB:

- **chapterCache** - кэширует главы и descriptions
- **imageCache** - кэширует изображения как Blob

```tsx
// Данные загружаются из IndexedDB если доступны
const { data } = useChapter(bookId, chapterNumber);
// 1. Проверяет IndexedDB
// 2. Если есть - возвращает мгновенно
// 3. Если нет - загружает с API и кэширует
```

## Тестирование

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { useBooks } from '@/hooks/api';

test('useBooks loads books', async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  const { result } = renderHook(() => useBooks(), { wrapper });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.books).toBeDefined();
});
```

## Миграция с Zustand

Старые Zustand stores (`useBooksStore`) остаются работать рядом с новыми хуками.

### До:
```tsx
import { useBooksStore } from '@/stores/books';

const { books, fetchBooks, isLoading } = useBooksStore();

useEffect(() => {
  fetchBooks();
}, []);
```

### После:
```tsx
import { useBooks } from '@/hooks/api';

const { data, isLoading } = useBooks();
// Данные загружаются автоматически!
// Кэшируются автоматически!
```

## Best Practices

1. **Не вызывайте query функции вручную** - данные загружаются автоматически
2. **Используйте enabled опцию** для conditional fetching
3. **Prefetch следующих данных** для лучшего UX
4. **Оптимистичные обновления** для мутаций
5. **Централизованные query keys** для управления

## Документация

- [TanStack Query Docs](https://tanstack.com/query/latest)
- [CLAUDE.md](../../../CLAUDE.md) - общая документация проекта

## Лицензия

Часть проекта BookReader AI.
