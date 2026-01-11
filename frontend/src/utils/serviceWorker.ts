// Service Worker Utilities
// NOTE: Service Worker registration is handled by VitePWA in main.tsx
// This file provides utility functions for SW interaction
import { useUIStore } from '@/stores/ui';

/**
 * @deprecated Use VitePWA registerSW in main.tsx instead
 * This function is kept for backward compatibility but does nothing
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  console.warn('[SW] registerServiceWorker is deprecated. SW is registered by VitePWA in main.tsx');

  // Set up message listener for custom SW events
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      handleServiceWorkerMessage(event.data);
    });
  }

  return navigator.serviceWorker?.ready || null;
}

export async function unregisterServiceWorker(): Promise<boolean> {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      for (const registration of registrations) {
        await registration.unregister();
      }
      
      console.log('SW unregistered');
      return true;
    } catch (error) {
      console.error('SW unregistration failed:', error);
      return false;
    }
  }
  
  return false;
}

export function checkServiceWorkerUpdate(): void {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CHECK_UPDATE' });
  }
}

export function skipWaiting(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(registration => {
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  }
}

function handleServiceWorkerMessage(data: unknown): void {
  const { notify } = useUIStore.getState();
  const messageData = data as Record<string, unknown>;

  switch (messageData.type) {
    case 'CACHE_UPDATED':
      console.log('[SW] Cache updated:', messageData.cacheName as string);
      break;

    case 'OFFLINE_FALLBACK':
      notify.warning(
        'Offline Mode',
        'You are currently offline. Some features may not be available.'
      );
      break;

    case 'BACK_ONLINE':
      notify.success(
        'Back Online',
        'Your connection has been restored!'
      );
      break;

    case 'SYNC_COMPLETE':
      notify.success(
        'Data Synced',
        'Your offline changes have been synced successfully.'
      );
      break;

    case 'SYNC_REQUESTED':
      // Background sync triggered - notify syncQueue to process
      console.log('[SW] Sync requested:', messageData.tag);
      window.dispatchEvent(new CustomEvent('sw-sync-requested', {
        detail: { tag: messageData.tag }
      }));
      break;

    default:
      console.log('[SW] Unknown message:', messageData);
  }
}

// PWA Install Prompt Management
export class PWAInstallPrompt {
  private deferredPrompt: any = null;
  private installed = false;

  constructor() {
    this.setupInstallPromptHandler();
    this.checkIfInstalled();
  }

  private setupInstallPromptHandler(): void {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredPrompt = event;
      console.log('PWA install prompt available');
    });

    window.addEventListener('appinstalled', () => {
      this.installed = true;
      this.deferredPrompt = null;
      console.log('PWA installed');
      
      const { notify } = useUIStore.getState();
      notify.success(
        'App Installed',
        'fancai has been installed successfully!'
      );
    });
  }

  private checkIfInstalled(): void {
    // Check if running in standalone mode (installed PWA)
    this.installed = window.matchMedia('(display-mode: standalone)').matches ||
                    (window.navigator as any).standalone === true;
  }

  public isInstallable(): boolean {
    return !!this.deferredPrompt && !this.installed;
  }

  public isInstalled(): boolean {
    return this.installed;
  }

  public async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    try {
      const result = await this.deferredPrompt.prompt();
      const userChoice = await result.userChoice;
      
      if (userChoice === 'accepted') {
        console.log('User accepted PWA install');
        return true;
      } else {
        console.log('User dismissed PWA install');
        return false;
      }
    } catch (error) {
      console.error('PWA install prompt failed:', error);
      return false;
    } finally {
      this.deferredPrompt = null;
    }
  }
}

// Background Sync for offline actions
export function requestBackgroundSync(tag: string): void {
  if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
    navigator.serviceWorker.ready.then((registration) => {
      return (registration as any).sync.register(tag);
    }).then(() => {
      console.log('Background sync registered:', tag);
    }).catch((error) => {
      console.error('Background sync failed:', error);
    });
  }
}

// =============================================================================
// PERIODIC BACKGROUND SYNC (Android PWA only)
// =============================================================================

/**
 * Register for Periodic Background Sync (Android Chrome 80+ only)
 *
 * This allows the PWA to periodically sync data even when closed.
 * Only works when:
 * - PWA is installed on home screen
 * - Browser is Chrome 80+ on Android
 * - User has sufficient engagement with the site
 *
 * Note: iOS Safari does NOT support this API.
 *
 * @param tag - Unique identifier for the sync registration
 * @param minInterval - Minimum interval in milliseconds (browser may increase this)
 * @returns Promise<boolean> - Whether registration was successful
 */
export async function registerPeriodicSync(
  tag: string = 'sync-reading-progress',
  minInterval: number = 24 * 60 * 60 * 1000 // 24 hours default
): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    console.log('[PeriodicSync] Service Worker not supported');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check if Periodic Background Sync is supported
    if (!('periodicSync' in registration)) {
      console.log('[PeriodicSync] Periodic Background Sync not supported (iOS/Firefox)');
      return false;
    }

    // Check permission status
    const status = await navigator.permissions.query({
      name: 'periodic-background-sync' as PermissionName,
    });

    if (status.state !== 'granted') {
      console.log('[PeriodicSync] Permission not granted:', status.state);
      return false;
    }

    // Register for periodic sync
    await (registration as any).periodicSync.register(tag, {
      minInterval,
    });

    console.log(`[PeriodicSync] Registered "${tag}" with minInterval ${minInterval}ms`);
    return true;
  } catch (error) {
    console.log('[PeriodicSync] Registration failed:', error);
    return false;
  }
}

/**
 * Unregister from Periodic Background Sync
 *
 * @param tag - Tag to unregister
 * @returns Promise<boolean> - Whether unregistration was successful
 */
export async function unregisterPeriodicSync(tag: string = 'sync-reading-progress'): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    if (!('periodicSync' in registration)) {
      return false;
    }

    await (registration as any).periodicSync.unregister(tag);
    console.log(`[PeriodicSync] Unregistered "${tag}"`);
    return true;
  } catch (error) {
    console.log('[PeriodicSync] Unregistration failed:', error);
    return false;
  }
}

/**
 * Check if Periodic Background Sync is supported and available
 *
 * @returns Promise<boolean>
 */
export async function isPeriodicSyncSupported(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return 'periodicSync' in registration;
  } catch {
    return false;
  }
}

/**
 * Get list of registered periodic sync tags
 *
 * @returns Promise<string[]> - Array of registered tags
 */
export async function getPeriodicSyncTags(): Promise<string[]> {
  if (!('serviceWorker' in navigator)) {
    return [];
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    if (!('periodicSync' in registration)) {
      return [];
    }

    const tags = await (registration as any).periodicSync.getTags();
    return tags;
  } catch {
    return [];
  }
}

// Push notification subscription
export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    const vapidKey = urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY || '');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey as unknown as ArrayBuffer,
    });

    console.log('Push subscription:', subscription);
    
    // Send subscription to server
    await fetch('/api/v1/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      },
      body: JSON.stringify(subscription),
    });

    return subscription;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}

// Singleton instance
export const pwaInstallPrompt = new PWAInstallPrompt();