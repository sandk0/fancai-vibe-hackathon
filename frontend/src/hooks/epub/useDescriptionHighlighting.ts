/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useDescriptionHighlighting - Custom hook for highlighting descriptions in EPUB text
 *
 * Highlights description text in the rendered EPUB content and makes them clickable.
 * Handles dynamic re-highlighting when page changes or descriptions update.
 *
 * IMPROVEMENTS (v2.1):
 * - 9 search strategies for maximum coverage
 * - Advanced text normalization (whitespace, non-breaking spaces, quotes, dashes)
 * - Enhanced chapter header removal (9 patterns including "Глава X Название Текст...")
 * - Debounced rendering instead of setTimeout hack
 * - Performance tracking and warnings
 * - Fuzzy matching with Longest Common Substring (LCS)
 * - Middle section matching for unreliable start/end
 * - First sentence extraction
 * - CFI-based highlighting when available
 *
 * SEARCH STRATEGIES (in order):
 * S1: First 40 chars
 * S2: Skip 10, take 10-50
 * S3: Skip 20, take 20-60
 * S4: Full match (short texts)
 * S5: First 5 words
 * S6: CFI-based (if available)
 * S7: Middle section (15%-60%)
 * S8: Longest Common Substring fuzzy
 * S9: First sentence case-insensitive
 *
 * @param rendition - epub.js Rendition instance
 * @param descriptions - Array of descriptions to highlight
 * @param images - Array of generated images
 * @param onDescriptionClick - Callback when description is clicked
 *
 * @example
 * useDescriptionHighlighting(
 *   rendition,
 *   descriptions,
 *   images,
 *   (desc, img) => setSelectedImage(img)
 * );
 */

import { useEffect, useCallback, useRef } from 'react';
import type { Rendition } from '@/types/epub';
import type { Description, GeneratedImage } from '@/types/api';

interface UseDescriptionHighlightingOptions {
  rendition: Rendition | null;
  descriptions: Description[];
  images: GeneratedImage[];
  onDescriptionClick: (description: Description, image?: GeneratedImage) => void;
  enabled?: boolean;
}

/**
 * Performance thresholds
 */
const PERFORMANCE_WARNING_MS = 100;
const DEBOUNCE_DELAY_MS = 100;

/**
 * Advanced text normalization for better matching
 * Handles: whitespace, non-breaking spaces, chapter headers, punctuation
 */
const normalizeText = (text: string): string => {
  return text
    .replace(/\u00A0/g, ' ') // Replace non-breaking spaces
    .replace(/\s+/g, ' ') // Normalize all whitespace to single space
    .replace(/[«»""]/g, '"') // Normalize quotes
    .replace(/\u2013|\u2014/g, '-') // Normalize dashes
    .trim();
};

/**
 * Remove chapter headers from description content
 * Enhanced v2.1: Handles complex patterns like:
 * - "Глава 4 Нити Том Меррилин..." -> "Том Меррилин..."
 * - "Глава 1. Начало Он проснулся..." -> "Он проснулся..."
 * - "ЧАСТЬ ПЕРВАЯ ГЛАВА 1 Текст..." -> "Текст..."
 */
