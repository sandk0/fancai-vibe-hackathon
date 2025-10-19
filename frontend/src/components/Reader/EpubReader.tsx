import { useState, useEffect, useCallback, useRef } from 'react';
import { ReactReader } from 'react-reader';
import { booksAPI } from '@/api/books';
import type { BookDetail } from '@/types/api';

interface EpubReaderProps {
  book: BookDetail;
}

export const EpubReader: React.FC<EpubReaderProps> = ({ book }) => {
  const [location, setLocation] = useState<string | number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const hasRestoredPosition = useRef(false);

  const epubUrl = booksAPI.getBookFileUrl(book.id);

  // Загрузить сохраненную позицию при монтировании
  useEffect(() => {
    const loadProgress = async () => {
      try {
        const { progress } = await booksAPI.getReadingProgress(book.id);

        if (progress?.reading_location_cfi) {
          console.log('📖 Restoring reading position:', progress.reading_location_cfi);
          setLocation(progress.reading_location_cfi);
        }

        hasRestoredPosition.current = true;
      } catch (error) {
        console.error('❌ Error loading reading progress:', error);
        hasRestoredPosition.current = true;
      } finally {
        setIsLoading(false);
      }
    };

    loadProgress();
  }, [book.id]);

  // Debounced сохранение позиции чтения
  const saveProgress = useCallback(
    (cfi: string) => {
      // Очистить предыдущий таймер
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Установить новый таймер для сохранения через 2 секунды
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await booksAPI.updateReadingProgress(book.id, {
            current_chapter: 1, // epub.js автоматически управляет главами
            current_position_percent: 0, // CFI важнее для точного позиционирования
            reading_location_cfi: cfi,
          });
          console.log('💾 Reading progress saved:', cfi);
        } catch (error) {
          console.error('❌ Error saving reading progress:', error);
        }
      }, 2000);
    },
    [book.id]
  );

  // Обработчик изменения позиции
  const handleLocationChange = useCallback(
    (epubcfi: string) => {
      // Не сохранять до восстановления позиции
      if (!hasRestoredPosition.current) {
        console.log('⏳ Skipping save - waiting for position restoration');
        return;
      }

      console.log('📍 Location changed:', epubcfi);
      setLocation(epubcfi);
      saveProgress(epubcfi);
    },
    [saveProgress]
  );

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-300">Загрузка книги...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-gray-900">
      <ReactReader
        url={epubUrl}
        location={location}
        locationChanged={handleLocationChange}
        getRendition={(rendition) => {
          // Здесь можно добавить кастомизацию rendition
          // Например, для инжектирования стилей или обработчиков изображений

          // Установить тему оформления
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

          console.log('✅ EPUB rendition ready');
        }}
      />
    </div>
  );
};
