# Анализ сервера и современные практики PWA для iOS/Android

**Дата:** 2026-01-10
**Сервер:** 77.246.106.109
**Домен:** fancai.ru
**Версии целевых ОС:** iOS 18, iOS 26, Android 15, Android 16

---

## ЧАСТЬ 1: АНАЛИЗ СЕРВЕРА

### Текущая архитектура на сервере

```
                    ┌─────────────────────┐
                    │   Let's Encrypt     │
                    │   SSL Certificate   │
                    │   (до 13.03.2026)   │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │   System Nginx      │
                    │   (порты 80, 443)   │
                    └─────────┬───────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    ┌─────▼─────┐       ┌─────▼─────┐       ┌─────▼─────┐
    │    /      │       │   /api    │       │  /_vite   │
    │   :5173   │       │   :8000   │       │   :5173   │
    └─────┬─────┘       └─────┬─────┘       └─────┬─────┘
          │                   │                   │
    ┌─────▼─────┐       ┌─────▼─────┐       ┌─────▼─────┐
    │   Vite    │       │  FastAPI  │       │    HMR    │
    │ Dev Server│       │  Backend  │       │ WebSocket │
    └───────────┘       └───────────┘       └───────────┘
```

### 🛑 КРИТИЧЕСКАЯ ПРОБЛЕМА: Vite Dev Server в Production

**Файл:** `/root/fancai-vibe-hackathon/frontend/Dockerfile`

```dockerfile
# ТЕКУЩИЙ (НЕПРАВИЛЬНЫЙ) - Development Dockerfile
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
```

**Проблемы:**
1. **Безопасность** - Dev server экспонирует исходный код, source maps, stack traces
2. **Производительность** - Нет оптимизации, minification, tree-shaking
3. **PWA не работает** - Service Worker не генерируется, precaching не работает
4. **HMR в production** - Hot Module Replacement работает на боевом сервере
5. **Ресурсы** - Dev server потребляет больше CPU/RAM

**Проверка на сервере:**
```bash
docker exec bookreader_frontend_lite ps aux
# PID   USER     TIME  COMMAND
#   1   root     0:00 npm run dev --host 0.0.0.0
#  18   root     5:43 node /app/node_modules/.bin/vite --host 0.0.0.0
```

**Вывод:** Frontend работает в режиме разработки!

---

### Текущие HTTP заголовки PWA файлов

**Service Worker (/sw.js):**
```http
HTTP/2 200
content-type: text/javascript          ✓ Правильно
cache-control: no-cache                ⚠️ Недостаточно строго
```

**Manifest (/manifest.json):**
```http
HTTP/2 200
content-type: application/json         ⚠️ Должен быть application/manifest+json
cache-control: no-cache                ✓ OK
```

---

### Nginx конфигурация на сервере

**Файл:** `/etc/nginx/sites-enabled/fancai.ru`

**Текущая конфигурация:**
```nginx
server {
    listen 443 ssl http2;
    server_name fancai.ru www.fancai.ru;

    # SSL - OK
    ssl_certificate /etc/letsencrypt/live/fancai.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fancai.ru/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # ⚠️ ОТСУТСТВУЕТ: HSTS header
    # ⚠️ ОТСУТСТВУЕТ: Service-Worker-Allowed header
    # ⚠️ ОТСУТСТВУЕТ: Proper Content-Type для manifest.json

    location / {
        proxy_pass http://127.0.0.1:5173;  # Vite dev server
        # ...
    }
}
```

**Проблемы nginx:**
1. Нет `Strict-Transport-Security` (HSTS) - PWA требует HTTPS
2. Нет специальной обработки для `sw.js`
3. Нет `Service-Worker-Allowed` header
4. Неправильный `Content-Type` для manifest.json

---

## ЧАСТЬ 2: СОВРЕМЕННЫЕ ПРАКТИКИ PWA (2025-2026)

### iOS 18 / Safari 18.0 Features

