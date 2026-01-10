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
import { Z_INDEX } from '@/lib/zIndex';
import type { BookMetadata } from '@/hooks/epub/useBookMetadata';

interface BookInfoProps {
  metadata: BookMetadata;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * BookInfo modal component
 */
export const BookInfo: React.FC<BookInfoProps> = ({
  metadata,
  isOpen,
  onClose,
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
      className="fixed inset-0 flex items-center justify-center px-4 pointer-events-none"
      style={{ zIndex: Z_INDEX.modal }}
      onClick={onClose}
    >
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
        style={{ zIndex: Z_INDEX.modalOverlay }}
      />
      <m.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-lg bg-popover shadow-2xl pointer-events-auto"
        style={{ zIndex: Z_INDEX.modal }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-popover border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-popover-foreground flex items-center gap-2">
            <BookIcon className="h-5 w-5" />
            О книге
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
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
              <h3 className="text-2xl font-bold text-popover-foreground mb-1">
                {metadata.title}
              </h3>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span className="text-lg">{metadata.creator}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {metadata.description && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold uppercase text-muted-foreground">
                Описание
              </h4>
              <p className="text-popover-foreground text-base leading-relaxed">
                {metadata.description}
              </p>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="space-y-3">
            {/* Publisher */}
            {metadata.publisher && (
              <div className="flex items-start gap-3">
                <BookIcon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                    Издательство
                  </div>
                  <div className="text-popover-foreground">{metadata.publisher}</div>
                </div>
              </div>
            )}

            {/* Publication Date */}
            {formattedDate && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                    Дата публикации
                  </div>
                  <div className="text-popover-foreground">{formattedDate}</div>
                </div>
              </div>
            )}

            {/* Language */}
            {metadata.language && (
              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                    Язык
                  </div>
                  <div className="text-popover-foreground">
                    {metadata.language.toUpperCase()}
                  </div>
                </div>
              </div>
            )}

            {/* Copyright */}
            {metadata.rights && (
              <div className="flex items-start gap-3">
                <Copyright className="h-5 w-5 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                    Права
                  </div>
                  <div className="text-popover-foreground text-sm">{metadata.rights}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer (optional - can add actions here) */}
        <div className="sticky bottom-0 bg-popover border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg hover:bg-muted text-popover-foreground font-medium transition-colors"
          >
            Закрыть
          </button>
        </div>
      </m.div>
    </m.div>
  );
};
