/**
 * PWA Hooks - Barrel Export (January 2026)
 *
 * Централизованный экспорт всех PWA-related хуков.
 * Позволяет импортировать: import { usePushNotifications, usePWAInstall } from '@/hooks/pwa'
 *
 * @module hooks/pwa
 */

// Push Notifications
export {
  usePushNotifications,
  pushKeys,
  type UsePushNotificationsReturn,
  type PushPermissionState,
} from '../usePushNotifications';

// PWA Install Prompt
export { usePWAInstall } from '../usePWAInstall';

// Offline Books
export { useOfflineBook } from '../useOfflineBook';

// Download Manager
export { useDownloadBook } from '../useDownloadBook';

// Storage Management
export { useStorageInfo } from '../useStorageInfo';

// Online Status
export { useOnlineStatus } from '../useOnlineStatus';

// PWA Resume Guard
export {
  usePWAResumeGuard,
  type PWAResumeGuardReturn,
} from './usePWAResumeGuard';

// Re-export query keys for PWA
export { pwaKeys } from '../api/queryKeys';
