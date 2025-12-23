import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { booksAPI } from '@/api/books';
import { EpubReader } from '@/components/Reader/EpubReader';
import ErrorBoundary from '@/components/ErrorBoundary';

const BookReaderPage = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();

  const { data: bookData, isLoading, error } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => booksAPI.getBook(bookId!),
    enabled: !!bookId,
  });

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

  if (error || !bookData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <p className="text-red-400 mb-4">Ошибка загрузки книги</p>
          <button
            onClick={() => navigate('/library')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Вернуться в библиотеку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-900">
      {/* Reader with integrated header and error protection */}
      <ErrorBoundary
        level="page"
        fallback={
          <div className="flex items-center justify-center h-screen bg-gray-900">
            <div className="text-center max-w-md px-4">
              <div className="text-6xl mb-4">📖</div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Ошибка загрузки читалки
              </h2>
              <p className="text-gray-400 mb-6">
                Не удалось открыть книгу. Попробуйте вернуться в библиотеку и открыть книгу снова.
              </p>
              <button
                onClick={() => navigate('/library')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
