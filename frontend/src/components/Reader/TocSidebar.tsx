/**
 * TocSidebar - Redesigned Table of Contents sidebar with modern animations
 *
 * Features:
 * - Slide-in panel from right (overlay on mobile)
 * - Backdrop blur with dark overlay
 * - Current chapter highlighting with accent color
 * - Progress indicator for each chapter
 * - Close button and ESC key support
 * - Touch-friendly items (44px minimum height)
 * - Smooth framer-motion animations
 * - Theme-aware styling via CSS variables
 *
 * @component
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Check, Search, BookOpen } from 'lucide-react';
import type { NavItem } from 'epubjs';

interface TocSidebarProps {
  toc: NavItem[];
  currentHref: string | null;
  onChapterClick: (href: string) => void;
  isOpen: boolean;
  onClose: () => void;
  /** Optional: chapter progress map (href -> progress 0-100) */
  chapterProgress?: Map<string, number>;
  /** Optional: total chapters for displaying count */
  totalChapters?: number;
}

interface ChapterItemProps {
  item: NavItem;
  currentHref: string | null;
  onChapterClick: (href: string) => void;
  level: number;
  index: number;
  progress?: number;
  isCompleted?: boolean;
}

/**
 * Normalize href for comparison (remove hash and query params)
 */
const normalizeHref = (href: string): string => {
  return href.split('#')[0].split('?')[0];
};

/**
 * Animation variants for staggered children
 */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
};

/**
 * Individual chapter item with expand/collapse for nested chapters
 */
