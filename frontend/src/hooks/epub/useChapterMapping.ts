/**
 * useChapterMapping - Maps EPUB spine hrefs to backend chapter numbers
 *
 * Solves the mismatch between:
 * - Frontend: spine index (0, 1, 2, 3, ...)
 * - Backend: logical chapter numbers (1, 2, 3, ...)
 *
 * The backend parser skips non-chapter spine items (cover, TOC, etc.)
 * and extracts chapter numbers from content ("Глава первая" → 1).
 *
 * This hook creates a mapping by matching:
 * 1. TOC hrefs from epub.js (e.g., "chapter1.xhtml")
 * 2. Chapter titles from API (e.g., "Глава первая")
 *
 * @param toc - Table of contents from epub.js
 * @param chapters - Chapter metadata from backend API
 * @returns Mapping functions for href/spine to chapter numbers
 *
 * @example
 * const { getChapterNumberByHref, getChapterNumberByLocation } = useChapterMapping(toc, chapters);
 * const chapterNum = getChapterNumberByLocation(rendition.currentLocation());
 */

import { useMemo } from 'react';
import type { NavItem, Location } from '@/types/epub';

interface ChapterMetadata {
  id: string;
  number: number;
  title: string;
  word_count: number;
}

interface ChapterMapping {
  /** Maps href to backend chapter number */
  hrefToChapterNumber: Map<string, number>;
  /** Get chapter number by spine href */
  getChapterNumberByHref: (href: string) => number | null;
  /** Get chapter number by epub.js location object */
  getChapterNumberByLocation: (location: Location) => number | null;
}

/**
 * Normalize href for comparison (remove hash, query params, leading slashes)
 */
const normalizeHref = (href: string): string => {
  return href
    .split('#')[0]
    .split('?')[0]
    .replace(/^\/+/, '')
    .toLowerCase();
};

/**
 * Normalize title for comparison (remove extra whitespace, lowercase)
 */
const normalizeTitle = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Check if two titles are similar enough to be considered a match
 */
const titlesMatch = (title1: string, title2: string): boolean => {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);

  // Exact match
  if (norm1 === norm2) return true;

  // One title contains the other (handles cases like "Глава 1" vs "Глава первая: начало")
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  // Extract chapter numbers from Russian words or digits
  const chapterNumRegex = /(первая|вторая|третья|четвертая|пятая|шестая|седьмая|восьмая|девятая|десятая|\d+)/i;
  const match1 = norm1.match(chapterNumRegex);
  const match2 = norm2.match(chapterNumRegex);

  if (match1 && match2) {
    // Convert Russian numerals to numbers for comparison
    const russianNumerals: Record<string, number> = {
      'первая': 1, 'вторая': 2, 'третья': 3, 'четвертая': 4, 'пятая': 5,
      'шестая': 6, 'седьмая': 7, 'восьмая': 8, 'девятая': 9, 'десятая': 10,
    };

    const num1 = russianNumerals[match1[1]] || parseInt(match1[1], 10);
    const num2 = russianNumerals[match2[1]] || parseInt(match2[1], 10);

    if (!isNaN(num1) && !isNaN(num2) && num1 === num2) {
      return true;
    }
  }

  return false;
};

/**
 * Flatten nested TOC structure into a list with hrefs
 */
const flattenToc = (toc: NavItem[]): NavItem[] => {
  const flattened: NavItem[] = [];

  const traverse = (items: NavItem[]) => {
    items.forEach(item => {
      flattened.push(item);
      if (item.subitems && item.subitems.length > 0) {
        traverse(item.subitems);
      }
    });
  };

  traverse(toc);
  return flattened;
};

export const useChapterMapping = (
  toc: NavItem[],
  chapters: ChapterMetadata[]
): ChapterMapping => {

  const hrefToChapterNumber = useMemo(() => {
    const mapping = new Map<string, number>();

    if (!toc || toc.length === 0 || !chapters || chapters.length === 0) {
      console.warn('⚠️ [useChapterMapping] TOC or chapters data is empty');
      return mapping;
    }

    console.log('📖 [useChapterMapping] Creating chapter mapping...', {
      tocItems: toc.length,
      chapters: chapters.length,
    });

    // Flatten TOC to get all hrefs
    const flatToc = flattenToc(toc);

    // Sort chapters by chapter number for sequential fallback
    const sortedChapters = [...chapters].sort((a, b) => a.number - b.number);

    // Try to match each TOC item to a chapter by title
    let matchedCount = 0;
    flatToc.forEach((tocItem, index) => {
      const tocTitle = tocItem.label || '';
      const normalizedHref = normalizeHref(tocItem.href);

      // Strategy 1: Match by title similarity
      const matchedChapter = sortedChapters.find(chapter =>
        titlesMatch(tocTitle, chapter.title)
      );

      if (matchedChapter) {
        mapping.set(normalizedHref, matchedChapter.number);
        matchedCount++;
        console.log(`✅ [useChapterMapping] Matched: "${tocTitle}" → Chapter ${matchedChapter.number}`);
      } else {
        // Strategy 2: Sequential fallback (if no title match, assume sequential order)
        // This works if TOC items are in the same order as chapters
        if (index < sortedChapters.length) {
          const fallbackChapter = sortedChapters[index];
          mapping.set(normalizedHref, fallbackChapter.number);
          console.log(`📝 [useChapterMapping] Fallback: "${tocTitle}" → Chapter ${fallbackChapter.number} (index ${index})`);
        } else {
          console.warn(`⚠️ [useChapterMapping] No match for TOC item: "${tocTitle}" (href: ${normalizedHref})`);
        }
      }
    });

    console.log(`🎯 [useChapterMapping] Mapping complete: ${matchedCount}/${flatToc.length} matched by title, ${mapping.size} total`);

    return mapping;
  }, [toc, chapters]);

  const getChapterNumberByHref = (href: string): number | null => {
    const normalized = normalizeHref(href);
    const chapterNumber = hrefToChapterNumber.get(normalized);

    if (chapterNumber === undefined) {
      console.warn(`⚠️ [useChapterMapping] No chapter number found for href: ${href}`);
      return null;
    }

    return chapterNumber;
  };

  const getChapterNumberByLocation = (location: Location): number | null => {
    if (!location || !location.start || !location.start.href) {
      console.warn('⚠️ [useChapterMapping] Invalid location object');
      return null;
    }

    return getChapterNumberByHref(location.start.href);
  };

  return {
    hrefToChapterNumber,
    getChapterNumberByHref,
    getChapterNumberByLocation,
  };
};
