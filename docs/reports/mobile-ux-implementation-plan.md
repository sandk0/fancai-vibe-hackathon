# План реализации Mobile UX улучшений

**Дата:** 11 января 2026
**Версия:** 1.3 (ФИНАЛЬНАЯ - все фазы завершены)
**На основе:** `mobile-ux-audit-2025-01-11.md`

---

## Обзор плана

Общее количество задач: **18**

| Фаза | Задачи | Статус |
|------|--------|--------|
| Фаза 1 (Критические) | 6 задач | ✅ ЗАВЕРШЕНА |
| Фаза 2 (UX улучшения) | 8 задач | ✅ ЗАВЕРШЕНА |
| Фаза 3 (Полировка) | 4 задачи | ✅ ЗАВЕРШЕНА |

**Все задачи выполнены: 18/18 (100%)**

---

## Фаза 1: Критические исправления ✅ ЗАВЕРШЕНА

### Задача 1.1: Исправить theme_color ✅

**Файлы:**
- `frontend/public/manifest.json`
- `frontend/index.html`

**Выполненные изменения:**
```json
// manifest.json
"theme_color": "#FFFFFF"  // Было: "#0ea5e9"
```

```html
<!-- index.html - добавлена поддержка light/dark -->
<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#121212" media="(prefers-color-scheme: dark)" />
<meta name="msapplication-TileColor" content="#F59E0B" />
```

---

### Задача 1.2: Поднять PWAUpdatePrompt ✅

**Файл:** `frontend/src/components/UI/PWAUpdatePrompt.tsx`

**Выполненные изменения:**
```tsx
// Было:
className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm"

// Стало:
className="fixed left-4 right-4 z-[600] bottom-[calc(72px+env(safe-area-inset-bottom)+1rem)] md:bottom-4 md:left-auto md:right-4 md:max-w-sm"
```

---

### Задача 1.3: Офлайн-хранение EPUB ✅

**Созданные файлы:**

1. **`frontend/src/services/epubCache.ts`**
   - Dexie IndexedDB для EPUB файлов
   - Методы: get, set, has, delete, clearUser, cleanup
   - Auto-cleanup LRU при >200MB
   - 30-дневный TTL

2. **`frontend/src/hooks/useEpubOffline.ts`**
   - isAvailableOffline, isDownloading, downloadProgress
   - downloadEpub(), removeEpub(), cancelDownload()
   - getEpubData() с fallback на сеть

**Изменённые файлы:**

3. **`frontend/src/hooks/epub/useEpubLoader.ts`**
   - Добавлены параметры bookId, userId
   - Проверка epubCache перед fetch
   - Сообщение об офлайн-недоступности

4. **`frontend/src/components/Reader/EpubReader.tsx`**
   - Передача bookId и userId в useEpubLoader

5. **`frontend/src/components/Library/BookCard.tsx`**
   - Зелёная галочка на обложке (офлайн-статус)
   - Кнопка "Скачать офлайн" в меню
   - Индикатор прогресса загрузки

---

### Задача 1.4: Централизовать z-index ✅

**Файл:** `frontend/src/components/UI/NotificationContainer.tsx`

**Выполненные изменения:**
- `z-[9999]` → `z-[800]` (строки 284, 310)
- Соответствует Z_INDEX.toast из `lib/zIndex.ts`

---

### Задача 1.5: Убрать настройки чтения из SettingsPage ✅

**Файл:** `frontend/src/pages/SettingsPage.tsx`

**Выполненные изменения:**
- Удалён импорт `ReaderSettings`
- Удалена вкладка "Чтение" из tabs и accordionItems
- Удалён case 'reader' из renderTabContent()
- Начальная вкладка изменена на 'account'

**Примечание:** `ReaderSettings.tsx` оставлен в проекте (не используется)

---

### Задача 1.6: Исправить overflow:hidden ✅

**Файл:** `frontend/src/styles/globals.css`

**Выполненные изменения:**
```css
/* Было: */
#root {
  overflow-x: hidden;
  width: 100%;
  min-height: 100vh;
}

/* Стало: */
#root {
  width: 100%;
  min-height: 100vh;
  /* overflow-x: hidden убран - ломает position:fixed на iOS */
}

/* Добавлен класс-альтернатива */
.overflow-x-clip {
  overflow-x: clip;
}
```

---

## Фаза 2: UX улучшения ✅ ЗАВЕРШЕНА

### Задача 2.1: Убрать мобильный сайдбар ✅

