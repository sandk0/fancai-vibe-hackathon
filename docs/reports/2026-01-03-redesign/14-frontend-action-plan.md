# План комплексного рефакторинга Frontend

**Дата:** 3 января 2026
**Приоритет:** ВЫСОКИЙ
**Статус:** ВСЕ ФАЗЫ ЗАВЕРШЕНЫ ✅

---

## Обзор

Выявлено **150+ проблем**. План разбит на 5 фаз по приоритету.

---

## Фаза 1: Критические исправления (P0)

### 1.1 z-index система

**Файл:** `src/styles/globals.css`

**Добавить:**
```css
:root {
  /* z-index scale */
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-fixed: 300;
  --z-modal-backdrop: 400;
  --z-modal: 500;
  --z-popover: 600;
  --z-tooltip: 700;
  --z-toast: 800;
}
```

**Обновить компоненты:**

| Файл | Изменение |
|------|-----------|
| Header.tsx | `z-50` → `z-[var(--z-sticky)]` или `z-[200]` |
| Sidebar.tsx | `z-50` → `z-[var(--z-fixed)]` или `z-[300]` |
| MobileDrawer.tsx overlay | `z-50` → `z-[var(--z-modal-backdrop)]` |
| BookUploadModal.tsx | `z-50` → `z-[var(--z-modal)]` |
| AlertDialog | `z-50` → `z-[var(--z-modal)]` |
| ToastContainer | `z-50` → `z-[var(--z-toast)]` |

---

### 1.2 Sidebar top position

**Файл:** `src/components/Layout/Sidebar.tsx`

**Строка ~151:**
```tsx
// БЫЛО:
className="fixed left-0 top-0 h-screen"

// СТАЛО:
className="fixed left-0 top-16 h-[calc(100vh-4rem)]"
```

---

### 1.3 Skip-link для accessibility

**Файл:** `src/components/Layout/Layout.tsx`

**Добавить в начало:**
```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:z-[900] focus:top-4 focus:left-4 focus:p-4 focus:bg-primary focus:text-primary-foreground focus:rounded-lg"
>
  Перейти к основному контенту
</a>

{/* Обернуть children */}
<main id="main-content" tabIndex={-1}>
  {children}
</main>
```

---

### 1.4 Focus trap для modals

**Создать:** `src/hooks/useFocusTrap.ts`

```tsx
import { useEffect, useRef, RefObject } from 'react';

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(isOpen: boolean, containerRef: RefObject<HTMLElement>) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    if (!container) return;

    // Save previously focused element
    previouslyFocusedRef.current = document.activeElement as HTMLElement;

    // Focus first focusable element
    const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusable[0]?.focus();

    // Trap focus
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen, containerRef]);
}
```

**Применить в:**
- BookUploadModal.tsx
- ImageModal.tsx
- DeleteConfirmModal.tsx

---

### 1.5 Lazy load epubjs

**Файл:** `src/App.tsx`

```tsx
// БЫЛО:
const BookReaderPage = lazy(() => import('./pages/BookReaderPage'));

// СТАЛО (если EpubReader внутри):
const BookReaderPage = lazy(() =>
  import('./pages/BookReaderPage').then(module => ({
    default: module.default
  }))
);
```

**Файл:** `vite.config.ts`

```ts
// Убрать epubjs из optimizeDeps.include если есть
optimizeDeps: {
  include: [
    // НЕ включать epubjs здесь
  ]
}
```

---

### 1.6 Унификация CSS переменных

**Файл:** `src/styles/globals.css`

**Удалить дублирующие переменные, оставить только HSL:**

```css
:root {
  /* Использовать ТОЛЬКО HSL формат для shadcn совместимости */
  --primary: 24 95% 53%;
  --primary-foreground: 0 0% 100%;

  /* Удалить legacy: */
  /* --color-primary-500: #f97316; ← УДАЛИТЬ */
}
```

**Файл:** `tailwind.config.js`

**Исправить ссылки на несуществующие переменные:**

```js
// БЫЛО:
accent: {
  50: 'var(--color-accent-50)', // НЕ СУЩЕСТВУЕТ
}

// СТАЛО:
accent: {
  DEFAULT: 'hsl(var(--accent))',
  foreground: 'hsl(var(--accent-foreground))',
}
```

---

### 1.7 Удаление legacy компонентов

**Удалить файлы:**
```
src/pages/HomePageOld.tsx
src/pages/BookPageOld.tsx
src/pages/LoginPageOld.tsx
src/pages/RegisterPageOld.tsx
src/pages/NotFoundPageOld.tsx
```

---

## Фаза 2: Mobile UX (P1-Mobile)

### 2.1 Touch targets минимум 44px

**Файлы для исправления:**

