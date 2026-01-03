/**
 * BookInfo - Modal displaying full book metadata
 *
 * Displays comprehensive book information extracted from EPUB metadata:
 * - Title and Author
 * - Description/Synopsis
 * - Publisher and Publication Date
 * - Language and Copyright
 *
 * Features:
 * - Theme-aware styling matching reader theme
 * - Close on Escape key or outside click
 * - Responsive design
 * - Graceful handling of missing metadata
 *
 * @component
 */

import React, { useEffect } from 'react';
import { m } from 'framer-motion';
import { X, Book as BookIcon, User, Calendar, Globe, Copyright } from 'lucide-react';
import type { BookMetadata } from '@/hooks/epub/useBookMetadata';
import type { ThemeName } from '@/hooks/epub/useEpubThemes';

interface BookInfoProps {
  metadata: BookMetadata;
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeName;
}

/**
 * BookInfo modal component
 */
export const BookInfo: React.FC<BookInfoProps> = ({
  metadata,
  isOpen,
  onClose,
  theme,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Theme-aware colors
  const getThemeColors = () => {
    switch (theme) {
      case 'light':
        return {
          bg: 'bg-white',
          text: 'text-gray-900',
          textSecondary: 'text-gray-600',
          border: 'border-gray-200',
          hover: 'hover:bg-gray-100',
        };
      case 'sepia':
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-900',
          textSecondary: 'text-amber-700',
          border: 'border-amber-200',
          hover: 'hover:bg-amber-100',
        };
      case 'dark':
      default:
        return {
          bg: 'bg-gray-800',
          text: 'text-gray-100',
          textSecondary: 'text-gray-400',
          border: 'border-gray-600',
          hover: 'hover:bg-gray-700',
        };
    }
  };

  const colors = getThemeColors();

  // Format publication date if available
  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formattedDate = formatDate(metadata.pubdate);

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <m.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className={`relative max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-lg ${colors.bg} shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`sticky top-0 ${colors.bg} border-b ${colors.border} px-6 py-4 flex items-center justify-between z-10`}>
          <h2 className={`text-xl font-bold ${colors.text} flex items-center gap-2`}>
            <BookIcon className="h-5 w-5" />
            О книге
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg ${colors.hover} transition-colors ${colors.textSecondary}`}
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Title and Author */}
          <div className="space-y-3">
            <div>
              <h3 className={`text-2xl font-bold ${colors.text} mb-1`}>
                {metadata.title}
              </h3>
              <div className={`flex items-center gap-2 ${colors.textSecondary}`}>
                <User className="h-4 w-4" />
                <span className="text-lg">{metadata.creator}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {metadata.description && (
            <div className="space-y-2">
              <h4 className={`text-sm font-semibold uppercase ${colors.textSecondary}`}>
                Описание
              </h4>
              <p className={`${colors.text} text-base leading-relaxed`}>
                {metadata.description}
              </p>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="space-y-3">
            {/* Publisher */}
            {metadata.publisher && (
              <div className="flex items-start gap-3">
                <BookIcon className={`h-5 w-5 mt-0.5 ${colors.textSecondary}`} />
                <div className="flex-1">
                  <div className={`text-xs font-semibold uppercase ${colors.textSecondary} mb-1`}>
                    Издательство
                  </div>
                  <div className={colors.text}>{metadata.publisher}</div>
                </div>
              </div>
            )}

            {/* Publication Date */}
            {formattedDate && (
              <div className="flex items-start gap-3">
                <Calendar className={`h-5 w-5 mt-0.5 ${colors.textSecondary}`} />
                <div className="flex-1">
                  <div className={`text-xs font-semibold uppercase ${colors.textSecondary} mb-1`}>
                    Дата публикации
                  </div>
                  <div className={colors.text}>{formattedDate}</div>
                </div>
              </div>
            )}

            {/* Language */}
            {metadata.language && (
              <div className="flex items-start gap-3">
                <Globe className={`h-5 w-5 mt-0.5 ${colors.textSecondary}`} />
                <div className="flex-1">
                  <div className={`text-xs font-semibold uppercase ${colors.textSecondary} mb-1`}>
                    Язык
                  </div>
                  <div className={colors.text}>
                    {metadata.language.toUpperCase()}
                  </div>
                </div>
              </div>
            )}

            {/* Copyright */}
            {metadata.rights && (
              <div className="flex items-start gap-3">
                <Copyright className={`h-5 w-5 mt-0.5 ${colors.textSecondary}`} />
                <div className="flex-1">
                  <div className={`text-xs font-semibold uppercase ${colors.textSecondary} mb-1`}>
                    Права
                  </div>
                  <div className={`${colors.text} text-sm`}>{metadata.rights}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer (optional - can add actions here) */}
        <div className={`sticky bottom-0 ${colors.bg} border-t ${colors.border} px-6 py-4`}>
          <button
            onClick={onClose}
            className={`w-full px-4 py-2 rounded-lg ${colors.hover} ${colors.text} font-medium transition-colors`}
          >
            Закрыть
          </button>
        </div>
      </m.div>
    </m.div>
  );
};
