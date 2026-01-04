# Комплексный анализ Reader и Frontend - Отчёт

**Дата:** 4 января 2026
**Статус:** АНАЛИЗ ЗАВЕРШЁН, ТРЕБУЕТСЯ РЕФАКТОРИНГ

---

## Резюме

Проведён глубокий анализ 6 направлений. Выявлено **200+ проблем** различной критичности.

### Общая оценка

| Категория | Критических | Высоких | Средних |
|-----------|-------------|---------|---------|
| Reader: Tap/Swipe | 3 | 2 | 3 |
| Reader: Цветовая схема | 2 | 4 | 10+ |
| Цвета во всём проекте | 5 | 12 | 60+ |
| Mobile UX | 1 | 5 | 15 |
| Design System | 4 | 8 | 35+ |

---

## I. READER: TAP-ЗОНЫ И HEADER (P0)

### Проблема 1: Клики по описаниям перехватываются

**Файл:** `EpubReader.tsx`

**Корень проблемы:**
- Tap-зоны (`z-[2]`) перекрывают весь контент
- Центральная зона (60% ширины) переключает immersive mode
- Подсвеченные описания НЕ ИМЕЮТ z-index

**Строки:**
- 771-784: Левая tap-зона (20%)
- 787-801: Центральная tap-зона (60%)
- 803-818: Правая tap-зона (20%)

### Проблема 2: Header скрыт по умолчанию

**Файл:** `EpubReader.tsx`

**Корень проблемы:**
- `isImmersive` = `true` по умолчанию (строка 140)
- Header скрывается на mobile через `opacity-0 pointer-events-none` (строки 931-938)
- Автоскрытие через 3 секунды (строки 672-674)

### Решение

1. **Сделать header всегда видимым:**
   - Строка 140: `useState(true)` → `useState(false)`
   - Строки 931-938: Удалить условную видимость

2. **Удалить tap-зоны:**
   - Строки 765-841: Полностью удалить overlay tap zones
   - Навигация только через кнопки в header

---

## II. READER: SWIPE NAVIGATION (P0)

### Текущее состояние

| Механизм | Статус | Файл:строка |
|----------|--------|-------------|
| useTouchNavigation | Отключён (`enabled: false`) | EpubReader.tsx:263 |
| Tap zones | Включены | EpubReader.tsx:771-818 |
| epub.js встроенные свайпы | **НЕ ОТКЛЮЧЕНЫ** | useEpubLoader.ts:112 |
| CSS touch-action: pan-y | Включён | globals.css:528 |

### Корень проблемы: epub.js

epub.js имеет встроенную обработку свайпов, которая не отключена при создании rendition.

### Решение

1. **Отключить свайпы в epub.js:**
   ```typescript
   // useEpubLoader.ts
   const newRendition = epubBook.renderTo(viewerRef.current, {
     width: '100%',
     height: '100%',
     spread: 'none',
     // Добавить:
     allowScriptedContent: false,
   });

   // Отключить touch события в iframe
   newRendition.on('rendered', () => {
     const iframe = viewerRef.current?.querySelector('iframe');
     if (iframe?.contentDocument) {
       iframe.contentDocument.body.style.touchAction = 'pan-y';
     }
   });
   ```

2. **CSS в globals.css:**
   ```css
   .epub-viewer-container iframe {
     touch-action: pan-y !important;
   }
   ```

---

## III. READER: ЦВЕТОВАЯ НЕСОГЛАСОВАННОСТЬ (P1)

### Проблема: Две системы цветов

| Система | Где используется | Тёмный фон |
|---------|------------------|------------|
| **Новая (semantic)** | Header, Settings, Toolbar | `#121212` (нейтральный) |
| **Старая (gray-*)** | BookInfo, EpubReader, ImageGenerationStatus | `#111827` (синеватый) |

### Найденные legacy цвета

| Файл | Строки | Проблема |
|------|--------|----------|
| EpubReader.tsx | 654 | `bg-gray-900` (синий оттенок) |
| BookInfo.tsx | 63-91 | `getThemeColors()` - 15 legacy классов |
| ImageGenerationStatus.tsx | 69-108 | `getColors()` - 30 legacy классов |
| ProgressIndicator.tsx | 39-62 | 10 legacy классов |
| ReaderControls.tsx | 58-88 | 14 legacy классов |
| useEpubThemes.ts | 55-107 | HSL значения не соответствуют CSS vars |

