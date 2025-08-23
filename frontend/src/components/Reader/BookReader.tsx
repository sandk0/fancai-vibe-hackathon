import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, Settings, Eye, Volume2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { booksAPI } from '@/api/books';
import { useReaderStore } from '@/stores/reader';
import { useUIStore } from '@/stores/ui';
import { LoadingSpinner } from '@/components/UI/LoadingSpinner';
import { ErrorMessage } from '@/components/UI/ErrorMessage';
import { ImageModal } from '@/components/Images/ImageModal';
import type { Chapter, Description } from '@/types/api';

interface BookReaderProps {
  bookId?: string;
  chapterNumber?: number;
}

export const BookReader: React.FC<BookReaderProps> = ({ 
  bookId: propBookId, 
  chapterNumber: propChapterNumber 
}) => {
  const params = useParams();
  const bookId = propBookId || params.bookId!;
  const initialChapter = propChapterNumber || parseInt(params.chapterNumber || '1');

  const [currentChapter, setCurrentChapter] = useState(initialChapter);
  const [currentPage, setCurrentPage] = useState(1);
  const [pages, setPages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [highlightedDescriptions, setHighlightedDescriptions] = useState<Description[]>([]);

  const contentRef = useRef<HTMLDivElement>(null);
  const { notify } = useUIStore();
  const { 
    fontSize, 
    fontFamily, 
    lineHeight, 
    theme,
    updateReadingProgress 
  } = useReaderStore();

  // Fetch book data
  const { data: book, isLoading: bookLoading } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => booksAPI.getBook(bookId),
  });

  // Fetch chapter data
  const { data: chapter, isLoading: chapterLoading, error: chapterError } = useQuery({
    queryKey: ['chapter', bookId, currentChapter],
    queryFn: () => booksAPI.getChapter(bookId, currentChapter),
    enabled: !!bookId,
  });

  // Paginate content based on container size and font settings
  useEffect(() => {
    if (!chapter?.content || !contentRef.current) return;

    const paginateContent = () => {
      const container = contentRef.current!;
      const containerHeight = container.clientHeight - 40; // Account for padding
      const lineHeightPx = fontSize * lineHeight;
      const linesPerPage = Math.floor(containerHeight / lineHeightPx);
      const wordsPerLine = Math.floor(container.clientWidth / (fontSize * 0.6)); // Approximate
      const wordsPerPage = linesPerPage * wordsPerLine;

      const words = chapter.content.split(' ');
      const newPages: string[] = [];
      
      for (let i = 0; i < words.length; i += wordsPerPage) {
        const pageWords = words.slice(i, i + wordsPerPage);
        newPages.push(pageWords.join(' '));
      }

      setPages(newPages);
      if (currentPage > newPages.length) {
        setCurrentPage(1);
      }
    };

    // Debounce resize
    const timeoutId = setTimeout(paginateContent, 100);
    return () => clearTimeout(timeoutId);
  }, [chapter?.content, fontSize, lineHeight, currentPage]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (chapter?.content) {
        setCurrentPage(1); // Reset to first page on resize
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [chapter?.content]);

  // Update reading progress
  useEffect(() => {
    if (book && chapter) {
      const progress = ((currentChapter - 1) / book.total_chapters + 
        (currentPage - 1) / (pages.length * book.total_chapters)) * 100;
      updateReadingProgress(bookId, currentChapter, Math.min(progress, 100));
    }
  }, [bookId, currentChapter, currentPage, pages.length, book, chapter, updateReadingProgress]);

  // Highlight descriptions in text
  useEffect(() => {
    if (chapter?.descriptions) {
      setHighlightedDescriptions(chapter.descriptions);
    }
  }, [chapter?.descriptions]);

  const nextPage = () => {
    if (currentPage < pages.length) {
      setCurrentPage(prev => prev + 1);
    } else if (currentChapter < (book?.total_chapters || 0)) {
      setCurrentChapter(prev => prev + 1);
      setCurrentPage(1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    } else if (currentChapter > 1) {
      setCurrentChapter(prev => prev - 1);
      // Will be set to last page of previous chapter when it loads
    }
  };

  const jumpToChapter = (chapterNum: number) => {
    if (chapterNum >= 1 && chapterNum <= (book?.total_chapters || 0)) {
      setCurrentChapter(chapterNum);
      setCurrentPage(1);
    }
  };

  const highlightDescription = (text: string, descriptions: Description[]) => {
    let highlightedText = text;
    
    descriptions.forEach((desc, index) => {
      const regex = new RegExp(desc.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      highlightedText = highlightedText.replace(regex, (match) => 
        `<span class="description-highlight cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900 transition-colors" data-description-id="${desc.id}">${match}</span>`
      );
    });
    
    return highlightedText;
  };

  const handleDescriptionClick = (descriptionId: string) => {
    const description = highlightedDescriptions.find(d => d.id === descriptionId);
    if (description && description.generated_image) {
      setSelectedImage(description.generated_image.image_url);
    } else {
      notify.info('Image Generation', 'Image for this description is being generated...');
    }
  };

  // Add click listener for description highlights
  useEffect(() => {
    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('description-highlight')) {
        const descriptionId = target.dataset.descriptionId;
        if (descriptionId) {
          handleDescriptionClick(descriptionId);
        }
      }
    };

    const container = contentRef.current;
    if (container) {
      container.addEventListener('click', handleClick);
      return () => container.removeEventListener('click', handleClick);
    }
  }, [highlightedDescriptions]);

  if (bookLoading || chapterLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading chapter..." />
      </div>
    );
  }

  if (chapterError || !book || !chapter) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ErrorMessage 
          title="Chapter Not Found"
          message="The requested chapter could not be loaded."
          action={{ label: "Go Back", onClick: () => window.history.back() }}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="bg-white dark:bg-gray-900 min-h-screen">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center space-x-3">
              <BookOpen className="h-6 w-6 text-primary-600" />
              <div>
                <h1 className="font-semibold text-gray-900 dark:text-white truncate max-w-xs">
                  {book.title}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Chapter {currentChapter}: {chapter.title}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {currentPage} of {pages.length}
              </span>
              <button className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Reading Area */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="relative">
            {/* Content */}
            <motion.div
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
                  __html: pages[currentPage - 1] 
                    ? highlightDescription(pages[currentPage - 1], highlightedDescriptions)
                    : chapter.content
                }}
                className="select-text"
              />
            </motion.div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center mt-8">
              <button
                onClick={prevPage}
                disabled={currentChapter === 1 && currentPage === 1}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
                <span>Previous</span>
              </button>

              <div className="flex items-center space-x-4">
                <select
                  value={currentChapter}
                  onChange={(e) => jumpToChapter(parseInt(e.target.value))}
                  className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                >
                  {Array.from({ length: book.total_chapters }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>
                      Chapter {num}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={nextPage}
                disabled={currentChapter === book.total_chapters && currentPage === pages.length}
                className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Progress</span>
                <span>
                  {Math.round(
                    ((currentChapter - 1) / book.total_chapters + 
                     (currentPage - 1) / (pages.length * book.total_chapters)) * 100
                  )}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      ((currentChapter - 1) / book.total_chapters + 
                       (currentPage - 1) / (pages.length * book.total_chapters)) * 100,
                      100
                    )}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Keyboard Navigation Hint */}
        <div className="fixed bottom-4 right-4 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          Use ← → keys to navigate
        </div>

        {/* Image Modal */}
        <AnimatePresence>
          {selectedImage && (
            <ImageModal
              imageUrl={selectedImage}
              isOpen={!!selectedImage}
              onClose={() => setSelectedImage(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Keyboard navigation
export const useKeyboardNavigation = (
  nextPage: () => void,
  prevPage: () => void
) => {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't intercept when typing in inputs
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          prevPage();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ': // Spacebar
          e.preventDefault();
          nextPage();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [nextPage, prevPage]);
};