const ChapterItem: React.FC<ChapterItemProps> = ({
  item,
  currentHref,
  onChapterClick,
  level,
  index,
  progress = 0,
  isCompleted = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasSubitems = item.subitems && item.subitems.length > 0;

  const isActive = currentHref && normalizeHref(item.href) === normalizeHref(currentHref);

  const handleClick = useCallback(() => {
    onChapterClick(item.href);
  }, [item.href, onChapterClick]);

  const toggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  return (
    <m.div
      variants={itemVariants}
      className={level > 0 ? 'ml-4' : ''}
    >
      <div
        className={`
          group relative flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer
          transition-all duration-200 ease-out
          min-h-[44px]
          ${isActive
            ? 'bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]'
            : 'hover:bg-[var(--color-bg-emphasis)] text-[var(--color-text-default)]'
          }
        `}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={`Navigate to ${item.label}`}
        aria-current={isActive ? 'page' : undefined}
        onKeyDown={handleKeyDown}
      >
        {/* Progress/completion indicator */}
        <div className="relative flex-shrink-0 w-6 h-6 flex items-center justify-center">
          {isCompleted ? (
            <m.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-5 h-5 rounded-full bg-[var(--color-success)] flex items-center justify-center"
            >
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </m.div>
          ) : progress > 0 ? (
            <div className="relative w-5 h-5">
              <svg className="w-5 h-5 -rotate-90" viewBox="0 0 20 20">
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  fill="none"
                  stroke="var(--color-border-default)"
                  strokeWidth="2"
                />
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  fill="none"
                  stroke="var(--color-accent-500)"
                  strokeWidth="2"
                  strokeDasharray={`${progress * 0.5} 50`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          ) : (
            <span className="text-xs font-medium text-[var(--color-text-subtle)]">
              {index + 1}
            </span>
          )}
        </div>

        {/* Chapter label */}
        <span
          className={`
            flex-1 text-sm leading-tight
            ${isActive ? 'font-semibold' : 'font-normal'}
            ${level > 0 ? 'text-[var(--color-text-muted)]' : ''}
          `}
        >
          {item.label || 'Untitled Chapter'}
        </span>

        {/* Expand/collapse button for nested chapters */}
        {hasSubitems && (
          <m.button
            onClick={toggleExpand}
            className="p-1 rounded-md text-[var(--color-text-subtle)] hover:text-[var(--color-text-default)] hover:bg-[var(--color-bg-muted)] transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="w-4 h-4" />
          </m.button>
        )}

        {/* Active indicator line */}
        {isActive && (
          <m.div
            layoutId="activeChapter"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-[hsl(var(--primary))]"
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </div>

      {/* Nested chapters */}
      <AnimatePresence>
        {hasSubitems && isExpanded && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden mt-1"
          >
            {item.subitems!.map((subitem, subIndex) => (
              <ChapterItem
                key={subitem.id || `${item.id}-${subIndex}`}
                item={subitem}
                currentHref={currentHref}
                onChapterClick={onChapterClick}
                level={level + 1}
                index={subIndex}
                progress={0}
                isCompleted={false}
              />
            ))}
          </m.div>
        )}
      </AnimatePresence>
    </m.div>
  );
};

/**
 * Main TOC Sidebar component
 */
export const TocSidebar: React.FC<TocSidebarProps> = ({
  toc,
  currentHref,
  onChapterClick,
  isOpen,
  onClose,
  chapterProgress,
  totalChapters,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Filter TOC by search query
  const filteredToc = useMemo(() => {
    if (!searchQuery.trim()) return toc;

    const query = searchQuery.toLowerCase();

    const filterItems = (items: NavItem[]): NavItem[] => {
      const results: NavItem[] = [];

      for (const item of items) {
        const matchesLabel = item.label.toLowerCase().includes(query);
        const filteredSubitems = item.subitems
          ? filterItems(item.subitems)
          : [];

        if (matchesLabel || filteredSubitems.length > 0) {
          results.push({
            ...item,
            subitems: filteredSubitems.length > 0 ? filteredSubitems : item.subitems,
          });
        }
      }

      return results;
    };

    return filterItems(toc);
  }, [toc, searchQuery]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Focus search input when sidebar opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    if (!chapterProgress || chapterProgress.size === 0) return 0;
    const total = Array.from(chapterProgress.values()).reduce((sum: number, p: number) => sum + p, 0);
    return Math.round(total / chapterProgress.size);
  }, [chapterProgress]);

  const handleChapterClick = useCallback((href: string) => {
    onChapterClick(href);
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      onClose();
    }
  }, [onChapterClick, onClose]);

  const displayedChapterCount = totalChapters ?? toc.length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with blur */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[400] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sidebar panel */}
          <m.div
            ref={sidebarRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
            }}
            className="fixed top-0 right-0 z-[500] h-full w-full md:w-96 bg-[var(--color-bg-base)] shadow-2xl flex flex-col overflow-hidden pt-safe pb-safe pr-safe"
            role="dialog"
            aria-modal="true"
            aria-label="Table of contents"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-default)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-[hsl(var(--primary))]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text-default)]">
                    Содержание
                  </h2>
                  <p className="text-xs text-[var(--color-text-subtle)]">
                    {displayedChapterCount} глав{overallProgress > 0 ? ` - ${overallProgress}%` : ''}
                  </p>
                </div>
              </div>
              <m.button
                onClick={onClose}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-default)] hover:bg-[var(--color-bg-emphasis)] transition-colors"
                aria-label="Close table of contents"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X className="w-5 h-5" />
              </m.button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-[var(--color-border-muted)]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-subtle)]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Поиск глав..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="
                    w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-xl
                    bg-[var(--color-bg-subtle)] text-[var(--color-text-default)]
                    border border-[var(--color-border-default)]
                    placeholder:text-[var(--color-text-subtle)]
                    focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] focus:border-transparent
                    transition-all duration-200
                    text-base
                  "
                  aria-label="Search chapters"
                />
                {searchQuery && (
                  <m.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-[var(--color-text-subtle)] hover:text-[var(--color-text-default)] hover:bg-[var(--color-bg-muted)] transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </m.button>
                )}
              </div>
            </div>

            {/* Progress bar (if progress data available) */}
            {overallProgress > 0 && (
              <div className="px-5 py-2">
                <div className="h-1 rounded-full bg-[var(--color-bg-emphasis)] overflow-hidden">
                  <m.div
                    className="h-full rounded-full bg-[var(--color-accent-500)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${overallProgress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}

            {/* TOC List */}
            <nav
              role="navigation"
              aria-label="Оглавление"
              className="flex-1 overflow-y-auto px-3 py-4 modal-scrollable"
            >
              <m.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
              {filteredToc.length === 0 ? (
                <m.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="w-16 h-16 rounded-xl bg-[var(--color-bg-emphasis)] flex items-center justify-center mb-4">
                    <Search className="w-7 h-7 text-[var(--color-text-subtle)]" />
                  </div>
                  <p className="text-[var(--color-text-muted)] font-medium">
                    {searchQuery ? 'Главы не найдены' : 'Содержание отсутствует'}
                  </p>
                  {searchQuery && (
                    <p className="text-[var(--color-text-subtle)] text-sm mt-1">
                      Попробуйте другой запрос
                    </p>
                  )}
                </m.div>
              ) : (
                <div className="space-y-1">
                  {filteredToc.map((item, index) => (
                    <ChapterItem
                      key={item.id || index}
                      item={item}
                      currentHref={currentHref}
                      onChapterClick={handleChapterClick}
                      level={0}
                      index={index}
                      progress={chapterProgress?.get(normalizeHref(item.href)) ?? 0}
                      isCompleted={(chapterProgress?.get(normalizeHref(item.href)) ?? 0) >= 100}
                    />
                  ))}
                </div>
              )}
              </m.div>
            </nav>

            {/* Footer with keyboard hint */}
            <div className="px-5 py-3 border-t border-[var(--color-border-muted)]">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-subtle)]">
                <span>
                  {filteredToc.length} из {displayedChapterCount} глав
                  {searchQuery && ' (фильтр)'}
                </span>
                <div className="hidden md:flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-emphasis)] text-[10px] font-mono">
                    ESC
                  </kbd>
                  <span>закрыть</span>
                </div>
              </div>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
};
