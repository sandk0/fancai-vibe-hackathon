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
 * Also includes IOSPushGuidance component which explains why iOS users
 * need to install the PWA to receive push notifications.
 *
 * @component
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Share, Plus, X, Bell, Smartphone, Zap, ArrowRight } from 'lucide-react';
import { m, AnimatePresence, LazyMotion, domAnimation } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '@/lib/zIndex';
import { Button } from '@/components/UI/button';
import {
  isIOSSafari,
  isStandalone,
  isIOS,
  shouldShowIOSInstallPrompt,
  dismissIOSInstallPrompt,
  getIOSInstallInstructions,
  IOS_MIN_PUSH_VERSION,
  getIOSVersion,
} from '@/utils/iosSupport';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/UI/Card';

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

// ============================================================================
// IOSPushGuidance Component
// ============================================================================

export interface IOSPushGuidanceProps {
  /**
   * Callback when user clicks the install button/link
   */
  onInstallClick?: () => void;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Whether to show an expanded version with more details
   * @default false
   */
  expanded?: boolean;
}

/**
 * IOSPushGuidance - Explains to iOS Safari users why they need to install the PWA
 * to receive push notifications.
 *
 * This component shows:
 * - Why push notifications are unavailable in Safari
 * - Benefits of installing the app (push notifications, fullscreen, quick access)
 * - Call-to-action to view installation instructions
 *
 * Only renders on iOS Safari when not in standalone mode.
 *
 * @example
 * // In settings/notifications section
 * <IOSPushGuidance onInstallClick={() => setShowInstallInstructions(true)} />
 *
 * @example
 * // Expanded version with more details
 * <IOSPushGuidance expanded onInstallClick={handleInstall} />
 */
