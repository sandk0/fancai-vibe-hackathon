# Отчёт по анализу PWA реализации fancai

**Дата:** 2026-01-10
**Проект:** fancai-vibe-hackathon
**Домен:** fancai.ru
**Сервер:** 77.246.106.109 (Docker Compose v2)

---

## Резюме

PWA реализация в целом **качественная и современная**, но содержит несколько **критических проблем**, которые необходимо исправить перед деплоем. Основные проблемы:

1. **Двойная регистрация Service Worker** - вызовет race conditions
2. **Отсутствие иконки 512x512** - нарушение PWA requirements
3. **Неправильные заголовки кеширования для SW** в production nginx
4. **Несоответствие домена** в метаданных (fancai.app vs fancai.ru)
5. **Отсутствующие скриншоты PWA**

---

## 1. КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1.1 Двойная регистрация Service Worker ⛔

**Файлы:**
- `frontend/src/main.tsx` (строки 6-36)
- `frontend/src/components/UI/PWAUpdatePrompt.tsx` (строки 58-83)

**Проблема:**
```typescript
// main.tsx - первая регистрация
const updateSW = registerSW({
  onNeedRefresh() { /* ... */ },
  onRegisteredSW(swUrl, registration) {
    setInterval(() => registration.update(), 60 * 60 * 1000) // 1 час
  },
})

// PWAUpdatePrompt.tsx - ВТОРАЯ регистрация
const { needRefresh, updateServiceWorker } = useRegisterSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    setInterval(() => registration.update(), 60 * 60 * 1000) // 1 час
  },
})
```

**Последствия:**
- Два независимых интервала проверки обновлений (2 запроса каждый час)
- Потенциальные race conditions при одновременном обнаружении обновления
- Увеличенная нагрузка на сеть и сервер
- Непредсказуемое поведение при обновлении

**Решение:**
Удалить регистрацию из `main.tsx` и оставить только в `PWAUpdatePrompt.tsx`, либо изменить `PWAUpdatePrompt` чтобы он использовал уже зарегистрированный SW через `window.__pwa_updateSW`.

---

### 1.2 Отсутствие иконки 512x512 ⛔

**Файлы:**
- `frontend/public/manifest.json` (строки 29-40)
- `frontend/public/icon-192.png` (существует)
- `frontend/public/icon-512.png` (**НЕ СУЩЕСТВУЕТ**)

**Проблема:**
```json
{
  "icons": [
    { "src": "/icon-512.png", "sizes": "512x512" }  // Файл не найден!
  ]
}
```

**Последствия:**
- Lighthouse PWA audit не пройдёт
- PWA не будет устанавливаться на некоторых устройствах
- Splash screen на iOS/Android будет некорректным

**Решение:**
Создать иконку 512x512 пикселей (`icon-512.png`) и поместить в `frontend/public/`.

---

### 1.3 Отсутствующие скриншоты PWA ⛔

**Файл:** `frontend/public/manifest.json` (строки 43-72)

**Проблема:**
```json
"screenshots": [
  { "src": "/screenshots/library-desktop.png" },  // Не существует!
  { "src": "/screenshots/reader-desktop.png" },   // Не существует!
  { "src": "/screenshots/library-mobile.png" },   // Не существует!
  { "src": "/screenshots/reader-mobile.png" }     // Не существует!
]
```

**Последствия:**
- 404 ошибки в консоли браузера
- Ухудшение Install Prompt на Android

**Решение:**
Создать скриншоты или удалить раздел `screenshots` из manifest.json.

---

### 1.4 Неправильные заголовки кеширования для Service Worker ⛔

**Файл:** `nginx/nginx.prod.conf.template`

**Проблема:**
Service Worker и manifest.json проксируются через общий `location /` без специальных заголовков:

```nginx
location / {
    proxy_pass http://frontend;
    # Нет специальной обработки для sw.js и manifest.json!
}
```

По стандарту W3C, Service Worker файл должен иметь `Cache-Control: no-cache, must-revalidate` или `max-age=0` для обеспечения своевременных обновлений.

**Последствия:**
- SW может кешироваться браузером на длительное время
- Пользователи не получат обновления приложения
- Дебаггинг будет затруднён

**Решение:**
Добавить в `nginx/nginx.prod.conf.template`:

```nginx
# Service Worker - без кеширования для быстрых обновлений
location = /sw.js {
    proxy_pass http://frontend;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Service-Worker-Allowed "/";
    expires 0;
}

# PWA Manifest
location = /manifest.json {
    proxy_pass http://frontend;
    add_header Cache-Control "no-cache, must-revalidate";
    add_header Content-Type "application/manifest+json";
}
```

