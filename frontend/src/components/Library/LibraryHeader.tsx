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
    <div className="relative mb-12 overflow-hidden rounded-3xl">
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background: 'linear-gradient(135deg, var(--accent-color) 0%, rgba(147, 51, 234, 0.3) 100%)',
        }}
      />
      <div className="relative px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              Моя библиотека 📚
            </h1>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              {getSubtitle()}
            </p>
          </div>

          <button
            onClick={onUploadClick}
            className={cn(
              "group inline-flex items-center gap-2 px-6 py-3 rounded-xl",
              "font-semibold transition-all duration-200",
              "shadow-lg hover:shadow-xl hover:scale-105"
            )}
            style={{
              backgroundColor: 'var(--accent-color)',
              color: 'white',
            }}
          >
            <Plus className="w-5 h-5" />
            <span>Загрузить книгу</span>
          </button>
        </div>
      </div>
    </div>
  );
};