### Критическое несоответствие в тёмной теме

| Элемент | Текущее | Должно быть |
|---------|---------|-------------|
| Фон читалки | `#111827` (gray-900) | `#121212` (--color-bg-base) |
| Фон модалок | `#1F2937` (gray-800) | `#1E1E1E` (--color-bg-muted) |
| EPUB body | `hsl(222.2, 84%, 4.9%)` | `#121212` |

### Решение

1. **Удалить функции getThemeColors() / getColors()** в:
   - BookInfo.tsx
   - ImageGenerationStatus.tsx
   - ProgressIndicator.tsx
   - ReaderControls.tsx

2. **Использовать semantic классы:**
   - `bg-gray-900` → `bg-background`
   - `bg-gray-800` → `bg-card`
   - `text-gray-100` → `text-foreground`
   - `border-gray-600` → `border-border`

3. **Обновить useEpubThemes.ts:**
   ```typescript
   dark: {
     body: {
       color: 'var(--color-text-default)',    // #E8E8E8
       background: 'var(--color-bg-base)',    // #121212
     },
   }
   ```

---

## IV. ОБЩИЕ ЦВЕТОВЫЕ ПРОБЛЕМЫ (P1)

### Hardcoded HEX цвета

| Файл | Строки | Проблема |
|------|--------|----------|
| App.tsx | 131-141 | Toast цвета не адаптируются к теме |
| images.ts | 318, 320 | SVG заглушка не адаптируется |
| reader.ts | 53-79 | Конфигурация тем (допустимо) |

### Legacy gray-* классы (60+ случаев)

**Критические файлы:**
- ImageGenerationStatus.tsx - 12 случаев
- BookInfo.tsx - 10 случаев
- ProgressIndicator.tsx - 10 случаев
- ReaderControls.tsx - 14 случаев
- StatsPage.tsx - 1 случай

### text-white на цветном фоне (80+ случаев)

**Требуют замены на `text-primary-foreground`:**
- ProfilePage.tsx: строки 194, 202, 207, 219, 221, 224, 226
- BookImagesPage.tsx: строки 79, 81, 82, 98, 106, 109, 116
- LoginPage.tsx: строка 70
- RegisterPage.tsx: строка 266
- Sidebar.tsx: строки 206, 311
- MobileDrawer.tsx: строка 289
- TocSidebar.tsx: строка 137
- И другие...

---

## V. MOBILE UX ПРОБЛЕМЫ (P1)

### Touch targets < 44px

| Файл | Строка | Элемент | Размер |
|------|--------|---------|--------|
| ReaderControls.tsx | 166-172 | Кнопки A-/A+ | 36px |
| ReaderNavigationControls.tsx | 51-82 | Кнопки навигации | py-2 px-4 |
| TocSidebar.tsx | 182-190 | Кнопка развернуть | p-1 |

### Safe-area проблемы

| Файл | Строка | Проблема |
|------|--------|----------|
| Sidebar.tsx | 248-254 | Mobile sidebar без pt-safe |
| LibraryPage.tsx | 498-506 | FAB без safe-area-inset-bottom |
| EpubReader.tsx | 757 | Hardcoded 70px вместо CSS var |

### Header height несогласованность

| Файл | Высота |
|------|--------|
| Header.tsx | h-14 md:h-16 |
| ReaderHeader.tsx | py-3 (без фиксированной высоты) |
| EpubReader.tsx | Hardcoded 70px |

---

## VI. DESIGN SYSTEM НЕСООТВЕТСТВИЯ (P2)

### Border Radius

| Стандарт | Текущее нарушение |
|----------|-------------------|
| Карточки: `rounded-xl` | AdminStats.tsx: `rounded-lg` |
| Кнопки: `rounded-lg` | button.tsx: `rounded-md` |
| Инпуты: `rounded-lg` | Select.tsx: `rounded-md` |

### Компоненты без использования стандартных UI

| Файл | Кастомные элементы |
|------|-------------------|
| BookCard.tsx | Кастомные кнопки |
| LibrarySearch.tsx | Кастомный input |
| DeleteConfirmModal.tsx | Не использует Dialog |
| PositionConflictDialog.tsx | Не использует Dialog |

---

## Связанные документы

- [21-reader-action-plan.md](./21-reader-action-plan.md) - План исправлений