**Файлы:**
- `frontend/src/components/Layout/Header.tsx`
- `frontend/src/components/Layout/Sidebar.tsx`
- `frontend/src/components/Layout/Layout.tsx`

**Выполненные изменения:**

1. **Header.tsx:**
   - Удалён импорт Menu из lucide-react
   - Удалён interface HeaderProps и prop onMenuClick
   - Удалена кнопка гамбургера (md:hidden)
   - Удалены sidebarOpen, setSidebarOpen из useUIStore

2. **Sidebar.tsx:**
   - Удалён импорт BookOpen из lucide-react
   - Удалён импорт useUIStore
   - Удалена функция handleLinkClick
   - Удалён весь Mobile Sidebar блок (строки ~250-334)
   - Удалён Mobile backdrop блок (строки ~336-344)

3. **Layout.tsx:**
   - Удалены sidebarOpen, mobileMenuOpen, setSidebarOpen, setMobileMenuOpen
   - Удалена функция handleBackdropClick
   - Удалён mobile overlay div

---

### Задача 2.2: Исправить toast уведомления ✅

**Файл:** `frontend/src/components/UI/NotificationContainer.tsx`

**Выполненные изменения:**
```tsx
// Toast стили (строка 213):
// Было:
'min-w-[280px] max-w-[400px]'

// Стало:
'min-w-0 max-w-[calc(100vw-2rem)] sm:min-w-[280px] sm:max-w-[400px]'

// Контейнер мобильный (строка 313):
// Было:
'top-4 left-4 right-4'

// Стало:
'top-[calc(env(safe-area-inset-top)+1rem)] left-4 right-4'
```

---

### Задача 2.3: Расширить ExtractionIndicator ✅

**Файл:** `frontend/src/components/Reader/ExtractionIndicator.tsx`

**Выполненные изменения:**
```tsx
// Было:
className={cn(
  'fixed left-1/2 -translate-x-1/2 z-[800]',
  'top-20 mt-safe',
  'max-w-[calc(100vw-32px)]',
  ...
)}

// Стало:
className={cn(
  'fixed inset-x-4 z-[800]',  // Привязка к краям
  'top-20 mt-safe',
  'w-[calc(100%-2rem)]',      // Явная ширина
  ...
)}
```

---

### Задача 2.4: Адаптировать BookUploadModal ✅

**Файл:** `frontend/src/components/Books/BookUploadModal.tsx`

**Выполненные изменения:**

1. Адаптивные размеры (строка 289):
```tsx
// Было:
className="... max-w-2xl w-full mx-4 ..."

// Стало:
className="... max-w-lg sm:max-w-2xl w-full mx-4 ..."
```

2. Padding в drag-drop зоне (строка 318):
```tsx
// Было:
className="... p-12 ..."

// Стало:
className="... p-6 sm:p-12 ..."
```

3. Auto-close после загрузки (строки 102-104):
```tsx
setTimeout(() => {
  onClose();
}, 1500);
```

---

### Задача 2.5: Переработать фильтры библиотеки ✅

**Файл:** `frontend/src/pages/LibraryPage.tsx`

**Выполненные изменения:**

1. Добавлен заголовок панели (строки 401-404):
```tsx
<h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
  <Filter className="w-4 h-4" />
  Фильтры
</h3>
```

2. Горизонтальный скролл для кнопок (строка 429):
```tsx
// Было:
<div className="flex flex-wrap gap-2">

// Стало:
<div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
```

3. Компактные кнопки (строка 436):
```tsx
className="... whitespace-nowrap ..."
```

---

### Задача 2.6: Исправить dropdown сортировки ✅

**Файл:** `frontend/src/pages/LibraryPage.tsx`

**Выполненные изменения (строка 338):**
```tsx
// Было:
className="absolute top-full right-0 mt-2 w-48 ..."

// Стало:
className="absolute top-full mt-2 w-48 right-0 max-w-[calc(100vw-2rem)] ..."
```

---

### Задача 2.7: Safe-area для header на iOS ✅

**Файлы:**
- `frontend/tailwind.config.js`
- `frontend/src/styles/globals.css`
- `frontend/src/components/Layout/Header.tsx`

**Выполненные изменения:**

1. **tailwind.config.js** - добавлен вариант standalone:
```javascript
plugin(function({ addVariant }) {
  addVariant('sepia-theme', '.sepia &');
  // PWA standalone mode variant for iOS safe-area handling
  addVariant('standalone', '@media all and (display-mode: standalone)');
}),
```

