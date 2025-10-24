/**
 * ReaderHeader - Book reader header component
 *
 * Displays book title, chapter info, page count, and settings button.
 *
 * @component
 */

import React from 'react';
import { BookOpen, Settings } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { BookDetail } from '@/types/api';

interface ReaderHeaderProps {
  book: BookDetail;
  currentChapter: number;
  chapterTitle: string;
  currentPage: number;
  totalPages: number;
  showSettings: boolean;
  onToggleSettings: () => void;
}

export const ReaderHeader: React.FC<ReaderHeaderProps> = React.memo(({
  book,
  currentChapter,
  chapterTitle,
  currentPage,
  totalPages,
  showSettings,
  onToggleSettings,
}) => {
  const { t } = useTranslation();

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center space-x-3">
          <BookOpen className="h-6 w-6 text-primary-600" />
          <div>
            <h1 className="font-semibold text-gray-900 dark:text-white truncate max-w-xs">
              {book.title}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('reader.chapterLabel')} {currentChapter}: {chapterTitle}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t('reader.page').replace('{num}', String(currentPage)).replace('{total}', String(totalPages))}
          </span>
          <button
            onClick={onToggleSettings}
            className={`p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white ${
              showSettings ? 'bg-gray-100 dark:bg-gray-700 rounded' : ''
            }`}
            title={t('reader.settings')}
            aria-label={t('reader.settings')}
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
});

ReaderHeader.displayName = 'ReaderHeader';
