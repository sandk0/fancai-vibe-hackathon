# EPUB Reader - План реализации недостающего функционала

> Создано: 26 октября 2025
> На основе: EPUB_READER_GAP_ANALYSIS.md
> Статус: 📋 READY FOR IMPLEMENTATION

---

## 📊 Executive Summary

**Всего задач:** 47
**Приоритет 1 (КРИТИЧНО):** 20 задач
**Приоритет 2 (ВАЖНО):** 15 задач
**Приоритет 3 (Nice-to-have):** 12 задач

**Рекомендуемые спринты:** 6 спринтов по 2 недели (3 месяца)

---

## 🎯 SPRINT 1: Foundations (2 недели)

**Цель:** Добавить критичный недостающий функционал для базового UX

### Task 1.1: TOC (Table of Contents) Sidebar ⭐ КРИТИЧНО
**Приоритет:** 🔴 P1
**Сложность:** 🟡 MEDIUM
**Оценка:** 16 часов
**Польза:** 🌟🌟🌟🌟🌟

**Файлы:**
- `src/components/Reader/TocSidebar.tsx` (новый)
- `src/hooks/epub/useToc.ts` (новый)
- `src/components/Reader/EpubReader.tsx` (обновить)

**Задачи:**
1. Создать hook `useToc` для получения TOC из `book.navigation.toc`
2. Создать компонент `<TocSidebar>` с:
   - Список глав с названиями
   - Highlight текущей главы
   - Клик → переход к главе
   - Expand/collapse для подглав
   - Поиск по главам
3. Интегрировать в `EpubReader`
4. Добавить toggle button (hamburger menu)
5. Сохранять открытость sidebar в localStorage

**API используемое:**
```typescript
book.navigation.toc // Массив глав
// [{ label: "Глава 1", href: "chapter1.xhtml", subitems: [...] }]

rendition.display(chapter.href); // Переход к главе
```

**Acceptance Criteria:**
- [ ] TOC отображается в sidebar
- [ ] Текущая глава подсвечена
- [ ] Клик по главе → переход работает
- [ ] Sidebar toggle работает
- [ ] Состояние сохраняется

---

### Task 1.2: Text Selection & Copy ⭐ КРИТИЧНО
**Приоритет:** 🔴 P1
**Сложность:** 🟢 LOW
**Оценка:** 8 часов
**Польза:** 🌟🌟🌟🌟🌟

**Файлы:**
- `src/hooks/epub/useTextSelection.ts` (новый)
- `src/components/Reader/SelectionMenu.tsx` (новый)

**Задачи:**
1. Создать hook `useTextSelection` для обработки `rendition.on('selected')`
2. При выделении текста:
   - Показать popup menu (Copy, Highlight, Note)
   - Сохранить выделенный CFI range
3. Реализовать copy to clipboard
4. Подготовить для highlights (Task 3.1)

**API используемое:**
```typescript
rendition.on('selected', (cfiRange, contents) => {
  // cfiRange - CFI выделенного текста
  const selectedText = contents.window.getSelection().toString();
});
```

**Acceptance Criteria:**
- [ ] При выделении текста появляется меню
- [ ] Кнопка Copy копирует в clipboard
- [ ] Выделение работает на мобильных
- [ ] CFI range сохраняется для highlights

---

### Task 1.3: Page Numbers Display ⭐ КРИТИЧНО
**Приоритет:** 🔴 P1
**Сложность:** 🟢 LOW
**Оценка:** 4 часа
**Польза:** 🌟🌟🌟🌟

**Файлы:**
- `src/components/Reader/ProgressIndicator.tsx` (обновить)
- `src/hooks/epub/useCFITracking.ts` (обновить)

**Задачи:**
1. Добавить вычисление current page из CFI
2. Получить total pages из `locations.total`
3. Обновить `ProgressIndicator` для отображения

**API используемое:**
```typescript
const totalPages = locations.total;
const currentPage = locations.locationFromCfi(currentCFI);
```

**Текущий:**
```tsx
<div>42%</div>
<div>Глава 5</div>
```

