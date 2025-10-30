/**
 * useTextSelection - Handles text selection in EPUB
 *
 * Listens to rendition.on('selected') event from epub.js
 * Provides selected text, CFI range, and position for popup menu
 *
 * Features:
 * - Captures text selection from epub.js
 * - Extracts CFI range for future highlights
 * - Calculates position for popup menu
 * - Clears selection programmatically
 *
 * @param rendition - epub.js Rendition instance
 * @param enabled - Whether selection is enabled (default: true)
 * @returns Selection state and control functions
 *
 * @example
 * const { selection, clearSelection } = useTextSelection(rendition);
 * if (selection) {
 *   console.log('Selected text:', selection.text);
 *   console.log('CFI range:', selection.cfiRange);
 * }
 */

import { useEffect, useState, useCallback } from 'react';
import type { Rendition } from 'epubjs';

export interface Selection {
  text: string;
  cfiRange: string;
  position: { x: number; y: number };
}

interface UseTextSelectionReturn {
  selection: Selection | null;
  clearSelection: () => void;
}

export const useTextSelection = (
  rendition: Rendition | null,
  enabled: boolean = true
): UseTextSelectionReturn => {
  const [selection, setSelection] = useState<Selection | null>(null);

  useEffect(() => {
    if (!rendition || !enabled) {
      console.log('⏭️ [useTextSelection] Not enabled or no rendition');
      return;
    }

    /**
     * Handle 'selected' event from epub.js
     * This fires when user selects text in the EPUB viewer
     */
    const handleSelected = (cfiRange: string, contents: any) => {
      try {
        // Get selected text from the iframe window
        const windowSelection = contents.window.getSelection();
        const selectedText = windowSelection?.toString() || '';

        if (!selectedText.trim()) {
          console.log('⏭️ [useTextSelection] Empty selection, clearing');
          setSelection(null);
          return;
        }

        // Get position for popup menu
        const range = windowSelection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Get iframe position to calculate absolute coordinates
        const iframe = contents.document.defaultView.frameElement as HTMLIFrameElement;
        const iframeRect = iframe.getBoundingClientRect();

        const absolutePosition = {
          x: iframeRect.left + rect.left,
          y: iframeRect.top + rect.top,
        };

        console.log('✅ [useTextSelection] Text selected:', {
          text: selectedText.substring(0, 50) + (selectedText.length > 50 ? '...' : ''),
          cfiRange: cfiRange.substring(0, 80) + '...',
          position: absolutePosition,
        });

        setSelection({
          text: selectedText,
          cfiRange,
          position: absolutePosition,
        });
      } catch (err) {
        console.error('❌ [useTextSelection] Error handling selection:', err);
      }
    };

    /**
     * Handle 'markClicked' event to clear selection when clicking annotation
     * This prevents conflicts with existing highlights
     */
    const handleMarkClicked = () => {
      console.log('🔘 [useTextSelection] Mark clicked, clearing selection');
      setSelection(null);
    };

    /**
     * Handle click on page to clear selection when clicking outside selected text
     * This ensures menu closes when user clicks anywhere on the page
     */
    const handleClick = () => {
      // Add small delay to let 'selected' event fire first if user is selecting
      setTimeout(() => {
        const contents = (rendition.getContents() as any)[0];
        if (!contents) return;

        const windowSelection = contents.window?.getSelection();
        const hasSelection = windowSelection && windowSelection.toString().trim().length > 0;

        if (!hasSelection) {
          console.log('🔘 [useTextSelection] Click detected, no selection - clearing menu');
          setSelection(null);
        }
      }, 50);
    };

    // Register event listeners
    rendition.on('selected', handleSelected);
    rendition.on('markClicked', handleMarkClicked);
    rendition.on('click', handleClick);

    console.log('✅ [useTextSelection] Event listeners registered');

    return () => {
      // Cleanup event listeners
      rendition.off('selected', handleSelected);
      rendition.off('markClicked', handleMarkClicked);
      rendition.off('click', handleClick);
      console.log('🧹 [useTextSelection] Event listeners removed');
    };
  }, [rendition, enabled]);

  /**
   * Clear selection programmatically
   * Call this when closing the selection menu
   */
  const clearSelection = useCallback(() => {
    console.log('❌ [useTextSelection] Clearing selection');
    setSelection(null);
  }, []);

  return { selection, clearSelection };
};
