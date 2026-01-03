/**
 * ImageGenerationStatus - Status indicator for image generation
 *
 * Shows the current state of image generation in the top-right corner
 * with smooth animations and theme support.
 *
 * @component
 */

import React, { useEffect, useState } from 'react';
import type { ThemeName } from '@/hooks/epub';
import type { GenerationStatus } from '@/hooks/epub/useImageModal';

interface ImageGenerationStatusProps {
  status: GenerationStatus;
  descriptionPreview?: string | null;
  error?: string | null;
  theme: ThemeName;
  onCancel?: () => void;
}

export const ImageGenerationStatus: React.FC<ImageGenerationStatusProps> = ({
  status,
  descriptionPreview,
  error,
  theme,
  onCancel,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Handle visibility transitions
  useEffect(() => {
    if (status === 'generating') {
      setShouldRender(true);
      // Small delay for enter animation
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else if (status === 'completed' || status === 'error') {
      // Show completed/error state briefly
      setShouldRender(true);
      setIsVisible(true);

      // Auto-hide after 3 seconds for completed, 5 seconds for error
      const hideDelay = status === 'error' ? 5000 : 3000;
      const timer = setTimeout(() => {
        setIsVisible(false);
        // Remove from DOM after animation
        setTimeout(() => {
          setShouldRender(false);
        }, 300);
      }, hideDelay);

      return () => clearTimeout(timer);
    } else {
      // idle - hide
      setIsVisible(false);
      setTimeout(() => {
        setShouldRender(false);
      }, 300);
    }
  }, [status]);

  // Don't render if not needed
  if (!shouldRender) return null;

  // Theme-based colors
  const getColors = () => {
    switch (theme) {
      case 'light':
        return {
          bg: 'bg-white',
          text: 'text-gray-800',
          subtext: 'text-gray-600',
          border: 'border-gray-200',
          spinner: 'border-blue-500',
          success: 'text-green-600',
          error: 'text-red-600',
          cancelBg: 'hover:bg-gray-100',
          cancelText: 'text-gray-500 hover:text-gray-700',
        };
      case 'sepia':
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-900',
          subtext: 'text-amber-700',
          border: 'border-amber-200',
          spinner: 'border-amber-600',
          success: 'text-green-700',
          error: 'text-red-700',
          cancelBg: 'hover:bg-amber-100',
          cancelText: 'text-amber-600 hover:text-amber-800',
        };
      case 'dark':
      default:
        return {
          bg: 'bg-gray-800',
          text: 'text-gray-100',
          subtext: 'text-gray-400',
          border: 'border-gray-600',
          spinner: 'border-blue-400',
          success: 'text-green-400',
          error: 'text-red-400',
          cancelBg: 'hover:bg-gray-700',
          cancelText: 'text-gray-400 hover:text-gray-200',
        };
    }
  };

  const colors = getColors();

  // Status icon and text
  const getStatusContent = () => {
    switch (status) {
      case 'generating':
        return {
          icon: (
            <div className={`animate-spin h-4 w-4 border-2 ${colors.spinner} border-t-transparent rounded-full`} />
          ),
          text: 'Генерация изображения...',
          showCancel: true,
        };
      case 'completed':
        return {
          icon: (
            <svg className={`h-4 w-4 ${colors.success}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
          text: 'Изображение создано',
          showCancel: false,
        };
      case 'error':
        return {
          icon: (
            <svg className={`h-4 w-4 ${colors.error}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ),
          text: error || 'Ошибка генерации',
          showCancel: false,
        };
      default:
        return { icon: null, text: '', showCancel: false };
    }
  };

  const { icon, text, showCancel } = getStatusContent();

  return (
    <div
      className={`
        fixed top-20 right-4 z-[800]
        ${colors.bg} ${colors.border} border
        rounded-lg shadow-lg
        px-4 py-3
        min-w-[250px] max-w-[350px]
        transition-all duration-300 ease-out
        ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}
      `}
    >
      {/* Header with icon and status */}
      <div className="flex items-center gap-3">
        {icon}
        <span className={`text-sm font-medium ${colors.text} flex-1`}>
          {text}
        </span>
        {showCancel && onCancel && (
          <button
            onClick={onCancel}
            className={`p-1 rounded ${colors.cancelBg} ${colors.cancelText} transition-colors`}
            title="Отменить"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Description preview (only when generating) */}
      {status === 'generating' && descriptionPreview && (
        <div className={`mt-2 text-xs ${colors.subtext} line-clamp-2`}>
          {descriptionPreview}...
        </div>
      )}

      {/* Progress bar animation (only when generating) */}
      {status === 'generating' && (
        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.spinner.replace('border-', 'bg-')} animate-progress-bar`}
          />
        </div>
      )}
    </div>
  );
};