**После:**
```tsx
<div>42%</div>
<div>Стр. 123/500</div>
<div>Глава 5</div>
```

**Acceptance Criteria:**
- [ ] Отображается "Стр. X/Y"
- [ ] Номера страниц точные
- [ ] Работает для всех книг

---

### Task 1.4: Book Metadata Display ⭐ КРИТИЧНО
**Приоритет:** 🔴 P1
**Сложность:** 🟢 LOW
**Оценка:** 6 часов
**Польза:** 🌟🌟🌟🌟

**Файлы:**
- `src/hooks/epub/useBookMetadata.ts` (новый)
- `src/components/Reader/BookInfo.tsx` (новый)
- `src/components/Reader/EpubReader.tsx` (обновить)

**Задачи:**
1. Создать hook `useBookMetadata` для получения метаданных
2. Показывать в header: `{title} - {author}`
3. Создать модальное окно "О книге" с полными метаданными
4. Button "i" в toolbar → открывает модалку

**API используемое:**
```typescript
await book.loaded.metadata;
book.packaging.metadata.title // Название
book.packaging.metadata.creator // Автор
book.packaging.metadata.description // Описание
book.packaging.metadata.publisher // Издатель
book.packaging.metadata.language // Язык
```

**Acceptance Criteria:**
- [ ] Заголовок и автор в header
- [ ] Модалка "О книге" с метаданными
- [ ] Обработка отсутствующих метаданных

---

### Task 1.5: Resize Event Handling ⭐ КРИТИЧНО
**Приоритет:** 🔴 P1
**Сложность:** 🟢 LOW
**Оценка:** 4 часа
**Польза:** 🌟🌟🌟🌟

**Файлы:**
- `src/hooks/epub/useResizeHandler.ts` (новый)

**Задачи:**
1. Слушать `rendition.on('resized')`
2. При resize:
   - Сохранить текущую позицию (CFI)
   - Дождаться перерисовки
   - Восстановить позицию
   - Обновить UI

**API используемое:**
```typescript
rendition.on('resized', ({width, height}) => {
  // Viewport изменился
});
```

**Acceptance Criteria:**
- [ ] При resize окна позиция сохраняется
- [ ] Плавный переход без скачков
- [ ] Работает на мобильных (поворот)

---

**SPRINT 1 TOTAL:**
- **Задач:** 5
- **Часов:** 38
- **Приоритет:** Все P1

---

## 🚀 SPRINT 2: Reading Modes (2 недели)

**Цель:** Добавить альтернативные режимы чтения

### Task 2.1: Scrolled Mode ⭐ КРИТИЧНО
**Приоритет:** 🔴 P1
**Сложность:** 🟡 MEDIUM
**Оценка:** 12 часов
**Польза:** 🌟🌟🌟🌟

**Файлы:**
- `src/hooks/epub/useReadingMode.ts` (новый)
- `src/hooks/epub/useEpubLoader.ts` (обновить)
- `src/components/Reader/ReadingModeToggle.tsx` (новый)

**Задачи:**
1. Добавить state для reading mode: `'paginated' | 'scrolled'`
2. При `scrolled`:
   ```typescript
   {
     flow: 'scrolled',
     manager: 'continuous',
   }
   ```
3. При `paginated`:
   ```typescript
   {
     flow: 'paginated',
     manager: 'default',
   }
   ```
4. Toggle button в toolbar
5. Сохранять preference в localStorage
6. Адаптировать navigation (scroll vs page)

**Acceptance Criteria:**
- [ ] Toggle работает
- [ ] Scrolled mode: плавный scroll
- [ ] Paginated mode: страницы
- [ ] Preference сохраняется
- [ ] Позиция сохраняется при переключении

---

### Task 2.2: Spreads Support (Two-Page View)
**Приоритет:** 🔴 P1
**Сложность:** 🟡 MEDIUM
**Оценка:** 10 часов
**Польза:** 🌟🌟🌟

