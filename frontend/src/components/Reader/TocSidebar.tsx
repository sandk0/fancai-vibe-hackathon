/**
 * TocSidebar - Table of Contents sidebar with chapter navigation
 *
 * Features:
 * - List of chapters with hierarchical structure
 * - Click to navigate to chapter
 * - Highlight current chapter
 * - Expand/collapse nested chapters
 * - Search/filter chapters (optional)
 * - Theme-aware styling via CSS variables (light/dark/sepia)
 * - Responsive design (mobile overlay, desktop sidebar)
 *
 * @component
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { NavItem } from 'epubjs';

interface TocSidebarProps {
  toc: NavItem[];
  currentHref: string | null;
  onChapterClick: (href: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface ChapterItemProps {
  item: NavItem;
  currentHref: string | null;
  onChapterClick: (href: string) => void;
  level: number;
}

/**
 * Individual chapter item with expand/collapse for nested chapters
 */
const ChapterItem: React.FC<ChapterItemProps> = ({
  item,
  currentHref,
  onChapterClick,
  level,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasSubitems = item.subitems && item.subitems.length > 0;

  // Normalize hrefs for comparison (remove hash and query params)
  const normalizeHref = (href: string) => {
    return href.split('#')[0].split('?')[0];
  };

  const isActive = currentHref && normalizeHref(item.href) === normalizeHref(currentHref);

  const handleClick = useCallback(() => {
    onChapterClick(item.href);
  }, [item.href, onChapterClick]);

  const toggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  return (
    <div className={`${level > 0 ? 'ml-4' : ''}`}>
      <div
        className={`
          flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors
          ${isActive
            ? 'bg-primary/20 text-primary font-semibold'
            : 'text-foreground hover:bg-muted'}
        `}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={`Navigate to ${item.label}`}
        aria-current={isActive ? 'page' : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {/* Expand/collapse button for nested chapters */}
        {hasSubitems && (
          <button
            onClick={toggleExpand}
            className="text-sm text-muted-foreground"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}

        {/* Chapter label */}
        <span className="flex-1 text-sm">
          {item.label || 'Untitled Chapter'}
        </span>
      </div>

      {/* Nested chapters */}
      {hasSubitems && isExpanded && (
        <div className="mt-1">
          {item.subitems!.map((subitem, index) => (
            <ChapterItem
              key={subitem.id || `${item.id}-${index}`}
              item={subitem}
              currentHref={currentHref}
              onChapterClick={onChapterClick}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
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
}) => {
  const [searchQuery, setSearchQuery] = useState('');

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

        // Include item if it matches or has matching subitems
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

  // Prevent body scroll when sidebar is open on mobile
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

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 z-30 bg-black/40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 left-0 z-40 h-full
          bg-card text-card-foreground
          shadow-2xl
          transition-transform duration-300
          w-full md:w-80
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          flex flex-col
          pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border">
          <h2 className="text-lg font-bold">Содержание</h2>
          <button
            onClick={onClose}
            className="text-2xl text-muted-foreground hover:opacity-70 transition-opacity"
            aria-label="Close table of contents"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className="p-3 sm:p-4 border-b border-border">
          <input
            type="text"
            placeholder="Поиск глав..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="
              w-full px-3 py-2 rounded border
              bg-input text-foreground border-border
              focus:outline-none focus:ring-2 focus:ring-ring
              transition-shadow
            "
            aria-label="Search chapters"
          />
        </div>

        {/* TOC List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {filteredToc.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              {searchQuery ? 'Главы не найдены' : 'Содержание отсутствует'}
            </p>
          )}

          {filteredToc.map((item, index) => (
            <ChapterItem
              key={item.id || index}
              item={item}
              currentHref={currentHref}
              onChapterClick={(href) => {
                onChapterClick(href);
                // Close sidebar on mobile after navigation
                if (window.innerWidth < 768) {
                  onClose();
                }
              }}
              level={0}
            />
          ))}
        </div>

        {/* Footer info */}
        <div className="p-3 sm:p-4 border-t border-border text-muted-foreground text-xs text-center">
          {filteredToc.length} глав{searchQuery && ' (фильтровано)'}
        </div>
      </div>
    </>
  );
};