| Файл | Элемент | Изменение |
|------|---------|-----------|
| PositionConflictDialog.tsx:106-118 | Buttons | Добавить `min-h-[44px]` |
| ImagesGalleryPage.tsx:186-191 | Search input | Добавить `min-h-[44px] text-base` |
| ImagesGalleryPage.tsx:219-263 | Select elements | Добавить `min-h-[44px]` |
| BookUploadModal.tsx:283-289 | Close button | `p-2` → `p-3 min-w-[44px] min-h-[44px]` |
| BookUploadModal.tsx:364-369 | Delete file button | `p-1` → `p-2.5 min-w-[44px] min-h-[44px]` |
| Header.tsx:89-96 | Mobile menu | `w-10 h-10` → `w-11 h-11` |
| Header.tsx:156-174 | Avatar button | `w-8 h-8` → `w-10 h-10` |
| SelectionMenu.tsx:171-193 | Action buttons | Добавить `min-h-[44px]` |

---

### 2.2 Input font-size 16px (prevent iOS zoom)

**Глобальное правило в globals.css:**

```css
input, select, textarea {
  font-size: max(16px, 1rem);
}
```

---

### 2.3 Viewport meta

**Файл:** `index.html`

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover" />
```

**Примечание:** `maximum-scale=1.0, user-scalable=no` нарушает WCAG. Изменить на `maximum-scale=5.0, user-scalable=yes`.

---

### 2.4 BottomNav интеграция

**Файл:** `src/components/Layout/Layout.tsx`

```tsx
import { BottomNav } from '../Navigation/BottomNav';

// В return:
<>
  <Header />
  <main className="pb-16 md:pb-0"> {/* padding для BottomNav */}
    {children}
  </main>
  <BottomNav className="md:hidden" /> {/* Только на mobile */}
</>
```

---

## Фаза 3: Design System консистентность (P1-Design)

### 3.1 Замена gray-* на semantic

**Глобальный find & replace:**

| Найти | Заменить на |
|-------|-------------|
| `text-gray-900 dark:text-white` | `text-foreground` |
| `text-gray-900 dark:text-gray-100` | `text-foreground` |
| `text-gray-600 dark:text-gray-400` | `text-muted-foreground` |
| `text-gray-500` | `text-muted-foreground` |
| `text-gray-400` | `text-muted-foreground` |
| `bg-gray-100 dark:bg-gray-800` | `bg-muted` |
| `bg-gray-200 dark:bg-gray-700` | `bg-secondary` |
| `bg-gray-50 dark:bg-gray-900` | `bg-background` |
| `bg-gray-800` | `bg-card` |
| `bg-gray-900` | `bg-background` |
| `border-gray-200 dark:border-gray-700` | `border-border` |
| `border-gray-300 dark:border-gray-600` | `border-input` |

---

### 3.2 Стандартизация border-radius

**Правило:**
- Cards/Modals: `rounded-xl`
- Buttons: `rounded-lg`
- Inputs: `rounded-lg`
- Small elements (tags, badges): `rounded-md`
- Pills/Avatars: `rounded-full`

---

### 3.3 Стандартизация transitions

**Правило:**
- Micro-interactions (hover, active): `duration-200`
- UI transitions (modals, dropdowns): `duration-300`
- Page transitions: `duration-500`

---

### 3.4 Удаление inline styles

**Файл:** `src/components/ErrorBoundary.tsx`

Заменить все inline styles на Tailwind классы.

**Файл:** `src/components/Settings/ReaderSettings.tsx`

Удалить `dangerouslySetInnerHTML` для slider CSS, использовать Tailwind или CSS modules.

---

## Фаза 4: Accessibility (P1-A11y)

### 4.1 Modals accessibility

**BookUploadModal.tsx:**
```tsx
<motion.div
  role="dialog"
  aria-modal="true"
  aria-labelledby="upload-modal-title"
  onKeyDown={(e) => e.key === 'Escape' && handleClose()}
>
  <h2 id="upload-modal-title">{t('upload.title')}</h2>
  <button aria-label={t('common.close')} onClick={handleClose}>
    <X />
  </button>
</motion.div>
```

---

### 4.2 Form error announcements

**LoginPage.tsx, RegisterPage.tsx:**
```tsx
<div role="alert" aria-live="assertive" className="sr-only">
  {error && <span>{error}</span>}
</div>

{/* Visible error */}
{error && (
  <p className="text-destructive text-sm">{error}</p>
)}
```

---

### 4.3 Skeleton loading states

```tsx
<div aria-busy={isLoading} aria-live="polite">
  {isLoading ? <SkeletonCard /> : <ActualContent />}
</div>
```

---

### 4.4 Input required fields

```tsx
<Input
  aria-required={required}
  aria-invalid={!!error}
  aria-describedby={error ? `${id}-error` : undefined}
/>
```

---

### 4.5 Navigation landmarks

**TocSidebar.tsx:**
```tsx
<nav role="navigation" aria-label="Оглавление">
  {/* chapters list */}
