/**
 * IOSTapZones - Overlay navigation zones for iOS PWA
 *
 * iOS PWA SPECIFIC FIX (January 2026):
 * iOS Safari and iOS PWA standalone mode do not reliably forward touch events
 * from iframes to the parent document. This is a known WebKit limitation.
 *
 * Solution: Render transparent overlay divs OUTSIDE the iframe that capture
 * touch/click events directly in the parent document.
 *
 * This component ONLY renders on iOS devices (detected via user agent).
 * Android and other platforms use the standard rendition.on() approach.
 *
 * References:
 * - https://github.com/gseguin/ios-iframe-touchevents-fix
 * - https://gist.github.com/datchley/6793842
 * - WebKit Bug 128924: Shifted document touch handling in iframes on iOS
 */

import { useCallback, useRef, memo } from 'react';

const TAP_MAX_DURATION = 350; // ms
const TAP_MAX_MOVEMENT = 20; // px

// Detect iOS device (iPhone, iPad, iPod)
const isIOS = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent;

  // Check for iOS devices
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);

  // Check for iPad on iOS 13+ (reports as Mac)
  const isIPadOS =
    navigator.platform === 'MacIntel' &&
    navigator.maxTouchPoints > 1;

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
  enabled?: boolean;
  headerHeight?: number; // Height of header to offset tap zones
}

/**
 * IOSTapZones renders transparent overlay divs for left/right navigation
 * ONLY on iOS devices. Does nothing on Android/Desktop.
 */
export const IOSTapZones = memo(function IOSTapZones({
  onPrevPage,
  onNextPage,
  enabled = true,
  headerHeight = 70,
}: IOSTapZonesProps) {
  // Only render on iOS
  if (!isIOS()) {
    return null;
  }

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Debug log for iOS detection
  if (import.meta.env.DEV) {
    console.log('[IOSTapZones] Rendering on iOS device', {
      isStandalone: isStandalone(),
      userAgent: navigator.userAgent.substring(0, 50),
    });
  }

  /**
   * Check if target is an interactive element that should receive the tap
   */
  const isInteractiveElement = useCallback((target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;

    // Don't intercept taps on buttons, links, etc.
    const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
    if (interactiveTags.includes(target.tagName)) return true;

    // Check for interactive parent
    if (target.closest('a, button, input, select, textarea')) return true;

    return false;
  }, []);

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

    // Check for interactive elements
    if (isInteractiveElement(e.target)) {
      if (import.meta.env.DEV) {
        console.log('[IOSTapZones] Interactive element - allowing through');
      }
      return;
    }

    if (import.meta.env.DEV) {
      console.log('[IOSTapZones] TAP detected -', action);
    }

    if (action === 'prev') {
      onPrevPage();
    } else {
      onNextPage();
    }
  }, [enabled, isInteractiveElement, onPrevPage, onNextPage]);

  /**
   * Handle click - fallback for devices where touch events don't work
   */
  const handleClick = useCallback((
    e: React.MouseEvent,
    action: 'prev' | 'next'
  ) => {
    if (!enabled) return;

    // Check for interactive elements
    if (isInteractiveElement(e.target)) {
      return;
    }

    if (import.meta.env.DEV) {
      console.log('[IOSTapZones] CLICK detected -', action);
    }

    if (action === 'prev') {
      onPrevPage();
    } else {
      onNextPage();
    }
  }, [enabled, isInteractiveElement, onPrevPage, onNextPage]);

  // Common styles for tap zones
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    top: `calc(${headerHeight}px + env(safe-area-inset-top))`,
    bottom: 'env(safe-area-inset-bottom)',
    zIndex: 5, // Above iframe but below UI elements
    // Transparent but catches events
    backgroundColor: 'transparent',
    // Ensure touch events are captured
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    // Prevent text selection on long press
    WebkitUserSelect: 'none',
    userSelect: 'none',
  };

  return (
    <>
      {/* Left tap zone - 25% width */}
      <div
        data-testid="ios-tap-zone-left"
        style={{
          ...baseStyle,
          left: 'env(safe-area-inset-left)',
          width: '25%',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={(e) => handleTouchEnd(e, 'prev')}
        onClick={(e) => handleClick(e, 'prev')}
        aria-label="Previous page"
        role="button"
        tabIndex={-1}
      />

      {/* Right tap zone - 25% width */}
      <div
        data-testid="ios-tap-zone-right"
        style={{
          ...baseStyle,
          right: 'env(safe-area-inset-right)',
          width: '25%',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={(e) => handleTouchEnd(e, 'next')}
        onClick={(e) => handleClick(e, 'next')}
        aria-label="Next page"
        role="button"
        tabIndex={-1}
      />

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
          iOS Tap Zones Active {isStandalone() ? '(PWA)' : '(Safari)'}
        </div>
      )}
    </>
  );
});

export default IOSTapZones;
