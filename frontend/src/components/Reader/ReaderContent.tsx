/**
 * ReaderContent - Book content display component
 *
 * Renders paginated book content with description highlighting.
 * Handles HTML sanitization and animations.
 *
 * @component
 */

import React from 'react';
import { m } from 'framer-motion';
import DOMPurify from 'dompurify';
import type { Description } from '@/types/api';

interface ReaderContentProps {
  pages: string[];
  currentPage: number;
  currentChapter: number;
  highlightedDescriptions: Description[];
  highlightDescription: (text: string, descriptions: Description[]) => string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  contentRef: React.RefObject<HTMLDivElement>;
}

export const ReaderContent: React.FC<ReaderContentProps> = React.memo(({
  pages,
  currentPage,
  currentChapter,
  highlightedDescriptions,
  highlightDescription,
  fontSize,
  fontFamily,
  lineHeight,
  contentRef,
}) => {
  const pageContent = pages[currentPage - 1];

  const getHighlightedContent = (): string => {
    if (!pageContent) {
      return '';
    }

    if (highlightedDescriptions.length > 0) {
      return highlightDescription(pageContent, highlightedDescriptions);
    }

    return pageContent;
  };

  return (
    <m.div
      ref={contentRef}
      className="prose prose-lg dark:prose-invert max-w-none"
      style={{
        fontSize: `${fontSize}px`,
        fontFamily: fontFamily,
        lineHeight: lineHeight,
        minHeight: '60vh',
      }}
      key={`${currentChapter}-${currentPage}`}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(getHighlightedContent())
        }}
        className="select-text epub-content"
      />
    </m.div>
  );
});

ReaderContent.displayName = 'ReaderContent';