**Файлы:**
- `src/hooks/epub/useSpreadMode.ts` (новый)
- `src/hooks/epub/useEpubLoader.ts` (обновить)

**Задачи:**
1. Определять screen size (tablet/desktop)
2. Если ширина > 900px и preference = auto:
   ```typescript
   {
     spread: 'auto', // Показать 2 страницы
   }
   ```
3. Toggle: single page / auto spreads
4. Адаптивное переключение

**Acceptance Criteria:**
- [ ] На wide screens показывает 2 страницы
- [ ] На narrow screens - 1 страница
- [ ] Toggle работает
- [ ] Адаптируется при resize

---

### Task 2.3: Font Family Selector
**Приоритет:** ⚠️ P2
**Сложность:** 🟢 LOW
**Оценка:** 6 часов
**Польза:** 🌟🌟🌟

**Файлы:**
- `src/hooks/epub/useEpubThemes.ts` (обновить)
- `src/components/Reader/FontSelector.tsx` (новый)

**Задачи:**
1. Добавить font family в theme state
2. Dropdown с шрифтами:
   - Georgia (serif)
   - Arial (sans-serif)
   - Courier (monospace)
   - System (device default)
3. `rendition.themes.font(family)`
4. Сохранять в localStorage

**API используемое:**
```typescript
rendition.themes.font('Georgia');
```

**Acceptance Criteria:**
- [ ] Dropdown с шрифтами
- [ ] Применяется корректно
- [ ] Сохраняется preference

---

### Task 2.4: Named Themes (Instead of Override)
**Приоритет:** ⚠️ P2
**Сложность:** 🟢 LOW
**Оценка:** 4 часа
**Польза:** 🌟🌟

**Файлы:**
- `src/hooks/epub/useEpubThemes.ts` (рефакторинг)

**Задачи:**
1. Заменить `rendition.themes.default()` на:
   ```typescript
   rendition.themes.register('light', lightStyles);
   rendition.themes.register('dark', darkStyles);
   rendition.themes.register('sepia', sepiaStyles);
   ```
2. Переключение через:
   ```typescript
   rendition.themes.select('dark');
   ```

**Преимущества:**
- Быстрее переключение
- Можно добавлять кастомные темы
- Правильное использование API

**Acceptance Criteria:**
- [ ] Темы зарегистрированы
- [ ] Переключение работает
- [ ] Нет регрессий

---

**SPRINT 2 TOTAL:**
- **Задач:** 4
- **Часов:** 32
- **Приоритет:** 3x P1, 1x P2

---

## 📝 SPRINT 3: Highlights & Annotations (2 недели)

**Цель:** Правильная система highlights через Annotations API

### Task 3.1: User Highlights System ⭐ КРИТИЧНО
**Приоритет:** 🔴 P1
**Сложность:** 🔴 HIGH
**Оценка:** 24 часа
**Польза:** 🌟🌟🌟🌟🌟

**БЛОКЕР:** Требует CFI ranges от бэкенда для descriptions

**Файлы:**
- `src/hooks/epub/useUserHighlights.ts` (новый)
- `src/hooks/epub/useTextSelection.ts` (обновить)
- `src/components/Reader/HighlightMenu.tsx` (новый)

**Задачи:**
1. При выделении текста → добавить highlight:
   ```typescript
   rendition.annotations.highlight(
     cfiRange,
     { note: userNote, color: selectedColor },
     (e) => { openHighlightMenu(e); },
     'user-highlight',
     { backgroundColor: color }
   );
   ```
2. Сохранять highlights в БД:
   ```typescript
   POST /api/highlights {
     book_id: string,
     cfi_range: string,
     text: string,
     note?: string,
     color: string,
   }
   ```
3. Загружать highlights при открытии книги
4. Восстанавливать через `rendition.annotations.add()`
5. CRUD операции:
   - Create: выделение текста
   - Read: загрузка при открытии
   - Update: изменить цвет, добавить заметку
   - Delete: удалить highlight

