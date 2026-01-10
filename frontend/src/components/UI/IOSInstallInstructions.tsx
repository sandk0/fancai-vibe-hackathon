/**
 * IOSInstallInstructions Component
 *
 * Displays step-by-step instructions for installing the PWA on iOS Safari.
 * iOS does not support the standard beforeinstallprompt event, so users
 * must manually add the app to their home screen via the Share menu.
 *
 * Features:
 * - Only shows on iOS Safari when not in standalone mode
 * - Modal and inline display modes
 * - Remembers user dismissal for 7 days
 * - Animated entrance/exit
 * - Dark mode support
 *
 * @component
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Share, Plus, X } from 'lucide-react';
import { m, AnimatePresence, LazyMotion, domAnimation } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '@/lib/zIndex';
import { Button } from '@/components/UI/button';
import {
  isIOSSafari,
  isStandalone,
  shouldShowIOSInstallPrompt,
  dismissIOSInstallPrompt,
  getIOSInstallInstructions,
} from '@/utils/iosSupport';

// ============================================================================
// Types
// ============================================================================

export interface IOSInstallInstructionsProps {
  /**
   * Display mode: 'modal' shows as an overlay, 'inline' renders in place
   * @default 'modal'
   */
  mode?: 'modal' | 'inline';

  /**
   * Callback when the user dismisses the instructions
   */
  onDismiss?: () => void;

  /**
   * Only show the component on iOS Safari (not already installed)
   * @default true
   */
  showOnlyOnIOS?: boolean;

  /**
   * Additional CSS classes for the container
   */
  className?: string;

  /**
   * Force show the component (bypasses platform check, useful for testing)
   * @default false
   */
  forceShow?: boolean;
}

// ============================================================================
// Animation Variants
// ============================================================================

const modalBackdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalContentVariants = {
  hidden: { opacity: 0, y: 50, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 300,
    },
  },
  exit: {
    opacity: 0,
    y: 50,
    scale: 0.95,
    transition: { duration: 0.2 },
  },
};

const inlineVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: {
      opacity: { duration: 0.2 },
      height: { duration: 0.3 },
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: {
      opacity: { duration: 0.15 },
      height: { duration: 0.2 },
    },
  },
};

const stepVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.3,
    },
  }),
};

// ============================================================================
// Step Component
// ============================================================================

interface InstallStepProps {
  stepNumber: number;
  text: string;
  icon?: React.ReactNode;
}

function InstallStep({ stepNumber, text, icon }: InstallStepProps) {
  return (
    <m.div
      className="flex items-start gap-3 py-2"
      variants={stepVariants}
      custom={stepNumber - 1}
      initial="hidden"
      animate="visible"
    >
      {/* Step number circle */}
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          'bg-[var(--color-accent-100)] text-[var(--color-accent-700)]',
          'dark:bg-[var(--color-accent-900)] dark:text-[var(--color-accent-300)]',
          'text-sm font-semibold'
        )}
      >
        {stepNumber}
      </div>

      {/* Step content */}
      <div className="flex flex-1 items-center gap-2 pt-0.5">
        <span className="text-[var(--color-text-default)]">{text}</span>
        {icon && (
          <span className="inline-flex text-[var(--color-accent-600)] dark:text-[var(--color-accent-400)]">
            {icon}
          </span>
        )}
      </div>
    </m.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * IOSInstallInstructions - Shows users how to install the PWA on iOS
 *
 * @example
 * // Modal mode (default) - shows as overlay
 * <IOSInstallInstructions onDismiss={() => console.log('Dismissed')} />
 *
 * @example
 * // Inline mode - renders in place (e.g., in Settings page)
 * <IOSInstallInstructions mode="inline" showOnlyOnIOS={true} />
 *
 * @example
 * // Force show for testing
 * <IOSInstallInstructions forceShow={true} mode="inline" />
 */