---

## 2. ВАЖНЫЕ ПРОБЛЕМЫ

### 2.1 Несоответствие домена в метаданных ⚠️

**Файл:** `frontend/index.html` (строки 29, 36)

**Проблема:**
```html
<meta property="og:url" content="https://fancai.app/" />
<meta property="twitter:url" content="https://fancai.app/" />
```

Реальный домен: `fancai.ru`, но в метаданных указан `fancai.app`.

**Последствия:**
- Некорректное отображение при шеринге в соцсетях
- SEO проблемы

**Решение:**
Заменить `fancai.app` на `fancai.ru` в index.html.

---

### 2.2 Отсутствие og-image и twitter-image ⚠️

**Файл:** `frontend/index.html` (строки 32, 39)

```html
<meta property="og:image" content="/og-image.jpg" />
<meta property="twitter:image" content="/twitter-image.jpg" />
```

Эти файлы, вероятно, не существуют в `frontend/public/`.

---

### 2.3 VAPID Subject в Docker Compose ⚠️

**Файл:** `docker-compose.lite.yml` (строка 128)

```yaml
- VAPID_SUBJECT=${VAPID_SUBJECT:-mailto:admin@fancai.app}
```

По умолчанию указан `fancai.app`, а не `fancai.ru`. Это может вызвать проблемы с Web Push, хотя технически работать будет.

---

### 2.4 CSP не поддерживает Web Push полностью ⚠️

**Файл:** `nginx/nginx.prod.conf.template` (строка 134)

```nginx
add_header Content-Security-Policy "... connect-src 'self' https: wss: ...";
```

Web Push требует подключения к push-серверам браузеров. Текущий CSP (`https:`) это покрывает, но стоит явно добавить домены push-сервисов для безопасности.

---

## 3. РЕКОМЕНДАЦИИ ПО УЛУЧШЕНИЮ

### 3.1 Отсутствие обработчика NOTIFICATION_CLICKED в React

**Файл:** `frontend/src/sw.ts` (строки 579-584)

Service Worker отправляет сообщение `NOTIFICATION_CLICKED` клиентам, но в React приложении нет обработчика этого события. Это может привести к тому, что клики по уведомлениям не будут корректно обрабатываться в уже открытом окне.

**Рекомендация:**
Добавить обработчик в корневой компонент или хук:

```typescript
useEffect(() => {
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'NOTIFICATION_CLICKED') {
      // Обработка клика по уведомлению
      const { action, data } = event.data
      // navigate() или другая логика
    }
  }
  navigator.serviceWorker?.addEventListener('message', handler)
  return () => navigator.serviceWorker?.removeEventListener('message', handler)
}, [])
```

---

### 3.2 Отсутствие очистки Push Subscriptions при логауте

При логауте пользователя его push-подписки остаются активными. Следует добавить вызов `/api/v1/push/unsubscribe` при выходе из аккаунта.

---

### 3.3 Fallback Storage Quota слишком большой

**Файл:** `frontend/src/services/storageManager.ts`

При недоступности Storage API используется fallback 1GB, что может быть больше, чем реально доступно на устройстве.

**Рекомендация:**
Уменьшить fallback до 100MB для безопасности.

---

## 4. ПРОВЕРКА ИНФРАСТРУКТУРЫ

### 4.1 Цепочка миграций базы данных ✅

```
2025_12_29_0001 → 2025_12_30_0001 (timezone) → 2026_01_09_0001 (push_subscriptions)
```

**Статус:** Корректная цепочка, миграция push_subscriptions правильно связана.

---

### 4.2 Backend Push Notification Service ✅

**Файлы проверены:**
- `backend/app/services/push_notification_service.py` - полная реализация
- `backend/app/routers/push.py` - все эндпоинты
- `backend/app/models/push_subscription.py` - модель с правильными индексами
- `backend/app/schemas/push.py` - Pydantic схемы

**Статус:** Production-ready, все компоненты на месте.

---

### 4.3 Docker Compose VAPID Configuration ✅

**Файл:** `docker-compose.lite.yml`

```yaml
# Backend (строки 125-128)
- VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY:-}
- VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY:-}
- VAPID_SUBJECT=${VAPID_SUBJECT:-mailto:admin@fancai.app}

# Celery Worker (строки 180-183)
- VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY:-}
- VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY:-}
- VAPID_SUBJECT=${VAPID_SUBJECT:-mailto:admin@fancai.app}
```

