/**
 * LibrarySearch - Панель поиска, сортировки и фильтрации
 *
 * Включает:
 * - Поле поиска по названию, автору, жанру
 * - Переключение режима отображения (grid/list)
 * - Dropdown сортировки
 * - Кнопка фильтров (с индикатором активности)
 *
 * @param searchQuery - Текущий поисковый запрос
 * @param onSearchChange - Callback при изменении поиска
 * @param viewMode - Режим отображения (grid/list)
 * @param onViewModeChange - Callback при изменении режима
 * @param sortBy - Текущий критерий сортировки
 * @param onSortChange - Callback при изменении сортировки
 * @param showFilters - Показаны ли фильтры
 * @param onToggleFilters - Callback для переключения фильтров
 */

import React from 'react';
import { Search, Grid3x3, List, ArrowUpDown, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LibrarySearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  sortBy: string;
  onSortChange: (sortBy: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
}

export const LibrarySearch: React.FC<LibrarySearchProps> = ({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  showFilters,
  onToggleFilters,
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-8">
      {/* Search Input */}
      <div className="flex-1">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5"
            style={{ color: 'var(--text-tertiary)' }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Поиск по названию, автору, жанру..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border-2 transition-all focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {/* Grid View Button */}
        <button
          onClick={() => onViewModeChange('grid')}
          className={cn(
            "p-3 rounded-xl border-2 transition-all",
            viewMode === 'grid' && "ring-2"
          )}
          style={{
            backgroundColor: viewMode === 'grid' ? 'var(--accent-color)' : 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
            color: viewMode === 'grid' ? 'white' : 'var(--text-primary)',
            ...(viewMode === 'grid' && { ringColor: 'var(--accent-color)' }),
          }}
          aria-label="Режим сетки"
        >
          <Grid3x3 className="w-5 h-5" />
        </button>

        {/* List View Button */}
        <button
          onClick={() => onViewModeChange('list')}
          className={cn(
            "p-3 rounded-xl border-2 transition-all",
            viewMode === 'list' && "ring-2"
          )}
          style={{
            backgroundColor: viewMode === 'list' ? 'var(--accent-color)' : 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
            color: viewMode === 'list' ? 'white' : 'var(--text-primary)',
            ...(viewMode === 'list' && { ringColor: 'var(--accent-color)' }),
          }}
          aria-label="Режим списка"
        >
          <List className="w-5 h-5" />
        </button>

        {/* Sorting Dropdown */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="appearance-none pl-10 pr-8 py-3 rounded-xl border-2 transition-all cursor-pointer focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
            aria-label="Сортировка"
          >
            <option value="created_desc">Новые → Старые</option>
            <option value="created_asc">Старые → Новые</option>
            <option value="title_asc">Название А → Я</option>
            <option value="title_desc">Название Я → А</option>
            <option value="author_asc">Автор А → Я</option>
            <option value="author_desc">Автор Я → А</option>
            <option value="accessed_desc">Недавно читал</option>
          </select>
          <ArrowUpDown
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 pointer-events-none"
            style={{ color: 'var(--text-tertiary)' }}
          />
        </div>

        {/* Filters Button */}
        <button
          onClick={onToggleFilters}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all",
            showFilters && "ring-2"
          )}
          style={{
            backgroundColor: showFilters ? 'var(--accent-color)' : 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
            color: showFilters ? 'white' : 'var(--text-primary)',
            ...(showFilters && { ringColor: 'var(--accent-color)' }),
          }}
          aria-label="Переключить фильтры"
        >
          <Filter className="w-5 h-5" />
          <span className="hidden sm:inline">Фильтры</span>
        </button>
      </div>
    </div>
  );
};