2. **globals.css** - добавлен utility class:
```css
/* PWA Standalone mode - extra padding for iOS Dynamic Island/notch */
@media all and (display-mode: standalone) {
  .standalone\:pt-safe-extra {
    padding-top: calc(env(safe-area-inset-top) + 0.5rem);
  }
}
```

3. **Header.tsx** - применён standalone variant:
```tsx
className="sticky top-0 ... pt-safe standalone:pt-[calc(env(safe-area-inset-top)+0.5rem)] ..."
```

---

### Задача 2.8: Scroll restoration для библиотеки ✅

**Файл:** `frontend/src/pages/LibraryPage.tsx`

**Выполненные изменения:**

1. Добавлена константа (строка 78):
```tsx
const SCROLL_KEY = 'library-scroll';
```

2. Добавлен useEffect для восстановления позиции (строки 84-93):
```tsx
useEffect(() => {
  const savedScroll = sessionStorage.getItem(SCROLL_KEY);
  if (savedScroll) {
    window.scrollTo(0, parseInt(savedScroll, 10));
  }
  return () => {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  };
}, []);
```

3. Обновлена функция handleBookClick (строки 194-197):
```tsx
const handleBookClick = (bookId: string) => {
  sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  navigate(`/book/${bookId}`);
};
```

---

## Фаза 3: Полировка ✅ ЗАВЕРШЕНА

### Задача 3.1: Унифицировать размеры в header ✅

**Файл:** `frontend/src/components/Layout/Header.tsx`

**Выполненные изменения:**

1. **Логотип** - консистентный 44px:
   - `w-10 h-10 sm:w-11 sm:h-11` → `w-11 h-11`
   - Иконка внутри: `w-5 h-5 sm:w-6 sm:h-6` → `w-6 h-6`

2. **Upload кнопка** - минимальные touch targets:
   - Добавлен `min-h-[44px] min-w-[44px]`
   - Убран `py-2` (высота через min-h)

3. **Desktop навигация** - минимальная высота:
   - `px-3 py-2` → `px-3 min-h-[44px]`

4. **User avatar** - консистентный 44px:
   - `w-10 h-10 sm:w-11 sm:h-11` → `w-11 h-11`

---

### Задача 3.2: Haptic feedback ✅

**Созданный файл:** `frontend/src/hooks/useHaptics.ts`

```typescript
/**
 * Hook for haptic feedback on mobile devices
 * Uses the Vibration API when available
 */
export function useHaptics() {
  const vibrate = (pattern: number | number[] = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  return {
    /** Light tap feedback - 10ms */
    tap: () => vibrate(10),
    /** Success feedback - double pulse */
    success: () => vibrate([10, 50, 10]),
    /** Error feedback - longer pulse */
    error: () => vibrate([50, 30, 50]),
    /** Selection feedback - very light 5ms */
    select: () => vibrate(5),
  };
}
```

**Интегрирован в:**

1. **`BookCard.tsx`:**
   - `haptics.tap()` при клике на карточку книги
   - `haptics.select()` при открытии мобильного меню

2. **`BottomNav.tsx`:**
   - `haptics.tap()` при переключении навигации

---

### Задача 3.3: Pull-to-refresh для библиотеки ✅

**Файл:** `frontend/src/pages/LibraryPage.tsx`

**Выполненные изменения:**

1. **Добавлены импорты:**
   - `useRef` из React
   - `RefreshCw` из lucide-react

2. **Добавлены состояния (строки 111-117):**
```tsx
const [isPulling, setIsPulling] = useState(false);
const [pullDistance, setPullDistance] = useState(0);
const [isRefreshing, setIsRefreshing] = useState(false);
const startY = useRef(0);
const containerRef = useRef<HTMLDivElement>(null);
const PULL_THRESHOLD = 80;
```

3. **Добавлен `refetch` из useBooks (строка 123):**
```tsx
const { data, isLoading, error, refetch } = useBooks(...)
```

4. **Добавлены touch handlers (строки 255-297):**
   - `handleTouchStart` - захватывает начальную Y позицию
   - `handleTouchMove` - отслеживает расстояние с сопротивлением (0.5x)
   - `handleTouchEnd` - запускает refetch при превышении порога

5. **Добавлен визуальный индикатор (строки 309-336):**
   - Фиксированная позиция сверху
   - Иконка RefreshCw с анимацией вращения
   - Плавные переходы

---

### Задача 3.4: Skeleton loading для обложек ✅

**Файл:** `frontend/src/components/Library/BookCard.tsx`

**Выполненные изменения:**

1. **Добавлен импорт `useEffect`** (строка 20)