**API используемое:**
```typescript
// Создание
rendition.annotations.highlight(cfiRange, data, callback, className, styles);

// Удаление
rendition.annotations.remove(cfiRange, 'highlight');

// Event при клике
rendition.on('markClicked', (cfiRange, data, contents) => {
  // Показать popup с actions
});
```

**Acceptance Criteria:**
- [ ] Можно создать highlight
- [ ] Highlights сохраняются в БД
- [ ] Highlights загружаются при открытии
- [ ] Можно удалить highlight
- [ ] Можно добавить заметку
- [ ] Разные цвета highlights

---

### Task 3.2: Migrate Description Highlights to Annotations API
**Приоритет:** 🔴 P1
**Сложность:** 🔴 HIGH
**Оценка:** 16 часов
**Польза:** 🌟🌟🌟🌟

**БЛОКЕР:** Требует CFI ranges от бэкенда

**Файлы:**
- `src/hooks/epub/useDescriptionHighlighting.ts` (рефакторинг)
- Backend: book parser должен сохранять CFI ranges

**Текущий подход (ПЛОХО):**
```typescript
// Manual DOM manipulation
const span = doc.createElement('span');
parent.insertBefore(span, node);
```

**Новый подход (ХОРОШО):**
```typescript
// Use Annotations API
descriptions.forEach(desc => {
  if (desc.cfi_range) {
    rendition.annotations.highlight(
      desc.cfi_range,
      { description_id: desc.id },
      () => openDescriptionModal(desc),
      'description-highlight'
    );
  }
});
```

**Задачи:**
1. **Backend:** Обновить book parser для сохранения CFI ranges
2. **Backend:** Добавить `cfi_range` в `descriptions` таблицу
3. **Frontend:** Заменить manual DOM на `annotations.highlight()`
4. **Frontend:** Убрать текстовый поиск

**Acceptance Criteria:**
- [ ] Backend сохраняет CFI ranges
- [ ] Frontend использует Annotations API
- [ ] Highlights работают корректно
- [ ] Клики работают
- [ ] Нет manual DOM manipulation

---

### Task 3.3: Highlight Colors & Customization
**Приоритет:** ⚠️ P2
**Сложность:** 🟡 MEDIUM
**Оценка:** 8 часов
**Польза:** 🌟🌟🌟

**Файлы:**
- `src/components/Reader/ColorPicker.tsx` (новый)
- `src/hooks/epub/useUserHighlights.ts` (обновить)

**Задачи:**
1. Color picker для highlights:
   - Yellow (default)
   - Green
   - Blue
   - Pink
   - Orange
2. При клике на highlight → показать меню:
   - Change color
   - Add note
   - Remove highlight
3. Update highlight color через API

**Acceptance Criteria:**
- [ ] 5 цветов доступно
- [ ] Можно изменить цвет существующего highlight
- [ ] Color picker красивый

---

**SPRINT 3 TOTAL:**
- **Задач:** 3
- **Часов:** 48
- **Приоритет:** 2x P1, 1x P2
- **БЛОКЕРЫ:** Требует backend работы

---

## 🌍 SPRINT 4: Internationalization & RTL (2 недели)

**Цель:** Поддержка RTL языков и internationalization

### Task 4.1: RTL (Right-to-Left) Support
**Приоритет:** 🔴 P1 (для арабского, иврита)
**Сложность:** 🟡 MEDIUM
**Оценка:** 12 часов
**Польза:** 🌟🌟🌟

**Файлы:**
- `src/hooks/epub/useBookDirection.ts` (новый)
- `src/hooks/epub/useEpubLoader.ts` (обновить)

**Задачи:**
1. Определять язык книги из metadata:
   ```typescript
   const language = book.packaging.metadata.language;
   const isRTL = ['ar', 'he', 'fa', 'ur'].includes(language);
   ```
2. Установить direction:
   ```typescript
   rendition.on('rendered', () => {
     const contents = rendition.getContents()[0];
     contents.direction(isRTL ? 'rtl' : 'ltr');
   });
   ```
3. Адаптировать UI:
   - Navigation arrows flip
   - Progress bar RTL
   - TOC sidebar RTL