export function IOSInstallInstructions({
  mode = 'modal',
  onDismiss,
  showOnlyOnIOS = true,
  className,
  forceShow = false,
}: IOSInstallInstructionsProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Check if we should show the component
  useEffect(() => {
    if (forceShow) {
      setShouldRender(true);
      setIsVisible(true);
      return;
    }

    if (showOnlyOnIOS) {
      // Check platform and dismissal state
      const shouldShow = shouldShowIOSInstallPrompt();
      setShouldRender(shouldShow);
      setIsVisible(shouldShow);
    } else {
      // Always render if not restricted to iOS
      setShouldRender(true);
      setIsVisible(true);
    }
  }, [forceShow, showOnlyOnIOS]);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    setIsVisible(false);

    // Save dismissal to localStorage
    dismissIOSInstallPrompt();

    // Notify parent after animation completes
    setTimeout(() => {
      onDismiss?.();
      setShouldRender(false);
    }, 300);
  }, [onDismiss]);

  // Handle escape key for modal mode
  useEffect(() => {
    if (mode !== 'modal' || !isVisible) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleDismiss();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mode, isVisible, handleDismiss]);

  // Lock body scroll for modal mode
  useEffect(() => {
    if (mode !== 'modal' || !isVisible) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mode, isVisible]);

  // Get installation steps
  const steps = getIOSInstallInstructions();

  // Get step icons
  const getStepIcon = (index: number): React.ReactNode => {
    switch (index) {
      case 0:
        return <Share className="h-5 w-5" aria-hidden="true" />;
      case 2:
        return <Plus className="h-5 w-5" aria-hidden="true" />;
      default:
        return null;
    }
  };

  // Don't render anything if not needed
  if (!shouldRender) {
    return null;
  }

  // Content shared between modal and inline modes
  const content = (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <h3
          className={cn(
            'text-lg font-semibold text-[var(--color-text-default)]',
            mode === 'inline' && 'text-base'
          )}
        >
          Install the App
        </h3>
        <p className="text-sm text-[var(--color-text-muted)]">
          Add this app to your home screen for the best experience
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-1">
        {steps.map((step, index) => (
          <InstallStep
            key={index}
            stepNumber={index + 1}
            text={step}
            icon={getStepIcon(index)}
          />
        ))}
      </div>

      {/* Benefits (only show in modal) */}
      {mode === 'modal' && (
        <div
          className={cn(
            'rounded-lg p-3',
            'bg-[var(--color-bg-subtle)]',
            'border border-[var(--color-border-default)]'
          )}
        >
          <p className="text-xs text-[var(--color-text-muted)]">
            Installing the app provides offline access, faster loading, and a full-screen
            experience.
          </p>
        </div>
      )}

      {/* Actions */}
      <div
        className={cn(
          'flex gap-2',
          mode === 'modal' ? 'flex-col sm:flex-row sm:justify-end' : 'flex-row justify-end'
        )}
      >
        <Button
          variant="secondary"
          size={mode === 'modal' ? 'md' : 'sm'}
          onClick={handleDismiss}
        >
          {mode === 'modal' ? 'Maybe Later' : 'Dismiss'}
        </Button>
      </div>
    </div>
  );

  // Inline mode
  if (mode === 'inline') {
    return (
      <LazyMotion features={domAnimation}>
        <AnimatePresence mode="wait">
          {isVisible && (
            <m.div
              className={cn(
                'overflow-hidden rounded-lg',
                'bg-card border border-[var(--color-border-default)]',
                'p-4',
                className
              )}
              variants={inlineVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {content}
            </m.div>
          )}
        </AnimatePresence>
      </LazyMotion>
    );
  }

  // Modal mode
  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence mode="wait">
        {isVisible && (
          <>
            {/* Backdrop */}
            <m.div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              style={{ zIndex: Z_INDEX.iosInstall - 1 }}
              variants={modalBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: 0.2 }}
              onClick={handleDismiss}
              onTouchEnd={handleDismiss}
              aria-hidden="true"
            />

            {/* Modal container */}
            <div
              className={cn(
                'fixed inset-0 flex items-end justify-center p-4',
                'sm:items-center'
              )}
              style={{ zIndex: Z_INDEX.iosInstall }}
              onClick={handleDismiss}
              onTouchEnd={handleDismiss}
            >
              {/* Modal content */}
              <m.div
                className={cn(
                  'relative w-full max-w-md',
                  'bg-popover text-popover-foreground',
                  'rounded-xl shadow-xl',
                  'p-6',
                  // Rounded corners at top only on mobile (drawer style)
                  'rounded-b-xl sm:rounded-xl',
                  className
                )}
                variants={modalContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="ios-install-title"
              >
                {/* Close button */}
                <button
                  type="button"
                  onClick={handleDismiss}
                  className={cn(
                    'absolute right-4 top-4',
                    'flex h-8 w-8 items-center justify-center rounded-md',
                    'text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]',
                    'hover:bg-[var(--color-bg-muted)] transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-500)]'
                  )}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>

                {content}
              </m.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook to check if the iOS install prompt should be shown
 *
 * @returns Object with shouldShow boolean and dismiss function
 *
 * @example
 * const { shouldShow, dismiss } = useIOSInstallPrompt();
 *
 * if (shouldShow) {
 *   return <IOSInstallInstructions onDismiss={dismiss} />;
 * }
 */
export function useIOSInstallPrompt() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    setShouldShow(shouldShowIOSInstallPrompt());
  }, []);

  const dismiss = useCallback(() => {
    dismissIOSInstallPrompt();
    setShouldShow(false);
  }, []);

  return { shouldShow, dismiss };
}

/**
 * Hook to check if the app is running as an installed PWA on iOS
 *
 * @returns true if running as installed PWA on iOS
 */
export function useIsIOSPWA() {
  const [isIOSPWA, setIsIOSPWA] = useState(false);

  useEffect(() => {
    setIsIOSPWA(isIOSSafari() && isStandalone());
  }, []);

  return isIOSPWA;
}

export default IOSInstallInstructions;
