/**
 * IOSTapZones - Touch navigation overlay for iOS PWA
 *
 * iOS PWA SPECIFIC FIX (January 2026):
 * iOS Safari and iOS PWA standalone mode do not reliably forward touch events
 * from iframes to the parent document. This is a known WebKit limitation.
 *
 * Solution: Render transparent overlay divs OUTSIDE the iframe that capture
 * touch/click events directly in the parent document.
 *
 * IMPORTANT:
 * - Zones are VERY narrow (8%) to maximize clickable area for descriptions
 * - Descriptions near the extreme edges may not be clickable (acceptable tradeoff)
 * - This component ONLY renders on iOS devices
 * - Android and other platforms use the standard rendition.on() approach
 *
 * References:
 * - https://github.com/gseguin/ios-iframe-touchevents-fix
 * - WebKit Bug 128924: Shifted document touch handling in iframes on iOS
 */

import { useCallback, useRef, memo } from 'react';

const TAP_MAX_DURATION = 350; // ms
const TAP_MAX_MOVEMENT = 20; // px

// Navigation zone width - VERY narrow to maximize description clickability
// 8% = roughly 30px on iPhone, enough for a finger tap on the edge
const ZONE_WIDTH_PERCENT = 8;

// Detect iOS device (iPhone, iPad, iPod)
const isIOS = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent;
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  return isIOSDevice || isIPadOS;
};

// Check if running as PWA (standalone mode)
const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error - Safari specific property
    window.navigator.standalone === true
  );
};

interface IOSTapZonesProps {
  onPrevPage: () => void;
  onNextPage: () => void;
  onDescriptionClick?: (descriptionId: string) => void;
  enabled?: boolean;
  headerHeight?: number;
}

/**
 * IOSTapZones renders transparent overlay divs for left/right navigation
 * ONLY on iOS devices. Does nothing on Android/Desktop.
 */
