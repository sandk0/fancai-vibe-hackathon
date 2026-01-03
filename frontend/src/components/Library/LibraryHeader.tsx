/**
 * LibraryHeader - Заголовок страницы библиотеки
 *
 * Отображает:
 * - Заголовок "Моя библиотека"
 * - Описание (количество книг или приглашение загрузить первую книгу)
 * - Кнопку загрузки книги
 *
 * @param totalBooks - Общее количество книг в библиотеке
 * @param filteredCount - Количество отфильтрованных книг (для поиска)
 * @param searchQuery - Текущий поисковый запрос
 * @param onUploadClick - Callback при клике на кнопку загрузки
 */

import React from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LibraryHeaderProps {
  totalBooks: number;
  filteredCount?: number;
  searchQuery?: string;
  onUploadClick: () => void;
}

export const LibraryHeader: React.FC<LibraryHeaderProps> = ({
  totalBooks,
  filteredCount,
  searchQuery,
  onUploadClick,
}) => {
  const getSubtitle = () => {
    if (totalBooks === 0) {
      return 'Начните свое путешествие с первой книги';
    }

    if (searchQuery && filteredCount !== undefined) {
      const count = filteredCount;
      const word = count === 1 ? 'книга' : count < 5 ? 'книги' : 'книг';
      return `Найдено ${count} ${word}`;
    }

    const word = totalBooks === 1 ? 'книга' : totalBooks < 5 ? 'книги' : 'книг';
    return `${totalBooks} ${word} в коллекции`;
  };

  return (
    <div className="relative mb-6 sm:mb-12 overflow-hidden rounded-xl">
      <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/30" />
      <div className="relative px-4 sm:px-8 py-6 sm:py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6">
          <div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-3 text-foreground">
              Моя библиотека
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              {getSubtitle()}
            </p>
          </div>

          <button
            onClick={onUploadClick}
            className={cn(
              "group inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl",
              "text-sm sm:text-base font-semibold transition-all duration-200",
              "shadow-lg hover:shadow-xl hover:scale-105",
              "bg-primary text-primary-foreground"
            )}
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Загрузить книгу</span>
          </button>
        </div>
      </div>
    </div>
  );
};
