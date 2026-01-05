/**
 * SelectionMenu - Popup menu for selected text
 *
 * Displays a popup menu when text is selected in the EPUB reader.
 * Features:
 * - Copy to clipboard
 * - Highlight button (prepared for Task 3.1)
 * - Note button (prepared for Task 3.1)
 * - Smart positioning (above/below selection)
 * - Uses semantic CSS tokens for automatic theme support
 * - Mobile-friendly touch targets
 * - Click outside to close
 *
 * @component
 */

import { useEffect, useRef, useCallback, memo } from 'react';
import type { Selection } from '@/hooks/epub/useTextSelection';

interface SelectionMenuProps {
  selection: Selection | null;
  onCopy: () => void;
  onHighlight?: () => void; // For Task 3.1
  onNote?: () => void; // For Task 3.1
  onClose: () => void;
}

/**
 * SelectionMenu - Memoized text selection popup
 *
 * Optimization rationale:
 * - Rendered on every selection event - memoization prevents redundant renders
 * - getMenuStyle already uses useCallback (correct)
 * - Event handlers memoized to prevent effect re-subscriptions
 */
export const SelectionMenu = memo(function SelectionMenu({
  selection,
  onCopy,
  onHighlight,
  onNote,
  onClose,
}: SelectionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * Handle click outside to close menu
   */
  useEffect(() => {
    if (!selection) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Add listener with slight delay to avoid immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [selection, onClose]);

  /**
   * Handle Escape key to close menu
   */
  useEffect(() => {
    if (!selection) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [selection, onClose]);

  /**
   * Calculate menu position (above or below selection)
   */
  const getMenuStyle = useCallback((): React.CSSProperties => {
    if (!selection) return { display: 'none' };

    const menuHeight = 60; // Approximate menu height
    const menuWidth = 200; // Approximate menu width
    const offset = 10; // Offset from selection

    // Check if there's space above selection
    const spaceAbove = selection.position.y;
    const spaceBelow = window.innerHeight - selection.position.y;

    // Position above if there's not enough space below
    const positionAbove = spaceBelow < menuHeight + offset && spaceAbove > menuHeight + offset;

    // Center horizontally relative to selection
    const left = Math.max(10, Math.min(
      selection.position.x - menuWidth / 2,
      window.innerWidth - menuWidth - 10
    ));

    const top = positionAbove
      ? selection.position.y - menuHeight - offset
      : selection.position.y + offset;

    return {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 600,
    };
  }, [selection]);


  /**
   * Handle copy with close - memoized to prevent button re-renders
   */
  const handleCopy = useCallback(() => {
    onCopy();
    onClose();
  }, [onCopy, onClose]);

  /**
   * Handle highlight with close (for Task 3.1) - memoized
   */
  const handleHighlight = useCallback(() => {
    if (onHighlight) {
      onHighlight();
      onClose();
    }
  }, [onHighlight, onClose]);

  /**
   * Handle note with close (for Task 3.1) - memoized
   */
  const handleNote = useCallback(() => {
    if (onNote) {
      onNote();
      onClose();
    }
  }, [onNote, onClose]);

  // Don't render if no selection
  if (!selection) return null;

  return (
    <div
      ref={menuRef}
      style={getMenuStyle()}
      className="bg-popover text-popover-foreground border border-border rounded-lg shadow-lg backdrop-blur-sm overflow-hidden"
      role="menu"
      aria-label="Text selection menu"
    >
      <div className="flex items-stretch divide-x divide-border">
        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-3 min-h-[44px] hover:bg-muted active:bg-muted/80 transition-colors min-w-[100px]"
          title="Copy to clipboard"
          aria-label="Copy text"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <span className="text-sm font-medium">Copy</span>
        </button>

        {/* Highlight Button (prepared for Task 3.1) */}
        {onHighlight && (
          <button
            onClick={handleHighlight}
            className="flex items-center gap-2 px-4 py-3 min-h-[44px] hover:bg-muted active:bg-muted/80 transition-colors min-w-[120px]"
            title="Highlight text"
            aria-label="Highlight text"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
              />
            </svg>
            <span className="text-sm font-medium">Highlight</span>
          </button>
        )}

        {/* Note Button (prepared for Task 3.1) */}
        {onNote && (
          <button
            onClick={handleNote}
            className="flex items-center gap-2 px-4 py-3 min-h-[44px] hover:bg-muted active:bg-muted/80 transition-colors min-w-[100px]"
            title="Add note"
            aria-label="Add note"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <span className="text-sm font-medium">Note</span>
          </button>
        )}
      </div>

      {/* Character count (helpful for long selections) */}
      {selection.text.length > 100 && (
        <div className="px-3 py-1 text-xs text-muted-foreground border-t border-border bg-opacity-50">
          {selection.text.length} characters selected
        </div>
      )}
    </div>
  );
});