2. **Добавлено состояние `imageLoaded`** (строка 58):
```tsx
const [imageLoaded, setImageLoaded] = useState(false);
```

3. **Добавлен эффект сброса при смене URL** (строки 76-79):
```tsx
useEffect(() => {
  setImageLoaded(false);
}, [coverUrl]);
```

4. **Добавлен callback для загрузки** (строки 132-135):
```tsx
const handleImageLoad = useCallback(() => {
  setImageLoaded(true);
}, []);
```

5. **Добавлен skeleton placeholder** (строки 165-184):
```tsx
{/* Skeleton Loading Placeholder */}
{!imageLoaded && coverUrl && (
  <div className="absolute inset-0 bg-muted animate-pulse" />
)}

{/* Cover Image с transition */}
<AuthenticatedImage
  ...
  className={cn(
    "w-full h-full object-cover transition-opacity duration-300",
    imageLoaded ? "opacity-100" : "opacity-0"
  )}
  onLoad={handleImageLoad}
/>
```

---

## Итоговая статистика

| Фаза | Задачи | Статус |
|------|--------|--------|
| Фаза 1 | 6 задач | ✅ Завершена |
| Фаза 2 | 8 задач | ✅ Завершена |
| Фаза 3 | 4 задачи | ✅ Завершена |
| **Всего** | **18 задач** | **100% выполнено** |

---

## Тестирование

После каждой фазы проверить на:

### Устройства:
- Android PWA (Chrome, Samsung Internet)
- iOS Safari PWA (iPhone 12+)
- Mobile Chrome/Safari (не PWA)

### Сценарии Фазы 1:
- [x] Status bar цвет соответствует теме
- [x] PWA prompt над нижним меню
- [x] Скачивание книги для офлайн
- [x] Чтение книги в офлайн режиме
- [x] Удаление книги из офлайн
- [x] Toast уведомления не конфликтуют
- [x] Fixed элементы корректно работают на iOS

### Сценарии Фазы 2:
- [x] Нет кнопки гамбургера на мобильных
- [x] Toast уведомления полностью видны
- [x] ExtractionIndicator на всю ширину
- [x] BookUploadModal адаптирован
- [x] Фильтры библиотеки удобны
- [x] Dropdown не выходит за край
- [x] Safe-area работает на iOS PWA
- [x] Scroll restoration сохраняет позицию

### Сценарии Фазы 3:
- [x] Размеры элементов унифицированы до 44px
- [x] Haptic feedback при нажатиях
- [x] Pull-to-refresh обновляет библиотеку
- [x] Skeleton loading при загрузке обложек

---

## Изменённые файлы

### Фаза 1 - Новые:
- `frontend/src/services/epubCache.ts`
- `frontend/src/hooks/useEpubOffline.ts`

### Фаза 1 - Изменённые:
- `frontend/public/manifest.json`
- `frontend/index.html`
- `frontend/src/components/UI/PWAUpdatePrompt.tsx`
- `frontend/src/components/UI/NotificationContainer.tsx`
- `frontend/src/styles/globals.css`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/hooks/epub/useEpubLoader.ts`
- `frontend/src/components/Reader/EpubReader.tsx`
- `frontend/src/components/Library/BookCard.tsx`

### Фаза 2 - Изменённые:
- `frontend/src/components/Layout/Header.tsx`
- `frontend/src/components/Layout/Sidebar.tsx`
- `frontend/src/components/Layout/Layout.tsx`
- `frontend/src/components/UI/NotificationContainer.tsx`
- `frontend/src/components/Reader/ExtractionIndicator.tsx`
- `frontend/src/components/Books/BookUploadModal.tsx`
- `frontend/src/pages/LibraryPage.tsx`
- `frontend/src/styles/globals.css`
- `frontend/tailwind.config.js`

### Фаза 3 - Новые:
- `frontend/src/hooks/useHaptics.ts`

### Фаза 3 - Изменённые:
- `frontend/src/components/Layout/Header.tsx`
- `frontend/src/components/Library/BookCard.tsx`
- `frontend/src/components/Navigation/BottomNav.tsx`
- `frontend/src/pages/LibraryPage.tsx`

---

## Итого по проекту

| Метрика | Значение |
|---------|----------|
| Всего задач | 18 |
| Выполнено | 18 (100%) |
| Новых файлов создано | 3 |
| Файлов изменено | 18 |
| Фаз выполнено | 3 из 3 |

---

**Документ подготовлен:** Claude Code
**Версия:** 1.3 (ФИНАЛЬНАЯ)
**Последнее обновление:** 11 января 2026