export const IOSTapZones = memo(function IOSTapZones({
  onPrevPage,
  onNextPage,
  onDescriptionClick,
  enabled = true,
  headerHeight = 70,
}: IOSTapZonesProps) {
  // Only render on iOS
  if (!isIOS()) {
    return null;
  }

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastNavTimeRef = useRef<number>(0);
  const lastDescClickTimeRef = useRef<number>(0);

  // Debug log for iOS detection (only once on mount)
  if (import.meta.env.DEV) {
    console.log('[IOSTapZones] Rendering overlay zones on iOS', {
      isStandalone: isStandalone(),
      zoneWidth: `${ZONE_WIDTH_PERCENT}%`,
    });
  }

  /**
   * Handle touch start - record position
   */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;

    const touch = e.touches[0];
    if (!touch) return;

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, [enabled]);

  /**
   * Handle touch end - determine if tap and navigate
   */
  const handleTouchEnd = useCallback((
    e: React.TouchEvent,
    action: 'prev' | 'next'
  ) => {
    if (!enabled) return;

    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    if (!touch) {
      touchStartRef.current = null;
      return;
    }

    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    const duration = Date.now() - touchStartRef.current.time;

    touchStartRef.current = null;

    // Check if it's a tap (not swipe or long press)
    const isTap = duration < TAP_MAX_DURATION && deltaX < TAP_MAX_MOVEMENT && deltaY < TAP_MAX_MOVEMENT;

    if (!isTap) {
      if (import.meta.env.DEV) {
        console.log('[IOSTapZones] Not a tap - ignoring', { deltaX, deltaY, duration });
      }
      return;
    }

    // Debounce navigation to prevent double triggers
    const now = Date.now();
    if (now - lastNavTimeRef.current < 300) {
      if (import.meta.env.DEV) {
        console.log('[IOSTapZones] Debounced - ignoring');
      }
      return;
    }
    lastNavTimeRef.current = now;

    if (import.meta.env.DEV) {
      console.log('[IOSTapZones] TAP detected -', action);
    }

    if (action === 'prev') {
      onPrevPage();
    } else {
      onNextPage();
    }
  }, [enabled, onPrevPage, onNextPage]);

  /**
   * Handle click - fallback for devices where touch events don't work
   */
  const handleClick = useCallback((
    _e: React.MouseEvent,
    action: 'prev' | 'next'
  ) => {
    if (!enabled) return;

    // Debounce
    const now = Date.now();
    if (now - lastNavTimeRef.current < 300) {
      return;
    }
    lastNavTimeRef.current = now;

    if (import.meta.env.DEV) {
      console.log('[IOSTapZones] CLICK detected -', action);
    }

    if (action === 'prev') {
      onPrevPage();
    } else {
      onNextPage();
    }
  }, [enabled, onPrevPage, onNextPage]);

  /**
   * Handle center zone touch start - record position for tap detection
   */
  const handleCenterTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;

    const touch = e.touches[0];
    if (!touch) return;

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, [enabled]);

  /**
   * Handle center zone touch end - check for description click
   *
   * Uses elementFromPoint on the iframe's document to find what element
   * is at the tap coordinates. If it's a description-highlight, trigger the click.
   */
  const handleCenterTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!enabled || !onDescriptionClick) return;

    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    if (!touch) {
      touchStartRef.current = null;
      return;
    }

    const startX = touchStartRef.current.x;
    const startY = touchStartRef.current.y;
    const deltaX = Math.abs(touch.clientX - startX);
    const deltaY = Math.abs(touch.clientY - startY);
    const duration = Date.now() - touchStartRef.current.time;

    touchStartRef.current = null;

    // Check if it's a tap (not swipe or long press)
    const isTap = duration < TAP_MAX_DURATION && deltaX < TAP_MAX_MOVEMENT && deltaY < TAP_MAX_MOVEMENT;

    if (!isTap) {
      if (import.meta.env.DEV) {
        console.log('[IOSTapZones] Center: Not a tap - ignoring', { deltaX, deltaY, duration });
      }
      return;
    }

    // Debounce
    const now = Date.now();
    if (now - lastDescClickTimeRef.current < 300) {
      if (import.meta.env.DEV) {
        console.log('[IOSTapZones] Center: Debounced - ignoring');
      }
      return;
    }

    // Find the iframe and check if tap hit a description
    const iframe = document.querySelector('#epub-viewer iframe') as HTMLIFrameElement | null;
    if (!iframe?.contentDocument) {
      if (import.meta.env.DEV) {
        console.log('[IOSTapZones] Center: No iframe found');
      }
      return;
    }

    // Get iframe bounding rect to calculate relative position
    const iframeRect = iframe.getBoundingClientRect();
    const relativeX = touch.clientX - iframeRect.left;
    const relativeY = touch.clientY - iframeRect.top;

    if (import.meta.env.DEV) {
      console.log('[IOSTapZones] Center: Checking for description at', { relativeX, relativeY });
    }

    // Find element at tap position in iframe document
    const elementAtPoint = iframe.contentDocument.elementFromPoint(relativeX, relativeY);

    if (!elementAtPoint) {
      if (import.meta.env.DEV) {
        console.log('[IOSTapZones] Center: No element at point');
      }
      return;
    }

    // Walk up the DOM tree to find description-highlight
    let target: HTMLElement | null = elementAtPoint as HTMLElement;
    let descriptionId: string | null = null;

    while (target && target !== iframe.contentDocument.body) {
      if (target.classList?.contains('description-highlight')) {
        descriptionId = target.getAttribute('data-description-id');
        break;
      }
      target = target.parentElement;
    }

    if (descriptionId) {
      lastDescClickTimeRef.current = now;

      if (import.meta.env.DEV) {
        console.log('[IOSTapZones] Center: DESCRIPTION TAP detected -', descriptionId);
      }

      onDescriptionClick(descriptionId);
    } else {
      if (import.meta.env.DEV) {
        console.log('[IOSTapZones] Center: No description at tap location, element:', elementAtPoint.tagName, elementAtPoint.className);
      }
    }
  }, [enabled, onDescriptionClick]);

  // Common styles for tap zones
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    top: `calc(${headerHeight}px + env(safe-area-inset-top))`,
    bottom: 'env(safe-area-inset-bottom)',
    zIndex: 5, // Above iframe but below UI elements
    backgroundColor: 'transparent',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    WebkitUserSelect: 'none',
    userSelect: 'none',
  };

  return (
    <>
      {/* Left tap zone - very narrow edge */}
      <div
        data-testid="ios-tap-zone-left"
        style={{
          ...baseStyle,
          left: 'env(safe-area-inset-left)',
          width: `${ZONE_WIDTH_PERCENT}%`,
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={(e) => handleTouchEnd(e, 'prev')}
        onClick={(e) => handleClick(e, 'prev')}
        aria-label="Previous page"
        role="button"
        tabIndex={-1}
      />

      {/* Right tap zone - very narrow edge */}
      <div
        data-testid="ios-tap-zone-right"
        style={{
          ...baseStyle,
          right: 'env(safe-area-inset-right)',
          width: `${ZONE_WIDTH_PERCENT}%`,
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={(e) => handleTouchEnd(e, 'next')}
        onClick={(e) => handleClick(e, 'next')}
        aria-label="Next page"
        role="button"
        tabIndex={-1}
      />

      {/* Center tap zone - for description clicks */}
      {/* This zone captures taps in the center and checks if they hit a description */}
      {onDescriptionClick && (
        <div
          data-testid="ios-tap-zone-center"
          style={{
            ...baseStyle,
            left: `calc(${ZONE_WIDTH_PERCENT}% + env(safe-area-inset-left))`,
            right: `calc(${ZONE_WIDTH_PERCENT}% + env(safe-area-inset-right))`,
            // pointerEvents only for touch - allows scrolling to work
          }}
          onTouchStart={handleCenterTouchStart}
          onTouchEnd={handleCenterTouchEnd}
          aria-label="Content area"
          role="region"
          tabIndex={-1}
        />
      )}

      {/* Debug indicator - only in dev mode */}
      {import.meta.env.DEV && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 128, 0, 0.7)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: 4,
            fontSize: 10,
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          iOS Tap Zones {ZONE_WIDTH_PERCENT}% {isStandalone() ? '(PWA)' : '(Safari)'}
        </div>
      )}
    </>
  );
});

export default IOSTapZones;
