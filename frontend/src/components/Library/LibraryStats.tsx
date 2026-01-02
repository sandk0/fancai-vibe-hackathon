/**
 * LibraryStats - Статистические карточки библиотеки
 *
 * Отображает 4 карточки:
 * - Всего книг
 * - В процессе чтения
 * - Завершено
 * - Обработка AI
 *
 * @param totalBooks - Общее количество книг
 * @param booksInProgress - Книги в процессе чтения
 * @param booksCompleted - Завершенные книги
 * @param processingBooks - Книги на обработке AI
 */

import React from 'react';
import { BookOpen, Clock, TrendingUp, Sparkles } from 'lucide-react';

interface LibraryStatsProps {
  totalBooks: number;
  booksInProgress: number;
  booksCompleted: number;
  processingBooks: number;
}

export const LibraryStats: React.FC<LibraryStatsProps> = ({
  totalBooks,
  booksInProgress,
  booksCompleted,
  processingBooks,
}) => {
  if (totalBooks === 0) return null;

  const stats = [
    {
      icon: BookOpen,
      value: totalBooks,
      label: 'Всего книг',
      color: 'hsl(var(--primary))',
    },
    {
      icon: Clock,
      value: booksInProgress,
      label: 'В процессе',
      color: 'rgb(147, 51, 234)', // purple
    },
    {
      icon: TrendingUp,
      value: booksCompleted,
      label: 'Завершено',
      color: 'rgb(34, 197, 94)', // green
    },
    {
      icon: Sparkles,
      value: processingBooks,
      label: 'Обработка AI',
      color: 'rgb(245, 158, 11)', // amber
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className="p-4 sm:p-6 rounded-2xl border-2 transition-all duration-300 hover:scale-105 bg-card border-border"
          >
            <div className="flex items-center justify-between mb-2">
              <Icon className="w-8 h-8" style={{ color: stat.color }} />
            </div>
            <div className="text-2xl sm:text-3xl font-bold mb-1 text-foreground">
              {stat.value}
            </div>
            <div className="text-sm text-muted-foreground">
              {stat.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