**API используемое:**
```typescript
contents.direction('rtl'); // или 'ltr'
```

**Acceptance Criteria:**
- [ ] Арабские книги отображаются справа-налево
- [ ] UI элементы флипнуты
- [ ] Навигация работает корректно
- [ ] Свайпы инвертированы

---

### Task 4.2: Vertical Text Support (CJK)
**Приоритет:** ⚠️ P2 (для японского, китайского)
**Сложность:** 🟡 MEDIUM
**Оценка:** 8 часов
**Польза:** 🌟🌟

**Задачи:**
1. Определять writing mode из metadata
2. Установить:
   ```typescript
   contents.writingMode('vertical-rl'); // Японский
   // или 'horizontal-tb' (default)
   ```

**Acceptance Criteria:**
- [ ] Японские книги вертикальные
- [ ] Навигация адаптирована

---

### Task 4.3: Language Detection & Auto-Config
**Приоритет:** ⚠️ P2
**Сложность:** 🟢 LOW
**Оценка:** 4 часа
**Польза:** 🌟🌟

**Задачи:**
1. Auto-detect language из book.packaging.metadata
2. Auto-configure:
   - Direction (RTL/LTR)
   - Writing mode (vertical/horizontal)
   - Font family (если нужно)

**Acceptance Criteria:**
- [ ] Автоматическая конфигурация
- [ ] Manual override возможен

---

**SPRINT 4 TOTAL:**
- **Задач:** 3
- **Часов:** 24
- **Приоритет:** 1x P1, 2x P2

---

## ⚙️ SPRINT 5: Advanced Features (2 недели)

**Цель:** Дополнительный функционал для power users

### Task 5.1: Advanced Navigation Features
**Приоритет:** ⚠️ P2
**Сложность:** 🟡 MEDIUM
**Оценка:** 12 часов
**Польза:** 🌟🌟🌟

**Подзадачи:**
1. **Jump to Page:** Input для перехода на страницу по номеру
2. **Jump to Percentage:** Слайдер для перехода на %
3. **Previous/Next Chapter:** Buttons для быстрого перехода

**Файлы:**
- `src/components/Reader/NavigationPanel.tsx` (новый)
- `src/hooks/epub/useAdvancedNavigation.ts` (новый)

**API:**
```typescript
// Jump to page
const cfi = locations.cfiFromLocation(pageNumber);
await rendition.display(cfi);

// Jump to percentage
const cfi = locations.cfiFromPercentage(0.5);
await rendition.display(cfi);

// Next/Prev chapter
const currentSection = book.spine.get(currentChapter);
const nextSection = book.spine.get(currentChapter + 1);
await rendition.display(nextSection.href);
```

**Acceptance Criteria:**
- [ ] Input "Перейти на страницу X"
- [ ] Slider для %
- [ ] Prev/Next chapter buttons

---

### Task 5.2: Bookmarks System
**Приоритет:** ⚠️ P2
**Сложность:** 🟡 MEDIUM
**Оценка:** 10 часов
**Польза:** 🌟🌟🌟🌟

**Файлы:**
- `src/hooks/epub/useBookmarks.ts` (новый)
- `src/components/Reader/BookmarksPanel.tsx` (новый)

**Задачи:**
1. Add bookmark: сохранить CFI + page title
2. View bookmarks: список в sidebar
3. Click bookmark → переход
4. Delete bookmark

**API:**
```typescript
POST /api/bookmarks {
  book_id: string,
  cfi: string,
  page_title: string,
  note?: string,
}
```

**Acceptance Criteria:**
- [ ] Можно добавить bookmark
- [ ] Список bookmarks
- [ ] Переход к bookmark
- [ ] Удаление bookmark

---

### Task 5.3: Search in Book
**Приоритет:** ⚠️ P2
**Сложность:** 🔴 HIGH
**Оценка:** 20 часов
**Польза:** 🌟🌟🌟🌟🌟

**Файлы:**
- `src/hooks/epub/useBookSearch.ts` (новый)
- `src/components/Reader/SearchPanel.tsx` (новый)

