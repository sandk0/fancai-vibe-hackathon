/**
 * LibraryPagination - Компонент пагинации для библиотеки
 *
 * Отображает:
 * - Информацию о текущей странице и общем количестве
 * - Кнопки навигации (назад/вперед)
 * - Номера страниц (до 5 одновременно)
 * - Умную навигацию (показывает страницы вокруг текущей)
 *
 * @param currentPage - Текущая страница (1-indexed)
 * @param totalPages - Общее количество страниц
 * @param totalItems - Общее количество элементов
 * @param currentItems - Количество элементов на текущей странице
 * @param onPageChange - Callback при изменении страницы
 * @param onNextPage - Callback для следующей страницы
 * @param onPrevPage - Callback для предыдущей страницы
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LibraryPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  currentItems: number;
  onPageChange: (page: number) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
}

export const LibraryPagination: React.FC<LibraryPaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  currentItems,
  onPageChange,
  onNextPage,
  onPrevPage,
}) => {
  if (totalPages <= 1) return null;

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  // Generate page numbers to display (max 5)
  const getPageNumbers = (): number[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 3) {
      return [1, 2, 3, 4, 5];
    }

    if (currentPage >= totalPages - 2) {
      return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4">
      {/* Page info */}
      <div className="text-sm text-muted-foreground">
        Страница {currentPage} из {totalPages} - Показано {currentItems} из {totalItems} книг
      </div>

      {/* Pagination controls */}
      <div className="flex items-center gap-2">
        {/* Previous button */}
        <button
          onClick={onPrevPage}
          disabled={!canGoPrev}
          className={cn(
            "p-2 rounded-lg border-2 transition-all bg-card border-border text-foreground",
            !canGoPrev
              ? "opacity-50 cursor-not-allowed"
              : "hover:scale-105 hover:bg-muted"
          )}
          aria-label="Предыдущая страница"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Page numbers */}
        <div className="flex gap-1">
          {pageNumbers.map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={cn(
                "w-10 h-10 rounded-lg border-2 transition-all font-semibold border-border",
                currentPage === pageNum
                  ? "bg-primary text-primary-foreground ring-2 ring-ring"
                  : "bg-card text-foreground hover:scale-105 hover:bg-muted"
              )}
              aria-label={`Страница ${pageNum}`}
              aria-current={currentPage === pageNum ? 'page' : undefined}
            >
              {pageNum}
            </button>
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={onNextPage}
          disabled={!canGoNext}
          className={cn(
            "p-2 rounded-lg border-2 transition-all bg-card border-border text-foreground",
            !canGoNext
              ? "opacity-50 cursor-not-allowed"
              : "hover:scale-105 hover:bg-muted"
          )}
          aria-label="Следующая страница"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