| Функция | Статус | Примечания |
|---------|--------|------------|
| Service Workers | ✅ Поддержка | С iOS 11.3 |
| Push Notifications | ✅ iOS 16.4+ | **Только в standalone mode!** |
| Background Sync | ❌ Не поддерживается | Использовать visibilitychange + online |
| Periodic Background Sync | ❌ Не поддерживается | - |
| IndexedDB | ✅ Поддержка | Лимит 50MB, 7-дневное удаление |
| Persistent Storage | ✅ iOS 17+ | Предотвращает 7-дневное удаление |
| View Transitions API | ✅ Safari 18 | Новое! Анимации между состояниями |
| Web Extensions in PWA | ✅ Safari 18 | Только macOS |
| Link Opening in PWA | ✅ Safari 18 | Ссылки, соответствующие scope |

**Источники:**
- [WebKit Features in Safari 18.0](https://webkit.org/blog/15865/webkit-features-in-safari-18-0/)
- [iOS PWA Compatibility](https://firt.dev/notes/pwa-ios/)

### iOS 18.1 Важные изменения

**Digital Markets Act (EU):**
- Сторонние браузеры могут добавлять PWA на Home Screen
- Могут использовать собственные движки (не только WebKit)
- Применяется только в ЕС

**Рекомендации для iOS:**
```typescript
// 1. Проверка standalone mode для push notifications
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                    || (navigator as any).standalone === true;

// 2. Запрос Persistent Storage для предотвращения 7-дневного удаления
if (navigator.storage?.persist) {
  const granted = await navigator.storage.persist();
  console.log('Persistent storage:', granted ? 'granted' : 'denied');
}

// 3. Workaround для Background Sync
function setupIOSBackgroundSync() {
  // Sync при возврате в приложение
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      processSyncQueue();
    }
  });

  // Sync при восстановлении соединения
  window.addEventListener('online', () => {
    processSyncQueue();
  });
}
```

### iOS 26 (предположительный выпуск: 2025-2026)

На момент января 2026 года iOS 26 не выпущена. Текущая версия - iOS 18.x.
Прогнозируемые улучшения основаны на трендах Apple:

- Возможное улучшение Background Sync
- Расширение лимита IndexedDB (возможно > 50MB)
- Лучшая интеграция с Home Screen
- Улучшенная поддержка Web Push

**Рекомендация:** Следить за [WebKit Blog](https://webkit.org/blog/) и WWDC 2026.

---

### Android 15/16 PWA Features

| Функция | Android 15 | Android 16 | Примечания |
|---------|------------|------------|------------|
| Service Workers | ✅ | ✅ | Полная поддержка |
| Push Notifications | ✅ | ✅ | Без ограничений |
| Background Sync | ✅ | ✅ | Полная поддержка |
| Periodic Background Sync | ✅ | ✅ | Chrome-only |
| WebAPK | ✅ | ✅ | Лучший install experience |
| beforeinstallprompt | ✅ | ✅ | Custom install UI |
| App Shortcuts | ✅ | ✅ | Long-press menu |
| Share Target | ✅ | ✅ | Получение shared content |
| File Handling | ✅ | ✅ | Открытие файлов |
| TWA (Play Store) | ✅ | ✅ | Публикация в магазине |

**Источники:**
- [web.dev PWA Installation](https://web.dev/learn/pwa/installation)
- [Android TWA Guide](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities-version2)

### Рекомендации для Android 15/16

```json
// manifest.json - оптимальная конфигурация
{
  "name": "fancai - AI Читалка",
  "short_name": "fancai",
  "description": "Чтение книг с ИИ-иллюстрациями",
  "start_url": "/?source=pwa",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#0ea5e9",
  "background_color": "#ffffff",
  "id": "/",

  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-192-maskable.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],

  "shortcuts": [
    {
      "name": "Моя библиотека",
      "url": "/library",
      "icons": [{ "src": "/icon-shortcut-library.png", "sizes": "192x192" }]
    },
    {
      "name": "Загрузить книгу",
      "url": "/library?action=upload",
      "icons": [{ "src": "/icon-shortcut-upload.png", "sizes": "192x192" }]
    }
  ],

  "screenshots": [
    { "src": "/screenshots/library.png", "sizes": "1280x720", "type": "image/png", "form_factor": "wide" },
    { "src": "/screenshots/reader.png", "sizes": "375x812", "type": "image/png", "form_factor": "narrow" }
  ],

  "share_target": {
    "action": "/upload",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "files": [{ "name": "book", "accept": ["application/epub+zip", ".epub", ".fb2"] }]
    }
  },

  "file_handlers": [
    { "action": "/upload", "accept": { "application/epub+zip": [".epub"], "application/x-fictionbook+xml": [".fb2"] } }
  ],

  "launch_handler": { "client_mode": "focus-existing" }
}
```

---

## ЧАСТЬ 3: РЕКОМЕНДУЕМЫЕ НАСТРОЙКИ NGINX

### Оптимальная конфигурация для PWA

```nginx
server {
    listen 443 ssl http2;
    server_name fancai.ru www.fancai.ru;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/fancai.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fancai.ru/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Security Headers (PWA требует HTTPS)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml application/manifest+json image/svg+xml;
    gzip_min_length 1000;

    root /var/www/fancai/dist;
    index index.html;

    # =============================================
    # PWA CRITICAL FILES - NO CACHING
    # =============================================

    # Service Worker - NEVER cache
    location = /sw.js {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" always;
        add_header Service-Worker-Allowed "/" always;
        add_header X-Content-Type-Options "nosniff" always;
        expires off;
        etag off;
        try_files $uri =404;
    }

    # Web App Manifest
    location = /manifest.json {
        add_header Cache-Control "no-cache, must-revalidate" always;
        add_header Content-Type "application/manifest+json" always;
        try_files $uri =404;
    }

    # =============================================
    # STATIC ASSETS - AGGRESSIVE CACHING
    # =============================================

    # Versioned assets (with hash in filename)
    location ~* \.(?:js|css)$ {
        expires 1y;
        add_header Cache-Control "public, immutable" always;
        try_files $uri =404;
    }

    # Images
    location ~* \.(?:png|jpg|jpeg|gif|ico|svg|webp)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform" always;
        try_files $uri =404;
    }

    # Fonts
    location ~* \.(?:woff|woff2|ttf|otf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable" always;
        add_header Access-Control-Allow-Origin "*" always;
        try_files $uri =404;
    }

    # =============================================
    # API PROXY
    # =============================================

    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        client_max_body_size 100M;
    }

    # =============================================
    # SPA FALLBACK
    # =============================================

    location / {
        # HTML - короткий кеш для обновлений
        location ~* \.html$ {
            add_header Cache-Control "no-cache, must-revalidate" always;
        }

        try_files $uri $uri/ /index.html;
    }
}
```

**Источники:**
- [Service Worker should not be cached](https://github.com/h5bp/server-configs-nginx/issues/158)
- [Guide to Service Worker Pitfalls](https://www.thecodeship.com/web-development/guide-service-worker-pitfalls-best-practices/)

---

## ЧАСТЬ 4: WORKBOX BEST PRACTICES 2025-2026

### Рекомендуемые стратегии кеширования

```typescript
// sw.ts - оптимальная конфигурация Workbox

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// Precaching (static assets)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// 1. API Requests - Network First (свежие данные приоритет)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/v1/') && !url.pathname.includes('/auth/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 3600 }),
    ],
  })
);

// 2. Images - Cache First (редко меняются)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true, // Важно для iOS!
      }),
    ],
  })
);

// 3. Fonts - Cache First (immutable)
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  })
);

// 4. Static Assets - Stale While Revalidate
registerRoute(
  ({ request }) =>
    request.destination === 'script' ||
    request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: 'static-assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// 5. Background Sync для критических операций
const bgSyncPlugin = new BackgroundSyncPlugin('offline-queue', {
  maxRetentionTime: 24 * 60, // 24 hours
});

registerRoute(
  ({ url }) => url.pathname.match(/\/api\/v1\/books\/[^/]+\/progress$/),
  new NetworkFirst({
    plugins: [bgSyncPlugin],
  }),
  'POST'
);
```

**Источники:**
- [Workbox Documentation](https://web.dev/learn/pwa/workbox)
- [PWA Caching Strategies](https://blog.pixelfreestudio.com/best-practices-for-pwa-offline-caching-strategies/)

---

## ЧАСТЬ 5: МАТРИЦА СОВМЕСТИМОСТИ

### Полная матрица PWA функций

| Функция | iOS 18 | iOS 17 | Android 16 | Android 15 | Chrome Desktop |
|---------|--------|--------|------------|------------|----------------|
| **Install** |
| beforeinstallprompt | ❌ | ❌ | ✅ | ✅ | ✅ |
| Add to Home Screen | ✅ manual | ✅ manual | ✅ | ✅ | ✅ |
| WebAPK | ❌ | ❌ | ✅ | ✅ | N/A |
| **Offline** |
| Service Workers | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cache Storage | ✅ 50MB | ✅ 50MB | ✅ | ✅ | ✅ |
| IndexedDB | ✅ 7-day* | ✅ 7-day* | ✅ | ✅ | ✅ |
| Background Sync | ❌ | ❌ | ✅ | ✅ | ✅ |
| Periodic Sync | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Engagement** |
| Push Notifications | ✅ standalone | ✅ standalone | ✅ | ✅ | ✅ |
| Badging API | ✅ | ✅ | ✅ | ✅ | ✅ |
| Share Target | ❌ | ❌ | ✅ | ✅ | ✅ |
| File Handling | ❌ | ❌ | ✅ | ✅ | ✅ |
| **UI** |
| View Transitions | ✅ Safari 18 | ❌ | ✅ | ✅ | ✅ |
| Window Controls Overlay | ❌ | ❌ | ✅ | ✅ | ✅ |
| App Shortcuts | ❌ | ❌ | ✅ | ✅ | ✅ |

*7-day eviction предотвращается через Persistent Storage API

---

## ЧАСТЬ 6: РЕЗЮМЕ И ПРИОРИТЕТЫ

### Критические проблемы сервера

| # | Проблема | Влияние | Приоритет |
|---|----------|---------|-----------|
| 1 | **Vite dev server в production** | PWA не работает, безопасность | P0 |
| 2 | Нет HSTS header | SEO, безопасность | P1 |
| 3 | Неправильный Content-Type для manifest | PWA install | P1 |
| 4 | Нет Service-Worker-Allowed header | Консоль warnings | P2 |

### Рекомендуемые улучшения для iOS 18

1. **Persistent Storage** - запрашивать для предотвращения 7-дневного удаления
2. **iOS Sync Workaround** - visibilitychange + online events
3. **iOS Install Instructions** - показывать кастомные инструкции
4. **View Transitions** - использовать для плавных анимаций (Safari 18)

### Рекомендуемые улучшения для Android 15/16

1. **Custom Install Prompt** - использовать beforeinstallprompt
2. **App Shortcuts** - добавить в manifest.json
3. **Screenshots** - для улучшенного install dialog
4. **Share Target** - для получения файлов через Share
5. **File Handlers** - для открытия .epub/.fb2 файлов

---

## Следующие шаги

1. ✅ Анализ сервера завершён
2. ⏳ Создать production Dockerfile для frontend
3. ⏳ Обновить nginx конфигурацию на сервере
4. ⏳ Обновить docker-compose.lite.yml для production
5. ⏳ Добавить iOS-специфичные workarounds в код