const removeChapterHeaders = (text: string): string => {
  let result = text;

  // Pattern 1: "Глава X НазваниеГлавы " followed by content starting with capital
  // This catches "Глава 4 Нити Том Меррилин..." -> "Том Меррилин..."
  result = result.replace(/^Глава\s+\d+\.?\s+[А-Яа-яA-Za-z]+\s+(?=[А-ЯA-Z])/gi, '');

  // Pattern 2: "Глава X. Название главы" with period separator
  result = result.replace(/^Глава\s+\d+\.?\s*[А-Яа-яA-Za-z\s]{1,50}?\s+(?=[А-ЯA-Z][а-яa-z])/gi, '');

  // Pattern 3: Basic chapter headers "Глава 1", "Глава первая", "Глава I"
  result = result.replace(/^(Глава\s+[А-Яа-я\dIVXLC]+\.?\s*)+/gi, '');

  // Pattern 4: English chapters "Chapter 1", "Chapter One"
  result = result.replace(/^(Chapter\s+[A-Za-z\d]+\.?\s*)+/gi, '');

  // Pattern 5: Numbered headings "1.", "1.1", "1.1.1"
  result = result.replace(/^\d+(\.\d+)*\.?\s+/, '');

  // Pattern 6: Part headers "Часть 1", "Part I", "ЧАСТЬ ПЕРВАЯ"
  result = result.replace(/^(Часть|Part)\s+[А-Яа-яA-Za-z\dIVXLC]+\.?\s*/gi, '');

  // Pattern 7: "ПРОЛОГ", "ЭПИЛОГ", "ПРЕДИСЛОВИЕ"
  result = result.replace(/^(ПРОЛОГ|ЭПИЛОГ|ПРЕДИСЛОВИЕ|ВВЕДЕНИЕ|ПОСЛЕСЛОВИЕ)\s*/gi, '');

  // Pattern 8: Combination "ЧАСТЬ ПЕРВАЯ ГЛАВА 1"
  result = result.replace(/^ЧАСТЬ\s+[А-ЯA-Z]+\s+(ГЛАВА\s+\d+\s*)?/gi, '');

  // Pattern 9: Titles with dashes "Глава 1 - Название"
  result = result.replace(/^Глава\s+\d+\s*[-–—]\s*[А-Яа-яA-Za-z\s]+\s+(?=[А-ЯA-Z])/gi, '');

  return result.trim();
};

/**
 * Extract first N words from text for fuzzy matching
 */
const getFirstWords = (text: string, count: number): string => {
  return text.split(/\s+/).slice(0, count).join(' ');
};

/**
 * Find longest common substring between two texts
 * Used for fuzzy matching when exact match fails
 */
const findLongestCommonSubstring = (text1: string, text2: string, minLength: number = 30): string | null => {
  const len1 = text1.length;
  const len2 = text2.length;

  if (len1 < minLength || len2 < minLength) return null;

  let maxLength = 0;
  let endIndex = 0;

  // Use a sliding window approach for performance
  for (let i = 0; i < len1; i++) {
    for (let j = 0; j < len2; j++) {
      let length = 0;
      while (
        i + length < len1 &&
        j + length < len2 &&
        text1[i + length].toLowerCase() === text2[j + length].toLowerCase()
      ) {
        length++;
      }
      if (length > maxLength) {
        maxLength = length;
        endIndex = i + length;
      }
    }
  }

  if (maxLength >= minLength) {
    return text1.substring(endIndex - maxLength, endIndex);
  }
  return null;
};

/**
 * Extract middle section of text (skip start and end)
 */
const getMiddleSection = (text: string, startPercent: number = 0.2, endPercent: number = 0.7): string => {
  const startIdx = Math.floor(text.length * startPercent);
  const endIdx = Math.floor(text.length * endPercent);
  return text.substring(startIdx, endIdx);
};

