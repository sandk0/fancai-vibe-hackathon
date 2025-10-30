/**
 * BookImagesPage - Modern redesign with shadcn UI components
 *
 * Features:
 * - Gradient hero section with book info
 * - AI image gallery with masonry/grid layout
 * - Stats cards (chapters, progress, genre)
 * - Back navigation
 * - "Read Book" action button
 * - Fully theme-aware (Light/Dark/Sepia)
 * - Responsive design
 */

import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Image as ImageIcon, Sparkles, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { booksAPI } from '@/api/books';
import { ImageGallery } from '@/components/Images/ImageGallery';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import ErrorMessage from '@/components/UI/ErrorMessage';
import { useTranslation } from '@/hooks/useTranslation';

const BookImagesPage: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const { t } = useTranslation();

  // Fetch book data for header information
  const { data: book, isLoading: bookLoading, error: bookError } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => booksAPI.getBook(bookId!),
    enabled: !!bookId,
  });

  if (!bookId) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <ErrorMessage title={t('images.invalidBook')} message={t('images.bookIdRequired')} />
      </div>
    );
  }

  if (bookLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="lg" text={t('images.loadingBookInfo')} />
      </div>
    );
  }

  if (bookError || !book) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <ErrorMessage
          title={t('images.bookNotFound')}
          message={t('images.bookNotFoundDesc')}
          action={{
            label: t('images.goBackToLibrary'),
            onClick: () => window.history.back()
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="relative mb-12 overflow-hidden rounded-3xl">
        {/* Gradient Background */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: 'linear-gradient(135deg, var(--accent-color) 0%, rgba(147, 51, 234, 0.5) 100%)',
          }}
        />

        {/* Content */}
        <div className="relative px-8 py-12">
          {/* Back Button */}
          <Link
            to="/library"
            className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
            <span className="text-white font-medium">{t('common.back')}</span>
          </Link>

          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Book Cover */}
            <div className="w-40 h-56 rounded-2xl overflow-hidden shadow-2xl flex-shrink-0 border-4 border-white/20">
              {book.has_cover ? (
                <img
                  src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/books/${book.id}/cover`}
                  alt={`${book.title} cover`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--accent-color)' }}
                >
                  <BookOpen className="w-16 h-16 text-white" />
                </div>
              )}
            </div>

            {/* Book Info */}
            <div className="flex-1 text-center lg:text-left">
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
                {book.title}
              </h1>
              <p className="text-lg text-white/90 mb-6">
                {book.author} • {t('images.aiGeneratedImages')}
              </p>

              {/* Action Button */}
              <Link
                to={`/books/${bookId}`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:scale-105 shadow-lg"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              >
                <BookOpen className="w-5 h-5" />
                <span>{t('images.readBook')}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div
          className="p-6 rounded-2xl border-2 transition-all hover:-translate-y-1 hover:shadow-xl"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {book.total_chapters}
            </span>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('images.chapters')}
          </p>
        </div>

        <div
          className="p-6 rounded-2xl border-2 transition-all hover:-translate-y-1 hover:shadow-xl"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {Math.round(book.reading_progress_percent || 0)}%
            </span>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('images.progress')}
          </p>
        </div>

        <div
          className="p-6 rounded-2xl border-2 transition-all hover:-translate-y-1 hover:shadow-xl"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <Sparkles className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {book.genre || t('images.unknown')}
            </span>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('images.genre')}
          </p>
        </div>
      </div>

      {/* Description (if available) */}
      {book.description && (
        <div
          className="p-6 rounded-2xl border-2 mb-12"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Описание
          </h3>
          <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {book.description}
          </p>
        </div>
      )}

      {/* Gallery Header */}
      <div className="flex items-center gap-3 mb-6">
        <ImageIcon className="w-7 h-7" style={{ color: 'var(--accent-color)' }} />
        <h2 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
          AI Галерея
        </h2>
      </div>

      {/* Image Gallery */}
      <div
        className="rounded-2xl border-2 p-6"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-color)',
        }}
      >
        <ImageGallery bookId={bookId} />
      </div>
    </div>
  );
};

export default BookImagesPage;