**Статус:** VAPID ключи настроены для backend и celery-worker.

---

### 4.4 Frontend Service Worker ✅

**Файл:** `frontend/src/sw.ts` (649 строк)

**Реализовано:**
- Precaching статических ресурсов (Workbox)
- Runtime caching с правильными стратегиями
- Background Sync для критических операций
- Push notifications с обработкой разных типов
- Notification click routing
- SPA Navigation fallback

**Статус:** Качественная реализация, соответствует best practices 2025-2026.

---

### 4.5 Dexie.js Database ✅

**Файл:** `frontend/src/services/db.ts`

**Таблицы:**
- `offlineBooks` - книги для оффлайн чтения
- `chapters` - главы с контентом
- `images` - сгенерированные изображения
- `syncQueue` - очередь синхронизации
- `readingProgress` - прогресс чтения

**Статус:** Правильная схема с composite keys для изоляции пользователей.

---

### 4.6 Frontend Dependencies ✅

**Файл:** `frontend/package.json`

```json
{
  "dexie": "^4.2.1",
  "dexie-react-hooks": "^4.2.0",
  "vite-plugin-pwa": "^1.2.0",
  "workbox-*": "^7.4.0"
}
```

**Статус:** Современные версии, совместимые друг с другом.

---

## 5. МАТРИЦА СОВМЕСТИМОСТИ

| Функция | iOS 16+ | iOS 26 | Android 16 | Chrome | Firefox |
|---------|---------|--------|------------|--------|---------|
| Service Worker | ✅ | ✅ | ✅ | ✅ | ✅ |
| Push Notifications | ⚠️ 16.4+ standalone | ✅ | ✅ | ✅ | ✅ |
| Background Sync | ❌ | ❌ | ✅ | ✅ | ✅ |
| IndexedDB | ⚠️ 7-day eviction | ⚠️ | ✅ | ✅ | ✅ |
| Install Prompt | ❌ manual | ❌ | ✅ | ✅ | ✅ |
| Persistent Storage | ⚠️ needs request | ⚠️ | ✅ | ✅ | ⚠️ |

**Примечания:**
- iOS требует standalone mode для Push Notifications
- iOS имеет 7-дневное автоудаление IndexedDB (workaround через Persistent Storage)
- Background Sync на iOS заменён на visibilitychange + online events

---

## 6. ЧЕКЛИСТ ПЕРЕД ДЕПЛОЕМ

### Критические (блокирующие деплой)
- [ ] Исправить двойную регистрацию Service Worker
- [ ] Создать иконку icon-512.png
- [ ] Добавить заголовки кеширования для sw.js в nginx
- [ ] Исправить домен в og:url и twitter:url

### Важные (рекомендуется до деплоя)
- [ ] Создать скриншоты для manifest.json или удалить раздел
- [ ] Создать og-image.jpg и twitter-image.jpg
- [ ] Исправить VAPID_SUBJECT default на fancai.ru
- [ ] Добавить обработчик NOTIFICATION_CLICKED в React

### Желательные (можно после деплоя)
- [ ] Добавить очистку push subscriptions при логауте
- [ ] Уменьшить fallback storage quota
- [ ] Добавить PWA install analytics

---

## 7. РИСКИ ДЕПЛОЯ

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| SW не обновляется из-за кеширования | Высокая | Критическое | Добавить Cache-Control headers |
| 404 на icon-512.png | 100% | Среднее | Создать иконку |
| Двойной polling SW | 100% | Низкое | Исправить регистрацию |
| Push не работает без VAPID | Высокая | Среднее | Сгенерировать ключи |
| iOS push fails silently | Средняя | Низкое | Уже есть fallback |

---

## Заключение

PWA реализация **технически грамотная** и использует современный стек:
- Workbox 7.4.0 с injectManifest strategy
- Dexie.js 4.x для IndexedDB
- Proper iOS workarounds
- Background Sync с приоритетами
- Push Notifications с типизацией

**Перед деплоем необходимо:**
1. Исправить 4 критические проблемы
2. Сгенерировать VAPID ключи и добавить в .env на сервере
3. Запустить `alembic upgrade head` для создания таблицы push_subscriptions
4. Проверить работу PWA локально через HTTPS (ngrok или mkcert)

После исправления критических проблем проект готов к деплою на fancai.ru.