**Задачи:**
1. Search input в toolbar
2. Поиск по всей книге (через book.spine)
3. Результаты с контекстом
4. Highlight найденных слов
5. Next/Prev result navigation

**Сложность:** epub.js не имеет built-in search API
- Нужно итерировать по sections
- Load каждую section
- Search в DOM
- Сохранить CFI results

**Альтернатива:** Backend search (лучше)

**Acceptance Criteria:**
- [ ] Search input
- [ ] Поиск работает
- [ ] Результаты с контекстом
- [ ] Navigation по результатам
- [ ] Highlight текста

---

### Task 5.4: Reading Statistics
**Приоритет:** 💡 P3
**Сложность:** 🟡 MEDIUM
**Оценка:** 8 часов
**Польза:** 🌟🌟

**Задачи:**
1. Track reading time
2. Calculate reading speed (WPM)
3. Estimate time to finish
4. Show stats panel

**Acceptance Criteria:**
- [ ] Время чтения tracked
- [ ] WPM calculated
- [ ] "Осталось ~30 мин" estimate

---

**SPRINT 5 TOTAL:**
- **Задач:** 4
- **Часов:** 50
- **Приоритет:** 3x P2, 1x P3

---

## 🎨 SPRINT 6: Polish & Optimization (2 недели)

**Цель:** UI/UX polish, performance, error handling

### Task 6.1: Error Handling & Edge Cases
**Приоритет:** 🔴 P1
**Сложность:** 🟡 MEDIUM
**Оценка:** 12 часов
**Польза:** 🌟🌟🌟🌟

**Задачи:**
1. Invalid EPUB handling
2. Missing chapters handling
3. Network error retry
4. CFI parsing errors
5. Rendering errors

**Файлы:**
- `src/hooks/epub/useErrorHandling.ts` (новый)
- `src/components/Reader/ErrorBoundary.tsx` (новый)

**Acceptance Criteria:**
- [ ] Error boundaries
- [ ] User-friendly error messages
- [ ] Retry mechanisms
- [ ] Fallback UI

---

### Task 6.2: Performance Optimization
**Приоритет:** ⚠️ P2
**Сложность:** 🟡 MEDIUM
**Оценка:** 10 часов
**Польза:** 🌟🌟🌟

**Задачи:**
1. Lazy loading для images
2. `epubInitOptions.replacements: 'blobUrl'` для оптимизации
3. Virtualization для TOC (если много глав)
4. Debounce resize events
5. Memoization hooks

**Acceptance Criteria:**
- [ ] Faster initial load
- [ ] Smooth navigation
- [ ] No memory leaks

---

### Task 6.3: Accessibility (A11y)
**Приоритет:** ⚠️ P2
**Сложность:** 🟡 MEDIUM
**Оценка:** 10 часов
**Польза:** 🌟🌟🌟

**Задачи:**
1. Keyboard navigation (уже есть)
2. ARIA labels
3. Screen reader support
4. Focus management
5. High contrast mode

**Acceptance Criteria:**
- [ ] WCAG 2.1 AA compliance
- [ ] Screen reader friendly
- [ ] Keyboard accessible

---

### Task 6.4: Mobile Optimization
**Приоритет:** ⚠️ P2
**Сложность:** 🟡 MEDIUM
**Оценка:** 8 часов
**Польза:** 🌟🌟🌟🌟

**Задачи:**
1. Touch target sizes (44x44px min)
2. Prevent zoom on double-tap
3. Optimize font sizes
4. Bottom sheet для меню (mobile)
5. Fullscreen mode

**Acceptance Criteria:**
- [ ] Comfortable на телефонах
- [ ] Gestures работают отлично
- [ ] UI элементы доступны

---

### Task 6.5: Cover Image & Book List Integration
**Приоритет:** 💡 P3
**Сложность:** 🟢 LOW
**Оценка:** 6 часов
**Польза:** 🌟🌟

**Задачи:**
1. Extract cover via `book.coverUrl()`
2. Show in book list
3. Thumbnails generation
4. Cache covers

