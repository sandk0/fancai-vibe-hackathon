import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { booksAPI } from '@/api/books';
import { EpubReader } from '@/components/Reader/EpubReader';
import { ArrowLeft } from 'lucide-react';

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
    <div className="relative h-screen w-full">
      {/* Header with back button */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gray-800/90 backdrop-blur-sm border-b border-gray-700">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => navigate(`/book/${bookId}`)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Назад к книге</span>
          </button>

          <div className="text-center flex-1 px-4">
            <h1 className="text-lg font-semibold text-white truncate">
              {bookData.title}
            </h1>
            <p className="text-sm text-gray-400 truncate">
              {bookData.author}
            </p>
          </div>

          <div className="w-24"></div> {/* Spacer for balance */}
        </div>
      </div>

      {/* Reader - positioned below header */}
      <div className="pt-20 h-full">
        <EpubReader book={bookData} />
      </div>
    </div>
  );
};

export default BookReaderPage;
