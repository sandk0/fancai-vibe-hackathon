/**
 * BookPage - Modern redesign with shadcn UI
 *
 * Features:
 * - Gradient hero with book cover
 * - Large action buttons
 * - Stats cards (Chapters, Progress, Images)
 * - Modern chapters list
 * - Reading progress visualization
 * - Fully theme-aware
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Book,
  BookOpen,
  Clock,
  User,
  ArrowLeft,
  Play,
  Image as ImageIcon,
  FileText,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { booksAPI } from '@/api/books';
import { AuthenticatedImage } from '@/components/UI/AuthenticatedImage';

const BookPage: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();

  // FIX: Always get fresh progress data, even after quick reader exit
  const { data: book, isLoading, error } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => booksAPI.getBook(bookId!),
    enabled: !!bookId,
    refetchOnMount: 'always', // CRITICAL: Always refetch, even if data is fresh
    staleTime: 0, // Data becomes stale immediately to force refetch
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" aria-busy="true" aria-live="polite">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 mb-4 border-primary" aria-hidden="true"></div>
          <p className="text-muted-foreground">Загрузка книги...</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-muted">
            <Book className="w-10 h-10 text-muted-foreground/70" />
          </div>
          <h1 className="text-3xl font-bold mb-3 text-foreground">
            Книга не найдена
          </h1>
          <p className="mb-6 max-w-sm mx-auto text-muted-foreground">
            Запрошенная книга не существует или была удалена
          </p>
          <button
            onClick={() => navigate('/library')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105 bg-primary text-primary-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
            Вернуться в библиотеку
          </button>
        </div>
      </div>
    );
  }

  const totalDescriptions = book.chapters.reduce(
    (sum, ch) => sum + (ch.descriptions_found || 0),
    0
  );
  const parsedChapters = book.chapters.filter(ch => ch.is_description_parsed).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate('/library')}
        className="inline-flex items-center gap-2 mb-6 min-h-[44px] py-2.5 px-4 -ml-4 rounded-lg transition-colors text-muted-foreground hover:bg-muted/50"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hover:underline">Назад в библиотеку</span>
      </button>

      {/* Hero Section */}
      <div className="relative mb-6 sm:mb-8 lg:mb-12 overflow-hidden rounded-xl">
        <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-primary to-purple-500/50" />
        <div className="relative">
          <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8 p-4 sm:p-6 lg:p-12">
            {/* Book Cover */}
            <div className="flex-shrink-0">
              <div className="w-36 h-52 sm:w-48 sm:h-72 lg:w-64 lg:h-96 rounded-xl shadow-2xl overflow-hidden mx-auto lg:mx-0 bg-muted">
                <AuthenticatedImage
                  src={
                    book.has_cover
                      ? `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/books/${book.id}/cover`
                      : null
                  }
                  alt={`${book.title} cover`}
                  className="w-full h-full object-cover"
                  fallback={
                    <div className="w-full h-full flex items-center justify-center">
                      <Book className="w-16 h-16 text-muted-foreground/70" />
                    </div>
                  }
                />
              </div>
            </div>

            {/* Book Info */}
            <div className="flex-1 text-center lg:text-left">
              <h1 className="fluid-h1 font-bold mb-2 sm:mb-4 text-foreground">
                {book.title}
              </h1>

              <div className="flex items-center justify-center lg:justify-start gap-2 mb-4 sm:mb-6 text-muted-foreground">
                <User className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-base sm:text-lg">{book.author}</span>
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-2 sm:gap-4 mb-6 sm:mb-8 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  <span>{book.chapters.length} глав</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {/* FIX #6: Note that total_pages is estimated from parsing, not epub.js locations */}
                  <span>~{book.total_pages} страниц</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>~{book.estimated_reading_time_hours}ч</span>
                </div>
                <div className="px-3 py-1 rounded-full text-xs uppercase font-semibold bg-background text-foreground">
                  {book.file_format}
                </div>
              </div>

              {/* Reading Progress */}
              {/* FIX #2: Change threshold from > 0 to >= 0.1 to show progress earlier */}
              {book.reading_progress.progress_percent >= 0.1 && (
                <div className="mb-6 sm:mb-8">
                  <div className="flex items-center justify-between text-xs sm:text-sm mb-2 text-muted-foreground">
                    <span>Прогресс чтения</span>
                    <span className="font-semibold text-primary">
                      {book.reading_progress.progress_percent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full overflow-hidden bg-muted/50">
                    <div
                      className="h-full rounded-full transition-all bg-primary"
                      style={{
                        width: `${book.reading_progress.progress_percent}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row flex-wrap justify-center lg:justify-start gap-3 sm:gap-4">
                <button
                  onClick={() => navigate(`/book/${book.id}/read`)}
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold text-sm sm:text-base lg:text-lg transition-all hover:scale-105 shadow-lg bg-primary text-primary-foreground"
                >
                  <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                  {/* FIX #2: Change threshold from > 0 to >= 0.1 for "Continue Reading" button */}
                  {book.reading_progress.progress_percent >= 0.1 &&
                  book.reading_progress.progress_percent < 100
                    ? 'Продолжить читать'
                    : 'Начать читать'}
                </button>

                <button
                  onClick={() => navigate(`/book/${book.id}/images`)}
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-4 rounded-xl font-semibold text-sm sm:text-base transition-all hover:scale-105 border-2 bg-background border-border text-foreground"
                >
                  <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  AI Галерея
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8 lg:mb-12">
        <div className="p-3 sm:p-4 lg:p-6 rounded-xl border-2 transition-all hover:scale-105 bg-background border-border">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-primary" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold mb-0.5 sm:mb-1 text-foreground">
            {book.chapters.length}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground">
            {book.chapters.length === 1 ? 'Глава' : 'Глав'}
          </div>
        </div>

        <div className="p-3 sm:p-4 lg:p-6 rounded-xl border-2 transition-all hover:scale-105 bg-background border-border">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold mb-0.5 sm:mb-1 text-foreground">
            {parsedChapters}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground">
            Обработано AI
          </div>
        </div>

        <div className="p-3 sm:p-4 lg:p-6 rounded-xl border-2 transition-all hover:scale-105 bg-background border-border">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold mb-0.5 sm:mb-1 text-foreground">
            {totalDescriptions}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground">
            Описаний найдено
          </div>
        </div>
      </div>

      {/* Description */}
      {book.description && (
        <div className="p-4 sm:p-6 lg:p-8 rounded-xl border-2 mb-6 sm:mb-8 lg:mb-12 bg-background border-border">
          <h2 className="fluid-h3 font-bold mb-2 sm:mb-4 text-foreground">
            Описание
          </h2>
          <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
            {book.description}
          </p>
        </div>
      )}

      {/* Chapters List */}
      <div>
        <h2 className="fluid-h2 font-bold mb-4 sm:mb-6 text-foreground">
          Главы ({book.chapters.length})
        </h2>

        <div className="space-y-2 sm:space-y-3">
          {book.chapters.map((chapter) => (
            <div
              key={chapter.id}
              onClick={() => navigate(`/book/${book.id}/chapter/${chapter.number}`)}
              className="group p-3 sm:p-4 lg:p-6 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg bg-background border-border"
            >
              <div className="flex items-start justify-between gap-2 sm:gap-4">
                <div className="flex items-start gap-2 sm:gap-4 flex-1 min-w-0">
                  {/* Chapter Number Badge */}
                  <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center font-bold text-sm sm:text-base bg-muted text-primary">
                    {chapter.number}
                  </div>

                  {/* Chapter Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base lg:text-lg mb-1 sm:mb-2 line-clamp-2 text-foreground">
                      {chapter.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm mb-2 sm:mb-3 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{chapter.word_count.toLocaleString()} слов</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>~{chapter.estimated_reading_time_minutes} мин</span>
                      </div>
                    </div>

                    {/* Description Status */}
                    {chapter.is_description_parsed && chapter.descriptions_found > 0 && (
                      <div className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-md bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs sm:text-sm font-medium">
                        <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{chapter.descriptions_found} описаний AI</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Arrow Icon */}
                <div className="flex-shrink-0 text-muted-foreground group-hover:translate-x-1 transition-transform hidden sm:block">
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 rotate-180" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BookPage;
