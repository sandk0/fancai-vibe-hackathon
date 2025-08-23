import React from 'react';
import { X, Download, Share2, ZoomIn, ZoomOut } from 'lucide-react';
import { motion } from 'framer-motion';

interface ImageModalProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  imageUrl,
  isOpen,
  onClose,
  title,
  description
}) => {
  const [isZoomed, setIsZoomed] = React.useState(false);

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

  // Close on escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
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
  }, [isOpen, onClose]);

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

        {/* Image */}
        <div className="relative overflow-hidden rounded-lg bg-gray-900">
          <img
            src={imageUrl}
            alt={title || 'Generated image'}
            className={`max-w-full max-h-[90vh] object-contain transition-transform duration-300 ${
              isZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'
            }`}
            onClick={() => setIsZoomed(!isZoomed)}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/placeholder-image.jpg'; // Fallback image
            }}
          />
        </div>

        {/* Loading state */}
        {!imageUrl && (
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