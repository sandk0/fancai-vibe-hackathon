import React, { useState } from 'react';
import { X, Download, Share2, ZoomIn, ZoomOut, RefreshCw, Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { imagesAPI } from '@/api/images';
import { useUIStore } from '@/stores/ui';
import LoadingSpinner from '@/components/UI/LoadingSpinner';
import type { Description, GeneratedImage } from '@/types/api';

interface ImageModalProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  imageId?: string;
  descriptionData?: Description;
  onImageRegenerated?: (newImageUrl: string) => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  imageUrl,
  isOpen,
  onClose,
  title,
  description,
  imageId,
  descriptionData,
  onImageRegenerated
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateOptions, setShowRegenerateOptions] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const { notify } = useUIStore();

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bookreader-image-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || 'BookReader AI - Generated Image',
          text: description || 'Image generated from book description',
          url: imageUrl,
        });
      } catch (error) {
        console.error('Share failed:', error);
      }
    } else {
      // Fallback to copy to clipboard
      navigator.clipboard.writeText(imageUrl);
    }
  };

  const handleRegenerate = async () => {
    if (!imageId) {
      notify.error('Regeneration Error', 'Cannot regenerate image: missing image ID');
      return;
    }

    setIsRegenerating(true);
    try {
      const result = await imagesAPI.regenerateImage(imageId, {
        style_prompt: customPrompt || undefined,
      });
      
      setCurrentImageUrl(result.image_url);
      setShowRegenerateOptions(false);
      setCustomPrompt('');
      
      if (onImageRegenerated) {
        onImageRegenerated(result.image_url);
      }
      
      notify.success('Image Regenerated', `New image generated in ${result.generation_time.toFixed(1)}s`);
    } catch (error) {
      console.error('Regeneration failed:', error);
      notify.error('Regeneration Failed', 'Failed to regenerate image. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Update current image URL when prop changes
  React.useEffect(() => {
    setCurrentImageUrl(imageUrl);
  }, [imageUrl]);

  // Close on escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showRegenerateOptions) {
          setShowRegenerateOptions(false);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, showRegenerateOptions]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative max-w-4xl max-h-[90vh] mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="text-white">
              {title && <h3 className="font-semibold">{title}</h3>}
              {description && (
                <p className="text-sm text-gray-300 mt-1">{description}</p>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsZoomed(!isZoomed)}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                title={isZoomed ? 'Zoom Out' : 'Zoom In'}
              >
                {isZoomed ? (
                  <ZoomOut className="h-5 w-5" />
                ) : (
                  <ZoomIn className="h-5 w-5" />
                )}
              </button>
              
              {imageId && (
                <button
                  onClick={() => setShowRegenerateOptions(!showRegenerateOptions)}
                  className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                  title="Regenerate Image"
                  disabled={isRegenerating}
                >
                  {isRegenerating ? (
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <RefreshCw className="h-5 w-5" />
                  )}
                </button>
              )}
              
              <button
                onClick={handleShare}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                title="Share"
              >
                <Share2 className="h-5 w-5" />
              </button>
              
              <button
                onClick={handleDownload}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                title="Download"
              >
                <Download className="h-5 w-5" />
              </button>
              
              <button
                onClick={onClose}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Regenerate Options */}
        {showRegenerateOptions && (
          <div className="absolute top-16 left-4 right-4 z-20 bg-gray-900/95 backdrop-blur-sm rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold flex items-center space-x-2">
                <Wand2 className="h-5 w-5" />
                <span>Regenerate Image</span>
              </h3>
              <button
                onClick={() => setShowRegenerateOptions(false)}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">
                  Custom Style (optional)
                </label>
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g., 'watercolor style', 'dark fantasy', 'photorealistic'..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                  disabled={isRegenerating}
                />
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded-lg transition-colors"
                >
                  {isRegenerating ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      <span>Regenerate</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowRegenerateOptions(false)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  disabled={isRegenerating}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image */}
        <div className="relative overflow-hidden rounded-lg bg-gray-900">
          {isRegenerating && (
            <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-10">
              <div className="text-center text-white">
                <LoadingSpinner size="lg" />
                <p className="mt-2">Regenerating image...</p>
                <p className="text-sm text-gray-300 mt-1">This may take 10-30 seconds</p>
              </div>
            </div>
          )}
          
          <img
            src={currentImageUrl}
            alt={title || 'Generated image'}
            className={`max-w-full max-h-[90vh] object-contain transition-transform duration-300 ${
              isZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'
            } ${isRegenerating ? 'opacity-50' : ''}`}
            onClick={() => !isRegenerating && setIsZoomed(!isZoomed)}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/placeholder-image.jpg'; // Fallback image
            }}
          />
        </div>

        {/* Loading state */}
        {!currentImageUrl && !isRegenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              <p className="text-white">Loading image...</p>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};