import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { booksAPI } from '@/api/books';
import { EpubReader } from '@/components/Reader/EpubReader';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useParsingStatus } from '@/hooks/api';

const BookReaderPage = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();

  const { data: bookData, isLoading, error } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => booksAPI.getBook(bookId!),
    enabled: !!bookId,
  });

  // Track parsing status and invalidate caches when parsing completes
  // This ensures descriptions are immediately available after background parsing
  const { isParsing, progress } = useParsingStatus({
    bookId: bookId || '',
    enabled: !!bookId && !!bookData,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Загрузка книги...</p>
        </div>
      </div>
    );
  }

  if (error || !bookData) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <p className="text-destructive mb-4">Ошибка загрузки книги</p>
          <button
            onClick={() => navigate('/library')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Вернуться в библиотеку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-background"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Parsing Status Indicator - shown while Celery is processing */}
      {isParsing && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-primary/90 backdrop-blur-sm text-primary-foreground text-sm flex items-center gap-2 shadow-lg"
          style={{ bottom: 'calc(20px + env(safe-area-inset-bottom))' }}
        >
          <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          <span>Подготовка книги... {progress}%</span>
        </div>
      )}

      {/* Reader with integrated header and error protection */}
      <ErrorBoundary
        level="page"
        fallback={
          <div className="flex items-center justify-center h-screen bg-background">
            <div className="text-center max-w-md px-4">
              <div className="text-6xl mb-4">📖</div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Ошибка загрузки читалки
              </h2>
              <p className="text-muted-foreground mb-6">
                Не удалось открыть книгу. Попробуйте вернуться в библиотеку и открыть книгу снова.
              </p>
              <button
                onClick={() => navigate('/library')}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Вернуться в библиотеку
              </button>
            </div>
          </div>
        }
      >
        <EpubReader book={bookData} />
      </ErrorBoundary>
    </div>
  );
};

export default BookReaderPage;