**API:**
```typescript
const coverUrl = await book.coverUrl();
```

**Acceptance Criteria:**
- [ ] Covers в списке книг
- [ ] Thumbnails
- [ ] Fallback при отсутствии

---

**SPRINT 6 TOTAL:**
- **Задач:** 5
- **Часов:** 46
- **Приоритет:** 1x P1, 3x P2, 1x P3

---

## 📋 Сводная таблица по спринтам

| Sprint | Задач | Часов | P1 | P2 | P3 | Блокеры |
|--------|-------|-------|----|----|----|---------|
| Sprint 1 | 5 | 38 | 5 | 0 | 0 | - |
| Sprint 2 | 4 | 32 | 3 | 1 | 0 | - |
| Sprint 3 | 3 | 48 | 2 | 1 | 0 | Backend CFI |
| Sprint 4 | 3 | 24 | 1 | 2 | 0 | - |
| Sprint 5 | 4 | 50 | 0 | 3 | 1 | - |
| Sprint 6 | 5 | 46 | 1 | 3 | 1 | - |
| **ИТОГО** | **24** | **238** | **12** | **10** | **2** | **1** |

**Средняя длительность спринта:** 40 часов работы
**Общая длительность:** ~6 недель full-time или 12 недель part-time

---

## 🚧 Блокеры и зависимости

### Backend Dependencies

#### БЛОКЕР: CFI Ranges для Descriptions (Sprint 3)
**Затрагивает:** Task 3.2

**Требуется:**
1. Обновить book parser для генерации CFI ranges
2. Добавить поле `cfi_range` в `descriptions` таблицу
3. Миграция БД
4. Парсинг при загрузке книги

**Файлы backend:**
- `app/services/book_parser.py` (обновить)
- `app/models/description.py` (добавить поле)
- `alembic/versions/xxx_add_cfi_range.py` (миграция)

**Альтернатива (workaround):**
- Генерировать CFI on-the-fly на фронтенде при первом хайлайте
- Сохранять обратно в БД

---

### Backend Endpoints Required

#### Highlights CRUD
```typescript
POST   /api/highlights
GET    /api/highlights?book_id=xxx
PUT    /api/highlights/:id
DELETE /api/highlights/:id
```

#### Bookmarks CRUD
```typescript
POST   /api/bookmarks
GET    /api/bookmarks?book_id=xxx
DELETE /api/bookmarks/:id
```

#### Search (опционально)
```typescript
POST /api/books/:id/search
{
  query: string,
  options?: { case_sensitive, whole_word }
}
→ Returns: { results: [{cfi, text, context}] }
```

---

## 🎯 Рекомендации по приоритизации

### Критично для MVP (Must Have)
1. ✅ TOC Sidebar (Sprint 1)
2. ✅ Text Selection (Sprint 1)
3. ✅ Page Numbers (Sprint 1)
4. ✅ Book Metadata (Sprint 1)
5. ✅ Scrolled Mode (Sprint 2)
6. ✅ User Highlights (Sprint 3)

**Оценка:** 3 спринта (6 недель)

---

### Важно для хорошего UX (Should Have)
1. ✅ Spreads (Sprint 2)
2. ✅ Font Family (Sprint 2)
3. ✅ RTL Support (Sprint 4)
4. ✅ Bookmarks (Sprint 5)
5. ✅ Advanced Navigation (Sprint 5)
6. ✅ Error Handling (Sprint 6)

**Оценка:** +3 спринта (6 недель)

---

### Nice-to-Have (Could Have)
1. Search in Book (Sprint 5)
2. Reading Stats (Sprint 5)
3. Cover Images (Sprint 6)
4. Vertical Text (Sprint 4)

**Оценка:** Backlog

---

## 📊 Распределение работы по компонентам

