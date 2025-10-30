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
import { Link } from 'react-router-dom';
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
  Award,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import { cn } from '@/lib/utils';

const HomePage: React.FC = () => {
  const { user } = useAuthStore();
  const setShowUploadModal = useUIStore(state => state.setShowUploadModal);

  const stats = [
    { label: 'Книг в библиотеке', value: '0', icon: Library, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Часов чтения', value: '0', icon: Clock, color: 'text-purple-600 dark:text-purple-400' },
    { label: 'Изображений создано', value: '0', icon: Award, color: 'text-amber-600 dark:text-amber-400' },
  ];

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
      <div className="relative mb-16 overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-500/20 dark:via-purple-500/20 dark:to-pink-500/20" />
        <div className="relative px-8 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              Привет, {user?.full_name || 'Читатель'}! 👋
            </h1>
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Погружайтесь в мир книг с AI-визуализацией. Каждое описание оживает благодаря искусственному интеллекту.
            </p>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/library"
                className={cn(
                  "group inline-flex items-center gap-2 px-6 py-3 rounded-xl",
                  "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600",
                  "text-white font-semibold transition-all duration-200",
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
                className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 font-semibold transition-all duration-200 hover:scale-105"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-color)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                <Upload className="w-5 h-5" />
                <span>Загрузить книгу</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {stats.map((stat, index) => (
          <div
            key={index}
            className={cn(
              "group p-6 rounded-2xl border-2 transition-all duration-300",
              "bg-white dark:bg-gray-800/50",
              "border-gray-200 dark:border-gray-700",
              "hover:border-blue-500 dark:hover:border-blue-500",
              "hover:shadow-lg hover:shadow-blue-500/10",
              "hover:-translate-y-1"
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <stat.icon className={cn("w-8 h-8", stat.color)} />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {stat.label}
              </span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div className="mb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Возможности платформы
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Передовые технологии для лучшего опыта чтения
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className={cn(
                "group p-8 rounded-2xl border-2 transition-all duration-300",
                "bg-white dark:bg-gray-800/50",
                "border-gray-200 dark:border-gray-700",
                "hover:border-blue-500 dark:hover:border-blue-500",
                "hover:shadow-xl hover:shadow-blue-500/10",
                "hover:-translate-y-2"
              )}
            >
              <div className={cn("inline-flex p-4 rounded-xl mb-6", feature.iconBg)}>
                <feature.icon className={cn("w-8 h-8", feature.iconColor)} />
              </div>

              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                {feature.title}
              </h3>

              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Reading Progress Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Books */}
        <div className={cn(
          "p-8 rounded-2xl border-2",
          "bg-white dark:bg-gray-800/50",
          "border-gray-200 dark:border-gray-700"
        )}>
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              Недавняя активность
            </h3>
          </div>

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
        </div>

        {/* AI Gallery */}
        <div className={cn(
          "p-8 rounded-2xl border-2 relative overflow-hidden",
          "bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20",
          "border-purple-200 dark:border-purple-700"
        )}>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Галерея AI
              </h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    Автоматическая визуализация
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Каждое описание превращается в уникальное изображение
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    Персональная галерея
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Сохраняйте и делитесь любимыми AI-изображениями
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-purple-600 dark:bg-purple-400 rounded-full mt-2 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    Контекстная интеграция
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
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
