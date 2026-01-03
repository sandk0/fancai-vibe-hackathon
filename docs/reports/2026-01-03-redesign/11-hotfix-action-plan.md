# План критических исправлений (Hotfix)

**Дата:** 3 января 2026
**Статус:** ✅ ВЫПОЛНЕНО

---

## Обзор

~~Выявлено **24+ проблемы**, требующих немедленного исправления.~~

✅ **ВСЕ ЗАДАЧИ ВЫПОЛНЕНЫ** - см. [12-hotfix-completion.md](./12-hotfix-completion.md)

---

## Этап 1: Reader - Критические исправления

**Оценка времени: 4 часа**

### 1.1 Устранить дублирование свайп-обработчиков

**Файл:** `src/components/Reader/EpubReader.tsx`

**Задача:** Оставить только ОДИН механизм навигации

**Действия:**
1. Отключить `useTouchNavigation` hook (строки 240-245):
```tsx
useTouchNavigation({
  rendition,
  nextPage,
  prevPage,
  enabled: false, // ОТКЛЮЧИТЬ
});
```

2. Или удалить inline handlers (строки 748-784) и оставить только hook

3. Добавить debounce на навигацию (после строки 230):
```tsx
const lastNavigationTime = useRef<number>(0);
const NAVIGATION_DEBOUNCE = 300;

const nextPageDebounced = useCallback(() => {
  const now = Date.now();
  if (now - lastNavigationTime.current > NAVIGATION_DEBOUNCE) {
    lastNavigationTime.current = now;
    nextPage();
  }
}, [nextPage]);
```

---

### 1.2 Исправить tap zones (блокировка кликов)

**Файл:** `src/components/Reader/EpubReader.tsx`

**Задача:** Позволить кликать на описания внутри iframe

**Действия:** Строки 810-893 - изменить z-index и pointer-events:

```tsx
{/* Left tap zone */}
<div
  className="fixed left-0 bottom-0 w-[20%] z-[3] md:hidden"
  style={{
    pointerEvents: 'none', // Пропускать события
    top: isImmersive ? '0' : 'calc(70px + env(safe-area-inset-top))',
  }}
>
  <div
    className="w-full h-full"
    style={{ pointerEvents: 'auto' }}
    onClick={() => handleTapZone('left', false)}
  />
</div>
```

---

### 1.3 Исправить шапку Reader (мобильная версия)

**Файлы:**
- `src/components/Reader/EpubReader.tsx`
- `src/components/Reader/ReaderHeader.tsx`

**Задача:** Убрать пустое пространство, показывать реальную шапку

**Действия:**

1. В `EpubReader.tsx` строки 999-1002 - убрать translate, оставить opacity:
```tsx
<div
  className={cn(
    'transition-opacity duration-300 ease-in-out',
    isImmersive
      ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto'
      : 'opacity-100'
  )}
>
  <ReaderHeader ... />
</div>
```

2. В `ReaderHeader.tsx` строка 49 - изменить на fixed:
```tsx
<div
  className="fixed left-0 right-0 z-10 backdrop-blur-md border-b bg-card/95 border-border"
  style={{ top: 'env(safe-area-inset-top)' }}
>
```

---

### 1.4 Исправить шапку на Desktop

**Файл:** `src/components/Reader/EpubReader.tsx`

**Задача:** Всегда показывать шапку на desktop (md+)

**Действия:** Строки 791-804 - добавить responsive класс:
```tsx
<div
  ref={viewerRef}
  className={cn(
    "h-full w-full transition-[padding] duration-300",
    backgroundColor,
    // Mobile: условный padding
    isImmersive ? "pt-[env(safe-area-inset-top)]" : "pt-[calc(70px+env(safe-area-inset-top))]",
    // Desktop: ВСЕГДА padding для шапки
    "md:pt-[calc(70px+env(safe-area-inset-top))]"
  )}
  style={{
    paddingBottom: 'env(safe-area-inset-bottom)',
  }}
/>
```

---

### 1.5 Убрать или отключить свайп-навигацию

**Рекомендация:** Полностью отключить свайпы, оставить только tap zones

**Файл:** `src/components/Reader/EpubReader.tsx`

**Действия:** Удалить строки 748-784 (handleTouchStart, handleTouchEnd) и убрать их из tap zones.

---

## Этап 2: UI - Критические исправления

**Оценка времени: 2 часа**

### 2.1 Добавить обложки книг в HomePage

**Файл:** `src/pages/HomePage.tsx`

**Действия:**

1. Добавить импорт (после строки 1):
```tsx
import { AuthenticatedImage } from '@/components/UI/AuthenticatedImage';
```

