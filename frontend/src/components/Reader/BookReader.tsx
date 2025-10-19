import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, Settings, Eye, Volume2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DOMPurify from 'dompurify';
import { useQuery } from '@tanstack/react-query';
import { booksAPI } from '@/api/books';
import { imagesAPI } from '@/api/images';
import { useReaderStore } from '@/stores/reader';
import { useUIStore, notify } from '@/stores/ui';
import { STORAGE_KEYS } from '@/types/state';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import ErrorMessage from '@/components/UI/ErrorMessage';
import { ImageModal } from '@/components/Images/ImageModal';
import { useTranslation } from '@/hooks/useTranslation';
import type { Chapter, Description, BookDetail } from '@/types/api';

interface BookReaderProps {
  bookId?: string;
  chapterNumber?: number;
}

export const BookReader: React.FC<BookReaderProps> = ({
  bookId: propBookId,
  chapterNumber: propChapterNumber
}) => {
  const { t } = useTranslation();
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
  const [showSettings, setShowSettings] = useState(false);
  const [hasRestoredPosition, setHasRestoredPosition] = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const isFirstMount = useRef(true);
  const {
    fontSize,
    fontFamily,
    lineHeight,
    theme,
    updateFontSize,
    updateTheme
  } = useReaderStore();

  // Fetch book data
  const { data: book, isLoading: bookLoading } = useQuery<BookDetail>({
    queryKey: ['book', bookId],
    queryFn: () => booksAPI.getBook(bookId),
  });

  // Fetch chapter data
  const { data: chapter, isLoading: chapterLoading, error: chapterError, refetch } = useQuery({
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

      // Don't modify currentPage here - let restore/navigation handle it
      // This prevents race conditions where pagination resets the restored position
      if (currentPage > newPages.length) {
        console.log(`⚠️ Warning: Current page ${currentPage} > ${newPages.length} pages. User position will be managed by restore/navigation logic.`);
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

  // Restore reading position on initial load
  useEffect(() => {
    console.log('📖 Restore useEffect called:', {
      hasRestoredPosition,
      pagesLength: pages.length,
      currentChapter,
      initialChapter,
      willRestore: !hasRestoredPosition && pages.length > 0 && currentChapter === initialChapter
    });

    // Only restore position once, for the initial chapter, and after pages are calculated
    if (hasRestoredPosition) {
      console.log('📖 Skipping restore - already restored');
      return;
    }

    if (pages.length === 0) {
      console.log('📖 Skipping restore - pages not ready');
      return;
    }

    if (currentChapter !== initialChapter) {
      console.log('📖 Skipping restore - chapter changed from initial');
      return;
    }

    console.log('📖 ✅ Attempting to restore reading position...');

    // Load saved reading progress
    booksAPI.getReadingProgress(bookId)
      .then(({ progress }) => {
        if (!progress) {
          console.log('📖 No saved progress found');
          setHasRestoredPosition(true);
          return;
        }

        console.log('📖 Loaded progress from API:', {
          currentChapter: progress.current_chapter,
          currentPosition: progress.current_position,
          currentPositionType: typeof progress.current_position,
          savedChapter: progress.current_chapter,
          urlChapter: initialChapter,
          pagesLength: pages.length
        });

        // Only restore position if we're on the same chapter as saved progress
        if (progress.current_chapter === currentChapter && progress.current_position > 0) {
          // Calculate target page based on position percent (0-100)
          const targetPage = Math.max(1, Math.ceil((progress.current_position / 100) * pages.length));

          console.log('📖 ✅ RESTORING POSITION:', {
            chapter: progress.current_chapter,
            positionPercent: progress.current_position + '%',
            totalPages: pages.length,
            targetPage,
            calculation: `Math.ceil((${progress.current_position} / 100) * ${pages.length}) = ${targetPage}`
          });

          setCurrentPage(targetPage);

          // Verify it was set
          setTimeout(() => {
            console.log('📖 Verification after setCurrentPage:', {
              targetPage,
              message: 'If currentPage is not ' + targetPage + ', something else is resetting it!'
            });
          }, 100);
        } else {
          console.log('📖 ⚠️ NOT restoring position:', {
            chapterMatch: progress.current_chapter === currentChapter,
            chapterMatchTypes: `${typeof progress.current_chapter} === ${typeof currentChapter}`,
            hasPosition: progress.current_position > 0,
            currentChapter,
            savedChapter: progress.current_chapter,
            position: progress.current_position
          });
        }

        setHasRestoredPosition(true);
      })
      .catch(err => {
        console.error('❌ Failed to load reading progress:', err);
        setHasRestoredPosition(true);
      });
  }, [pages.length, currentChapter, initialChapter, bookId, hasRestoredPosition]);

  // Update reading progress
  useEffect(() => {
    console.log('📊 Reading progress update conditions:', {
      hasBook: !!book,
      hasChapter: !!chapter,
      pagesLength: pages.length,
      currentChapter,
      currentPage,
      bookId,
      hasRestoredPosition
    });

    // Don't save progress until position has been restored on initial load
    if (!hasRestoredPosition) {
      console.log('📊 Skipping progress save - waiting for position restoration');
      return;
    }

    if (book && chapter && pages.length > 0) {
      // Calculate position percent in current chapter (0-100%)
      const positionPercent = (currentPage / pages.length) * 100;

      console.log('📊 Auto-save progress:', {
        currentChapter,
        currentPage,
        totalPages: pages.length,
        positionPercent: positionPercent.toFixed(2) + '%'
      });

      console.log('📊 Sending API request to save progress...', {
        bookId,
        data: {
          current_chapter: currentChapter,
          current_position_percent: positionPercent
        }
      });

      // Send progress to API with new format
      const savePromise = booksAPI.updateReadingProgress(bookId, {
        current_chapter: currentChapter,
        current_position_percent: positionPercent
      });

      console.log('📊 API request initiated, promise:', savePromise);

      savePromise
        .then(response => {
          console.log('📊 ✅ Progress saved successfully:', {
            savedChapter: response.progress.current_chapter,
            savedPosition: response.progress.current_position,
            response
          });
        })
        .catch(err => {
          console.error('❌ Failed to update progress:', err);
          console.error('❌ Error details:', {
            message: err.message,
            response: err.response,
            stack: err.stack
          });
        });
    } else {
      console.log('📊 Not updating progress - conditions not met');
    }
  }, [bookId, currentChapter, currentPage, pages.length, book, chapter, hasRestoredPosition]);

  // Reset to first page when chapter changes (skip first mount)
  useEffect(() => {
    // Skip on first mount to allow position restoration
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    console.log(`Chapter changed to: ${currentChapter}`);
    setCurrentPage(1);
    setPages([]); // Clear pages to force re-pagination

    // Save progress immediately when changing chapters
    if (book) {
      console.log(`📊 Saving progress for chapter change: ${currentChapter}, position: 0%`);
      booksAPI.updateReadingProgress(bookId, {
        current_chapter: currentChapter,
        current_position_percent: 0  // Beginning of new chapter
      }).catch(err => {
        console.error('Failed to update progress:', err);
      });
    }
  }, [currentChapter, book, bookId]);

  // Handle descriptions from API response and auto-parsing
  useEffect(() => {
    if (!chapter) return;
    
    // Check for descriptions in different possible locations in API response
    let descriptions = [];
    
    if (chapter.descriptions && Array.isArray(chapter.descriptions)) {
      descriptions = chapter.descriptions;
    } else if (chapter.chapter?.descriptions && Array.isArray(chapter.chapter.descriptions)) {
      descriptions = chapter.chapter.descriptions;  
    } else if (Array.isArray(chapter)) {
      // Sometimes API returns descriptions array directly
      descriptions = chapter;
    }
    
    console.log('📖 Chapter API response analysis:', {
      hasDescriptions: descriptions.length > 0,
      descriptionsCount: descriptions.length,
      chapterKeys: Object.keys(chapter),
      sampleDescription: descriptions[0] ? {
        type: descriptions[0].type,
        content: descriptions[0].content?.substring(0, 100) + '...'
      } : null
    });
    
    if (descriptions.length > 0) {
      console.log('✅ Descriptions loaded from chapter API:', descriptions.length);
      setHighlightedDescriptions(descriptions);
      return; // Exit early if we have descriptions
    }
    
    // If no descriptions found in chapter response, always try to trigger parsing
    console.log('⚠️ No descriptions in chapter response, will attempt to trigger parsing');
    setHighlightedDescriptions([]);
    
    const recentParsingKey = 'recent_parsing';
    const recentParsing = JSON.parse(localStorage.getItem(recentParsingKey) || '{}');
    const isRecentlyParsed = recentParsing[bookId] && (Date.now() - recentParsing[bookId] < 300000); // 5 minutes cooldown
    
    console.log('🔍 Auto-parsing status check:', {
      bookId,
      recentlyParsed: isRecentlyParsed,
      cooldownRemaining: isRecentlyParsed ? Math.max(0, 300000 - (Date.now() - recentParsing[bookId])) : 0,
      authToken: localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) ? 'Present' : 'Missing',
      nextAction: !isRecentlyParsed ? 'Will trigger parsing' : 'Cooldown active, will wait'
    });
    
    if (!isRecentlyParsed && bookId) {
      // Trigger parsing if not recently attempted
      console.log('📝 Auto-triggering description parsing for book:', bookId);
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      fetch(`${apiUrl}/books/${bookId}/process`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)}`,
          'Content-Type': 'application/json'
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
        
        // Mark as recently parsed (prevent duplicate requests)
        recentParsing[bookId] = Date.now();
        localStorage.setItem(recentParsingKey, JSON.stringify(recentParsing));
        
        // Show notification based on processing type
        if (data.status === 'completed') {
          // Synchronous processing completed
          notify.success('Описания обработаны!', `Найдено ${data.descriptions_found || 0} описаний. Перезагружаем...`);
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          // Asynchronous processing started
          notify.info('Парсинг запущен', 'Обрабатываем описания в фоновом режиме...');
          
          // Check for completion every 10 seconds for up to 2 minutes
          let attempts = 0;
          const maxAttempts = 12;
          
          const checkCompletion = () => {
            attempts++;
            console.log(`🔄 Checking parsing completion (attempt ${attempts}/${maxAttempts})`);
            
            refetch().then((newData) => {
              const newDescriptions = newData?.descriptions || [];
              if (newDescriptions.length > 0) {
                console.log('✅ Descriptions found, parsing completed!');
                notify.success('Парсинг завершен!', `Найдено ${newDescriptions.length} описаний. Перезагружаем...`);
                setTimeout(() => {
                  window.location.reload();
                }, 2000);
              } else if (attempts < maxAttempts) {
                setTimeout(checkCompletion, 10000);
              } else {
                console.log('⏰ Parsing check timed out');
                notify.warning('Парсинг займет время', 'Обновите страницу через несколько минут');
              }
            }).catch(() => {
              if (attempts < maxAttempts) {
                setTimeout(checkCompletion, 10000);
              }
            });
          };
          
          // Start checking after initial delay
          setTimeout(checkCompletion, 15000);
        }
      })
      .catch(err => {
        console.error('❌ Failed to trigger parsing:', err);
        notify.error('Ошибка парсинга', 'Не удалось запустить обработку описаний');
      });
      
    } else {
      console.log('📝 Auto-parsing skipped due to cooldown:', {
        bookId,
        cooldownRemaining: Math.max(0, 300000 - (Date.now() - recentParsing[bookId])),
        message: 'Waiting for cooldown to expire before allowing new parsing attempt'
      });
    }
    
  }, [chapter, bookId, currentChapter, refetch]);

  const nextPage = () => {
    console.log(`Next page: current=${currentPage}, total=${pages.length}, chapter=${currentChapter}`);
    if (currentPage < pages.length) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      // Progress will be saved by useEffect
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
      // Progress will be saved by useEffect
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
      // Progress will be saved by useEffect
    }
  };

  const cleanExistingHighlights = (text: string) => {
    // Remove all existing highlight spans to prevent nesting
    return text.replace(/<span[^>]*class="[^"]*description-highlight[^"]*"[^>]*>/gi, '')
               .replace(/<\/span>/gi, '');
  };

  const highlightDescription = (text: string, descriptions: Description[]) => {
    if (!descriptions || descriptions.length === 0) {
      return text;
    }
    
    // First, clean any existing highlights to prevent nesting
    let highlightedText = cleanExistingHighlights(text);
    
    // Sort descriptions by length (longest first) to prevent shorter descriptions 
    // from being highlighted inside longer ones
    const sortedDescriptions = [...descriptions].sort((a, b) => {
      const aText = a.content || a.text || '';
      const bText = b.content || b.text || '';
      return bText.length - aText.length;
    });
    
    sortedDescriptions.forEach((desc) => {
      // Use content or text field
      const descText = desc.content || desc.text;
      if (!descText || descText.length < 10) return; // Skip very short descriptions
      
      // Escape special regex characters and create pattern
      const escapedText = descText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<!<[^>]*>)${escapedText}(?![^<]*>)`, 'gi');
      
      // Replace with highlighted span only if not already inside HTML tags
      highlightedText = highlightedText.replace(regex, (match) => {
        // Double check we're not inside an existing highlight
        const beforeMatch = highlightedText.substring(0, highlightedText.indexOf(match));
        const openHighlights = (beforeMatch.match(/<span[^>]*class="[^"]*description-highlight[^"]*"[^>]*>/g) || []).length;
        const closeHighlights = (beforeMatch.match(/<\/span>/g) || []).length;
        
        // If we're inside a highlight span, skip highlighting
        if (openHighlights > closeHighlights) {
          return match;
        }
        
        return `<span class="description-highlight" data-description-id="${desc.id}">${match}</span>`;
      });
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
        notify.info(t('reader.imageGeneration'), t('reader.generatingImageDesc'));
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
        
        notify.success(t('reader.imageGenerated'), t('reader.imageCreated').replace('{time}', result.generation_time.toFixed(1)));
      } catch (error: any) {
        console.error('Image generation failed:', error);
        if (error.response?.status === 409) {
          notify.warning(t('reader.imageExists'), t('reader.imageExistsDesc'));
        } else {
          notify.error(t('reader.generationFailed'), t('reader.generationFailedDesc'));
        }
      }
    } else {
      console.log('❌ Description not found for ID:', descriptionId);
      notify.error(t('common.error'), t('reader.descriptionNotFound'));
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
        <LoadingSpinner size="lg" text={t('reader.loadingChapter')} />
      </div>
    );
  }

  if (chapterError || !book || !chapter) {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <ErrorMessage
            title={t('reader.authRequired')}
            message={t('reader.authRequiredDesc')}
            action={{ label: t('reader.goToLogin'), onClick: () => window.location.href = '/login' }}
          />
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-screen">
        <ErrorMessage
          title={t('reader.chapterNotFound')}
          message={t('reader.chapterNotFoundDesc')}
          action={{ label: t('reader.goBack'), onClick: () => window.history.back() }}
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
                  {t('reader.chapterLabel')} {currentChapter}: {chapter.chapter?.title}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('reader.page').replace('{num}', String(currentPage)).replace('{total}', String(pages.length))}
              </span>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white ${showSettings ? 'bg-gray-100 dark:bg-gray-700 rounded' : ''}`}
                title={t('reader.settings')}
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-4 px-6">
            <div className="max-w-4xl mx-auto">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                {t('reader.quickSettings')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Font Size */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('reader.fontSize')}: {fontSize}px
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateFontSize(Math.max(12, fontSize - 2))}
                      className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
                    >
                      A-
                    </button>
                    <input
                      type="range"
                      min="12"
                      max="32"
                      step="2"
                      value={fontSize}
                      onChange={(e) => updateFontSize(Number(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <button
                      onClick={() => updateFontSize(Math.min(32, fontSize + 2))}
                      className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
                    >
                      A+
                    </button>
                  </div>
                </div>

                {/* Theme */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('reader.theme')}
                  </label>
                  <div className="flex space-x-2">
                    {['light', 'dark', 'sepia'].map((themeOption) => (
                      <button
                        key={themeOption}
                        onClick={() => updateTheme(themeOption as 'light' | 'dark' | 'sepia')}
                        className={`flex-1 px-3 py-2 text-sm border rounded transition-colors ${
                          theme === themeOption
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        {t(`readerSettings.${themeOption}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
                  __html: DOMPurify.sanitize((() => {
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
                  })())
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
                <span>{t('reader.previous')}</span>
              </button>

              <div className="flex items-center space-x-4">
                <select
                  value={currentChapter}
                  onChange={(e) => jumpToChapter(parseInt(e.target.value))}
                  className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                >
                  {Array.from({ length: book.chapters?.length || book.chapters_count || 0 }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num}>
                      {t('reader.chapterLabel')} {num}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={nextPage}
                disabled={currentChapter === (book.chapters?.length || book.chapters_count) && currentPage === pages.length}
                className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span>{t('reader.next')}</span>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>{t('reader.progress')}</span>
                <span>
                  {pages.length > 0 ? Math.round(
                    ((currentChapter - 1) + currentPage / pages.length) / (book.chapters?.length || book.chapters_count || 1) * 100
                  ) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${pages.length > 0 ? Math.min(
                      ((currentChapter - 1) + currentPage / pages.length) / (book.chapters?.length || book.chapters_count || 1) * 100,
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
          {t('reader.navigationHint')}
        </div>

        {/* Image Modal */}
        <AnimatePresence>
          {selectedImage && (
            <ImageModal
              imageUrl={selectedImage}
              isOpen={!!selectedImage}
              onClose={handleCloseModal}
              title={selectedDescription?.type ? `${selectedDescription.type.charAt(0).toUpperCase() + selectedDescription.type.slice(1)} ${t('reader.descriptionType').replace('{type}', '')}` : t('reader.generatedImage')}
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