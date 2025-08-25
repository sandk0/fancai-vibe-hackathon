import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, Settings, Eye, Volume2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { booksAPI } from '@/api/books';
import { imagesAPI } from '@/api/images';
import { useReaderStore } from '@/stores/reader';
import { useUIStore, notify } from '@/stores/ui';
import { STORAGE_KEYS } from '@/types/state';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import ErrorMessage from '@/components/UI/ErrorMessage';
import { ImageModal } from '@/components/Images/ImageModal';
import type { Chapter, Description, BookDetail } from '@/types/api';

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
  const [selectedDescription, setSelectedDescription] = useState<Description | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [highlightedDescriptions, setHighlightedDescriptions] = useState<Description[]>([]);

  const contentRef = useRef<HTMLDivElement>(null);
  const { 
    fontSize, 
    fontFamily, 
    lineHeight, 
    theme,
    updateReadingProgress 
  } = useReaderStore();

  // Fetch book data
  const { data: book, isLoading: bookLoading } = useQuery<BookDetail>({
    queryKey: ['book', bookId],
    queryFn: () => booksAPI.getBook(bookId),
  });

  // Fetch chapter data
  const { data: chapter, isLoading: chapterLoading, error: chapterError } = useQuery({
    queryKey: ['chapter', bookId, currentChapter],
    queryFn: () => booksAPI.getChapter(bookId, currentChapter),
    enabled: !!bookId,
  });

  // Debug chapter loading
  useEffect(() => {
    console.log('Chapter query state:', {
      chapter,
      isLoading: chapterLoading,
      error: chapterError,
      bookId,
      currentChapter
    });
    
    console.log('📖 Current book and chapter details:', {
      bookId: bookId,
      chapterNumber: currentChapter,
      chapterUrl: `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/books/${bookId}/chapters/${currentChapter}`,
      chapterDataStructure: chapter ? Object.keys(chapter) : 'No chapter',
      descriptionsCount: chapter?.descriptions?.length || 0
    });

    // Check if user is authenticated
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      console.warn('❌ User not authenticated! Please login first.');
    } else {
      console.log('✅ User has auth token');
    }
  }, [chapter, chapterLoading, chapterError, bookId, currentChapter]);

  // Paginate content based on container size and font settings
  useEffect(() => {
    if (!chapter?.chapter?.content) return;

    const paginateContent = () => {
      const content = chapter.chapter.html_content || chapter.chapter.content;
      if (!content) {
        setPages(['']);
        return;
      }
      
      // Simple approach: estimate characters per page based on screen size and font
      const container = contentRef.current;
      const containerHeight = container?.clientHeight || 600;
      const containerWidth = container?.clientWidth || 800;
      
      // Calculate approximate characters per page
      const lineHeightPx = fontSize * lineHeight;
      const linesPerPage = Math.max(15, Math.floor((containerHeight - 120) / lineHeightPx));
      const charsPerLine = Math.max(40, Math.floor(containerWidth / (fontSize * 0.55)));
      const charsPerPage = Math.max(800, Math.min(4000, linesPerPage * charsPerLine));
      
      console.log(`Pagination params: lines=${linesPerPage}, chars/line=${charsPerLine}, chars/page=${charsPerPage}`);
      
      // Remove HTML tags for length calculation but keep for display
      const textLength = content.replace(/<[^>]*>/g, '').length;
      const totalPages = Math.max(1, Math.ceil(textLength / charsPerPage));
      
      console.log(`Content length: ${textLength} chars, will create ${totalPages} pages`);
      
      const newPages: string[] = [];
      
      if (totalPages === 1) {
        // Single page - use all content
        newPages.push(content);
      } else {
        // Multiple pages - split content
        if (content.includes('<')) {
          // HTML content - try to split at paragraph boundaries
          const paragraphs = content.split(/<\/p>|<\/div>|<br\s*\/?>/i).filter(p => p.trim());
          
          let currentPage = '';
          let currentLength = 0;
          
          for (const paragraph of paragraphs) {
            const paragraphText = paragraph.replace(/<[^>]*>/g, '');
            const paragraphLength = paragraphText.length;
            
            if (currentLength + paragraphLength > charsPerPage && currentPage) {
              // Start new page
              newPages.push(currentPage);
              currentPage = paragraph;
              currentLength = paragraphLength;
            } else {
              // Add to current page
              currentPage += (currentPage ? '</p>' : '') + paragraph;
              currentLength += paragraphLength;
            }
          }
          
          // Add last page
          if (currentPage) {
            newPages.push(currentPage);
          }
        } else {
          // Plain text - simple character-based splitting
          for (let i = 0; i < content.length; i += charsPerPage) {
            const pageContent = content.substring(i, Math.min(i + charsPerPage, content.length));
            newPages.push(pageContent);
          }
        }
      }
      
      // Ensure we have at least one page
      if (newPages.length === 0) {
        newPages.push(content);
      }

      console.log(`Final pagination: ${newPages.length} pages created`);
      setPages(newPages);
      
      // Reset to page 1 if current page is out of bounds
      if (currentPage > newPages.length) {
        setCurrentPage(1);
      }
    };

    // Debounce pagination
    const timeoutId = setTimeout(paginateContent, 200);
    return () => clearTimeout(timeoutId);
  }, [chapter?.chapter, fontSize, lineHeight, currentChapter]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // Don't reset page on resize to avoid losing reading position
      console.log('Window resized, keeping current page');
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update reading progress
  useEffect(() => {
    console.log('📊 Reading progress update conditions:', {
      hasBook: !!book,
      hasChapter: !!chapter,
      pagesLength: pages.length,
      currentChapter,
      currentPage,
      bookId
    });

    if (book && chapter && pages.length > 0) {
      // Calculate progress: (completed chapters + current chapter progress) / total chapters
      const chapterProgress = currentPage / pages.length; // 0 to 1 for current chapter
      const chaptersCount = book.chapters?.length || book.chapters_count || 0;
      const totalProgress = chaptersCount > 0 ? ((currentChapter - 1) + chapterProgress) / chaptersCount : 0;
      const progressPercent = Math.min(Math.max(totalProgress * 100, 0), 100);
      
      console.log('📊 Updating reading progress:', {
        chapterProgress,
        chaptersCount,
        totalProgress,
        progressPercent,
        currentChapter,
        currentPage
      });
      
      updateReadingProgress(bookId, currentChapter, progressPercent, currentPage);
    } else {
      console.log('📊 Not updating progress - conditions not met');
    }
  }, [bookId, currentChapter, currentPage, pages.length, book, chapter, updateReadingProgress]);

  // Reset to first page when chapter changes
  useEffect(() => {
    console.log(`Chapter changed to: ${currentChapter}`);
    setCurrentPage(1);
    setPages([]); // Clear pages to force re-pagination
    
    // Save progress immediately when changing chapters
    if (book) {
      const chaptersCount = book.chapters?.length || book.chapters_count || 0;
      const totalProgress = chaptersCount > 0 ? (currentChapter - 1) / chaptersCount : 0;
      const progressPercent = Math.min(Math.max(totalProgress * 100, 0), 100);
      console.log(`📊 Saving progress for chapter change: ${currentChapter}, progress: ${progressPercent}%`);
      updateReadingProgress(bookId, currentChapter, progressPercent, 1);
    }
  }, [currentChapter, book, bookId, updateReadingProgress]);

  // Highlight descriptions in text and trigger parsing if needed
  useEffect(() => {
    // API returns descriptions at root level, not in chapter object
    if (chapter?.descriptions && Array.isArray(chapter.descriptions)) {
      console.log('Descriptions received:', chapter.descriptions);
      setHighlightedDescriptions(chapter.descriptions);
    } else {
      console.log('No descriptions in chapter:', chapter);
      console.log('Chapter structure:', chapter);
      setHighlightedDescriptions([]);
      
      // Auto-trigger parsing if no descriptions found (only once per book)
      const parsedBooksKey = 'parsed_books';
      const parsedBooks = JSON.parse(localStorage.getItem(parsedBooksKey) || '[]');
      
      console.log('🔍 Auto-parsing check:', {
        bookId,
        parsedBooks,
        alreadyParsed: parsedBooks.includes(bookId),
        authToken: localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) ? 'Present' : 'Missing',
        clearStorageCommand: `localStorage.removeItem('parsed_books'); console.log('Cleared parsed books cache');`
      });
      
      if (bookId && !parsedBooks.includes(bookId)) {
        console.log('📝 Auto-triggering description parsing for book:', bookId);
        
        fetch(`/api/v1/books/${bookId}/process`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)}`
          }
        })
        .then(r => {
          console.log('📝 Parse request response status:', r.status);
          if (!r.ok) {
            throw new Error(`HTTP ${r.status}: ${r.statusText}`);
          }
          return r.json();
        })
        .then(data => {
          console.log('📝 Parsing triggered successfully:', data);
          // Mark book as parsed
          parsedBooks.push(bookId);
          localStorage.setItem(parsedBooksKey, JSON.stringify(parsedBooks));
          
          // Show notification
          alert('Парсинг описаний запущен. Страница обновится через 10 секунд.');
          
          // Refresh page after delay to load parsed descriptions
          setTimeout(() => {
            window.location.reload();
          }, 10000);
        })
        .catch(err => {
          console.error('❌ Failed to trigger parsing:', err);
          // Don't add to parsed list if failed
        });
      } else {
        console.log('📝 Auto-parsing skipped:', {
          reason: !bookId ? 'No bookId' : 'Already parsed',
          bookId,
          inParsedList: parsedBooks.includes(bookId)
        });
      }
    }
  }, [chapter, bookId]);

  const nextPage = () => {
    console.log(`Next page: current=${currentPage}, total=${pages.length}, chapter=${currentChapter}`);
    if (currentPage < pages.length) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      // Manually save progress for next page
      if (book && chapter && pages.length > 0) {
        const chapterProgress = newPage / pages.length;
        const chaptersCount = book.chapters?.length || book.chapters_count || 0;
        const totalProgress = chaptersCount > 0 ? ((currentChapter - 1) + chapterProgress) / chaptersCount : 0;
        const progressPercent = Math.min(Math.max(totalProgress * 100, 0), 100);
        updateReadingProgress(bookId, currentChapter, progressPercent, newPage);
      }
    } else if (currentChapter < (book?.chapters?.length || book?.chapters_count || 0)) {
      console.log('Moving to next chapter');
      setCurrentChapter(prev => prev + 1);
      setCurrentPage(1);
    }
  };

  const prevPage = () => {
    console.log(`Prev page: current=${currentPage}, total=${pages.length}, chapter=${currentChapter}`);
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      // Manually save progress for previous page
      if (book && chapter && pages.length > 0) {
        const chapterProgress = newPage / pages.length;
        const chaptersCount = book.chapters?.length || book.chapters_count || 0;
        const totalProgress = chaptersCount > 0 ? ((currentChapter - 1) + chapterProgress) / chaptersCount : 0;
        const progressPercent = Math.min(Math.max(totalProgress * 100, 0), 100);
        updateReadingProgress(bookId, currentChapter, progressPercent, newPage);
      }
    } else if (currentChapter > 1) {
      console.log('Moving to previous chapter');
      setCurrentChapter(prev => prev - 1);
      // Start at first page - will set to last page when new chapter loads
      setCurrentPage(1);
    }
  };

  const jumpToChapter = (chapterNum: number) => {
    if (chapterNum >= 1 && chapterNum <= (book?.chapters?.length || book?.chapters_count || 0)) {
      setCurrentChapter(chapterNum);
      setCurrentPage(1);
      // Manually save progress when jumping to chapter
      if (book) {
        const chaptersCount = book.chapters?.length || book.chapters_count || 0;
        const totalProgress = chaptersCount > 0 ? (chapterNum - 1) / chaptersCount : 0;
        const progressPercent = Math.min(Math.max(totalProgress * 100, 0), 100);
        updateReadingProgress(bookId, chapterNum, progressPercent, 1);
      }
    }
  };

  const highlightDescription = (text: string, descriptions: Description[]) => {
    if (!descriptions || descriptions.length === 0) {
      return text;
    }
    
    let highlightedText = text;
    
    descriptions.forEach((desc) => {
      // Use content or text field
      const descText = desc.content || desc.text;
      if (!descText) return;
      
      // Escape special regex characters and create pattern
      const escapedText = descText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedText, 'gi');
      
      // Replace with highlighted span
      highlightedText = highlightedText.replace(regex, (match) => 
        `<span class="description-highlight" data-description-id="${desc.id}">${match}</span>`
      );
    });
    
    return highlightedText;
  };

  const handleDescriptionClick = async (descriptionId: string) => {
    console.log('🖱️ Description clicked:', descriptionId);
    const description = highlightedDescriptions.find(d => d.id === descriptionId);
    console.log('📋 Found description:', description);
    
    if (description && description.generated_image) {
      console.log('🖼️ Description has image, opening modal');
      setSelectedImage(description.generated_image.image_url);
      setSelectedDescription(description);
      setSelectedImageId(description.generated_image.id);
    } else if (description) {
      console.log('🎨 No image found, trying to generate...');
      // Try to generate image if it doesn't exist
      try {
        notify.info('Image Generation', 'Generating image for this description...');
        const result = await imagesAPI.generateImageForDescription(descriptionId);
        
        // Update the description with the new image
        const updatedDescriptions = highlightedDescriptions.map(d => {
          if (d.id === descriptionId) {
            return {
              ...d,
              generated_image: {
                id: result.image_id,
                image_url: result.image_url,
                created_at: result.created_at,
                generation_time_seconds: result.generation_time
              }
            };
          }
          return d;
        });
        
        setHighlightedDescriptions(updatedDescriptions);
        setSelectedImage(result.image_url);
        setSelectedDescription(description);
        setSelectedImageId(result.image_id);
        
        notify.success('Image Generated', `Image created in ${result.generation_time.toFixed(1)}s`);
      } catch (error: any) {
        console.error('Image generation failed:', error);
        if (error.response?.status === 409) {
          notify.warning('Image Exists', 'An image for this description already exists');
        } else {
          notify.error('Generation Failed', 'Failed to generate image. Please try again later.');
        }
      }
    } else {
      console.log('❌ Description not found for ID:', descriptionId);
      notify.error('Error', 'Description not found');
    }
  };

  const handleImageRegenerated = (newImageUrl: string) => {
    setSelectedImage(newImageUrl);
    
    // Update the highlighted descriptions to reflect the new image URL
    if (selectedDescription) {
      const updatedDescriptions = highlightedDescriptions.map(d => {
        if (d.id === selectedDescription.id && d.generated_image) {
          return {
            ...d,
            generated_image: {
              ...d.generated_image,
              image_url: newImageUrl
            }
          };
        }
        return d;
      });
      
      setHighlightedDescriptions(updatedDescriptions);
    }
  };

  const handleCloseModal = () => {
    setSelectedImage(null);
    setSelectedDescription(null);
    setSelectedImageId(null);
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
  }, [highlightedDescriptions, handleDescriptionClick]);

  if (bookLoading || chapterLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Loading chapter..." />
      </div>
    );
  }

  if (chapterError || !book || !chapter) {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <ErrorMessage 
            title="Authentication Required"
            message="Please login to access this book. Use test@example.com / testpassword123"
            action={{ label: "Go to Login", onClick: () => window.location.href = '/login' }}
          />
        </div>
      );
    }

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
      <style>{`
        .epub-content p {
          margin-bottom: 1em;
          line-height: inherit;
        }
        .epub-content h1, .epub-content h2, .epub-content h3, .epub-content h4, .epub-content h5, .epub-content h6 {
          font-weight: bold;
          margin: 1.5em 0 1em 0;
        }
        .epub-content h1 { font-size: 1.5em; }
        .epub-content h2 { font-size: 1.3em; }
        .epub-content h3 { font-size: 1.2em; }
        .epub-content img {
          max-width: 100%;
          height: auto;
          margin: 1em 0;
          display: block;
        }
        .epub-content blockquote {
          margin: 1em 2em;
          padding-left: 1em;
          border-left: 3px solid #ccc;
          font-style: italic;
        }
        .epub-content em, .epub-content i {
          font-style: italic;
        }
        .epub-content strong, .epub-content b {
          font-weight: bold;
        }
        .epub-content br {
          line-height: 1.5;
        }
        .epub-content div, .epub-content span {
          line-height: inherit;
        }
        .description-highlight {
          background-color: rgba(59, 130, 246, 0.1);
          border-bottom: 2px solid rgba(59, 130, 246, 0.3);
          padding: 2px 4px;
          margin: 0 1px;
          border-radius: 3px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .description-highlight:hover {
          background-color: rgba(59, 130, 246, 0.2);
          border-bottom-color: rgba(59, 130, 246, 0.6);
          transform: translateY(-1px);
        }
        .dark .description-highlight {
          background-color: rgba(59, 130, 246, 0.15);
          border-bottom-color: rgba(59, 130, 246, 0.4);
        }
        .dark .description-highlight:hover {
          background-color: rgba(59, 130, 246, 0.25);
          border-bottom-color: rgba(59, 130, 246, 0.7);
        }
      `}</style>
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
                  Chapter {currentChapter}: {chapter.chapter?.title}
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
                  __html: (() => {
                    const pageContent = pages[currentPage - 1];
                    console.log(`Displaying page ${currentPage} of ${pages.length}, content length: ${pageContent?.length || 0}`);
                    
                    if (pageContent) {
                      if (highlightedDescriptions.length > 0) {
                        console.log('Highlighting descriptions in page:', highlightedDescriptions.length);
                        return highlightDescription(pageContent, highlightedDescriptions);
                      }
                      return pageContent;
                    }
                    
                    // Fallback to full content if pagination failed
                    const fallbackContent = chapter.chapter?.html_content || chapter.chapter?.content || '';
                    console.log('Using fallback content, length:', fallbackContent.length);
                    return fallbackContent;
                  })()
                }}
                className="select-text epub-content"
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
                  {Array.from({ length: book.chapters?.length || book.chapters_count || 0 }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>
                      Chapter {num}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={nextPage}
                disabled={currentChapter === (book.chapters?.length || book.chapters_count) && currentPage === pages.length}
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
                  {pages.length > 0 ? Math.round(
                    ((currentChapter - 1) + (currentPage - 1) / pages.length) / (book.chapters?.length || book.chapters_count || 1) * 100
                  ) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${pages.length > 0 ? Math.min(
                      ((currentChapter - 1) + (currentPage - 1) / pages.length) / (book.chapters?.length || book.chapters_count || 1) * 100,
                      100
                    ) : 0}%`
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
              onClose={handleCloseModal}
              title={selectedDescription?.type ? `${selectedDescription.type.charAt(0).toUpperCase() + selectedDescription.type.slice(1)} Description` : 'Generated Image'}
              description={selectedDescription?.content}
              imageId={selectedImageId || undefined}
              descriptionData={selectedDescription || undefined}
              onImageRegenerated={handleImageRegenerated}
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