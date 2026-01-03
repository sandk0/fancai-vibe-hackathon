/**
 * OfflineBanner - Network status indicator component
 *
 * Displays a banner when the user goes offline or when sync operations are pending.
 * Automatically hides when online with no pending operations.
 *
 * Features:
 * - Real-time network status tracking
 * - Pending sync operations count
 * - Smooth transitions between states
 * - Auto-hide after successful sync
 */

import { useState, useEffect } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { syncQueue, subscribeSyncQueue } from '@/services/syncQueue';

interface OfflineBannerProps {
  /** Auto-hide banner after sync complete (ms). Set to 0 to disable. */
  autoHideDelay?: number;
  /** Additional CSS classes */
  className?: string;
}

export function OfflineBanner({
  autoHideDelay = 3000,
  className = '',
}: OfflineBannerProps) {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(() => syncQueue.getQueueLength());
  const [isVisible, setIsVisible] = useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);

  // Subscribe to queue changes
  useEffect(() => {
    const updateCount = () => {
      setPendingCount(syncQueue.getQueueLength());
    };

    const unsubscribe = subscribeSyncQueue(updateCount);
    return unsubscribe;
  }, []);

  // Manage visibility state
  useEffect(() => {
    if (!isOnline) {
      // Always show when offline
      setIsVisible(true);
      setShowSyncSuccess(false);
    } else if (wasOffline && pendingCount > 0) {
      // Show while syncing after being offline
      setIsVisible(true);
      setShowSyncSuccess(false);
    } else if (wasOffline && pendingCount === 0) {
      // Show success message briefly, then hide
      setShowSyncSuccess(true);
      setIsVisible(true);

      if (autoHideDelay > 0) {
        const timer = setTimeout(() => {
          setIsVisible(false);
        }, autoHideDelay);
        return () => clearTimeout(timer);
      }
    } else {
      // Online and never was offline - hide
      setIsVisible(false);
    }
  }, [isOnline, wasOffline, pendingCount, autoHideDelay]);

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  // Determine banner state and content
  let bgColor: string;
  let content: React.ReactNode;

  if (!isOnline) {
    // Offline state
    bgColor = 'bg-yellow-600';
    content = (
      <>
        <span className="mr-2" role="img" aria-label="offline">
          &#128225;
        </span>
        <span>
          Вы offline. Изменения сохранятся при восстановлении связи.
          {pendingCount > 0 && (
            <span className="ml-2 opacity-80">
              ({pendingCount} {getPluralForm(pendingCount, 'изменение', 'изменения', 'изменений')} в очереди)
            </span>
          )}
        </span>
      </>
    );
  } else if (pendingCount > 0) {
    // Syncing state
    bgColor = 'bg-blue-600';
    content = (
      <>
        <span className="mr-2 inline-block animate-spin" role="img" aria-label="syncing">
          &#8635;
        </span>
        <span>
          Соединение восстановлено. Синхронизация {pendingCount}{' '}
          {getPluralForm(pendingCount, 'изменения', 'изменений', 'изменений')}...
        </span>
      </>
    );
  } else if (showSyncSuccess) {
    // Success state
    bgColor = 'bg-green-600';
    content = (
      <>
        <span className="mr-2" role="img" aria-label="success">
          &#10003;
        </span>
        <span>Соединение восстановлено. Все изменения синхронизированы.</span>
      </>
    );
  } else {
    // Fallback (shouldn't normally reach here)
    return null;
  }

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-[800]
        px-4 py-2
        text-center text-sm text-white
        transition-all duration-300 ease-in-out
        ${bgColor}
        ${className}
      `}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-center">
        {content}
      </div>
    </div>
  );
}

/**
 * Helper for Russian plural forms
 */
function getPluralForm(
  count: number,
  one: string,
  few: string,
  many: string
): string {
  const absCount = Math.abs(count);
  const lastTwo = absCount % 100;
  const lastOne = absCount % 10;

  if (lastTwo >= 11 && lastTwo <= 19) {
    return many;
  }

  if (lastOne === 1) {
    return one;
  }

  if (lastOne >= 2 && lastOne <= 4) {
    return few;
  }

  return many;
}

export default OfflineBanner;
