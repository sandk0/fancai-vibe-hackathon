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
import type { Rendition } from 'epubjs';
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
    if (!rendition || !enabled || descriptions.length === 0) {
      console.log('⏸️ [useDescriptionHighlighting] Skipping highlights:', {
        hasRendition: !!rendition,
        enabled,
        descriptionsCount: descriptions.length,
      });
      return;
    }

    console.log('🎨 [useDescriptionHighlighting] Highlighting descriptions:', descriptions.length);

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

    // Remove old highlights
    const oldHighlights = doc.querySelectorAll('.description-highlight');
    oldHighlights.forEach((el: Element) => {
      const parent = el.parentNode;
      if (parent) {
        const textNode = doc.createTextNode(el.textContent || '');
        parent.replaceChild(textNode, el);
        parent.normalize();
      }
    });

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
          const searchString = text.substring(0, 50);
          const index = nodeText.indexOf(searchString);

          if (index !== -1) {
            found = true;
            highlightedCount++;

            const parent = node.parentNode;
            if (!parent || parent.classList?.contains('description-highlight')) {
              continue;
            }

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
            const before = nodeText.substring(0, index);
            const highlighted = nodeText.substring(index, index + text.length);
            const after = nodeText.substring(index + text.length);

            const beforeNode = before ? doc.createTextNode(before) : null;
            const afterNode = after ? doc.createTextNode(after) : null;

            span.textContent = highlighted;

            parent.insertBefore(span, node);
            if (beforeNode) parent.insertBefore(beforeNode, span);
            if (afterNode) parent.insertBefore(afterNode, span.nextSibling);
            parent.removeChild(node);

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
