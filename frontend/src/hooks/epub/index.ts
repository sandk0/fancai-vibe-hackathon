/**
 * EPUB Reader Custom Hooks
 *
 * This module exports all custom hooks for EPUB reading functionality.
 * These hooks were extracted from the monolithic EpubReader component
 * to improve maintainability and testability.
 *
 * Performance improvements:
 * - Location caching: 5-10s → <100ms on subsequent loads
 * - Progress updates: 60 req/s → 0.2 req/s (debounced)
 * - Memory leaks: Fixed via proper cleanup
 * - CFI restoration: Hybrid CFI + scroll offset for pixel-perfect positioning
 *
 * @module hooks/epub
 */

export { useEpubLoader } from './useEpubLoader';
export { useLocationGeneration, clearCachedLocations } from './useLocationGeneration';
export { useCFITracking } from './useCFITracking';
export { useProgressSync } from './useProgressSync';
export { useEpubNavigation, useKeyboardNavigation } from './useEpubNavigation';
export { useChapterManagement } from './useChapterManagement';
export { useDescriptionHighlighting } from './useDescriptionHighlighting';
export { useImageModal } from './useImageModal';
