# Анализ проблем навигации и UI читалки

**Дата:** 5 января 2026
**Статус:** Завершён
**Тип:** Комплексный анализ

---

## Резюме

Проведён глубокий анализ 3 заявленных проблем. Выявлено **15+ дополнительных проблем** различной степени критичности.

| Заявленная проблема | Корневая причина |
|---------------------|------------------|
| Навигация после закрытия модала | Фокус не восстанавливается на viewer |
| Мобильная tap-навигация | `useTouchNavigation` не используется, tap-зоны удалены |
| Тема при обновлении страницы | Race condition: epub рендерится ДО применения темы |

---

## Проблема 1: Навигация после закрытия модала

### Симптомы
- После закрытия ImageModal клавиатурная навигация (стрелки) не работает
- После выделения текста навигация также ломается

### Корневая причина

**Файл:** `frontend/src/hooks/useFocusTrap.ts` (строки 91-104)

```typescript
// Fallback selectors don't match actual viewer div
const viewerContainer = document.getElementById('viewer') ||
                        document.querySelector('.epub-container') ||
                        document.body;
```

**Проблема:** Viewer div в `EpubReader.tsx` (строка 628) НЕ имеет `id="viewer"` или `class="epub-container"`:

```tsx
<div
  ref={viewerRef}
  className={`h-full w-full ${backgroundColor}`}
  // НЕТ id или epub-container класса!
/>
```

**Результат:** Фокус восстанавливается на `document.body`, а не на viewer.

### Дополнительная причина

**Файл:** `frontend/src/hooks/epub/useEpubNavigation.ts` (строка 93)

```typescript
window.addEventListener('keydown', handleKeyPress);
```

Keyboard listener на `window`, но когда фокус внутри iframe (epub.js), события клавиатуры НЕ bubble-ят в main window.

---

## Проблема 2: Мобильная tap-навигация не работает

### Симптомы
- Tap на края экрана не переключает страницы
- Работают только кнопки в header

### Корневая причина

**Критическое открытие:** `useTouchNavigation` НЕ импортируется и НЕ используется!

**Файл:** `frontend/src/components/Reader/EpubReader.tsx` (строки 40-57)

```typescript
import {
  useEpubLoader,
  useLocationGeneration,
  useCFITracking,
  useProgressSync,
  useEpubNavigation,
  useKeyboardNavigation,
  // ... другие хуки
  // useTouchNavigation - ОТСУТСТВУЕТ!
} from '@/hooks/epub';
```

**Файл:** `frontend/src/hooks/epub/useTouchNavigation.ts` (строки 78-84)

```typescript
if (isTap) {
  // Taps are handled by overlay tap zones in EpubReader.tsx
  // This hook only handles swipe gestures
  return;  // TAP игнорируется!
}
```

Комментарий говорит "overlay tap zones в EpubReader.tsx", но:

**Файл:** `EpubReader.tsx` (строка 724)

```tsx
{/* Always visible - tap zones removed */}
```

**Tap-зоны были УДАЛЕНЫ, а swipe-навигация НИКОГДА НЕ БЫЛА ПОДКЛЮЧЕНА!**

---

## Проблема 3: Тема при обновлении страницы

### Симптомы
- При refresh страницы тёмная тема частично переключается на светлую
- Видна "вспышка" светлого контента (FOUC)

### Корневые причины

#### 3.1 Дублирование хранения темы

| Источник | Ключ localStorage | Проблема |
|----------|-------------------|----------|
| `useEpubThemes.ts` | `app-theme` | Основной |
| `useReaderStore` (Zustand) | `reader-storage.theme` | Дублирует |

При изменении темы в ReaderControls, `useEpubThemes` сохраняет в `app-theme`, но Zustand store НЕ обновляется.

#### 3.2 Race condition

**Файл:** `EpubReader.tsx` (строки 148-154)

```typescript
onReady: () => {
  setTimeout(() => {
    setRenditionReady(true);  // 500ms DELAY!
  }, 500);
},
```