</nav>
```

---

## Фаза 5: Performance (P2-Perf)

### 5.1 Self-hosted fonts

**Файл:** `index.html`

```html
<!-- Заменить Google Fonts @import на: -->
<link rel="preload" href="/fonts/Inter-Variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/CrimsonText-Regular.woff2" as="font" type="font/woff2" crossorigin>
```

---

### 5.2 Library search debounce

**Файл:** `src/components/Library/LibrarySearch.tsx`

```tsx
import { useDeferredValue, useState } from 'react';

const [inputValue, setInputValue] = useState('');
const deferredQuery = useDeferredValue(inputValue);

// Использовать deferredQuery для фильтрации
```

Или создать хук `useDebounce`:

```tsx
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

---

### 5.3 searchPatternsCache лимит

**Файл:** `src/hooks/epub/useDescriptionHighlighting.ts`

```tsx
const MAX_CACHE_SIZE = 500;

function addToCache(key: string, value: RegExp[]) {
  if (searchPatternsCache.size >= MAX_CACHE_SIZE) {
    const firstKey = searchPatternsCache.keys().next().value;
    searchPatternsCache.delete(firstKey);
  }
  searchPatternsCache.set(key, value);
}
```

---

### 5.4 framer-motion optimization

```tsx
// Использовать LazyMotion для уменьшения bundle
import { LazyMotion, domAnimation, m } from 'framer-motion';

<LazyMotion features={domAnimation}>
  <m.div animate={{ opacity: 1 }}>
    ...
  </m.div>
</LazyMotion>
```

---

## Порядок выполнения

| Фаза | Задачи | Приоритет | Статус |
|------|--------|-----------|--------|
| 1.1 | z-index система | P0 | ✅ |
| 1.2 | Sidebar top position | P0 | ✅ |
| 1.3 | Skip-link | P0 | ✅ |
| 1.4 | Focus trap | P0 | ✅ |
| 1.5 | Lazy load epubjs | P0 | ✅ |
| 1.6 | CSS переменные унификация | P0 | ✅ |
| 1.7 | Удаление legacy | P0 | ✅ |
| 2.1 | Touch targets 44px | P1 | ✅ |
| 2.2 | Input font-size 16px | P1 | ✅ |
| 2.3 | Viewport meta | P1 | ✅ |
| 2.4 | BottomNav интеграция | P1 | ✅ |
| 3.1 | gray-* → semantic | P1 | ✅ |
| 3.2 | border-radius стандарт | P1 | ✅ |
| 3.3 | transitions стандарт | P1 | ✅ |
| 3.4 | Удаление inline styles | P1 | ✅ |
| 4.1 | Modals accessibility | P1 | ✅ |
| 4.2 | Form error aria-live | P1 | ✅ |
| 4.3 | Skeleton aria-busy | P1 | ✅ |
| 4.4 | Input aria-required | P1 | ✅ |
| 4.5 | Navigation landmarks | P1 | ✅ |
| 5.1 | Font preload optimization | P2 | ✅ |
| 5.2 | Library search debounce | P2 | ✅ |
| 5.3 | searchPatternsCache лимит | P2 | ✅ |
| 5.4 | framer-motion LazyMotion | P2 | ✅ |

---

## Тестирование

### Mobile (iOS Safari, Android Chrome)

- [ ] Touch targets ≥44px
- [ ] Input не вызывает zoom
- [ ] Safe area insets работают
- [ ] BottomNav видна и функциональна
- [ ] Swipe navigation в Reader (если включена)
- [ ] Modals блокируют scroll

### Desktop (Chrome, Safari, Firefox)

- [ ] z-index не конфликтует
- [ ] Sidebar не перекрывает Header
- [ ] Skip-link работает
- [ ] Focus trap в modals
- [ ] Keyboard navigation полная

### Accessibility

- [ ] Screen reader объявляет errors
- [ ] Focus visible на всех элементах
- [ ] WCAG AA contrast
- [ ] Landmarks правильные

### Performance

- [ ] Initial bundle < 350KB
- [ ] LCP < 2.5s
- [ ] No memory leaks в cache

---

## Связанные документы

- [13-comprehensive-analysis.md](./13-comprehensive-analysis.md) - Полный отчёт анализа
- [15-phase1-completion.md](./15-phase1-completion.md) - Отчёт о завершении Фазы 1
- [16-phase2-completion.md](./16-phase2-completion.md) - Отчёт о завершении Фазы 2
- [17-phase3-completion.md](./17-phase3-completion.md) - Отчёт о завершении Фазы 3
- [18-phase4-completion.md](./18-phase4-completion.md) - Отчёт о завершении Фазы 4
- [19-phase5-completion.md](./19-phase5-completion.md) - Отчёт о завершении Фазы 5
