import { useState, useEffect, useCallback, useRef } from 'react';
import ePub from 'epubjs';
import type { Book, Rendition } from 'epubjs';
import { booksAPI } from '@/api/books';
import { STORAGE_KEYS } from '@/types/state';
import type { BookDetail } from '@/types/api';

interface EpubReaderProps {
  book: BookDetail;
}

export const EpubReader: React.FC<EpubReaderProps> = ({ book }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isReady, setIsReady] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const bookRef = useRef<Book | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const hasRestoredPosition = useRef(false);

  // Инициализация epub.js и загрузка книги
  useEffect(() => {
    if (!isReady) {
      console.log('⏳ Component not ready yet');
      return;
    }

    const initEpub = async () => {
      if (!viewerRef.current) {
        console.error('❌ Viewer ref is null');
        setError('Viewer container not found');
        return;
      }

      try {
        console.log('📥 Downloading EPUB file...');

        // Загружаем файл через fetch (с авторизацией)
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        const response = await fetch(booksAPI.getBookFileUrl(book.id), {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to download EPUB: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        console.log('✅ EPUB file downloaded successfully', {
          size: arrayBuffer.byteLength
        });

        // Инициализируем epub.js напрямую с ArrayBuffer
        const epubBook = ePub(arrayBuffer);
        bookRef.current = epubBook;

        // Создаем rendition
        const rendition = epubBook.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none',
        });
        renditionRef.current = rendition;

        // Применяем темную тему
        rendition.themes.default({
          body: {
            color: '#e5e7eb !important',
            background: '#1f2937 !important',
            'font-family': 'Georgia, serif !important',
            'font-size': '1.1em !important',
            'line-height': '1.6 !important',
          },
          p: {
            'margin-bottom': '1em !important',
          },
          a: {
            color: '#60a5fa !important',
          },
        });

        // Генерируем locations для отслеживания прогресса
        console.log('📊 Generating locations for progress tracking...');
        await epubBook.locations.generate(1024); // 1024 символов на "страницу"
        console.log('✅ Locations generated:', epubBook.locations.total);

        // Загружаем прогресс чтения
        const { progress } = await booksAPI.getReadingProgress(book.id);

        if (progress?.reading_location_cfi) {
          console.log('📖 Restoring reading position:', progress.reading_location_cfi);
          await rendition.display(progress.reading_location_cfi);
        } else {
          await rendition.display();
        }

        hasRestoredPosition.current = true;

        // Обработчик изменения позиции
        rendition.on('relocated', async (location: any) => {
          if (!hasRestoredPosition.current) {
            console.log('⏳ Skipping save - waiting for position restoration');
            return;
          }

          const cfi = location.start.cfi;

          // Получаем прогресс из epub.js
          const currentLocation = epubBook.locations.percentageFromCfi(cfi);
          const progressPercent = Math.round((currentLocation || 0) * 100);

          console.log('📍 Location changed:', {
            cfi: cfi.substring(0, 50),
            progress: progressPercent + '%'
          });

          // Debounced сохранение
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }

          saveTimeoutRef.current = setTimeout(async () => {
            try {
              await booksAPI.updateReadingProgress(book.id, {
                current_chapter: 1,
                current_position_percent: progressPercent,
                reading_location_cfi: cfi,
              });
              console.log('💾 Reading progress saved:', {
                cfi: cfi.substring(0, 50),
                progress: progressPercent + '%'
              });
            } catch (error) {
              console.error('❌ Error saving reading progress:', error);
            }
          }, 2000);
        });

        console.log('✅ EPUB reader initialized');
        setIsLoading(false);
      } catch (err) {
        console.error('❌ Error initializing EPUB reader:', err);
        setError(err instanceof Error ? err.message : 'Error loading book');
        setIsLoading(false);
      }
    };

    initEpub();

    // Cleanup
    return () => {
      if (renditionRef.current) {
        renditionRef.current.destroy();
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [book.id, isReady]);

  // Устанавливаем isReady после первого рендера
  useEffect(() => {
    // Небольшая задержка чтобы убедиться что DOM готов
    const timer = setTimeout(() => {
      console.log('🎯 Setting ready state, viewerRef:', !!viewerRef.current);
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Навигация
  const handlePrevPage = useCallback(() => {
    if (renditionRef.current) {
      renditionRef.current.prev();
    }
  }, []);

  const handleNextPage = useCallback(() => {
    if (renditionRef.current) {
      renditionRef.current.next();
    }
  }, []);

  return (
    <div className="relative h-full w-full bg-gray-900">
      {/* EPUB Viewer - всегда рендерится */}
      <div ref={viewerRef} className="h-full w-full" />

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <p className="text-red-400 mb-4">Ошибка загрузки книги</p>
            <p className="text-gray-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-300">Загрузка книги...</p>
          </div>
        </div>
      )}

      {/* Navigation arrows - показываем только после загрузки */}
      {!isLoading && !error && (
        <>
          <button
            onClick={handlePrevPage}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full flex items-center justify-center transition-colors"
            aria-label="Previous page"
          >
            ←
          </button>
          <button
            onClick={handleNextPage}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-gray-800/80 hover:bg-gray-700 text-white rounded-full flex items-center justify-center transition-colors"
            aria-label="Next page"
          >
            →
          </button>
        </>
      )}
    </div>
  );
};
