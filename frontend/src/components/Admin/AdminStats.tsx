/**
 * AdminStats - Статистические карточки админ-панели
 *
 * Отображает 4 карточки с системной статистикой:
 * - Всего пользователей
 * - Всего книг
 * - Описаний
 * - Сгенерированных изображений
 *
 * @param stats - Системная статистика
 * @param isLoading - Индикатор загрузки
 * @param t - Функция перевода
 */

import React from 'react';
import { Users, BookOpen, Database, Image } from 'lucide-react';
import type { SystemStats } from '@/api/admin';

interface AdminStatsProps {
  stats: SystemStats | undefined;
  isLoading: boolean;
  t: (key: string) => string;
}

export const AdminStats: React.FC<AdminStatsProps> = ({ stats, isLoading, t }) => {
  const statCards = [
    {
      title: t('admin.totalUsers'),
      value: stats?.total_users || 0,
      icon: Users,
      color: 'blue'
    },
    {
      title: t('admin.totalBooks'),
      value: stats?.total_books || 0,
      icon: BookOpen,
      color: 'green'
    },
    {
      title: t('admin.descriptions'),
      value: stats?.total_descriptions || 0,
      icon: Database,
      color: 'purple'
    },
    {
      title: t('admin.generatedImages'),
      value: stats?.total_images || 0,
      icon: Image,
      color: 'orange'
    }
  ];

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      aria-busy={isLoading}
      aria-live="polite"
    >
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className="bg-card rounded-lg p-6 shadow-sm border border-border"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {isLoading ? '...' : stat.value.toLocaleString()}
                </p>
              </div>
              <Icon className={`w-8 h-8 text-${stat.color}-500`} aria-hidden="true" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