### Hooks (новые/обновляемые)
- `useToc.ts` ✨ NEW
- `useTextSelection.ts` ✨ NEW
- `useBookMetadata.ts` ✨ NEW
- `useResizeHandler.ts` ✨ NEW
- `useReadingMode.ts` ✨ NEW
- `useSpreadMode.ts` ✨ NEW
- `useBookDirection.ts` ✨ NEW
- `useUserHighlights.ts` ✨ NEW
- `useBookmarks.ts` ✨ NEW
- `useBookSearch.ts` ✨ NEW
- `useAdvancedNavigation.ts` ✨ NEW
- `useErrorHandling.ts` ✨ NEW
- `useEpubThemes.ts` 🔄 UPDATE
- `useEpubLoader.ts` 🔄 UPDATE
- `useCFITracking.ts` 🔄 UPDATE
- `useDescriptionHighlighting.ts` 🔄 REFACTOR

**Всего:** 12 новых, 4 обновления

---

### Components (новые/обновляемые)
- `TocSidebar.tsx` ✨ NEW
- `SelectionMenu.tsx` ✨ NEW
- `BookInfo.tsx` ✨ NEW
- `ReadingModeToggle.tsx` ✨ NEW
- `FontSelector.tsx` ✨ NEW
- `HighlightMenu.tsx` ✨ NEW
- `ColorPicker.tsx` ✨ NEW
- `NavigationPanel.tsx` ✨ NEW
- `BookmarksPanel.tsx` ✨ NEW
- `SearchPanel.tsx` ✨ NEW
- `ErrorBoundary.tsx` ✨ NEW
- `ProgressIndicator.tsx` 🔄 UPDATE
- `EpubReader.tsx` 🔄 UPDATE

**Всего:** 11 новых, 2 обновления

---

## 🧪 Testing Strategy

### Unit Tests
- Все новые hooks должны иметь тесты
- Coverage target: 80%+

### Integration Tests
- TOC navigation
- Highlights CRUD
- Mode switching
- Text selection

### E2E Tests (Playwright)
- Открыть книгу → читать → закладка → вернуться
- Создать highlight → сохранить → загрузить снова
- Поиск в книге → переход к результату
- RTL book navigation

---

## 📝 Documentation Requirements

Для каждой feature:
1. ✅ Inline code documentation (JSDoc)
2. ✅ Hook usage examples
3. ✅ Component props documentation
4. ✅ API integration guide
5. ✅ User guide update

---

## ✅ Definition of Done

Каждая задача считается завершенной когда:
- [ ] Код написан и работает
- [ ] Unit tests покрывают ≥80%
- [ ] Integration tests проходят
- [ ] Code review пройден
- [ ] Документация обновлена
- [ ] UX/UI reviewed
- [ ] Нет регрессий
- [ ] Работает на mobile
- [ ] A11y compliant

---

## 🎯 Success Metrics

### После Sprint 1-2 (MVP Enhancements)
- [ ] ✅ TOC sidebar используется 80%+ users
- [ ] ✅ Page numbers отображаются всегда
- [ ] ✅ Text selection работает
- [ ] ✅ Scrolled mode выбирают 30%+ users

### После Sprint 3 (Highlights)
- [ ] ✅ User highlights созданы 50%+ readers
- [ ] ✅ Annotations API используется корректно
- [ ] ✅ 0 manual DOM manipulation

### После Sprint 4-6 (Advanced)
- [ ] ✅ RTL books работают perfect
- [ ] ✅ Bookmarks используют 40%+ users
- [ ] ✅ Search используют 60%+ users
- [ ] ✅ Mobile experience rated 4.5/5+

---

## 🚀 Deployment Plan

### Phase 1: Sprint 1-2 (Core Features)
**Дата:** Неделя 1-4
**Deploy:** После Sprint 2

### Phase 2: Sprint 3 (Highlights)
**Дата:** Неделя 5-6
**Deploy:** После Sprint 3
**Requires:** Backend deploy (CFI ranges)

### Phase 3: Sprint 4-6 (Advanced)
**Дата:** Неделя 7-12
**Deploy:** Progressive rollout

---

**План составлен:** 26 октября 2025
**Автор:** Claude Code AI
**Статус:** ✅ READY FOR IMPLEMENTATION
