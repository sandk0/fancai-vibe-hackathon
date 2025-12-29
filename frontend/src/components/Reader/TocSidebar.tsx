/**
 * TocSidebar - Table of Contents sidebar with chapter navigation
 *
 * Features:
 * - List of chapters with hierarchical structure
 * - Click to navigate to chapter
 * - Highlight current chapter
 * - Expand/collapse nested chapters
 * - Search/filter chapters (optional)
 * - Theme-aware styling (light/dark/sepia)
 * - Responsive design (mobile overlay, desktop sidebar)
 *
 * @component
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { NavItem } from 'epubjs';
import type { ThemeName } from '@/hooks/epub';

interface TocSidebarProps {
  toc: NavItem[];
  currentHref: string | null;
  onChapterClick: (href: string) => void;
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeName;
}

interface ChapterItemProps {
  item: NavItem;
  currentHref: string | null;
  onChapterClick: (href: string) => void;
  theme: ThemeName;
  level: number;
}

/**
 * Individual chapter item with expand/collapse for nested chapters
 */
const ChapterItem: React.FC<ChapterItemProps> = ({
  item,
  currentHref,
  onChapterClick,
  theme,
  level,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasSubitems = item.subitems && item.subitems.length > 0;

  // Normalize hrefs for comparison (remove hash and query params)
  const normalizeHref = (href: string) => {
    return href.split('#')[0].split('?')[0];
  };

  const isActive = currentHref && normalizeHref(item.href) === normalizeHref(currentHref);

  // Theme-based colors
  const getColors = () => {
    switch (theme) {
      case 'light':
        return {
          text: 'text-gray-800',
          textHover: 'hover:text-blue-600',
          active: 'bg-blue-100 text-blue-700 font-semibold',
          inactive: 'text-gray-700 hover:bg-gray-100',
          border: 'border-gray-200',
        };
      case 'sepia':
        return {
          text: 'text-amber-900',
          textHover: 'hover:text-amber-700',
          active: 'bg-amber-200 text-amber-900 font-semibold',
          inactive: 'text-amber-800 hover:bg-amber-100',
          border: 'border-amber-300',
        };
      case 'dark':
      default:
        return {
          text: 'text-gray-200',
          textHover: 'hover:text-blue-400',
          active: 'bg-blue-900/50 text-blue-300 font-semibold',
          inactive: 'text-gray-300 hover:bg-gray-700',
          border: 'border-gray-600',
        };
    }
  };

  const colors = getColors();

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
          ${isActive ? colors.active : colors.inactive}
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
            className="text-sm"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}

        {/* Chapter label */}
        <span className={`flex-1 text-sm ${colors.text}`}>
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
              theme={theme}
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
  theme,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Theme-based colors
  const getColors = () => {
    switch (theme) {
      case 'light':
        return {
          bg: 'bg-white',
          text: 'text-gray-800',
          subtext: 'text-gray-600',
          border: 'border-gray-300',
          overlay: 'bg-black/30',
          input: 'bg-gray-100 text-gray-800 border-gray-300',
        };
      case 'sepia':
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-900',
          subtext: 'text-amber-700',
          border: 'border-amber-300',
          overlay: 'bg-black/30',
          input: 'bg-amber-100 text-amber-900 border-amber-300',
        };
      case 'dark':
      default:
        return {
          bg: 'bg-gray-800',
          text: 'text-gray-100',
          subtext: 'text-gray-400',
          border: 'border-gray-600',
          overlay: 'bg-black/50',
          input: 'bg-gray-700 text-gray-100 border-gray-600',
        };
    }
  };

  const colors = getColors();

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
        className={`fixed inset-0 z-30 ${colors.overlay} md:hidden`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div
        className={`
          fixed top-0 left-0 z-40 h-full
          ${colors.bg} ${colors.text}
          shadow-2xl
          transition-transform duration-300
          w-full md:w-80
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          flex flex-col
          pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]
        `}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-3 sm:p-4 border-b ${colors.border}`}>
          <h2 className="text-lg font-bold">Содержание</h2>
          <button
            onClick={onClose}
            className={`text-2xl ${colors.subtext} hover:opacity-70 transition-opacity`}
            aria-label="Close table of contents"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className="p-3 sm:p-4 border-b border-gray-700">
          <input
            type="text"
            placeholder="Поиск глав..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`
              w-full px-3 py-2 rounded border
              ${colors.input}
              focus:outline-none focus:ring-2 focus:ring-blue-500
              transition-shadow
            `}
            aria-label="Search chapters"
          />
        </div>

        {/* TOC List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {filteredToc.length === 0 && (
            <p className={`text-center ${colors.subtext} py-8`}>
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
              theme={theme}
              level={0}
            />
          ))}
        </div>

        {/* Footer info */}
        <div className={`p-3 sm:p-4 border-t ${colors.border} ${colors.subtext} text-xs text-center`}>
          {filteredToc.length} глав{searchQuery && ' (фильтровано)'}
        </div>
      </div>
    </>
  );
};
