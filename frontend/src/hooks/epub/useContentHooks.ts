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
import type { Rendition } from 'epubjs';
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
    const contentHook = (contents: any, _view: any) => {
      console.log('🪝 [useContentHooks] Content hook triggered');

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
        body {
          margin: 0 !important;
          padding: 0.75em !important;
        }

        /* Smooth scrolling */
        * {
          scroll-behavior: smooth !important;
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
          console.warn('⚠️ [useContentHooks] Image failed to load:', img.src);
          // Could show placeholder or remove broken image
          img.style.display = 'none';
        });
      });

      console.log('✅ [useContentHooks] Custom styles injected');
    };

    // Register the hook
    rendition.hooks.content.register(contentHook);

    console.log('🪝 [useContentHooks] Content hook registered');

    // Cleanup
    return () => {
      try {
        rendition.hooks.content.deregister(contentHook);
        console.log('🧹 [useContentHooks] Content hook deregistered');
      } catch (err) {
        console.warn('⚠️ [useContentHooks] Error deregistering hook:', err);
      }
    };
  }, [rendition, theme]);
};
