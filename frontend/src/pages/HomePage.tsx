/**
 * HomePage - Modern redesign with shadcn UI components
 *
 * Features:
 * - Hero section with gradient background
 * - Feature cards with hover effects
 * - Stats dashboard
 * - Quick action buttons
 * - Fully theme-aware (Light/Dark/Sepia)
 * - Responsive design
 * - Modern typography and spacing
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Upload,
  Sparkles,
  TrendingUp,
  Zap,
  Image as ImageIcon,
  Brain,
  ArrowRight,
  Library,
  Clock,
  FileText,
  Wand2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import { booksAPI } from '@/api/books';
import { imagesAPI } from '@/api/images';
import { cn } from '@/lib/utils';

const HomePage: React.FC = () => {
  const { user } = useAuthStore();
  const setShowUploadModal = useUIStore(state => state.setShowUploadModal);
  const navigate = useNavigate();

  // Fetch user reading statistics
  const { data: readingStats } = useQuery({
    queryKey: ['userReadingStatistics'],
    queryFn: () => booksAPI.getUserReadingStatistics(),
    staleTime: 30000, // 30 seconds
  });

  // Fetch books for recent activity
  const { data: booksData, isLoading: booksLoading } = useQuery({
    queryKey: ['books', 'homepage'],
    queryFn: () => booksAPI.getBooks({ limit: 50, sort_by: 'accessed_desc' }),
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: 'always', // Always refetch when component mounts
  });

  // Fetch user images and descriptions stats
  const { data: imagesStats } = useQuery({
    queryKey: ['userImagesStats'],
    queryFn: () => imagesAPI.getUserStats(),
    staleTime: 30000, // 30 seconds
  });

  // Calculate stats from fetched data
  const totalBooks = readingStats?.total_books ?? 0;
  const totalHours = readingStats?.total_reading_time_minutes
    ? Math.round(readingStats.total_reading_time_minutes / 60)
    : 0;
  const totalDescriptions = imagesStats?.total_descriptions_found ?? 0;
  const totalImages = imagesStats?.total_images_generated ?? 0;

  const stats = [
    { label: 'Книг в библиотеке', value: totalBooks.toString(), icon: Library, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Часов чтения', value: totalHours.toString(), icon: Clock, color: 'text-purple-600 dark:text-purple-400' },
    { label: 'Описаний найдено', value: totalDescriptions.toString(), icon: FileText, color: 'text-green-600 dark:text-green-400' },
    { label: 'Изображений создано', value: totalImages.toString(), icon: Wand2, color: 'text-amber-600 dark:text-amber-400' },
  ];

  // Get books in progress for recent activity
  // Note: reading_progress_percent might be 0.0, 0.1, 5.0, etc.
  const booksInProgress = booksData?.books.filter(book => {
    const progress = book.reading_progress_percent ?? 0;
    const hasProgress = progress >= 0.1 && progress < 100;

    // Debug logging (remove in production)
    if (progress > 0) {
      console.log('[HomePage] Book with progress:', {
        title: book.title,
        progress,
        hasProgress,
      });
    }

    return hasProgress;
  }) ?? [];

  // Debug: log total books in progress
  console.log('[HomePage] Books in progress:', booksInProgress.length);

  const features = [
    {
      icon: Brain,
      title: 'Умное распознавание',
      description: 'Multi-NLP система извлекает описания локаций, персонажей и атмосферы из текста',
      color: 'from-blue-500 to-cyan-500',
      iconBg: 'bg-blue-500/10 dark:bg-blue-500/20',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      icon: ImageIcon,
      title: 'AI генерация',
      description: 'Автоматическое создание изображений для описаний с помощью нейросетей',
      color: 'from-purple-500 to-pink-500',
      iconBg: 'bg-purple-500/10 dark:bg-purple-500/20',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      icon: Zap,
      title: 'Мгновенная обработка',
      description: 'Параллельная обработка глав и кэширование для максимальной скорости',
      color: 'from-amber-500 to-orange-500',
      iconBg: 'bg-amber-500/10 dark:bg-amber-500/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="relative mb-8 sm:mb-12 lg:mb-16 overflow-hidden rounded-2xl sm:rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-500/20 dark:via-purple-500/20 dark:to-pink-500/20" />
        <div className="relative px-4 py-8 sm:px-6 sm:py-12 md:px-8 md:py-16 lg:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              Привет, {user?.full_name || 'Читатель'}!
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
              Погружайтесь в мир книг с AI-визуализацией. Каждое описание оживает благодаря искусственному интеллекту.
            </p>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link
                to="/library"
                className={cn(
                  "group inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 sm:px-6 py-3 rounded-xl",
                  "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600",
                  "text-white font-semibold text-sm sm:text-base transition-all duration-200",
                  "shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40",
                  "hover:scale-105"
                )}
              >
                <BookOpen className="w-5 h-5" />
                <span>Моя библиотека</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>

              <button
                onClick={() => setShowUploadModal(true)}
                className="group inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 sm:px-6 py-3 rounded-xl border-2 font-semibold text-sm sm:text-base transition-all duration-200 hover:scale-105 bg-background border-border text-foreground hover:border-primary"
              >
                <Upload className="w-5 h-5" />
                <span>Загрузить книгу</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-8 sm:mb-12 lg:mb-16">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={cn(
              "group p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 transition-all duration-300",
              "bg-white dark:bg-gray-800/50",
              "border-gray-200 dark:border-gray-700",
              "hover:border-blue-500 dark:hover:border-blue-500",
              "hover:shadow-lg hover:shadow-blue-500/10",
              "hover:-translate-y-1"
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 mb-2 sm:mb-3">
              <stat.icon className={cn("w-6 h-6 sm:w-8 sm:h-8", stat.color)} />
              <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="mb-8 sm:mb-12 lg:mb-16">
        <div className="text-center mb-6 sm:mb-8 lg:mb-12">
          <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-4">
            Возможности платформы
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto px-4">
            Передовые технологии для лучшего опыта чтения
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className={cn(
                "group p-5 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl border-2 transition-all duration-300",
                "bg-white dark:bg-gray-800/50",
                "border-gray-200 dark:border-gray-700",
                "hover:border-blue-500 dark:hover:border-blue-500",
                "hover:shadow-xl hover:shadow-blue-500/10",
                "hover:-translate-y-2"
              )}
            >
              <div className={cn("inline-flex p-3 sm:p-4 rounded-lg sm:rounded-xl mb-4 sm:mb-6", feature.iconBg)}>
                <feature.icon className={cn("w-6 h-6 sm:w-8 sm:h-8", feature.iconColor)} />
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">
                {feature.title}
              </h3>

              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Reading Progress Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        {/* Recent Books */}
        <div className={cn(
          "p-5 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl border-2",
          "bg-white dark:bg-gray-800/50",
          "border-gray-200 dark:border-gray-700"
        )}>
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
              Недавняя активность
            </h3>
          </div>

          {booksLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400">Загрузка активности...</p>
            </div>
          ) : booksInProgress.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Пока нет книг в процессе чтения
              </p>
              <Link
                to="/library"
                className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                Начать читать
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {booksInProgress.slice(0, 3).map((book) => (
                <div
                  key={book.id}
                  onClick={() => navigate(`/book/${book.id}`)}
                  className={cn(
                    "p-4 rounded-xl border-2 cursor-pointer transition-all duration-200",
                    "bg-gray-50 dark:bg-gray-800",
                    "border-gray-200 dark:border-gray-700",
                    "hover:border-blue-500 dark:hover:border-blue-500",
                    "hover:shadow-md hover:-translate-y-0.5"
                  )}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                        {book.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {book.author}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">
                      {Math.round(book.reading_progress_percent)}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                      style={{ width: `${Math.min(book.reading_progress_percent, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {booksInProgress.length > 3 && (
                <Link
                  to="/library"
                  className="block text-center py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  Показать все ({booksInProgress.length})
                </Link>
              )}
            </div>
          )}
        </div>

        {/* AI Gallery */}
        <div className={cn(
          "p-5 sm:p-6 lg:p-8 rounded-xl sm:rounded-2xl border-2 relative overflow-hidden",
          "bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20",
          "border-purple-200 dark:border-purple-700"
        )}>
          <div className="relative z-10">
            <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white">
                Галерея AI
              </h3>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full mt-1.5 sm:mt-2 flex-shrink-0" />
                <div>
                  <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-0.5 sm:mb-1">
                    Автоматическая визуализация
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Каждое описание превращается в уникальное изображение
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full mt-1.5 sm:mt-2 flex-shrink-0" />
                <div>
                  <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-0.5 sm:mb-1">
                    Персональная галерея
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Сохраняйте и делитесь любимыми AI-изображениями
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full mt-1.5 sm:mt-2 flex-shrink-0" />
                <div>
                  <h4 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-0.5 sm:mb-1">
                    Контекстная интеграция
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Изображения появляются прямо в тексте книги
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
