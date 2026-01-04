# План исправлений Reader и Frontend

**Дата:** 4 января 2026
**Приоритет:** КРИТИЧЕСКИЙ
**Статус:** ✅ ВСЕ ФАЗЫ ЗАВЕРШЕНЫ

---

## Обзор

Выявлено **200+ проблем**. План разбит на 4 фазы по приоритету.

---

## Фаза 1: Критические исправления Reader (P0)

### 1.1 Сделать header всегда видимым

**Файл:** `src/components/Reader/EpubReader.tsx`

**Изменение 1 - строка 140:**
```tsx
// БЫЛО:
const [isImmersive, setIsImmersive] = useState(true);

// СТАЛО:
const [isImmersive, setIsImmersive] = useState(false);
```

**Изменение 2 - строки 931-950:**
```tsx
// БЫЛО:
<div
  className={`transition-opacity duration-300 ease-in-out ${
    isImmersive
      ? 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto'
      : 'opacity-100'
  }`}
>
  <ReaderHeader ... />
</div>

// СТАЛО:
<ReaderHeader ... />
```

---

### 1.2 Удалить tap-зоны навигации

**Файл:** `src/components/Reader/EpubReader.tsx`

**Удалить строки 765-841** (tap zones и tap feedback overlay)

**Удалить строки 718-734** (handleTapZone callback)

**Удалить строки 659-694** (showToolbarTemporarily, toggleImmersiveMode)

**Удалить строки 139-142** (isImmersive state и immersiveTimeoutRef)

---

### 1.3 Отключить свайп-навигацию в epub.js

**Файл:** `src/hooks/epub/useEpubLoader.ts`

**Добавить после создания rendition (после строки ~120):**
```tsx
// Disable touch/swipe navigation inside epub.js iframe
newRendition.on('rendered', (section: Section) => {
  const iframe = viewerRef.current?.querySelector('iframe');
  if (iframe?.contentDocument?.body) {
    iframe.contentDocument.body.style.touchAction = 'pan-y';
    iframe.contentDocument.body.style.userSelect = 'text';
    iframe.contentDocument.body.style.webkitUserSelect = 'text';
  }
});
```

**Файл:** `src/styles/globals.css`

**Добавить:**
```css
/* Disable horizontal swipe in epub reader */
.epub-container iframe,
.epub-container iframe body {
  touch-action: pan-y !important;
  overscroll-behavior-x: none !important;
}
```

---

### 1.4 Удалить неиспользуемый useTouchNavigation

**Файл:** `src/components/Reader/EpubReader.tsx`

**Удалить строки 257-264:**
```tsx
// Удалить весь блок:
useTouchNavigation({
  rendition,
  nextPage,
  prevPage,
  enabled: false,
});
```

**Удалить импорт:**
```tsx
// Удалить из импортов:
import { useTouchNavigation } from '@/hooks/epub/useTouchNavigation';
```

---

## Фаза 2: Унификация цветов Reader (P1)

### 2.1 Обновить backgroundColor в EpubReader

**Файл:** `src/components/Reader/EpubReader.tsx`

**Строки 646-656:**
```tsx
// БЫЛО:
const backgroundColor = useMemo(() => {
  switch (theme) {
    case 'light': return 'bg-white';
    case 'sepia': return 'bg-amber-50';
    case 'dark': default: return 'bg-gray-900';
  }
}, [theme]);

// СТАЛО:
const backgroundColor = useMemo(() => {
  switch (theme) {
    case 'light': return 'bg-background';
    case 'sepia': return 'bg-[#FBF0D9]';
    case 'dark': default: return 'bg-background';
  }
}, [theme]);
```

---

### 2.2 Удалить getThemeColors() в BookInfo.tsx

**Файл:** `src/components/Reader/BookInfo.tsx`

**Удалить строки 63-91** (функция getThemeColors)

**Заменить использования:**
```tsx
// БЫЛО:
const colors = getThemeColors();
<div className={colors.bg}>

// СТАЛО:
<div className="bg-popover">
```

**Маппинг замен:**
| Было | Стало |
|------|-------|
| `colors.bg` | `bg-popover` |
| `colors.text` | `text-popover-foreground` |
| `colors.textSecondary` | `text-muted-foreground` |
| `colors.border` | `border-border` |
| `colors.hover` | `hover:bg-muted` |

