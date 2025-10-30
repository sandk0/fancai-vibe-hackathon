// Service Worker Registration and Management
import { useUIStore } from '@/stores/ui';

// Reserved for future localhost-specific logic (currently unused)
// const _isLocalhost = Boolean(
//   window.location.hostname === 'localhost' ||
//   window.location.hostname === '[::1]' ||
//   window.location.hostname.match(
//     /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
//   )
// );

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    const { notify } = useUIStore.getState();

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('SW registered:', registration);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New content available
                notify.info(
                  'App Update Available',
                  'New content is available. Refresh to update.'
                );
              } else {
                // Content cached for offline use
                notify.success(
                  'App Ready',
                  'BookReader AI is now available offline!'
                );
              }
            }
          });
        }
      });

      // Handle service worker messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        handleServiceWorkerMessage(event.data);
      });

      return registration;
    } catch (error) {
      console.error('SW registration failed:', error);
      return null;
    }
  }

  return null;
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

function handleServiceWorkerMessage(data: any): void {
  const { notify } = useUIStore.getState();

  switch (data.type) {
    case 'CACHE_UPDATED':
      console.log('Cache updated:', data.cacheName);
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
      
    default:
      console.log('Unknown SW message:', data);
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
        'BookReader AI has been installed successfully!'
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

// Push notification subscription
export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    const vapidKey = urlBase64ToUint8Array(process.env.REACT_APP_VAPID_PUBLIC_KEY || '');
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

// Network status monitoring
export class NetworkMonitor {
  private online = navigator.onLine;
  private callbacks: Array<(online: boolean) => void> = [];

  constructor() {
    window.addEventListener('online', () => this.updateStatus(true));
    window.addEventListener('offline', () => this.updateStatus(false));
  }

  private updateStatus(online: boolean): void {
    if (this.online !== online) {
      this.online = online;
      this.callbacks.forEach(callback => callback(online));
      
      // Notify service worker
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: online ? 'BACK_ONLINE' : 'WENT_OFFLINE',
        });
      }
    }
  }

  public isOnline(): boolean {
    return this.online;
  }

  public onStatusChange(callback: (online: boolean) => void): void {
    this.callbacks.push(callback);
  }

  public removeStatusListener(callback: (online: boolean) => void): void {
    const index = this.callbacks.indexOf(callback);
    if (index > -1) {
      this.callbacks.splice(index, 1);
    }
  }
}

// Singleton instances
export const pwaInstallPrompt = new PWAInstallPrompt();
export const networkMonitor = new NetworkMonitor();