# План исправлений навигации и UI читалки

**Дата:** 5 января 2026
**Статус:** ✅ ВСЕ ФАЗЫ ЗАВЕРШЕНЫ
**Приоритет:** КРИТИЧЕСКИЙ

---

## Обзор

Выявлено 15 проблем. План разбит на 4 фазы по приоритету.

---

## Фаза 1: Критические исправления навигации (P0)

### 1.1 Добавить id и tabIndex на viewer div

**Файл:** `frontend/src/components/Reader/EpubReader.tsx`

**Строка ~628:**
```tsx
// БЫЛО:
<div
  ref={viewerRef}
  className={`h-full w-full ${backgroundColor}`}
>

// СТАЛО:
<div
  ref={viewerRef}
  id="epub-viewer"
  tabIndex={-1}
  className={`h-full w-full ${backgroundColor} outline-none`}
>
```

---

### 1.2 Обновить селекторы в useFocusTrap

**Файл:** `frontend/src/hooks/useFocusTrap.ts`

**Строки 91-104:**
```typescript
// БЫЛО:
const viewerContainer = document.getElementById('viewer') ||
                        document.querySelector('.epub-container') ||
                        document.body;

// СТАЛО:
const viewerContainer = document.getElementById('epub-viewer') ||
                        document.querySelector('[data-epub-viewer]') ||
                        document.body;
```

---

### 1.3 Импортировать и подключить useTouchNavigation

**Файл:** `frontend/src/components/Reader/EpubReader.tsx`

**Добавить импорт (строка ~40):**
```typescript
import {
  // ... существующие импорты
  useTouchNavigation,
} from '@/hooks/epub';
```

**Добавить вызов хука (после строки ~260):**
```typescript
// Hook 9: Touch/swipe navigation for mobile
useTouchNavigation({
  rendition,
  nextPage,
  prevPage,
  enabled: renditionReady && !isModalOpen && !isTocOpen,
});
```

---

### 1.4 Включить tap-зоны в useTouchNavigation

**Файл:** `frontend/src/hooks/epub/useTouchNavigation.ts`

**Строки 78-84 - изменить логику tap:**
```typescript
// БЫЛО:
if (isTap) {
  // Taps are handled by overlay tap zones in EpubReader.tsx
  return;
}

// СТАЛО:
if (isTap) {
  // Handle edge taps for navigation
  const tapX = touchStartRef.current.x;
  const screenWidth = window.innerWidth;
  const leftZone = screenWidth * 0.25;  // 25% from left
  const rightZone = screenWidth * 0.75; // 75% from left

  if (tapX < leftZone) {
    console.log('[useTouchNavigation] Left edge tap → prev page');
    prevPage();
  } else if (tapX > rightZone) {
    console.log('[useTouchNavigation] Right edge tap → next page');
    nextPage();
  }
  // Center tap (25%-75%) - do nothing (allow text selection)
  return;
}
```

---

### 1.5 Добавить keyboard listener на iframe

**Файл:** `frontend/src/hooks/epub/useEpubNavigation.ts`

**Строки 69-95 - добавить iframe listener:**
```typescript
useEffect(() => {
  if (!enabled || !rendition) return;

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        prevPage();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
      case ' ':
        e.preventDefault();
        nextPage();
        break;
    }
  };

  // Listen on main window
  window.addEventListener('keydown', handleKeyPress);

  // ДОБАВИТЬ: Also listen in epub.js iframe
  const attachToIframe = () => {
    const contents = rendition?.getContents();
    if (contents && contents[0]?.document) {
      contents[0].document.addEventListener('keydown', handleKeyPress);
    }
  };

  rendition?.on('rendered', attachToIframe);
  attachToIframe(); // Attach immediately if already rendered

  return () => {
    window.removeEventListener('keydown', handleKeyPress);
    rendition?.off('rendered', attachToIframe);
    const contents = rendition?.getContents();
    if (contents && contents[0]?.document) {
      contents[0].document.removeEventListener('keydown', handleKeyPress);
    }
  };
}, [nextPage, prevPage, enabled, rendition]);
```

---

## Фаза 2: Исправление темы (P0)

### 2.1 Использовать явные цвета вместо CSS переменных

**Файл:** `frontend/src/components/Reader/EpubReader.tsx`

**Строки 608-618:**
```typescript
// БЫЛО:
const backgroundColor = useMemo(() => {
  switch (theme) {
    case 'light':
      return 'bg-background';
    case 'sepia':
      return 'bg-[#FBF0D9]';
    case 'dark':
    default:
      return 'bg-background';
  }
}, [theme]);

// СТАЛО:
const backgroundColor = useMemo(() => {
  switch (theme) {
    case 'light':
      return 'bg-white';
    case 'sepia':
      return 'bg-[#FBF0D9]';
    case 'dark':
      return 'bg-[#121212]';
    case 'night':
      return 'bg-black';
    default:
      return 'bg-[#121212]';
  }
}, [theme]);
```

