/**
 * StatsPage - Reading statistics and analytics
 *
 * Features:
 * - Reading statistics (books, time, pages)
 * - Reading streak calendar
 * - Genre distribution
 * - Reading goals progress
 * - Reading activity chart (mock bar chart with CSS)
 * - Top books by reading time
 * - Achievements/badges
 * - Fully theme-aware (Light/Dark/Sepia)
 * - Responsive design
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  BookOpen,
  Clock,
  TrendingUp,
  Award,
  Target,
  Calendar,
  Zap,
  Star,
  Flame,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { booksAPI } from '@/api/books';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import ErrorMessage from '@/components/UI/ErrorMessage';

const StatsPage: React.FC = () => {
  // Fetch detailed user statistics (including weekly activity)
  const { data: detailedStats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['user-reading-statistics'],
    queryFn: () => booksAPI.getUserReadingStatistics(),
  });

  // Fetch all books for additional stats (genre distribution, top books)
  const { data: booksData, isLoading: booksLoading } = useQuery({
    queryKey: ['books-for-stats'],
    queryFn: () => booksAPI.getBooks({ skip: 0, limit: 100 }),
  });

  // Calculate stats from API data
  const stats = useMemo(() => {
    if (!detailedStats) {
      return {
        totalBooks: 0,
        booksThisMonth: 0,
        totalHours: 0,
        hoursThisMonth: 0,
        totalPages: 0,
        pagesThisMonth: 0,
        currentStreak: 0,
        longestStreak: 0,
        averagePerDay: 0,
      };
    }

    const s = detailedStats;

    // Calculate average minutes per day from weekly activity
    const avgMinutesPerDay = s.weekly_activity && s.weekly_activity.length > 0
      ? Math.round(s.weekly_activity.reduce((sum, day) => sum + day.minutes, 0) / 7)
      : 0;

    // Calculate this month's stats (TODO: need separate fields from backend)
    const hoursThisMonth = s.weekly_activity && s.weekly_activity.length > 0
      ? Math.round(s.weekly_activity.reduce((sum, day) => sum + day.minutes, 0) / 60)
      : 0;

    return {
      totalBooks: s.total_books || 0,
      booksThisMonth: 0, // TODO: need backend field
      totalHours: Math.round((s.total_reading_time_minutes || 0) / 60),
      hoursThisMonth,
      totalPages: s.total_pages_read || (s.total_chapters_read * 20) || 0,
      pagesThisMonth: 0, // TODO: need backend field
      currentStreak: s.reading_streak_days || 0,
      longestStreak: s.reading_streak_days || 0, // TODO: track separately in backend
      averagePerDay: avgMinutesPerDay,
    };
  }, [detailedStats]);

  // Genre distribution from books
  const genreDistribution = useMemo(() => {
    if (!booksData?.books) return [];

    const genreCounts = booksData.books.reduce((acc, book) => {
      const genre = book.genre || 'Другое';
      acc[genre] = (acc[genre] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = booksData.books.length;
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-green-500', 'bg-gray-500'];

    return Object.entries(genreCounts)
      .map(([genre, count], idx) => ({
        genre,
        count,
        percentage: Math.round((count / total) * 100),
        color: colors[idx % colors.length],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [booksData]);

  // Top books by reading time (estimated from progress)
  const topBooks = useMemo(() => {
    if (!booksData?.books) return [];

    return booksData.books
      .map((book) => ({
        title: book.title,
        author: book.author,
        hours: Math.round(book.estimated_reading_time_hours * (book.reading_progress_percent / 100)),
        progress: Math.round(book.reading_progress_percent),
      }))
      .filter((book) => book.hours > 0)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);
  }, [booksData]);

  // Achievements based on real stats
  const achievements = useMemo(() => {
    const totalBooks = stats.totalBooks;
    const streak = stats.currentStreak;
    const hoursPerDay = stats.totalHours / Math.max(1, streak);

    return [
      { name: 'Первая книга', description: 'Прочитайте первую книгу', icon: BookOpen, earned: totalBooks >= 1 },
      { name: 'Марафонец', description: '7 дней подряд', icon: Flame, earned: streak >= 7 },
      { name: 'Книжный червь', description: '10 книг прочитано', icon: Star, earned: totalBooks >= 10 },
      { name: 'Целеустремленный', description: 'Достигните месячной цели', icon: Target, earned: stats.booksThisMonth >= 5 },
      { name: 'Спринтер', description: '3 часа за день', icon: Zap, earned: hoursPerDay >= 3 },
      { name: 'Легенда', description: '50 книг прочитано', icon: Award, earned: totalBooks >= 50 },
    ];
  }, [stats]);

  // Helper function to format minutes
  const formatMinutes = (minutes: number): string => {
    if (minutes === 0) return '0 мин';
    if (minutes < 60) return `${minutes} мин`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}ч ${mins}м` : `${hours}ч`;
  };

  // Weekly activity from API
  const weeklyActivity = useMemo(() => {
    if (!detailedStats?.weekly_activity || detailedStats.weekly_activity.length === 0) {
      // Если нет данных - возвращаем 7 дней с нулями
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i)); // От 6 дней назад до сегодня
        const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        return {
          day: days[date.getDay()],
          minutes: 0,
          label: '0 мин'
        };
      });
    }

    // Используем данные из API
    return detailedStats.weekly_activity.map(day => ({
      day: day.day,
      minutes: day.minutes,
      label: formatMinutes(day.minutes),
    }));
  }, [detailedStats]);

  const maxMinutes = Math.max(...weeklyActivity.map((d) => d.minutes), 1); // Минимум 1 для избежания деления на 0

  if (statsLoading || booksLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="lg" text="Загрузка статистики..." />
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <ErrorMessage
          title="Ошибка загрузки"
          message="Не удалось загрузить статистику чтения"
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <BarChart3 className="w-8 h-8" style={{ color: 'var(--accent-color)' }} />
          <h1 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Статистика чтения
          </h1>
        </div>
        <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
          Ваш прогресс и достижения
        </p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Books */}
        <div
          className="p-6 rounded-2xl border-2 transition-all hover:-translate-y-1 hover:shadow-xl"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <BookOpen className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            <div className="text-right">
              <p className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {stats.totalBooks}
              </p>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                всего книг
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">
              +{stats.booksThisMonth} в этом месяце
            </span>
          </div>
        </div>

        {/* Hours */}
        <div
          className="p-6 rounded-2xl border-2 transition-all hover:-translate-y-1 hover:shadow-xl"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-10 h-10 text-purple-600 dark:text-purple-400" />
            <div className="text-right">
              <p className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {stats.totalHours}
              </p>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                часов чтения
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">
              +{stats.hoursThisMonth}ч в этом месяце
            </span>
          </div>
        </div>

        {/* Pages */}
        <div
          className="p-6 rounded-2xl border-2 transition-all hover:-translate-y-1 hover:shadow-xl"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <Award className="w-10 h-10 text-amber-600 dark:text-amber-400" />
            <div className="text-right">
              <p className="text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {stats.totalPages.toLocaleString()}
              </p>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                страниц прочитано
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">
              +{stats.pagesThisMonth} в этом месяце
            </span>
          </div>
        </div>
      </div>

      {/* Streak and Weekly Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Reading Streak */}
        <div
          className="p-6 rounded-2xl border-2"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <Flame className="w-6 h-6" style={{ color: 'var(--accent-color)' }} />
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Серия чтения
            </h2>
          </div>

          <div className="flex items-center justify-around mb-6">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full flex items-center justify-center mb-3 border-4" style={{
                borderColor: 'var(--accent-color)',
                backgroundColor: 'var(--bg-secondary)',
              }}>
                <span className="text-3xl font-bold" style={{ color: 'var(--accent-color)' }}>
                  {stats.currentStreak}
                </span>
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Текущая серия
              </p>
            </div>

            <div className="text-center">
              <div className="w-24 h-24 rounded-full flex items-center justify-center mb-3 border-4" style={{
                borderColor: 'var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
              }}>
                <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {stats.longestStreak}
                </span>
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Лучшая серия
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <p className="text-center font-medium" style={{ color: 'var(--text-primary)' }}>
              В среднем {stats.averagePerDay} минут в день
            </p>
          </div>
        </div>

        {/* Weekly Activity Chart */}
        <div
          className="p-6 rounded-2xl border-2"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-6 h-6" style={{ color: 'var(--accent-color)' }} />
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Активность за неделю
            </h2>
          </div>

          {weeklyActivity.every((d) => d.minutes === 0) ? (
            // Empty state - no reading activity
            <div className="h-48 flex flex-col items-center justify-center">
              <Calendar className="w-12 h-12 mb-3" style={{ color: 'var(--text-secondary)', opacity: 0.3 }} />
              <p className="text-center font-medium" style={{ color: 'var(--text-secondary)' }}>
                Нет данных о чтении за последнюю неделю
              </p>
              <p className="text-sm text-center mt-2" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                Начните читать, чтобы увидеть статистику
              </p>
            </div>
          ) : (
            // Chart with data
            <div className="flex items-end justify-between gap-2 h-48">
              {weeklyActivity.map((day, index) => (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div className="relative flex-1 w-full flex flex-col justify-end">
                    <div
                      className="w-full rounded-t-lg transition-all hover:opacity-80 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--accent-color)',
                        height: `${(day.minutes / maxMinutes) * 100}%`,
                        minHeight: day.minutes > 0 ? '8px' : '0',
                      }}
                      title={day.label}
                    />
                  </div>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {day.day}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Genre Distribution and Top Books */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Genre Distribution */}
        <div
          className="p-6 rounded-2xl border-2"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            Распределение по жанрам
          </h2>

          <div className="space-y-4">
            {genreDistribution.map((genre, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {genre.genre}
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {genre.count} книг ({genre.percentage}%)
                  </span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                  <div
                    className={cn('h-full rounded-full transition-all', genre.color)}
                    style={{ width: `${genre.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Books */}
        <div
          className="p-6 rounded-2xl border-2"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            Топ книг по времени чтения
          </h2>

          <div className="space-y-4">
            {topBooks.map((book, index) => (
              <div
                key={index}
                className="p-4 rounded-xl transition-all hover:scale-[1.02]"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white"
                    style={{ backgroundColor: 'var(--accent-color)' }}
                  >
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-1 truncate" style={{ color: 'var(--text-primary)' }}>
                      {book.title}
                    </h3>
                    <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                      {book.author} • {book.hours}ч
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: 'var(--accent-color)',
                            width: `${book.progress}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {book.progress}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div
        className="p-6 rounded-2xl border-2"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <Award className="w-6 h-6" style={{ color: 'var(--accent-color)' }} />
          <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Достижения
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {achievements.map((achievement, index) => (
            <div
              key={index}
              className={cn(
                'p-4 rounded-xl border-2 transition-all',
                achievement.earned ? 'hover:-translate-y-1' : 'opacity-50'
              )}
              style={{
                backgroundColor: achievement.earned ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                borderColor: achievement.earned ? 'var(--accent-color)' : 'var(--border-color)',
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="p-2 rounded-lg"
                  style={{
                    backgroundColor: achievement.earned ? 'var(--accent-color)' : 'var(--bg-secondary)',
                  }}
                >
                  <achievement.icon className="w-6 h-6" style={{ color: achievement.earned ? 'white' : 'var(--text-secondary)' }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                    {achievement.name}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {achievement.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StatsPage;
