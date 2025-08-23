// BookReader AI - Service Worker
// Version 1.0.0

const CACHE_NAME = 'bookreader-ai-v1.0.0';
const STATIC_CACHE_NAME = 'bookreader-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'bookreader-dynamic-v1.0.0';

// Files to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  // Add critical CSS and JS files here when available
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/api\/v1\/books\/\w+$/,
  /\/api\/v1\/books\/\w+\/chapters\/\d+$/,
  /\/api\/v1\/images\/book\/\w+$/,
];

// Image cache patterns
const IMAGE_CACHE_PATTERNS = [
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
  /pollinations\.ai/,
  /generated-images/,
];

// Maximum cache sizes
const MAX_CACHE_SIZE = {
  static: 50,
  dynamic: 100,
  images: 200,
};

// Cache duration (in milliseconds)
const CACHE_DURATION = {
  static: 7 * 24 * 60 * 60 * 1000, // 7 days
  api: 60 * 60 * 1000, // 1 hour
  images: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  
  event.waitUntil(
    (async () => {
      try {
        const staticCache = await caches.open(STATIC_CACHE_NAME);
        await staticCache.addAll(STATIC_ASSETS);
        console.log('[SW] Static assets cached');
        
        // Skip waiting to activate immediately
        self.skipWaiting();
      } catch (error) {
        console.error('[SW] Failed to cache static assets:', error);
      }
    })()
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const deletePromises = cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE_NAME && 
              cacheName !== DYNAMIC_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        });
        
        await Promise.all(deletePromises);
        
        // Take control of all clients
        self.clients.claim();
        console.log('[SW] Activated and claimed clients');
      } catch (error) {
        console.error('[SW] Activation failed:', error);
      }
    })()
  );
});

// Fetch event - handle requests with caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle different types of requests
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isAPIRequest(request)) {
    event.respondWith(handleAPIRequest(request));
  } else if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request));
  } else if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request));
  } else {
    event.respondWith(handleGenericRequest(request));
  }
});

// Check if request is for static asset
function isStaticAsset(request) {
  const url = new URL(request.url);
  return STATIC_ASSETS.some(asset => url.pathname.endsWith(asset)) ||
         url.pathname.match(/\.(js|css|ico|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/);
}

// Check if request is for API
function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/') ||
         API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname));
}

// Check if request is for images
function isImageRequest(request) {
  const url = new URL(request.url);
  return IMAGE_CACHE_PATTERNS.some(pattern => pattern.test(url.href));
}

// Check if request is navigation
function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

// Handle static assets - Cache First strategy
async function handleStaticAsset(request) {
  try {
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Static asset request failed:', error);
    
    // Return offline page for HTML requests
    if (request.headers.get('accept').includes('text/html')) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      return cache.match('/index.html');
    }
    
    return new Response('Asset not available offline', { status: 503 });
  }
}

// Handle API requests - Network First with cache fallback
async function handleAPIRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      const responseClone = networkResponse.clone();
      
      // Add cache headers
      const headers = new Headers(responseClone.headers);
      headers.set('sw-cached-at', new Date().toISOString());
      
      const cachedResponse = new Response(responseClone.body, {
        status: responseClone.status,
        statusText: responseClone.statusText,
        headers: headers,
      });
      
      cache.put(request, cachedResponse);
      
      // Cleanup old cache entries
      cleanupCache(DYNAMIC_CACHE_NAME, MAX_CACHE_SIZE.dynamic);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache for API request');
    
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // Check if cache is still fresh
      const cachedAt = cachedResponse.headers.get('sw-cached-at');
      if (cachedAt) {
        const cacheAge = Date.now() - new Date(cachedAt).getTime();
        if (cacheAge > CACHE_DURATION.api) {
          console.log('[SW] Cached API response is stale');
        }
      }
      
      return cachedResponse;
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'No network connection and no cached data available',
        offline: true 
      }), 
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle images - Cache First with long-term storage
async function handleImageRequest(request) {
  try {
    const cache = await caches.open('bookreader-images-v1.0.0');
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      
      // Cleanup old image cache entries
      cleanupCache('bookreader-images-v1.0.0', MAX_CACHE_SIZE.images);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Image request failed:', error);
    
    // Return placeholder image
    return new Response(
      '<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="#9ca3af" text-anchor="middle" dy=".3em">Image not available offline</text></svg>',
      {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' }
      }
    );
  }
}

// Handle navigation requests - Cache First for offline support
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Navigation failed, serving cached index.html');
    
    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedResponse = await cache.match('/index.html');
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('App not available offline', { 
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Handle generic requests
async function handleGenericRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Resource not available offline', { status: 503 });
  }
}

// Clean up cache to maintain size limits
async function cleanupCache(cacheName, maxSize) {
  try {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    if (requests.length > maxSize) {
      const deleteCount = requests.length - maxSize;
      const deletePromises = requests.slice(0, deleteCount).map(request => 
        cache.delete(request)
      );
      
      await Promise.all(deletePromises);
      console.log(`[SW] Cleaned up ${deleteCount} entries from ${cacheName}`);
    }
  } catch (error) {
    console.error('[SW] Cache cleanup failed:', error);
  }
}

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'reading-progress-sync') {
    event.waitUntil(syncReadingProgress());
  } else if (event.tag === 'book-upload-sync') {
    event.waitUntil(syncBookUploads());
  }
});

// Sync reading progress when back online
async function syncReadingProgress() {
  try {
    // Get stored progress data from IndexedDB
    const progressData = await getStoredProgressData();
    
    if (progressData.length > 0) {
      for (const progress of progressData) {
        try {
          await fetch('/api/v1/books/' + progress.bookId + '/progress', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + progress.token,
            },
            body: JSON.stringify({
              chapter_number: progress.chapter,
              progress_percentage: progress.progress,
            }),
          });
          
          // Remove synced data
          await removeStoredProgressData(progress.id);
        } catch (error) {
          console.error('[SW] Failed to sync progress:', error);
        }
      }
    }
  } catch (error) {
    console.error('[SW] Reading progress sync failed:', error);
  }
}

// Placeholder for stored progress data (would use IndexedDB in real implementation)
async function getStoredProgressData() {
  // This would query IndexedDB for stored progress data
  return [];
}

async function removeStoredProgressData(id) {
  // This would remove synced data from IndexedDB
}

// Sync book uploads when back online
async function syncBookUploads() {
  console.log('[SW] Book upload sync not implemented yet');
}

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  const options = {
    body: 'Your book processing is complete!',
    icon: '/favicon-192.png',
    badge: '/favicon-72.png',
    data: {
      url: '/',
    },
    actions: [
      {
        action: 'view',
        title: 'View Book',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  };
  
  if (event.data) {
    const data = event.data.json();
    options.body = data.message || options.body;
    options.data = data;
  }
  
  event.waitUntil(
    self.registration.showNotification('BookReader AI', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});

// Log service worker registration
console.log('[SW] Service Worker registered successfully');