---

### 2.3 Удалить getColors() в ImageGenerationStatus.tsx

**Файл:** `src/components/Reader/ImageGenerationStatus.tsx`

**Удалить строки 69-108** (функция getColors)

**Маппинг замен:**
| Было | Стало |
|------|-------|
| `colors.bg` | `bg-popover` |
| `colors.text` | `text-popover-foreground` |
| `colors.subtext` | `text-muted-foreground` |
| `colors.border` | `border-border` |
| `colors.spinner` | `border-primary` |
| `colors.success` | `text-success` |
| `colors.error` | `text-destructive` |
| `colors.cancelBg` | `hover:bg-muted` |
| `colors.cancelText` | `text-muted-foreground hover:text-foreground` |

---

### 2.4 Рефакторинг ProgressIndicator.tsx

**Файл:** `src/components/Reader/ProgressIndicator.tsx`

**Удалить функцию getThemeColors()** и заменить на semantic классы аналогично BookInfo.tsx.

---

### 2.5 Рефакторинг ReaderControls.tsx

**Файл:** `src/components/Reader/ReaderControls.tsx`

**Удалить функцию getThemeColors()** и заменить на semantic классы.

---

### 2.6 Обновить useEpubThemes.ts

**Файл:** `src/hooks/epub/useEpubThemes.ts`

**Строки 55-107 - заменить HSL на CSS переменные:**
```tsx
const THEMES: Record<ThemeName, ThemeStyles> = {
  light: {
    body: {
      color: '#1A1A1A',           // --color-text-default light
      background: '#FFFFFF',      // --color-bg-base light
    },
    'a:link': { color: 'hsl(24, 95%, 53%)' },
    'a:visited': { color: 'hsl(24, 95%, 45%)' },
  },
  dark: {
    body: {
      color: '#E8E8E8',           // --color-text-default dark
      background: '#121212',      // --color-bg-base dark (нейтральный!)
    },
    'a:link': { color: 'hsl(24, 95%, 60%)' },
    'a:visited': { color: 'hsl(24, 95%, 50%)' },
  },
  sepia: {
    body: {
      color: '#3D2914',           // Тёмно-коричневый для sepia
      background: '#FBF0D9',      // Sepia фон
    },
    'a:link': { color: 'hsl(24, 80%, 40%)' },
    'a:visited': { color: 'hsl(24, 80%, 35%)' },
  },
  night: {
    body: {
      color: '#B0B0B0',           // Приглушённый для ночи
      background: '#000000',
    },
    'a:link': { color: 'hsl(24, 70%, 50%)' },
    'a:visited': { color: 'hsl(24, 70%, 45%)' },
  },
};
```

---

## Фаза 3: Унификация цветов во всём проекте (P1)

### 3.1 Заменить text-white на text-primary-foreground

**Файлы для исправления:**

| Файл | Строки |
|------|--------|
| ProfilePage.tsx | 194, 202, 207, 219, 221, 224, 226 |
| BookImagesPage.tsx | 79, 81, 82, 98, 106, 109, 116 |
| LoginPage.tsx | 70 |
| RegisterPage.tsx | 266 |
| Sidebar.tsx | 206, 311 |
| MobileDrawer.tsx | 289 |
| TocSidebar.tsx | 137 |
| ErrorBoundaryDemo.tsx | 49, 68, 87, 130 |
| AdminParsingSettings.tsx | 173 |
| DeleteConfirmModal.tsx | 134 |
| OfflineBanner.tsx | 133 |
| Checkbox.tsx | 111, 118 |
| ErrorMessage.tsx | 65 |
| ParsingOverlay.tsx | 141 |
| button.tsx | 70, 96 |

---

### 3.2 Исправить toast цвета в App.tsx

**Файл:** `src/App.tsx`

**Строки 131-141:**
```tsx
// БЫЛО:
toastOptions={{
  style: { background: '#363636', color: '#fff' },
  success: { style: { background: '#22c55e' } },
  error: { style: { background: '#ef4444' } },
}}

// СТАЛО:
toastOptions={{
  className: 'bg-popover text-popover-foreground border border-border',
  success: { className: 'bg-success text-success-foreground' },
  error: { className: 'bg-destructive text-destructive-foreground' },
}}
```

