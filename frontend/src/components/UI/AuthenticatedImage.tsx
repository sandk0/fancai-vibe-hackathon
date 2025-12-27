/**
 * AuthenticatedImage - Image component that loads images with JWT authentication
 *
 * Regular <img> tags cannot send Authorization headers, so this component
 * fetches the image with the JWT token and displays it as a blob URL.
 *
 * @component
 */

import { useState, useEffect, memo } from 'react';
import { STORAGE_KEYS } from '@/types/state';

interface AuthenticatedImageProps {
  src: string | null;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * AuthenticatedImage - Loads images with JWT authentication
 *
 * Optimization rationale:
 * - Memoized to prevent re-renders when parent state changes
 * - Uses useEffect cleanup to revoke blob URLs and prevent memory leaks
 * - Caches blob URL in state to avoid re-fetching on re-renders
 */
export const AuthenticatedImage = memo(function AuthenticatedImage({
  src,
  alt,
  className,
  fallback,
  onLoad,
  onError,
}: AuthenticatedImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let currentBlobUrl: string | null = null;

    const loadImage = async () => {
      if (!src) {
        setIsLoading(false);
        setHasError(true);
        return;
      }

      setIsLoading(true);
      setHasError(false);

      try {
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        const response = await fetch(src, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();

        if (isMounted) {
          currentBlobUrl = URL.createObjectURL(blob);
          setBlobUrl(currentBlobUrl);
          setIsLoading(false);
          onLoad?.();
        }
      } catch (error) {
        console.warn('AuthenticatedImage: Failed to load image:', src, error);
        if (isMounted) {
          setIsLoading(false);
          setHasError(true);
          onError?.();
        }
      }
    };

    loadImage();

    // Cleanup: revoke blob URL when component unmounts or src changes
    return () => {
      isMounted = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [src, onLoad, onError]);

  // Cleanup previous blob URL when a new one is created
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  if (isLoading) {
    // Show a loading placeholder or the fallback
    return fallback ? <>{fallback}</> : (
      <div className={className} style={{ backgroundColor: 'var(--bg-secondary)' }} />
    );
  }

  if (hasError || !blobUrl) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
    />
  );
});