---

### 2.2 Убрать 500ms задержку

**Файл:** `frontend/src/components/Reader/EpubReader.tsx`

**Строки 148-154:**
```typescript
// БЫЛО:
onReady: () => {
  setTimeout(() => {
    setRenditionReady(true);
  }, 500);
},

// СТАЛО:
onReady: () => {
  // Use requestAnimationFrame for immediate but safe state update
  requestAnimationFrame(() => {
    setRenditionReady(true);
  });
},
```

---

### 2.3 Применить тему сразу в useEpubLoader

**Файл:** `frontend/src/hooks/epub/useEpubLoader.ts`

**После создания rendition (строка ~120):**
```typescript
const newRendition = epubBook.renderTo(viewerRef.current, {
  width: '100%',
  height: '100%',
  spread: 'none',
});

// ДОБАВИТЬ: Apply initial theme immediately BEFORE rendering
const savedTheme = localStorage.getItem('app-theme') || 'dark';
const INITIAL_THEMES: Record<string, Record<string, Record<string, string>>> = {
  light: { body: { color: '#1A1A1A', background: '#FFFFFF' } },
  dark: { body: { color: '#E8E8E8', background: '#121212' } },
  sepia: { body: { color: '#3D2914', background: '#FBF0D9' } },
  night: { body: { color: '#B0B0B0', background: '#000000' } },
};
newRendition.themes.default(INITIAL_THEMES[savedTheme] || INITIAL_THEMES.dark);
```

---

### 2.4 Синхронизировать тему с HTML root

**Файл:** `frontend/src/hooks/epub/useEpubThemes.ts`

**В функции setTheme (после localStorage.setItem):**
```typescript
const setTheme = useCallback((newTheme: ThemeName) => {
  console.log('[useEpubThemes] Changing theme to:', newTheme);
  setThemeState(newTheme);
  localStorage.setItem(THEME_STORAGE_KEY, newTheme);

  // ДОБАВИТЬ: Sync with HTML root for Tailwind
  const root = document.documentElement;
  root.classList.remove('light', 'dark', 'sepia');
  root.setAttribute('data-theme', newTheme);

  if (newTheme === 'dark' || newTheme === 'night') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else if (newTheme === 'sepia') {
    root.classList.add('sepia');
    root.style.colorScheme = 'light';
  } else {
    root.style.colorScheme = 'light';
  }

  applyTheme(newTheme, fontSize);
}, [fontSize, applyTheme]);
```

---

## Фаза 3: Memory leaks и focus (P0-P1)

### 3.1 Очистка event listeners в useDescriptionHighlighting

**Файл:** `frontend/src/hooks/epub/useDescriptionHighlighting.ts`

**Добавить cleanup ref (после строки ~100):**
```typescript
const cleanupFunctionsRef = useRef<(() => void)[]>([]);
```

**В highlightDescriptions, сохранять cleanup (строки 692-709):**
```typescript
const handleMouseEnter = () => { /* ... */ };
const handleMouseLeave = () => { /* ... */ };
const handleClick = (event: MouseEvent) => { /* ... */ };

span.addEventListener('mouseenter', handleMouseEnter);
span.addEventListener('mouseleave', handleMouseLeave);
span.addEventListener('click', handleClick);

// ДОБАВИТЬ: Save cleanup function
cleanupFunctionsRef.current.push(() => {
  span.removeEventListener('mouseenter', handleMouseEnter);
  span.removeEventListener('mouseleave', handleMouseLeave);
  span.removeEventListener('click', handleClick);
});
```

**В removeAllHighlights (строка ~493):**
```typescript
const removeAllHighlights = useCallback(() => {
  // ДОБАВИТЬ: Run all cleanup functions
  cleanupFunctionsRef.current.forEach(cleanup => cleanup());
  cleanupFunctionsRef.current = [];

  // Existing code...
  const contents = rendition?.getContents();
  // ...
}, [rendition]);
```

---

### 3.2 Исправить stale closure в useProgressSync

**Файл:** `frontend/src/hooks/epub/useProgressSync.ts`

**Использовать ref для актуального значения (строки 161-243):**
```typescript
// ДОБАВИТЬ: Ref для актуальных значений
const latestPositionRef = useRef({ cfi: '', scrollPercent: 0 });

// Обновлять ref при каждом изменении
useEffect(() => {
  latestPositionRef.current = { cfi: currentCfi, scrollPercent };
}, [currentCfi, scrollPercent]);

// В beforeunload использовать ref
useEffect(() => {
  const handleBeforeUnload = () => {
    const { cfi, scrollPercent } = latestPositionRef.current;
    if (cfi) {
      // Сохранить позицию синхронно
      navigator.sendBeacon(
        `/api/v1/books/${bookId}/progress`,
        JSON.stringify({ cfi, scrollPercent })
      );
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [bookId]); // Только bookId в зависимостях
```