2. Заменить ContinueReadingCard (строки 284-294):
```tsx
{/* Book cover */}
<div className="flex-shrink-0 w-20 sm:w-24 aspect-[2/3] rounded-lg overflow-hidden">
  {book.has_cover ? (
    <AuthenticatedImage
      src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/books/${book.id}/cover`}
      alt={`${book.title} обложка`}
      className="w-full h-full object-cover"
      fallback={
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-accent/20 to-secondary">
          <BookOpen className="w-8 h-8 text-primary/60" />
        </div>
      }
    />
  ) : (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-accent/20 to-secondary">
      <BookOpen className="w-8 h-8 text-primary/60" />
    </div>
  )}
</div>
```

3. Заменить RecentBooksSection (строки 437-448):
```tsx
{/* Book cover */}
<div className="aspect-[2/3] rounded-xl overflow-hidden mb-2 border border-border">
  {book.has_cover ? (
    <AuthenticatedImage
      src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/books/${book.id}/cover`}
      alt={`${book.title} обложка`}
      className="w-full h-full object-cover"
      fallback={
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-accent/10 to-secondary">
          <BookOpen className="w-10 h-10 text-primary/40" />
        </div>
      }
    />
  ) : (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-accent/10 to-secondary">
      <BookOpen className="w-10 h-10 text-primary/40" />
    </div>
  )}
</div>
```

---

### 2.2 Исправить nav.library

**Файл:** `src/components/Layout/Header.tsx`

**Действия:** Строка 72:
```tsx
// БЫЛО:
{ to: '/library', label: t('nav.library'), icon: Library },

// СТАЛО:
{ to: '/library', label: t('nav.myLibrary'), icon: Library },
```

---

### 2.3 Подключить мобильное меню к store

**Файл:** `src/components/Layout/Header.tsx`

**Действия:**

1. Добавить импорт:
```tsx
import { useUIStore } from '@/stores/ui';
```

2. Добавить hook внутри компонента:
```tsx
const { setSidebarOpen, sidebarOpen } = useUIStore();
```

3. Изменить onClick кнопки меню (строка 92):
```tsx
onClick={() => setSidebarOpen(!sidebarOpen)}
```

---

### 2.4 Исправить прозрачность dropdown аватарки

**Файл:** `src/components/Layout/Header.tsx`

**Действия:** Строка 179:
```tsx
// БЫЛО:
className="... bg-popover/95 backdrop-blur-md ..."

// СТАЛО:
className="... bg-popover border border-border ..."
```

---

## Этап 3: Важные исправления

**Оценка времени: 2 часа**

### 3.1 Обновить viewport meta tag

**Файл:** `frontend/index.html`

**Действия:** Строка 6:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

---

### 3.2 Исправить dropdown alignment темы

**Файл:** `src/components/UI/ThemeSwitcher.tsx`

**Действия:** Строка 54:
```tsx
<DropdownMenuContent align="end" side="bottom" alignOffset={0} className="w-40">
```

---

### 3.3 Исправить snap-mandatory

**Файл:** `src/pages/HomePage.tsx`

**Действия:** Строка 414:
```tsx
// БЫЛО:
'snap-x snap-mandatory sm:snap-none'

// СТАЛО:
'snap-x snap-proximity sm:snap-none'
```

---

## Этап 4: Локализация

**Оценка времени: 3 часа**

### 4.1 LibraryPage.tsx

Заменить все SORT_OPTIONS, GENRE_OPTIONS, PROGRESS_OPTIONS на русский язык.

```tsx
const SORT_OPTIONS = [
  { value: 'newest', label: 'Сначала новые' },
  { value: 'oldest', label: 'Сначала старые' },
  { value: 'title-asc', label: 'По названию А-Я' },
  { value: 'title-desc', label: 'По названию Я-А' },
  { value: 'author-asc', label: 'По автору А-Я' },
  { value: 'recent', label: 'Недавно читал' },
];

const GENRE_OPTIONS = [
  { value: 'all', label: 'Все жанры' },
  { value: 'fiction', label: 'Художественная' },
  { value: 'non-fiction', label: 'Документальная' },
  { value: 'fantasy', label: 'Фэнтези' },
  { value: 'sci-fi', label: 'Научная фантастика' },
  { value: 'romance', label: 'Романтика' },
  { value: 'mystery', label: 'Детектив' },
  { value: 'thriller', label: 'Триллер' },
];

const PROGRESS_OPTIONS = [
  { value: 'all', label: 'Все книги' },
  { value: 'not-started', label: 'Не начаты' },
  { value: 'in-progress', label: 'В процессе' },
  { value: 'completed', label: 'Завершены' },
];
```

Также заменить:
- `"Upload Book"` → `"Загрузить книгу"`
- `"Search by title or author..."` → `"Поиск по названию или автору..."`
- `"Filters"` → `"Фильтры"`
- `"Reading Progress"` → `"Прогресс чтения"`
- `"Clear all filters"` → `"Сбросить фильтры"`
- `"Previous"` → `"Назад"`
- `"Next"` → `"Далее"`

---

### 4.2 BookCard.tsx

```tsx
// Строка 168:
"AI Processing..." → "AI обработка..."

// Строки 191, 245:
"Read" → "Читать"

// Строки 203, 254:
"Delete" → "Удалить"

// Строка 262:
"Close" → "Закрыть"

// Строка 214:
aria-label="Book menu" → aria-label="Меню книги"
```

---

### 4.3 BookGrid.tsx

```tsx
// Строка 138:
"No books found" → "Книги не найдены"

// Строка 141:
"No results for \"{searchQuery}\". Try a different search term."
→ "Нет результатов для \"{searchQuery}\". Попробуйте другой запрос."

// Строка 150:
"Clear Search" → "Очистить поиск"

// Строка 168:
"Your library is empty" → "Ваша библиотека пуста"

// Строка 171:
"Upload your first book to start your AI-enhanced reading journey"
→ "Загрузите первую книгу, чтобы начать чтение с AI-иллюстрациями"

// Строка 181:
"Upload First Book" → "Загрузить первую книгу"
```

---

### 4.4 ImageGallery.tsx

```tsx
// Строка 130:
"Loading images..." → "Загрузка изображений..."

// Строка 139:
"Failed to Load Images" → "Не удалось загрузить изображения"

// Строка 152:
"No Images Generated Yet" → "Изображений пока нет"

// Строка 167:
"Generated Images" → "Созданные изображения"

// Строка 206:
"All Types" → "Все типы"

// Строка 251, 325:
"Download" → "Скачать"

// Строка 261, 332:
"Share" → "Поделиться"

// Строка 318:
"View" → "Просмотр"

// Строка 347:
"No Images Match Your Filters" → "Нет изображений по выбранным фильтрам"
```

---

### 4.5 Sidebar.tsx

```tsx
// Строка 202:
"Collapse" → "Свернуть"

// Строка 242:
"Free Plan" → "Бесплатный план"
```

---

## Порядок выполнения

| # | Задача | Время | Приоритет |
|---|--------|-------|-----------|
| 1 | Устранить дублирование свайпов | 1ч | 🔴 CRITICAL |
| 2 | Исправить tap zones z-index | 30м | 🔴 CRITICAL |
| 3 | Исправить шапку Reader (mobile) | 1ч | 🔴 CRITICAL |
| 4 | Исправить шапку Reader (desktop) | 30м | 🔴 CRITICAL |
| 5 | Добавить обложки в HomePage | 1ч | 🔴 CRITICAL |
| 6 | Исправить nav.library | 10м | 🔴 CRITICAL |
| 7 | Подключить мобильное меню | 20м | 🔴 CRITICAL |
| 8 | Исправить dropdown прозрачность | 10м | 🟠 HIGH |
| 9 | Viewport meta tag | 5м | 🟠 HIGH |
| 10 | Dropdown alignment | 10м | 🟠 HIGH |
| 11 | snap-proximity | 5м | 🟡 MEDIUM |
| 12 | Локализация LibraryPage | 1ч | 🟠 HIGH |
| 13 | Локализация BookCard/BookGrid | 30м | 🟠 HIGH |
| 14 | Локализация ImageGallery | 30м | 🟠 HIGH |
| 15 | Локализация остальных | 30м | 🟡 MEDIUM |

---

## Тестирование после исправлений

### Mobile (iOS Safari, Android Chrome)
- [ ] Tap zones работают (левый/центр/правый)
- [ ] Свайпы НЕ пролистывают несколько страниц
- [ ] Шапка Reader появляется по клику
- [ ] Можно кликнуть по выделенному описанию
- [ ] Меню-гамбургер открывает drawer
- [ ] Обложки книг отображаются

### Desktop (Chrome, Safari)
- [ ] Шапка Reader видна всегда
- [ ] Dropdown аватарки читаемый
- [ ] nav.library показывает "Моя библиотека"
- [ ] Обложки книг отображаются

### Локализация
- [ ] Все тексты на русском языке
- [ ] Нет hardcoded English strings

---

## Связанные документы

- [10-post-deploy-issues.md](./10-post-deploy-issues.md) - Полный отчёт о проблемах
