 
/**
 * ProfilePage - Modern redesign with shadcn UI components
 *
 * Features:
 * - Gradient hero section with large avatar
 * - User stats cards (books read, time spent, achievements)
 * - Editable profile information
 * - Reading goals tracking
 * - Subscription plan info
 * - Fully theme-aware (Light/Dark/Sepia)
 * - Responsive design
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { getErrorMessage } from '@/utils/errors';
import {
  User,
  Mail,
  Calendar,
  Shield,
  BookOpen,
  Clock,
  Award,
  Edit2,
  Save,
  X,
  Camera,
  Sparkles,
  TrendingUp,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { booksAPI } from '@/api/books';
import { authAPI } from '@/api/auth';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import toast from 'react-hot-toast';

// Helper function to calculate achievements
function calculateAchievements(totalBooks: number, streak: number) {
  let earned = 0;
  if (totalBooks >= 1) earned++; // First book
  if (streak >= 7) earned++; // 7 day streak
  if (totalBooks >= 10) earned++; // 10 books
  // Add more achievement logic as needed
  return { earned, total: 6 };
}

const ProfilePage: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(user?.full_name || '');

  // Fetch user statistics
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['user-statistics'],
    queryFn: () => booksAPI.getUserStatistics(),
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: { full_name?: string }) => authAPI.updateProfile(data),
    onSuccess: () => {
      toast.success('Профиль успешно обновлен');
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      setIsEditing(false);
    },
    onError: (error: Error | { response?: { data?: { detail?: string } } }) => {
      toast.error(getErrorMessage(error, 'Ошибка при обновлении профиля'));
    },
  });

  // Calculate stats from API data
  const stats = useMemo(() => {
    if (!statsData?.statistics) {
      return [
        { label: 'Книг прочитано', value: '0', icon: BookOpen, color: 'text-blue-600 dark:text-blue-400' },
        { label: 'Часов чтения', value: '0', icon: Clock, color: 'text-purple-600 dark:text-purple-400' },
        { label: 'Достижений', value: '0', icon: Award, color: 'text-amber-600 dark:text-amber-400' },
      ];
    }

    const s = statsData.statistics;
    const totalHours = Math.round((s.total_reading_time_minutes || 0) / 60);
    const achievements = calculateAchievements(s.total_books || 0, s.reading_streak_days || 0);

    return [
      { label: 'Книг прочитано', value: String(s.total_books || 0), icon: BookOpen, color: 'text-blue-600 dark:text-blue-400' },
      { label: 'Часов чтения', value: String(totalHours), icon: Clock, color: 'text-purple-600 dark:text-purple-400' },
      { label: 'Достижений', value: String(achievements.earned), icon: Award, color: 'text-amber-600 dark:text-amber-400' },
    ];
  }, [statsData]);

  // Calculate reading goals
  const readingGoals = useMemo(() => {
    if (!statsData?.statistics) {
      return [
        { label: 'Цель на месяц', current: 0, target: 5, unit: 'книг' },
        { label: 'Минут в день', current: 0, target: 60, unit: 'мин' },
      ];
    }

    const s = statsData.statistics;
    const booksInProgress = s.books_in_progress || 0;
    // Используем унифицированную метрику из API
    // Формула на бэкенде: total_minutes / days_with_reading_activity
    const avgMinutesPerDay = s.avg_minutes_per_day || 0;

    return [
      { label: 'Цель на месяц', current: booksInProgress, target: 5, unit: 'книг' },
      { label: 'Минут в день', current: avgMinutesPerDay, target: 60, unit: 'мин' },
    ];
  }, [statsData]);

  const handleSave = () => {
    if (editedName.trim() && editedName !== user?.full_name) {
      updateProfileMutation.mutate({ full_name: editedName.trim() });
    } else {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditedName(user?.full_name || '');
    setIsEditing(false);
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <LoadingSpinner size="lg" text="Загрузка профиля..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Section with Avatar */}
      <div className="relative mb-12 overflow-hidden rounded-3xl">
        {/* Gradient Background */}
        <div
          className="absolute inset-0 opacity-50"
          style={{
            background: 'linear-gradient(135deg, var(--accent-color) 0%, rgba(147, 51, 234, 0.5) 100%)',
          }}
        />

        {/* Content */}
        <div className="relative px-8 py-12">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Avatar */}
            <div className="relative group">
              <div
                className="w-32 h-32 rounded-full flex items-center justify-center border-4 border-white/20 shadow-2xl transition-transform group-hover:scale-105"
                style={{
                  backgroundColor: 'var(--accent-color)',
                }}
              >
                <span className="text-5xl font-bold text-white">
                  {user?.full_name ? user.full_name.charAt(0).toUpperCase() : user?.email.charAt(0).toUpperCase()}
                </span>
              </div>

              {/* Upload Avatar Button */}
              <button
                className="absolute bottom-0 right-0 p-2 rounded-full bg-white dark:bg-gray-800 shadow-lg transition-all hover:scale-110"
                style={{
                  borderColor: 'var(--border-color)',
                }}
                onClick={() => console.log('Upload avatar')}
              >
                <Camera className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
              </button>
            </div>

            {/* User Info */}
            <div className="flex-1 text-center md:text-left">
              {isEditing ? (
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="text-3xl font-bold px-4 py-2 rounded-xl border-2"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: 'var(--accent-color)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button
                    onClick={handleSave}
                    className="p-2 rounded-lg transition-all hover:scale-110"
                    style={{ backgroundColor: 'var(--accent-color)' }}
                  >
                    <Save className="w-5 h-5 text-white" />
                  </button>
                  <button
                    onClick={handleCancel}
                    className="p-2 rounded-lg border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <X className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 mb-3 justify-center md:justify-start">
                  <h1 className="text-3xl md:text-4xl font-bold text-white">
                    {user?.full_name || 'User'}
                  </h1>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-all"
                  >
                    <Edit2 className="w-5 h-5 text-white" />
                  </button>
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-4 text-white/90 mb-4">
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <Mail className="w-4 h-4" />
                  <span>{user?.email}</span>
                </div>
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <Calendar className="w-4 h-4" />
                  <span>Зарегистрирован: {new Date().toLocaleDateString('ru-RU')}</span>
                </div>
              </div>

              {/* Subscription Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 backdrop-blur-sm">
                <Sparkles className="w-4 h-4 text-yellow-300" />
                <span className="font-semibold text-white">Free Plan</span>
                {user?.is_admin && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-white/50" />
                    <Shield className="w-4 h-4 text-green-300" />
                    <span className="font-semibold text-white">Admin</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="p-6 rounded-2xl border-2 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <stat.icon className={cn('w-10 h-10', stat.color)} />
              <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {stat.value}
              </span>
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Reading Goals */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <Target className="w-6 h-6" style={{ color: 'var(--accent-color)' }} />
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Цели чтения
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {readingGoals.map((goal, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl border-2"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {goal.label}
                </h3>
                <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {goal.current} / {goal.target} {goal.unit}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="relative h-3 rounded-full overflow-hidden" style={{
                backgroundColor: 'var(--bg-secondary)',
              }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    backgroundColor: 'var(--accent-color)',
                    width: `${(goal.current / goal.target) * 100}%`,
                  }}
                />
              </div>

              <div className="mt-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {Math.round((goal.current / goal.target) * 100)}% выполнено
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Profile Information */}
      <div
        className="p-8 rounded-2xl border-2"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <User className="w-6 h-6" style={{ color: 'var(--accent-color)' }} />
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Информация профиля
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Полное имя
            </label>
            <div
              className="px-4 py-3 rounded-xl border-2"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              {user?.full_name || 'Не указано'}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Email
            </label>
            <div
              className="px-4 py-3 rounded-xl border-2"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              {user?.email}
            </div>
          </div>

          {/* Account Type */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Тип аккаунта
            </label>
            <div
              className="px-4 py-3 rounded-xl border-2"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              {user?.is_admin ? 'Администратор' : 'Обычный пользователь'}
            </div>
          </div>

          {/* Member Since */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Дата регистрации
            </label>
            <div
              className="px-4 py-3 rounded-xl border-2"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              {new Date().toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
