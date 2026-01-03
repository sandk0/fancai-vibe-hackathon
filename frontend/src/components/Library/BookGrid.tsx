/**
 * BookGrid - Redesigned responsive book grid with skeleton loading
 *
 * Grid breakpoints:
 * - Mobile: 2 columns
 * - Tablet (sm/md): 3-4 columns
 * - Desktop (lg/xl): 5-6 columns
 *
 * Features:
 * - Skeleton loading state
 * - Empty state with illustration
 * - Search empty state
 * - Responsive grid layout
 * - Animation support via AnimatePresence
 *
 * @param books - Array of books to display
 * @param isLoading - Loading state for skeleton
 * @param searchQuery - Current search query (for empty state)
 * @param onBookClick - Callback when clicking a book
 * @param onClearSearch - Callback to clear search
 * @param onUploadClick - Callback to upload first book
 * @param onParsingComplete - Callback when parsing completes
 * @param onDelete - Callback for delete action
 */

import { memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, BookOpen } from 'lucide-react';
import { BookCard } from './BookCard';
import { Skeleton } from '@/components/UI/Skeleton';
import type { Book as BookType } from '@/types/api';

interface BookGridProps {
  books: BookType[];
  isLoading?: boolean;
  searchQuery?: string;
  onBookClick: (bookId: string) => void;
  onClearSearch?: () => void;
  onUploadClick?: () => void;
  onParsingComplete?: () => void;
  onDelete?: (bookId: string) => void;
}

/**
 * BookCardSkeleton - Skeleton for book card loading state
 */
const BookCardSkeleton = memo(function BookCardSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Cover skeleton - 2:3 aspect ratio */}
      <Skeleton
        variant="rectangular"
        className="aspect-[2/3] w-full rounded-xl"
      />
      {/* Title skeleton */}
      <div className="mt-3 px-1">
        <Skeleton variant="text" className="h-4 w-3/4 mb-2" />
        <Skeleton variant="text" className="h-3 w-1/2" />
      </div>
    </div>
  );
});

/**
 * EmptyStateIllustration - SVG illustration for empty library
 */
const EmptyStateIllustration = () => (
  <div className="w-32 h-32 mx-auto mb-6 relative">
    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5" />
    <div className="absolute inset-4 flex items-center justify-center">
      <div className="relative">
        {/* Stack of books illustration */}
        <div className="absolute -left-2 bottom-0 w-8 h-10 rounded bg-primary/30 transform -rotate-12" />
        <div className="absolute left-1 bottom-0 w-8 h-12 rounded bg-primary/50 transform -rotate-6" />
        <div className="relative w-10 h-14 rounded bg-primary flex items-center justify-center shadow-lg">
          <BookOpen className="w-5 h-5 text-primary-foreground" />
        </div>
      </div>
    </div>
  </div>
);

/**
 * SearchEmptyIllustration - SVG illustration for no search results
 */
const SearchEmptyIllustration = () => (
  <div className="w-24 h-24 mx-auto mb-6 relative">
    <div className="absolute inset-0 rounded-full bg-muted flex items-center justify-center">
      <Search className="w-10 h-10 text-muted-foreground/50" />
    </div>
    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center">
      <span className="text-destructive font-bold text-sm">?</span>
    </div>
  </div>
);

/**
 * BookGrid - Memoized grid/list of book cards
 */
export const BookGrid = memo(function BookGrid({
  books,
  isLoading = false,
  searchQuery,
  onBookClick,
  onClearSearch,
  onUploadClick,
  onParsingComplete,
  onDelete,
}: BookGridProps) {
  // Memoize book click handler factory
  const createBookClickHandler = useCallback(
    (bookId: string) => () => onBookClick(bookId),
    [onBookClick]
  );

  // Loading state with skeleton grid
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5 lg:gap-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <BookCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  // Empty state: No results from search
  if (books.length === 0 && searchQuery) {
    return (
      <motion.div
        className="text-center py-16 px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <SearchEmptyIllustration />
        <h3 className="text-xl font-bold mb-2 text-foreground">
          No books found
        </h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          No results for "{searchQuery}". Try a different search term.
        </p>
        {onClearSearch && (
          <motion.button
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground shadow-lg min-h-[44px]"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClearSearch}
          >
            Clear Search
          </motion.button>
        )}
      </motion.div>
    );
  }

  // Empty state: No books at all
  if (books.length === 0) {
    return (
      <motion.div
        className="text-center py-16 px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <EmptyStateIllustration />
        <h3 className="text-xl font-bold mb-2 text-foreground">
          Your library is empty
        </h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          Upload your first book to start your AI-enhanced reading journey
        </p>
        {onUploadClick && (
          <motion.button
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground shadow-lg min-h-[44px]"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onUploadClick}
          >
            <Plus className="w-5 h-5" />
            Upload First Book
          </motion.button>
        )}
      </motion.div>
    );
  }

  // Books grid - responsive columns
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5 lg:gap-6">
      <AnimatePresence mode="popLayout">
        {books.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onClick={createBookClickHandler(book.id)}
            onParsingComplete={onParsingComplete}
            onDelete={onDelete}
          />
        ))}
      </AnimatePresence>
    </div>
  );
});
