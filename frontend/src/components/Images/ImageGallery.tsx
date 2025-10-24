import React, { useState } from 'react';
import { Eye, Download, Share2, Image, Filter, Grid, List } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { imagesAPI } from '@/api/images';
import { useUIStore } from '@/stores/ui';
import { ImageModal } from './ImageModal';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import ErrorMessage from '@/components/UI/ErrorMessage';
import type { GeneratedImage } from '@/types/api';

interface ImageGalleryProps {
  bookId: string;
  chapterNumber?: number;
  className?: string;
}

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'location' | 'character' | 'atmosphere' | 'object' | 'action';

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  bookId,
  chapterNumber,
  className = '',
}) => {
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { notify } = useUIStore();

  // Fetch images for the book
  const { 
    data: imagesResponse, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['book-images', bookId, chapterNumber],
    queryFn: () => imagesAPI.getBookImages(bookId, chapterNumber),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const images = imagesResponse?.images || [];

  // Filter images based on search and filter criteria
  const filteredImages = React.useMemo(() => {
    let filtered = images;
    
    // Apply filter by description type
    if (filter !== 'all') {
      filtered = filtered.filter(img => 
        img.description?.type === filter
      );
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(img =>
        img.description?.content.toLowerCase().includes(query) ||
        img.description?.type.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [images, filter, searchQuery]);

  // Get unique description types for filter options
  const availableTypes = React.useMemo(() => {
    const types = new Set(images.map(img => img.description?.type).filter(Boolean));
    return Array.from(types);
  }, [images]);

  const handleImageClick = (image: GeneratedImage) => {
    setSelectedImage(image);
  };

  const handleDownload = async (image: GeneratedImage) => {
    try {
      const response = await fetch(image.image_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `bookreader-${image.id}-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      notify.success('Download Started', 'Image download has begun');
    } catch (error) {
      notify.error('Download Failed', 'Failed to download image');
    }
  };

  const handleShare = async (image: GeneratedImage) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'BookReader AI - Generated Image',
          text: image.description?.content || 'AI-generated book illustration',
          url: image.image_url,
        });
      } catch (error) {
        console.error('Share failed:', error);
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(image.image_url);
        notify.success('Copied to Clipboard', 'Image URL copied to clipboard');
      } catch (error) {
        notify.error('Share Failed', 'Failed to share image');
      }
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <LoadingSpinner size="lg" text="Loading images..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <ErrorMessage
          title="Failed to Load Images"
          message="Unable to load generated images for this book"
          action={{ label: 'Retry', onClick: () => refetch() }}
        />
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <Image className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No Images Generated Yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
          AI images will appear here as they are generated from the book's descriptions
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
            Generated Images
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {filteredImages.length} of {images.length} images
          </p>
        </div>
        
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors"
            title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
          >
            {viewMode === 'grid' ? (
              <List className="h-5 w-5" />
            ) : (
              <Grid className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search descriptions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>
        
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterType)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">All Types</option>
          {availableTypes.map(type => (
            <option key={type} value={type}>
              {(type ?? '').charAt(0).toUpperCase() + (type ?? '').slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Images */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredImages.map((image, index) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="group relative bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
            >
              <div 
                className="aspect-square cursor-pointer overflow-hidden"
                onClick={() => handleImageClick(image)}
              >
                <img
                  src={image.image_url}
                  alt={image.description?.content || 'Generated image'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Eye className="h-8 w-8 text-white" />
                </div>
              </div>
              
              {/* Actions */}
              <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(image);
                  }}
                  className="p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare(image);
                  }}
                  className="p-1.5 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                  title="Share"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
              
              {/* Info */}
              <div className="p-3">
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {image.description?.content || 'Generated image'}
                </p>
                {image.description?.type && (
                  <span className="inline-block mt-2 px-2 py-1 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 rounded-full">
                    {image.description.type}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredImages.map((image, index) => (
            <motion.div
              key={image.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center space-x-4 bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-lg transition-shadow"
            >
              <div 
                className="w-20 h-20 flex-shrink-0 cursor-pointer rounded-lg overflow-hidden"
                onClick={() => handleImageClick(image)}
              >
                <img
                  src={image.image_url}
                  alt={image.description?.content || 'Generated image'}
                  className="w-full h-full object-cover hover:scale-105 transition-transform"
                  loading="lazy"
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 dark:text-white text-sm font-medium line-clamp-2">
                  {image.description?.content || 'Generated image'}
                </p>
                {image.description?.type && (
                  <span className="inline-block mt-1 px-2 py-1 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 rounded-full">
                    {image.description.type}
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleImageClick(image)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 transition-colors"
                  title="View"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDownload(image)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 transition-colors"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleShare(image)}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 transition-colors"
                  title="Share"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty state for filtered results */}
      {filteredImages.length === 0 && images.length > 0 && (
        <div className="text-center py-12">
          <Filter className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Images Match Your Filters
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}

      {/* Image Modal */}
      <AnimatePresence>
        {selectedImage && (
          <ImageModal
            imageUrl={selectedImage.image_url}
            title={selectedImage.description?.type}
            description={selectedImage.description?.content}
            isOpen={!!selectedImage}
            onClose={() => setSelectedImage(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};