/**
 * useContentHooks - epub.js content hooks for custom styling and manipulation
 *
 * Uses epub.js hooks system to inject custom styles and manipulate content
 * before rendering. More reliable than manual DOM manipulation.
 *
 * Updated: Reduced internal padding from 1.5em to 0.75em for compact layout
 *
 * @param rendition - epub.js Rendition instance
 * @param theme - Current theme
 *
 * @example
 * useContentHooks(rendition, theme);
 */

import { useEffect } from 'react';
import type { Rendition, Contents } from '@/types/epub';
import type { ThemeName } from './useEpubThemes';

export const useContentHooks = (
  rendition: Rendition | null,
  theme: ThemeName
): void => {
  useEffect(() => {
    if (!rendition) return;

    /**
     * Content hook - runs when section content is loaded
     * Perfect for injecting custom styles, manipulating images, etc.
     */
    const contentHook = (contents: Contents, _view?: unknown) => {
      const doc = contents.document;
      if (!doc) return;

      // Inject custom CSS for better readability
      const style = doc.createElement('style');
      style.textContent = `
        /* Image optimization */
        img {
          max-width: 100% !important;
          height: auto !important;
          display: block !important;
          margin: 1em auto !important;
        }

        /* Better paragraph spacing */
        p {
          margin-bottom: 1em !important;
          text-align: justify !important;
          hyphens: auto !important;
        }

        /* Headings */
        h1, h2, h3, h4, h5, h6 {
          margin-top: 1.5em !important;
          margin-bottom: 0.5em !important;
          font-weight: bold !important;
        }

        /* Quotes */
        blockquote {
          margin: 1em 2em !important;
          padding-left: 1em !important;
          border-left: 3px solid currentColor !important;
          opacity: 0.8 !important;
        }

        /* Links */
        a {
          text-decoration: none !important;
          border-bottom: 1px dotted currentColor !important;
        }

        a:hover {
          opacity: 0.8 !important;
        }

        /* Lists */
        ul, ol {
          margin: 1em 0 !important;
          padding-left: 2em !important;
        }

        li {
          margin-bottom: 0.5em !important;
        }

        /* Tables */
        table {
          width: 100% !important;
          border-collapse: collapse !important;
          margin: 1em 0 !important;
        }

        th, td {
          padding: 0.5em !important;
          border: 1px solid currentColor !important;
        }

        /* Code blocks */
        pre, code {
          font-family: 'Courier New', monospace !important;
          font-size: 0.9em !important;
        }

        pre {
          padding: 1em !important;
          overflow-x: auto !important;
          border-radius: 4px !important;
          opacity: 0.9 !important;
        }

        /* Horizontal rules */
        hr {
          margin: 2em 0 !important;
          border: none !important;
          border-top: 1px solid currentColor !important;
          opacity: 0.3 !important;
        }

        /* Minimal padding on body for compact layout */
        /* Mobile touch optimizations */
        /* iOS Safari fix: cursor:pointer enables click event delegation */
        /* https://www.quirksmode.org/blog/archives/2010/09/click_event_del.html */
        body {
          margin: 0 !important;
          padding: 0.75em !important;
          -webkit-overflow-scrolling: touch;
          touch-action: manipulation;
          overscroll-behavior: contain;
          cursor: pointer;
        }

        /* iOS Safari Fix (January 2026): Force single-column layout */
        /* Only applied on iOS devices via @supports with iOS-specific check */
        /* This prevents double-page turn bug on iOS without affecting Android */
        @supports (-webkit-touch-callout: none) {
          /* -webkit-touch-callout is iOS-only, not supported on Android Chrome */
          html, body {
            column-count: 1 !important;
            -webkit-column-count: 1 !important;
            column-width: auto !important;
            -webkit-column-width: auto !important;
          }
        }

        /* Disable text selection on touch devices (mobile) */
        /* Prevents accidental text selection when tapping to navigate */
        @media (pointer: coarse), (hover: none) {
          body, p, span, div, h1, h2, h3, h4, h5, h6, li, td, th, blockquote {
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
            -webkit-touch-callout: none !important;
          }
        }

        /* Smooth scrolling and mobile tap highlight removal */
        * {
          scroll-behavior: smooth !important;
          -webkit-tap-highlight-color: transparent;
        }

        /* Ensure description highlights are tappable on mobile */
        .description-highlight {
          touch-action: manipulation;
          -webkit-touch-callout: none;
          cursor: pointer;
        }

        /* Selection color based on theme */
        ::selection {
          ${theme === 'dark' ? 'background-color: rgba(96, 165, 250, 0.3);' : ''}
          ${theme === 'light' ? 'background-color: rgba(37, 99, 235, 0.3);' : ''}
          ${theme === 'sepia' ? 'background-color: rgba(139, 90, 43, 0.3);' : ''}
        }
      `;

      doc.head.appendChild(style);

      // Fix broken images (optional)
      const images = doc.querySelectorAll('img');
      images.forEach((img: HTMLImageElement) => {
        img.addEventListener('error', () => {
          // Hide broken images
          img.style.display = 'none';
        });
      });

      /**
       * iOS PWA FIX (January 2026): Document-level touch handler for description clicks
       *
       * Problem: On iOS PWA standalone mode, touch events on elements inside iframes
       * don't propagate properly to parent document handlers (WebKit Bug 128924).
       *
       * Solution: Add a touch handler directly inside the iframe document that:
       * 1. Captures all touchend events at document level (event delegation)
       * 2. Checks if the touch target is a description highlight
       * 3. Sends postMessage to parent window with description ID
       *
       * This bypasses the iframe boundary issue entirely.
       */
      const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      if (isIOSDevice) {
        // Track touch start position for tap detection
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;

        const handleTouchStart = (e: TouchEvent) => {
          const touch = e.touches[0];
          if (touch) {
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchStartTime = Date.now();
          }
        };

        const handleTouchEnd = (e: TouchEvent) => {
          const touch = e.changedTouches[0];
          if (!touch) return;

          // Check if this was a tap (not swipe or long press)
          const deltaX = Math.abs(touch.clientX - touchStartX);
          const deltaY = Math.abs(touch.clientY - touchStartY);
          const duration = Date.now() - touchStartTime;

          const isTap = deltaX < 20 && deltaY < 20 && duration < 350;
          if (!isTap) return;

          // Find if we tapped on a description highlight
          let target = e.target as HTMLElement | null;
          let descriptionId: string | null = null;

          // Walk up the DOM tree to find description-highlight
          while (target && target !== doc.body) {
            if (target.classList?.contains('description-highlight')) {
              descriptionId = target.getAttribute('data-description-id');
              break;
            }
            target = target.parentElement;
          }

          if (descriptionId) {
            // Prevent default to stop navigation
            e.preventDefault();
            e.stopPropagation();

            // Send message to parent window
            try {
              window.parent.postMessage({
                type: 'DESCRIPTION_CLICK',
                descriptionId: descriptionId,
              }, '*');

              // Debug log
              if (import.meta.env.DEV) {
                console.log('[useContentHooks] iOS: Description tap detected, sent postMessage:', descriptionId);
              }
            } catch (_err) {
              // Ignore cross-origin errors
            }
          }
        };

        // Add listeners to document body
        doc.body.addEventListener('touchstart', handleTouchStart, { passive: true });
        doc.body.addEventListener('touchend', handleTouchEnd, { passive: false });

        if (import.meta.env.DEV) {
          console.log('[useContentHooks] iOS PWA: Added document-level touch handlers for descriptions');
        }
      }
    };

    // Register the hook
    rendition.hooks.content.register(contentHook);

    // Cleanup
    return () => {
      try {
        rendition.hooks.content.deregister(contentHook);
      } catch (_err) {
        // Ignore deregistration errors during cleanup
      }
    };
  }, [rendition, theme]);
};