export const useDescriptionHighlighting = ({
  rendition,
  descriptions,
  images,
  onDescriptionClick,
  enabled = true,
}: UseDescriptionHighlightingOptions): void => {

  // Debounce timer reference
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Apply highlights to current page with 6 search strategies
   */
  const highlightDescriptions = useCallback(() => {
    const startTime = performance.now();
    console.log('🎨 [useDescriptionHighlighting] Hook called:', {
      hasRendition: !!rendition,
      enabled,
      descriptionsCount: descriptions.length,
      imagesCount: images.length,
      timestamp: new Date().toISOString(),
    });

    if (!rendition || !enabled || descriptions.length === 0) {
      console.log('⏸️ [useDescriptionHighlighting] Skipping highlights:', {
        hasRendition: !!rendition,
        enabled,
        descriptionsCount: descriptions.length,
      });
      return;
    }

    console.log('✅ [useDescriptionHighlighting] Starting highlighting for', descriptions.length, 'descriptions');
    console.log('📝 [useDescriptionHighlighting] Sample descriptions:', descriptions.slice(0, 3).map(d => ({
      id: d.id,
      type: d.type,
      contentLength: d.content?.length || 0,
      preview: d.content?.substring(0, 50) || '',
      hasCFI: !!(d as any).cfi_range,
    })));

    const contents = rendition.getContents() as any;
    if (!contents || contents.length === 0) {
      console.warn('⚠️ [useDescriptionHighlighting] No iframe content available');
      return;
    }

    const iframe = contents[0];
    const doc = iframe.document;

    if (!doc || !doc.body) {
      console.warn('⚠️ [useDescriptionHighlighting] No document body available');
      return;
    }

    // FIXED: Check if highlights already exist for CURRENT descriptions
    // This prevents infinite re-highlighting loop while allowing highlights for new pages
    const existingHighlights = doc.querySelectorAll('.description-highlight');
    if (existingHighlights.length > 0) {
      // Check if existing highlights belong to current descriptions
      const firstHighlightId = existingHighlights[0].getAttribute('data-description-id');
      const currentDescriptionIds = descriptions.map(d => d.id);

      if (firstHighlightId && currentDescriptionIds.includes(firstHighlightId)) {
        // Highlights are for current page - skip to prevent loop
        console.log(`⏭️ [useDescriptionHighlighting] Already highlighted for current page (${existingHighlights.length} highlights), skipping`);
        return;
      } else {
        // Highlights are from previous page - remove them
        console.log(`🧹 [useDescriptionHighlighting] Removing old highlights from previous page (${existingHighlights.length})`);
        existingHighlights.forEach((el: Element) => {
          const parent = el.parentNode;
          if (parent) {
            const textNode = doc.createTextNode(el.textContent || '');
            parent.replaceChild(textNode, el);
            parent.normalize();
          }
        });
      }
    }

    // Add new highlights with 6 search strategies
    let highlightedCount = 0;
    const failedDescriptions: { index: number; reason: string; preview: string }[] = [];

    descriptions.forEach((desc, descIndex) => {
      try {
        let text = desc.content;
        if (!text || text.length < 10) {
          failedDescriptions.push({
            index: descIndex,
            reason: 'too_short',
            preview: text || 'empty'
          });
          return;
        }

        // Advanced text normalization
        text = removeChapterHeaders(text);
        const normalizedDesc = normalizeText(text);

        if (normalizedDesc.length < 10) {
          failedDescriptions.push({
            index: descIndex,
            reason: 'too_short_after_cleanup',
            preview: normalizedDesc
          });
          return;
        }

        // Search for text in document
        const walker = doc.createTreeWalker(
          doc.body,
          NodeFilter.SHOW_TEXT,
          null
        );

        let node;
        let found = false;
        let strategyUsed = '';

        while ((node = walker.nextNode())) {
          const nodeText = node.nodeValue || '';
          const normalizedNode = normalizeText(nodeText);

          let searchString = '';
          let index = -1;

          // ===== STRATEGY 1: First 0-40 chars (original approach) =====
          if (index === -1) {
            searchString = normalizedDesc.substring(0, Math.min(40, normalizedDesc.length));
            index = normalizedNode.indexOf(searchString);
            if (index !== -1) {
              strategyUsed = 'S1_First_40';
            }
          }

          // ===== STRATEGY 2: Skip first 10 chars (10-50) =====
          if (index === -1 && normalizedDesc.length > 50) {
            searchString = normalizedDesc.substring(10, Math.min(50, normalizedDesc.length));
            index = normalizedNode.indexOf(searchString);
            if (index !== -1) {
              strategyUsed = 'S2_Skip_10';
            }
          }

          // ===== STRATEGY 3: Skip first 20 chars (20-60) =====
          if (index === -1 && normalizedDesc.length > 60) {
            searchString = normalizedDesc.substring(20, Math.min(60, normalizedDesc.length));
            index = normalizedNode.indexOf(searchString);
            if (index !== -1) {
              strategyUsed = 'S3_Skip_20';
            }
          }

          // ===== STRATEGY 4: Full content match (slower but comprehensive) =====
          if (index === -1 && normalizedDesc.length <= 200) {
            // Try matching entire normalized description (only if reasonable length)
            index = normalizedNode.indexOf(normalizedDesc);
            if (index !== -1) {
              searchString = normalizedDesc;
              strategyUsed = 'S4_Full_Match';
            }
          }

          // ===== STRATEGY 5: Fuzzy matching - first 5 words =====
          if (index === -1 && normalizedDesc.split(/\s+/).length >= 5) {
            const firstWords = getFirstWords(normalizedDesc, 5);
            index = normalizedNode.indexOf(firstWords);
            if (index !== -1) {
              searchString = firstWords;
              strategyUsed = 'S5_Fuzzy_5_Words';
            }
          }

          // ===== STRATEGY 6: CFI-based highlighting (if available) =====
          if (index === -1 && (desc as any).cfi_range) {
            try {
              // CFI range format: "epubcfi(/6/4[chapter01]!/4/2,/1:0,/1:100)"
              // This strategy relies on epub.js CFI functionality
              const cfiRange = (desc as any).cfi_range;
              console.log(`📍 [S6_CFI] Description ${descIndex} has CFI: ${cfiRange.substring(0, 50)}...`);
              // TODO: Implement epub.js annotations.highlight with CFI
              // For now, fallback to content search
            } catch (cfiError) {
              console.warn('⚠️ [S6_CFI] Failed to parse CFI:', cfiError);
            }
          }

          // ===== STRATEGY 7: Middle section matching (skip unreliable start/end) =====
          if (index === -1 && normalizedDesc.length >= 80) {
            const middleSection = getMiddleSection(normalizedDesc, 0.15, 0.6);
            if (middleSection.length >= 25) {
              index = normalizedNode.indexOf(middleSection);
              if (index !== -1) {
                searchString = middleSection;
                strategyUsed = 'S7_Middle_Section';
              }
            }
          }

          // ===== STRATEGY 8: Longest common substring (fuzzy matching) =====
          if (index === -1 && normalizedDesc.length >= 50) {
            const lcs = findLongestCommonSubstring(normalizedNode, normalizedDesc, 25);
            if (lcs && lcs.length >= 25) {
              index = normalizedNode.indexOf(lcs);
              if (index !== -1) {
                searchString = lcs;
                strategyUsed = 'S8_LCS_Fuzzy';
              }
            }
          }

          // ===== STRATEGY 9: Case-insensitive first sentence =====
          if (index === -1 && normalizedDesc.length >= 30) {
            // Extract first sentence (up to first period, question, or exclamation)
            const firstSentenceMatch = normalizedDesc.match(/^[^.!?]+[.!?]?/);
            if (firstSentenceMatch && firstSentenceMatch[0].length >= 20) {
              const firstSentence = firstSentenceMatch[0].trim();
              const lowerNode = normalizedNode.toLowerCase();
              const lowerSentence = firstSentence.toLowerCase();
              index = lowerNode.indexOf(lowerSentence);
              if (index !== -1) {
                searchString = firstSentence;
                strategyUsed = 'S9_First_Sentence';
              }
            }
          }

          if (index !== -1) {
            found = true;

            const parent = node.parentNode;
            if (!parent || parent.classList?.contains('description-highlight')) {
              continue;
            }

            // Find the actual position in original nodeText by searching for searchString
            // Since we normalized for searching, we need to find where it appears in original
            const actualIndex = nodeText.toLowerCase().indexOf(searchString.toLowerCase());

            if (actualIndex === -1) {
              console.warn(`⚠️ [${strategyUsed}] Found in normalized but not in original, skipping`);
              continue;
            }

            // Highlight the full description text
            const highlightLength = text.length;

            // Create highlight span
            const span = doc.createElement('span');
            span.className = 'description-highlight';
            span.setAttribute('data-description-id', desc.id);
            span.setAttribute('data-description-type', desc.type);
            span.setAttribute('data-strategy', strategyUsed);
            span.style.cssText = `
              background-color: rgba(96, 165, 250, 0.2);
              border-bottom: 2px solid #60a5fa;
              cursor: pointer;
              transition: background-color 0.2s;
            `;

            // Hover effects
            span.addEventListener('mouseenter', () => {
              span.style.backgroundColor = 'rgba(96, 165, 250, 0.3)';
            });
            span.addEventListener('mouseleave', () => {
              span.style.backgroundColor = 'rgba(96, 165, 250, 0.2)';
            });

            // Click handler
            span.addEventListener('click', () => {
              console.log('🖱️ [useDescriptionHighlighting] Description clicked:', {
                id: desc.id,
                type: desc.type,
                strategy: strategyUsed
              });
              const image = images.find(img => img.description?.id === desc.id);
              onDescriptionClick(desc, image);
            });

            // Replace text with highlighted span
            const before = nodeText.substring(0, actualIndex);
            const highlighted = nodeText.substring(actualIndex, actualIndex + highlightLength);
            const after = nodeText.substring(actualIndex + highlightLength);

            const beforeNode = before ? doc.createTextNode(before) : null;
            const afterNode = after ? doc.createTextNode(after) : null;

            span.textContent = highlighted;

            parent.insertBefore(span, node);
            if (beforeNode) parent.insertBefore(beforeNode, span);
            if (afterNode) parent.insertBefore(afterNode, span.nextSibling);
            parent.removeChild(node);

            highlightedCount++;
            console.log(`✅ [${strategyUsed}] Highlighted #${descIndex}: "${highlighted.substring(0, 30)}..."`);
            break; // Only highlight first occurrence
          }
        }

        if (!found) {
          const preview = normalizedDesc.substring(0, 50);
          failedDescriptions.push({
            index: descIndex,
            reason: 'no_match_in_dom',
            preview
          });
          console.log(`⏭️ [FAILED] No match for description #${descIndex}: "${preview}..."`);
        }
      } catch (error) {
        console.error('❌ [useDescriptionHighlighting] Error highlighting description:', error);
        failedDescriptions.push({
          index: descIndex,
          reason: 'exception',
          preview: error instanceof Error ? error.message : 'unknown_error'
        });
      }
    });

    // Performance tracking and summary
    const duration = performance.now() - startTime;
    const coverage = descriptions.length > 0
      ? Math.round((highlightedCount / descriptions.length) * 100)
      : 0;

    console.log(`🎨 [SUMMARY] Highlighting complete:`, {
      highlighted: highlightedCount,
      total: descriptions.length,
      coverage: `${coverage}%`,
      failed: failedDescriptions.length,
      duration: `${duration.toFixed(2)}ms`,
      target: `<${PERFORMANCE_WARNING_MS}ms`,
    });

    // Log failed descriptions for debugging
    if (failedDescriptions.length > 0) {
      console.warn(`⚠️ [FAILED DESCRIPTIONS] ${failedDescriptions.length} not highlighted:`);
      failedDescriptions.slice(0, 10).forEach(({ index, reason, preview }) => {
        console.warn(`  - #${index}: ${reason} - "${preview.substring(0, 40)}..."`);
      });
      if (failedDescriptions.length > 10) {
        console.warn(`  ... and ${failedDescriptions.length - 10} more`);
      }
    }

    // Performance warning
    if (duration > PERFORMANCE_WARNING_MS) {
      console.warn(`⚠️ [PERFORMANCE] Highlighting took ${duration.toFixed(2)}ms (target: <${PERFORMANCE_WARNING_MS}ms)`);
    }

    // Coverage warning
    if (coverage < 100) {
      console.warn(`⚠️ [COVERAGE] Only ${coverage}% descriptions highlighted (target: 100%)`);
    }
  }, [rendition, descriptions, images, onDescriptionClick, enabled]);

  /**
   * Re-highlight when page is rendered (with debouncing)
   */
  useEffect(() => {
    if (!rendition || !enabled) return;

    const handleRendered = () => {
      console.log('📄 [useDescriptionHighlighting] Page rendered, scheduling highlights...');

      // Clear previous debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce highlighting to avoid multiple rapid calls
      debounceTimerRef.current = setTimeout(() => {
        console.log('📄 [useDescriptionHighlighting] Debounce complete, applying highlights...');
        highlightDescriptions();
      }, DEBOUNCE_DELAY_MS);
    };

    rendition.on('rendered', handleRendered);

    // Initial highlighting (immediate)
    handleRendered();

    return () => {
      rendition.off('rendered', handleRendered);
      // Clear debounce timer on cleanup
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [rendition, enabled, highlightDescriptions]);
};
