/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * useDescriptionHighlighting - Custom hook for highlighting descriptions in EPUB text
 *
 * Highlights description text in the rendered EPUB content and makes them clickable.
 * Handles dynamic re-highlighting when page changes or descriptions update.
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

import { useEffect, useCallback } from 'react';
import type { Rendition } from '@/types/epub';
import type { Description, GeneratedImage } from '@/types/api';

interface UseDescriptionHighlightingOptions {
  rendition: Rendition | null;
  descriptions: Description[];
  images: GeneratedImage[];
  onDescriptionClick: (description: Description, image?: GeneratedImage) => void;
  enabled?: boolean;
}

export const useDescriptionHighlighting = ({
  rendition,
  descriptions,
  images,
  onDescriptionClick,
  enabled = true,
}: UseDescriptionHighlightingOptions): void => {

  /**
   * Apply highlights to current page
   */
  const highlightDescriptions = useCallback(() => {
    console.log('🎨 [useDescriptionHighlighting] Hook called:', {
      hasRendition: !!rendition,
      enabled,
      descriptionsCount: descriptions.length,
      imagesCount: images.length,
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

    // Add new highlights
    let highlightedCount = 0;

    descriptions.forEach((desc, descIndex) => {
      try {
        let text = desc.content;
        if (!text || text.length < 10) {
          return;
        }

        // Remove chapter headers from search
        const chapterHeaderMatch = text.match(/^(Глава (первая|вторая|третья|четвертая|пятая|шестая|седьмая|восьмая|девятая|десятая|одиннадцатая|двенадцатая|тринадцатая|четырнадцатая|пятнадцатая|шестнадцатая|семнадцатая|восемнадцатая|девятнадцатая|двадцатая|\d+))\s+/i);
        if (chapterHeaderMatch) {
          text = text.substring(chapterHeaderMatch[0].length).trim();
        }

        if (text.length < 10) return;

        // Search for text in document
        const walker = doc.createTreeWalker(
          doc.body,
          NodeFilter.SHOW_TEXT,
          null
        );

        let node;
        let found = false;

        while ((node = walker.nextNode())) {
          const nodeText = node.nodeValue || '';

          // FIXED: Use multiple search strategies for better matching
          // 1. Normalize text - remove extra spaces, trim
          const normalizedText = text.replace(/\s+/g, ' ').trim();
          const normalizedNode = nodeText.replace(/\s+/g, ' ');

          // 2. Try searching from different starting positions
          // Skip first 10-20 chars (in case NLP extracted from middle of sentence)
          let searchString = '';
          let index = -1;

          // Strategy 1: First 40 chars (original approach)
          searchString = normalizedText.substring(0, Math.min(40, normalizedText.length));
          index = normalizedNode.indexOf(searchString);

          // Strategy 2: If not found, try from char 10-50 (skip potential prefix)
          if (index === -1 && normalizedText.length > 50) {
            searchString = normalizedText.substring(10, Math.min(50, normalizedText.length));
            index = normalizedNode.indexOf(searchString);
          }

          // Strategy 3: If still not found, try from char 20-60 (deeper skip)
          if (index === -1 && normalizedText.length > 60) {
            searchString = normalizedText.substring(20, Math.min(60, normalizedText.length));
            index = normalizedNode.indexOf(searchString);
          }

          if (index !== -1) {
            found = true;
            highlightedCount++;

            const parent = node.parentNode;
            if (!parent || parent.classList?.contains('description-highlight')) {
              continue;
            }

            // FIXED: Find the actual position in original nodeText by searching for searchString
            // Since we normalized for searching, we need to find where it appears in original
            const actualIndex = nodeText.toLowerCase().indexOf(searchString.toLowerCase());

            if (actualIndex === -1) {
              // Fallback: try case-insensitive search with original text
              console.warn('⚠️ [useDescriptionHighlighting] Found in normalized but not in original, skipping');
              continue;
            }

            // Determine how much text to highlight (min of description length or 100 chars)
            const highlightLength = Math.min(text.length, 100);

            // Create highlight span
            const span = doc.createElement('span');
            span.className = 'description-highlight';
            span.setAttribute('data-description-id', desc.id);
            span.setAttribute('data-description-type', desc.type);
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
              console.log('🖱️ [useDescriptionHighlighting] Description clicked:', desc.id);
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

            console.log(`✅ [useDescriptionHighlighting] Highlighted description ${descIndex}: "${highlighted.substring(0, 30)}..."`);
            break; // Only highlight first occurrence
          }
        }

        if (!found) {
          console.log(`⏭️ [useDescriptionHighlighting] No match for description ${descIndex}`);
        }
      } catch (error) {
        console.error('❌ [useDescriptionHighlighting] Error highlighting description:', error);
      }
    });

    console.log(`🎨 [useDescriptionHighlighting] Complete: ${highlightedCount}/${descriptions.length} highlighted`);
  }, [rendition, descriptions, images, onDescriptionClick, enabled]);

  /**
   * Re-highlight when page is rendered
   */
  useEffect(() => {
    if (!rendition || !enabled) return;

    const handleRendered = () => {
      console.log('📄 [useDescriptionHighlighting] Page rendered, applying highlights...');
      setTimeout(() => {
        highlightDescriptions();
      }, 300);
    };

    rendition.on('rendered', handleRendered);

    // Initial highlighting
    handleRendered();

    return () => {
      rendition.off('rendered', handleRendered);
    };
  }, [rendition, enabled, highlightDescriptions]);
};