---

### 3.3 Исправить StatsPage.tsx

**Файл:** `src/pages/StatsPage.tsx`

**Строка 98:**
```tsx
// БЫЛО:
bg-gray-500

// СТАЛО:
bg-muted
```

---

## Фаза 4: Mobile UX и Design System (P2)

### 4.1 Увеличить touch targets в ReaderControls

**Файл:** `src/components/Reader/ReaderControls.tsx`

**Строки 166-172:**
```tsx
// БЫЛО:
className="h-9 w-9"

// СТАЛО:
className="h-11 w-11 min-h-[44px] min-w-[44px]"
```

---

### 4.2 Добавить safe-area в Mobile Sidebar

**Файл:** `src/components/Layout/Sidebar.tsx`

**Строка ~248:**
```tsx
// БЫЛО:
className="fixed inset-y-0 left-0 z-[500]"

// СТАЛО:
className="fixed inset-y-0 left-0 z-[500] pt-safe"
```

---

### 4.3 Исправить FAB в LibraryPage

**Файл:** `src/pages/LibraryPage.tsx`

**Строка ~498:**
```tsx
// БЫЛО:
className="fixed bottom-6 right-6"

// СТАЛО:
className="fixed bottom-6 right-6 bottom-safe"
```

---

### 4.4 Унифицировать border-radius

**Файлы:**

| Файл | Строка | Изменение |
|------|--------|-----------|
| button.tsx | 49 | `rounded-md` → `rounded-lg` |
| Select.tsx | 14 | `rounded-md` → `rounded-lg` |
| AdminStats.tsx | 65 | `rounded-lg` → `rounded-xl` |
| PositionConflictDialog.tsx | 70 | `rounded-lg` → `rounded-xl` |

---

## Порядок выполнения

| Фаза | Задачи | Приоритет | Статус |
|------|--------|-----------|--------|
| 1.1 | Header всегда видим | P0 | ✅ |
| 1.2 | Удалить tap-зоны | P0 | ✅ |
| 1.3 | Отключить swipe в epub.js | P0 | ✅ |
| 1.4 | Удалить useTouchNavigation | P0 | ✅ |
| 2.1 | backgroundColor в EpubReader | P1 | ✅ |
| 2.2 | BookInfo.tsx рефакторинг | P1 | ✅ |
| 2.3 | ImageGenerationStatus.tsx рефакторинг | P1 | ✅ |
| 2.4 | ProgressIndicator.tsx рефакторинг | P1 | ✅ |
| 2.5 | ReaderControls.tsx рефакторинг | P1 | ✅ |
| 2.6 | useEpubThemes.ts цвета | P1 | ✅ |
| 3.* | text-white → text-primary-foreground | P1 | ✅ |
| 4.* | Mobile UX и Design System | P2 | ✅ |

---

## Тестирование

### После Фазы 1 (Reader)

- [ ] Header всегда виден на mobile
- [ ] Клик по описаниям работает
- [ ] Swipe не переключает страницы
- [ ] Навигация только через кнопки в header

### После Фазы 2 (Цвета Reader)

- [ ] Тёмная тема: нейтральный серый (#121212) везде
- [ ] Sepia тема: правильный коричневатый фон
- [ ] Нет синеватых оттенков в тёмной теме

### После Фазы 3 (Цвета проект)

- [ ] Все кнопки на primary фоне читаемы
- [ ] Toast уведомления адаптируются к теме
- [ ] Нет hardcoded белого текста

### После Фазы 4 (Mobile UX)

- [ ] Все touch targets ≥ 44px
- [ ] Safe area работает на iPhone X+
- [ ] Border-radius консистентен

---

## Связанные документы

- [20-reader-analysis.md](./20-reader-analysis.md) - Полный анализ
- [22-phase1-reader-completion.md](./22-phase1-reader-completion.md) - Отчёт Фазы 1
- [23-phase2-colors-completion.md](./23-phase2-colors-completion.md) - Отчёт Фазы 2
- [24-phase3-project-colors-completion.md](./24-phase3-project-colors-completion.md) - Отчёт Фазы 3
- [25-phase4-mobile-ux-completion.md](./25-phase4-mobile-ux-completion.md) - Отчёт Фазы 4