---

### 3.3 Исправить overflow в TocSidebar

**Файл:** `frontend/src/components/Reader/TocSidebar.tsx`

**Строки 291-302 - добавить cleanup:**
```typescript
useEffect(() => {
  if (isOpen) {
    document.body.style.overflow = 'hidden';
  }

  return () => {
    // ИЗМЕНИТЬ: Всегда очищать при unmount
    document.body.style.overflow = '';
  };
}, [isOpen]);
```

---

## Фаза 4: UI/UX улучшения (P1-P2)

### 4.1 Увеличить z-index SelectionMenu

**Файл:** `frontend/src/components/Reader/SelectionMenu.tsx`

**Строка 122:**
```typescript
// БЫЛО:
zIndex: 100

// СТАЛО:
zIndex: 600  // Выше модалов (z-500)
```

---

### 4.2 Добавить focus trap в PositionConflictDialog

**Файл:** `frontend/src/components/Reader/PositionConflictDialog.tsx`

**Добавить useFocusTrap:**
```typescript
import { useFocusTrap } from '@/hooks/useFocusTrap';

// В компоненте:
const dialogRef = useRef<HTMLDivElement>(null);
useFocusTrap(isOpen, dialogRef);

// На dialog div:
<div ref={dialogRef} role="dialog" aria-modal="true">
```

---

### 4.3 Удалить console.log в production

**Команда:**
```bash
# Найти все console.log в Reader компонентах
grep -rn "console.log" frontend/src/components/Reader/
grep -rn "console.log" frontend/src/hooks/epub/

# Заменить на conditional logging или удалить
```

---

## Порядок выполнения

| Фаза | Задачи | Приоритет | Статус |
|------|--------|-----------|--------|
| 1.1 | Добавить id/tabIndex на viewer | P0 | ✅ Завершено |
| 1.2 | Обновить селекторы useFocusTrap | P0 | ✅ Завершено |
| 1.3 | Импортировать useTouchNavigation | P0 | ✅ Завершено |
| 1.4 | Включить tap-зоны | P0 | ✅ Завершено |
| 1.5 | Iframe keyboard listener | P0 | ✅ Завершено |
| 2.1 | Явные цвета backgroundColor | P0 | ✅ Завершено |
| 2.2 | Убрать 500ms задержку | P0 | ✅ Завершено |
| 2.3 | Тема сразу в useEpubLoader | P0 | ✅ Завершено |
| 2.4 | Синхронизация с HTML root | P0 | ✅ Завершено |
| 3.1 | Cleanup event listeners | P0 | ✅ Завершено |
| 3.2 | Fix stale closure | P0 | ✅ Завершено |
| 3.3 | Fix TocSidebar overflow | P1 | ✅ Уже исправлено |
| 4.1 | SelectionMenu z-index | P1 | ✅ Завершено |
| 4.2 | PositionConflictDialog focus trap | P1 | ✅ Завершено |
| 4.3 | Удалить console.log | P2 | ✅ Завершено |

---

## Тестирование

### После Фазы 1 (Навигация)

- [ ] Закрыть модал → стрелки работают
- [ ] Выделить текст → стрелки работают после снятия выделения
- [ ] Mobile: tap на левый край → предыдущая страница
- [ ] Mobile: tap на правый край → следующая страница
- [ ] Mobile: swipe влево → следующая страница
- [ ] Mobile: swipe вправо → предыдущая страница

### После Фазы 2 (Тема)

- [ ] Refresh в тёмной теме → остаётся тёмной
- [ ] Refresh в sepia → остаётся sepia
- [ ] Нет вспышки светлого контента
- [ ] Переключение темы работает мгновенно

### После Фазы 3-4 (Cleanup)

- [ ] Долгое чтение → RAM не растёт
- [ ] Закрытие вкладки → позиция сохранена
- [ ] TOC sidebar → no overflow: hidden после закрытия
- [ ] SelectionMenu видно поверх модалов

---

## Связанные документы

- [01-analysis.md](./01-analysis.md) - Полный анализ
- [03-phase1-completion.md](./03-phase1-completion.md) - Отчёт Фазы 1
- [04-phase2-completion.md](./04-phase2-completion.md) - Отчёт Фазы 2
- [05-phase3-completion.md](./05-phase3-completion.md) - Отчёт Фазы 3
- [06-phase4-completion.md](./06-phase4-completion.md) - Отчёт Фазы 4
