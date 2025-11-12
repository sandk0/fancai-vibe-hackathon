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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div
            className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 mb-4"
            style={{ borderColor: 'var(--accent-color)' }}
          ></div>
          <p style={{ color: 'var(--text-secondary)' }}>Загрузка книги...</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-20">
          <div
            className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <Book className="w-10 h-10" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
            Книга не найдена
          </h1>
          <p className="mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Запрошенная книга не существует или была удалена
          </p>
          <button
            onClick={() => navigate('/library')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'white',
            }}
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
    <div className="max-w-7xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate('/library')}
        className="inline-flex items-center gap-2 mb-6 transition-colors"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hover:underline">Назад в библиотеку</span>
      </button>

      {/* Hero Section */}
      <div className="relative mb-12 overflow-hidden rounded-3xl">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              'linear-gradient(135deg, var(--accent-color) 0%, rgba(147, 51, 234, 0.5) 100%)',
          }}
        />
        <div className="relative">
          <div className="flex flex-col lg:flex-row gap-8 p-8 lg:p-12">
            {/* Book Cover */}
            <div className="flex-shrink-0">
              <div
                className="w-48 h-72 lg:w-64 lg:h-96 rounded-2xl shadow-2xl overflow-hidden mx-auto lg:mx-0"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                {book.has_cover ? (
                  <img
                    src={`${
                      import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
                    }/books/${book.id}/cover`}
                    alt={`${book.title} cover`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Book className="w-16 h-16" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                )}
              </div>
            </div>

            {/* Book Info */}
            <div className="flex-1">
              <h1
                className="text-4xl lg:text-5xl font-bold mb-4"
                style={{ color: 'var(--text-primary)' }}
              >
                {book.title}
              </h1>

              <div className="flex items-center gap-2 mb-6" style={{ color: 'var(--text-secondary)' }}>
                <User className="w-5 h-5" />
                <span className="text-lg">{book.author}</span>
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-4 mb-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
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
                <div
                  className="px-3 py-1 rounded-full text-xs uppercase font-semibold"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {book.file_format}
                </div>
              </div>

              {/* Reading Progress */}
              {/* FIX #2: Change threshold from > 0 to >= 0.1 to show progress earlier */}
              {book.reading_progress.progress_percent >= 0.1 && (
                <div className="mb-8">
                  <div
                    className="flex items-center justify-between text-sm mb-2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span>Прогресс чтения</span>
                    <span
                      className="font-semibold"
                      style={{ color: 'var(--accent-color)' }}
                    >
                      {book.reading_progress.progress_percent.toFixed(1)}%
                    </span>
                  </div>
                  <div
                    className="w-full h-3 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--bg-tertiary)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${book.reading_progress.progress_percent}%`,
                        backgroundColor: 'var(--accent-color)',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => navigate(`/book/${book.id}/read`)}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg"
                  style={{
                    backgroundColor: 'var(--accent-color)',
                    color: 'white',
                  }}
                >
                  <Play className="w-5 h-5" />
                  {/* FIX #2: Change threshold from > 0 to >= 0.1 for "Continue Reading" button */}
                  {book.reading_progress.progress_percent >= 0.1 &&
                  book.reading_progress.progress_percent < 100
                    ? 'Продолжить читать'
                    : 'Начать читать'}
                </button>

                <button
                  onClick={() => navigate(`/book/${book.id}/images`)}
                  className="inline-flex items-center gap-2 px-6 py-4 rounded-xl font-semibold transition-all hover:scale-105 border-2"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <ImageIcon className="w-5 h-5" />
                  AI Галерея
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div
          className="p-6 rounded-2xl border-2 transition-all hover:scale-105"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <BookOpen className="w-8 h-8" style={{ color: 'var(--accent-color)' }} />
          </div>
          <div className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            {book.chapters.length}
          </div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {book.chapters.length === 1 ? 'Глава' : 'Глав'}
          </div>
        </div>

        <div
          className="p-6 rounded-2xl border-2 transition-all hover:scale-105"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            {parsedChapters}
          </div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Обработано AI
          </div>
        </div>

        <div
          className="p-6 rounded-2xl border-2 transition-all hover:scale-105"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <Sparkles className="w-8 h-8 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            {totalDescriptions}
          </div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Описаний найдено
          </div>
        </div>
      </div>

      {/* Description */}
      {book.description && (
        <div
          className="p-8 rounded-2xl border-2 mb-12"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Описание
          </h2>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {book.description}
          </p>
        </div>
      )}

      {/* Chapters List */}
      <div>
        <h2 className="text-3xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
          Главы ({book.chapters.length})
        </h2>

        <div className="space-y-3">
          {book.chapters.map((chapter) => (
            <div
              key={chapter.id}
              onClick={() => navigate(`/book/${book.id}/chapter/${chapter.number}`)}
              className="group p-6 rounded-2xl border-2 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  {/* Chapter Number Badge */}
                  <div
                    className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--accent-color)',
                    }}
                  >
                    {chapter.number}
                  </div>

                  {/* Chapter Info */}
                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-semibold text-lg mb-2 line-clamp-2"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {chapter.title}
                    </h3>

                    <div
                      className="flex flex-wrap items-center gap-4 text-sm mb-3"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <div className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        <span>{chapter.word_count.toLocaleString()} слов</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>~{chapter.estimated_reading_time_minutes} мин</span>
                      </div>
                    </div>

                    {/* Description Status */}
                    {chapter.is_description_parsed && chapter.descriptions_found > 0 && (
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-medium">
                        <Sparkles className="w-4 h-4" />
                        <span>{chapter.descriptions_found} описаний AI</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Arrow Icon */}
                <div className="flex-shrink-0 text-gray-400 group-hover:translate-x-1 transition-transform">
                  <ArrowLeft className="w-5 h-5 rotate-180" />
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
