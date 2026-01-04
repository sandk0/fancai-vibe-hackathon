import { useEffect, useRef, RefObject } from 'react';

/**
 * Selector for all focusable elements within a container
 */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])';

/**
 * useFocusTrap - Hook for trapping focus within a modal or dialog
 *
 * Features:
 * - Saves previously focused element and restores focus on close
 * - Auto-focuses first focusable element when opened
 * - Traps Tab/Shift+Tab navigation within container
 * - Handles Escape key to restore focus (does not close modal - use onClose prop)
 *
 * @param isOpen - Whether the modal/dialog is open
 * @param containerRef - Ref to the container element
 *
 * @example
 * ```tsx
 * const modalRef = useRef<HTMLDivElement>(null);
 * useFocusTrap(isOpen, modalRef);
 *
 * return (
 *   <div ref={modalRef} role="dialog" aria-modal="true">
 *     <button>First focusable</button>
 *     <button>Last focusable</button>
 *   </div>
 * );
 * ```
 */
export function useFocusTrap(
  isOpen: boolean,
  containerRef: RefObject<HTMLElement | null>
): void {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    if (!container) return;

    // Save previously focused element
    previouslyFocusedRef.current = document.activeElement as HTMLElement;

    // Focus first focusable element
    const focusableElements =
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    // Trap focus within container
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable =
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Handle Escape key - restore focus to previously focused element
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        previouslyFocusedRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleEscape);
      // Restore focus on cleanup, but NOT to elements inside iframes
      // (keyboard events from iframes don't bubble to main window)
      const prevElement = previouslyFocusedRef.current;
      if (prevElement) {
        // Check if element is inside an iframe by checking if ownerDocument is main document
        const isInIframe = prevElement.ownerDocument !== document;
        if (!isInIframe) {
          prevElement.focus();
        } else {
          // Focus the epub viewer container instead to enable keyboard navigation
          const viewerContainer = document.getElementById('viewer') ||
                                  document.querySelector('.epub-container') ||
                                  document.body;
          if (viewerContainer instanceof HTMLElement) {
            viewerContainer.focus();
          }
        }
      }
    };
  }, [isOpen, containerRef]);
}

export default useFocusTrap;