export function IOSPushGuidance({
  onInstallClick,
  className,
  expanded = false,
}: IOSPushGuidanceProps) {
  const [shouldShow, setShouldShow] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [iosVersionInfo, setIosVersionInfo] = useState<{
    version: number | null;
    supportsWebPush: boolean;
  }>({ version: null, supportsWebPush: false });

  useEffect(() => {
    // Only show on iOS Safari when NOT in standalone mode
    const isiOSSafari = isIOSSafari();
    const inStandalone = isStandalone();
    const version = getIOSVersion();
    const supportsWebPush = version !== null && version >= IOS_MIN_PUSH_VERSION;

    setShouldShow(isiOSSafari && !inStandalone);
    setIosVersionInfo({ version, supportsWebPush });
  }, []);

  const handleInstallClick = useCallback(() => {
    if (onInstallClick) {
      onInstallClick();
    } else {
      setShowInstructions(true);
    }
  }, [onInstallClick]);

  // Don't render if not iOS Safari or already in standalone
  if (!shouldShow) {
    return null;
  }

  // Benefits of installing the PWA
  const benefits = [
    {
      icon: Bell,
      title: 'Push-уведомления',
      description: 'Узнавайте о готовности книг и новых изображениях',
    },
    {
      icon: Smartphone,
      title: 'Полноэкранный режим',
      description: 'Читайте без элементов браузера',
    },
    {
      icon: Zap,
      title: 'Быстрый доступ',
      description: 'Запускайте с главного экрана одним нажатием',
    },
  ];

  // Compact version - just a notice with link
  if (!expanded) {
    return (
      <LazyMotion features={domAnimation}>
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={className}
        >
          <Card variant="outlined" padding="md" className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Push-уведомления недоступны в Safari
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {iosVersionInfo.supportsWebPush
                    ? 'Установите приложение на главный экран, чтобы получать уведомления.'
                    : `Требуется iOS ${IOS_MIN_PUSH_VERSION}+ и установка приложения на главный экран.`}
                </p>
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className={cn(
                    'mt-2 inline-flex items-center gap-1 text-sm font-medium',
                    'text-amber-700 dark:text-amber-400',
                    'hover:text-amber-800 dark:hover:text-amber-300',
                    'focus:outline-none focus:underline',
                    'transition-colors'
                  )}
                >
                  Как установить
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </Card>

          {/* Inline install instructions modal */}
          {showInstructions && (
            <IOSInstallInstructions
              mode="modal"
              onDismiss={() => setShowInstructions(false)}
              forceShow
            />
          )}
        </m.div>
      </LazyMotion>
    );
  }

  // Expanded version with benefits list
  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={className}
      >
        <Card variant="default" padding="lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 p-2.5 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50">
                <Smartphone className="h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Установите приложение для Push-уведомлений
                </CardTitle>
                <CardDescription className="mt-0.5">
                  iOS Safari не поддерживает Push в браузере
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {/* iOS version warning if needed */}
            {!iosVersionInfo.supportsWebPush && iosVersionInfo.version !== null && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <p className="text-xs text-red-700 dark:text-red-400">
                  Ваша версия iOS ({iosVersionInfo.version}) не поддерживает Web Push.
                  Обновите устройство до iOS {IOS_MIN_PUSH_VERSION} или новее.
                </p>
              </div>
            )}

            {/* Benefits list */}
            <div className="space-y-4">
              <p className="text-sm font-medium text-foreground">
                Преимущества установленного приложения:
              </p>

              <div className="space-y-3">
                {benefits.map((benefit, index) => {
                  const IconComponent = benefit.icon;
                  return (
                    <m.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.2 }}
                      className="flex items-start gap-3"
                    >
                      <div className="flex-shrink-0 p-1.5 rounded-lg bg-[var(--color-bg-subtle)]">
                        <IconComponent
                          className="h-4 w-4 text-[var(--color-accent-600)] dark:text-[var(--color-accent-400)]"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {benefit.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {benefit.description}
                        </p>
                      </div>
                    </m.div>
                  );
                })}
              </div>
            </div>

            {/* Install CTA */}
            <div className="mt-6 pt-4 border-t border-border">
              <Button
                variant="primary"
                size="md"
                onClick={handleInstallClick}
                className="w-full sm:w-auto"
              >
                <Smartphone className="h-4 w-4 mr-2" aria-hidden="true" />
                Установить приложение
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Inline install instructions modal */}
        {showInstructions && (
          <IOSInstallInstructions
            mode="modal"
            onDismiss={() => setShowInstructions(false)}
            forceShow
          />
        )}
      </m.div>
    </LazyMotion>
  );
}

// ============================================================================
// Hook for checking iOS Push readiness
// ============================================================================

/**
 * Hook to check if the current device needs guidance for iOS push notifications
 *
 * @returns Object with:
 *  - needsGuidance: true if iOS Safari user is not in standalone mode
 *  - isIOSSafari: true if running Safari on iOS
 *  - isStandalone: true if running as installed PWA
 *  - canReceivePush: true if all requirements for iOS push are met
 *  - iosVersion: iOS version number or null
 *
 * @example
 * const { needsGuidance, canReceivePush } = useIOSPushReadiness();
 *
 * if (needsGuidance) {
 *   return <IOSPushGuidance />;
 * }
 *
 * if (canReceivePush) {
 *   // Show push notification toggle
 * }
 */
export function useIOSPushReadiness() {
  const [state, setState] = useState({
    needsGuidance: false,
    isIOSSafariDevice: false,
    isStandaloneMode: false,
    canReceivePush: false,
    iosVersion: null as number | null,
  });

  useEffect(() => {
    const isiOSSafari = isIOSSafari();
    const inStandalone = isStandalone();
    const version = getIOSVersion();
    const supportsWebPush = version !== null && version >= IOS_MIN_PUSH_VERSION;

    setState({
      needsGuidance: isiOSSafari && !inStandalone,
      isIOSSafariDevice: isiOSSafari,
      isStandaloneMode: inStandalone,
      canReceivePush: isIOS() ? (supportsWebPush && inStandalone) : true,
      iosVersion: version,
    });
  }, []);

  return state;
}

export default IOSInstallInstructions;