Последовательность:
1. `useEpubLoader` создаёт rendition
2. epub.js начинает рендерить с DEFAULT (светлой) темой
3. **500ms задержка**
4. Только потом `useEpubThemes` применяет тему

#### 3.3 CSS переменные не инициализированы

**Файл:** `EpubReader.tsx` (строки 608-618)

```typescript
const backgroundColor = useMemo(() => {
  switch (theme) {
    case 'light':
      return 'bg-background';  // CSS variable
    case 'dark':
      return 'bg-background';  // ТОТ ЖЕ CSS variable!
```

`bg-background` зависит от `.dark` класса на `<html>`. Если класс не установлен к моменту рендера - фон светлый.

---

## Дополнительные проблемы (P0-P2)

### P0 (Критические)

| # | Проблема | Файл | Строки |
|---|----------|------|--------|
| 1 | **Memory leak**: Event listeners на description highlights не очищаются | `useDescriptionHighlighting.ts` | 684-709 |
| 2 | **Stale closure**: beforeunload сохраняет устаревшую позицию | `useProgressSync.ts` | 161-243 |
| 3 | **Focus trap не освобождается**: overflow: hidden остаётся | `TocSidebar.tsx` | 291-302 |

### P1 (Высокие)

| # | Проблема | Файл | Влияние |
|---|----------|------|---------|
| 4 | Race condition в инициализации позиции | `EpubReader.tsx` | Неверная позиция после refresh |
| 5 | Нет focus trap в PositionConflictDialog | `PositionConflictDialog.tsx` | A11y нарушение |
| 6 | Touch targets < 44px | `ExtractionIndicator.tsx` | WCAG нарушение |
| 7 | SelectionMenu z-index: 100 (ниже модалов z-500) | `SelectionMenu.tsx` | Меню скрыто за модалом |

### P2 (Средние)

| # | Проблема | Файл | Влияние |
|---|----------|------|---------|
| 8 | Unnecessary re-renders в ReaderContent | `ReaderContent.tsx` | Performance |
| 9 | debounce пересоздаётся на каждый рендер | `useResizeHandler.ts` | Debounce не работает |
| 10 | 50+ console.log в production | Везде | Performance, логи |
| 11 | Hardcoded русские строки | Компоненты | i18n блокировка |
| 12 | Нет aria-live для статус-сообщений | Компоненты | A11y |

---

## Карта event handlers

### Z-Index стек

```
z-[800]  ExtractionIndicator, ImageGenerationStatus
z-[500]  TocSidebar, BookInfo, PositionConflictDialog
z-[400]  Backdrops
z-[100]  SelectionMenu  ← ПРОБЛЕМА: ниже модалов!
z-10     ReaderHeader
z-0      EPUB iframe
```

### Потенциальные конфликты

| Конфликт | Компоненты | Суть |
|----------|------------|------|
| Click-outside | SelectionMenu, BookInfo, TocSidebar | 3 listener-а на document, могут конфликтовать |
| Escape key | SelectionMenu, TocSidebar, BookInfo | 3 listener-а, последний выигрывает |
| Touch vs Swipe | useTouchNavigation | touchmove preventDefault только при deltaX > deltaY |

---

## Статистика

| Категория | Количество |
|-----------|------------|
| Критических проблем (P0) | 6 |
| Высоких проблем (P1) | 4 |
| Средних проблем (P2) | 5 |
| **Итого** | **15** |

---

## Связанные документы

- [02-action-plan.md](./02-action-plan.md) - План исправлений
- [03-phase1-completion.md](./03-phase1-completion.md) - Отчёт Фазы 1
- [04-phase2-completion.md](./04-phase2-completion.md) - Отчёт Фазы 2
- [05-phase3-completion.md](./05-phase3-completion.md) - Отчёт Фазы 3
- [06-phase4-completion.md](./06-phase4-completion.md) - Отчёт Фазы 4
