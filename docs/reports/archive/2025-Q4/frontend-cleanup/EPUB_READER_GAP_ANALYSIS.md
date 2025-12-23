# EPUB Reader - Полный анализ упущенных возможностей

> Дата анализа: 26 октября 2025
> Версия epub.js: 0.3.93
> Версия react-reader: 2.0.15

## 📊 Executive Summary

Проведен полный анализ документации epub.js и react-reader. Обнаружено **47 нереализованных функций** в следующих категориях:

- 🎯 Критичные (требуют немедленного внимания): **12**
- ⚠️ Важные (значительно улучшат UX): **18**
- 💡 Nice-to-have (дополнительные возможности): **17**

---

## 🔴 КРИТИЧНЫЕ упущенные функции (Priority 1)

### 1. **Rendition Events - Отсутствует обработка критичных событий**

#### 1.1 `rendition.on('selected')` - Text Selection
**Текущее состояние:** ❌ Не реализовано
**Важность:** 🔴 КРИТИЧНО
**Описание:** Событие при выделении текста пользователем

**Возможности:**
```typescript
rendition.on('selected', (cfiRange, contents) => {
  // cfiRange - CFI range выделенного текста
  // contents - DOM contents object
  // Можно:
  // 1. Сохранять highlights
  // 2. Копировать текст
  // 3. Добавлять заметки
  // 4. Создавать bookmarks
  // 5. Искать определения слов
});
```

**Примеры использования:**
- Выделение текста → Создание highlight
- Выделение текста → Копирование в clipboard
- Выделение текста → Добавление заметки
- Выделение текста → Поиск в словаре

**Реализация:** ~50 строк кода
**Файл:** `useTextSelection.ts` (новый hook)

---

#### 1.2 `rendition.on('markClicked')` - Annotation Click Handler
**Текущее состояние:** ❌ Не реализовано
**Важность:** 🔴 КРИТИЧНО для Highlights

**Описание:** Событие при клике на highlight/annotation

```typescript
rendition.on('markClicked', (cfiRange, data, contents) => {
  // Открыть модальное окно с highlight
  // Показать заметку пользователя
  // Удалить highlight
  // Редактировать цвет
});
```

---

#### 1.3 `rendition.on('resized')` - Responsive Handling
**Текущее состояние:** ❌ Не реализовано
**Важность:** 🔴 КРИТИЧНО для адаптивности

**Описание:** Событие при изменении размера viewport

```typescript
rendition.on('resized', ({width, height}) => {
  // Пересчитать pagination
  // Обновить UI элементы
  // Сохранить текущую позицию
});
```

**Проблема сейчас:** При изменении размера окна могут быть глюки

---

### 2. **Locations API - Неиспользованные методы**

#### 2.1 `locations.locationFromCfi(cfi)` - CFI → Location Number
**Текущее состояние:** ❌ Не используется
**Важность:** 🔴 КРИТИЧНО для навигации

**Текущий код:**
```typescript
// Мы используем только:
locations.percentageFromCfi(cfi) // 0-1
```

**Недостает:**
```typescript
locations.locationFromCfi(cfi) // Номер "страницы" в книге
locations.cfiFromLocation(42) // CFI по номеру страницы
locations.cfiFromPercentage(0.5) // CFI по процентам
```

**Польза:**
- Показывать пользователю "Страница 42 из 500"
- Переход на конкретную страницу по номеру
- "Перейти к 50% книги"

---

#### 2.2 `book.locations.total` - Общее количество "страниц"
**Текущее состояние:** ❌ Не отображается
**Важность:** 🔴 КРИТИЧНО для UX

**Текущий код:**
```typescript
// В ProgressIndicator мы показываем только:
<div>{progress}%</div>
<div>Глава {currentChapter}</div>

// НЕ показываем:
<div>Страница {currentPage} из {totalPages}</div>
```

**Исправление:**
```typescript
const totalPages = locations.total; // Доступно!
const currentPage = locations.locationFromCfi(currentCFI);
```

---

### 3. **Book API - Неиспользованные методы**

#### 3.1 `book.coverUrl()` - Cover Image
**Текущее состояние:** ❌ Не используется
**Важность:** 🔴 КРИТИЧНО для списка книг

**Доступно:**
```typescript
const coverUrl = await book.coverUrl();
// Возвращает URL обложки из EPUB
```

**Применение:**
- Показывать обложку в списке книг
- Thumbnails в библиотеке
- Preview при выборе книги

---

#### 3.2 `book.navigation.toc` - Table of Contents
**Текущее состояние:** ❌ Не отображается
**Важность:** 🔴 КРИТИЧНО для навигации

**Доступно:**
```typescript
book.navigation.toc // Массив глав с названиями и CFI
// [
//   { label: "Глава 1", href: "chapter1.xhtml", id: "..." },
//   { label: "Глава 2", href: "chapter2.xhtml", id: "..." }
// ]
```

**Применение:**
- Sidebar с оглавлением (TOC)
- Быстрый переход к главам
- Отображение текущей главы с НАЗВАНИЕМ

**Текущая проблема:**
```typescript
// Мы показываем только:
<div>Глава {currentChapter}</div>

// Должны показывать:
<div>Глава {currentChapter}: {chapterTitle}</div>
```

---

#### 3.3 `book.loaded.metadata` - Book Metadata
**Текущее состояние:** ❌ Не используется
**Важность:** 🔴 КРИТИЧНО для информации

**Доступно:**
```typescript
await book.loaded.metadata;
book.packaging.metadata.title // Название книги
book.packaging.metadata.creator // Автор
book.packaging.metadata.description // Описание
book.packaging.metadata.language // Язык
book.packaging.metadata.publisher // Издатель
book.packaging.metadata.rights // Copyright
```

**Применение:**
- Отображать автора и название в header
- Показывать метаданные в модальном окне "О книге"
- Локализация интерфейса по языку книги

---

### 4. **Rendition Options - Неиспользованные настройки**

#### 4.1 `flow: 'scrolled'` - Continuous Scroll Mode
**Текущее состояние:** ❌ Hardcoded `paginated`
**Важность:** 🔴 КРИТИЧНО - выбор пользователя

**Текущий код:**
```typescript
// useEpubLoader.ts
const newRendition = epubBook.renderTo(viewerRef.current, {
  width: '100%',
  height: '100%',
  spread: 'none', // Всегда paginated
});
```

**Должно быть:**
```typescript
const newRendition = epubBook.renderTo(viewerRef.current, {
  width: '100%',
  height: '100%',
  spread: 'none',
  flow: userPreference, // 'paginated' | 'scrolled' | 'auto'
  manager: userPreference === 'scrolled' ? 'continuous' : 'default',
});
```

**Преимущества scrolled mode:**
- Непрерывное чтение без пагинации
- Похоже на чтение веб-статьи
- Легче скроллить на мобильных
- Некоторые пользователи предпочитают

---

#### 4.2 `spread: 'auto'` - Two-Page Spreads
**Текущее состояние:** ❌ Hardcoded `'none'`
**Важность:** 🔴 КРИТИЧНО для планшетов

**Текущий код:**
```typescript
spread: 'none', // Всегда одна страница
```

**Должно быть:**
```typescript
spread: isTablet ? 'auto' : 'none',
// 'auto' - показывает 2 страницы рядом если ширина позволяет
// 'none' - всегда 1 страница
// 'both' - всегда 2 страницы
```

**Польза:**
- На планшетах/десктопе показывать 2 страницы рядом (как книга)
- Более реалистичное чтение
- Экономия места

---

#### 4.3 `stylesheet` option - Custom CSS Injection
**Текущее состояние:** ⚠️ Частично (через hooks)
**Важность:** 🟡 СРЕДНЕ

**Доступно:**
```typescript
book.renderTo(element, {
  stylesheet: '/path/to/custom.css',
});
```

**Текущая реализация:**
- Мы используем `rendition.hooks.content` для CSS
- Это работает, но `stylesheet` option проще для статических стилей

---

#### 4.4 `script` option - JavaScript Injection
**Текущее состояние:** ❌ Не используется
**Важность:** 🟢 LOW (большинству не нужно)

---

#### 4.5 `allowScriptedContent` - Interactive EPUBs
**Текущее состояние:** ❌ Не используется
**Важность:** 🟡 СРЕДНЕ для интерактивных книг

**Описание:** Некоторые EPUB содержат JavaScript (интерактивные учебники, детские книги с анимацией)

**Безопасность:** По умолчанию отключено из-за XSS рисков

---

### 5. **Annotations API - Highlights System**

#### 5.1 `rendition.annotations.add()` - Proper Highlights
**Текущее состояние:** ❌ Используем manual DOM manipulation
**Важность:** 🔴 КРИТИЧНО - архитектурная проблема

**Текущий подход (ПЛОХО):**
```typescript
// useDescriptionHighlighting.ts
const span = doc.createElement('span');
span.className = 'description-highlight';
span.style.cssText = `background-color: rgba(96, 165, 250, 0.2); ...`;
parent.insertBefore(span, node);
```

**Правильный подход (ХОРОШО):**
```typescript
rendition.annotations.highlight(
  cfiRange, // CFI диапазон текста
  {
    description_id: desc.id,
    type: desc.type,
  },
  (e) => {
    // Click handler
    onDescriptionClick(desc, image);
  },
  'description-highlight', // CSS class
  {
    'background-color': 'rgba(96, 165, 250, 0.2)',
    'border-bottom': '2px solid #60a5fa',
  }
);
```

**Проблемы текущего подхода:**
1. ❌ Manual DOM manipulation - хрупко
2. ❌ Не сохраняется при перерисовке
3. ❌ Нет интеграции с epub.js
4. ❌ Сложный поиск текста вместо CFI
5. ❌ Требует перепоиск при каждой странице

**Преимущества annotations API:**
1. ✅ Автоматическое сохранение
2. ✅ Интеграция с epub.js rendering
3. ✅ Built-in event handling
4. ✅ Поддержка CFI ranges
5. ✅ Методы remove/update

**БЛОКЕР:** Нужны CFI ranges для descriptions (бэкенд парсинг)

---

#### 5.2 `rendition.annotations.remove()` - Remove Highlights
**Текущее состояние:** ❌ Не реализовано
**Важность:** 🔴 КРИТИЧНО

**Применение:**
- Удаление highlights пользователя
- Очистка всех highlights
- Удаление при удалении заметки

---

#### 5.3 `rendition.annotations.underline()` / `.mark()`
**Текущее состояние:** ❌ Не реализовано
**Важность:** 🟡 СРЕДНЕ

**Типы annotations:**
- `highlight` - цветной фон
- `underline` - подчеркивание
- `mark` - другие пометки

---

### 6. **Navigation API - Table of Contents**

#### 6.1 `book.navigation.get(target)` - Get TOC Item
**Текущее состояние:** ❌ Не используется
**Важность:** 🔴 КРИТИЧНО

**Применение:**
```typescript
const chapter = book.navigation.get(href);
// { label: "Глава 1", href: "...", subitems: [...] }
```

---

#### 6.2 `book.navigation.landmark(type)` - Landmarks
**Текущее состояние:** ❌ Не используется
**Важность:** 🟡 СРЕДНЕ

**Landmarks:** Специальные секции EPUB
- `cover` - обложка
- `toc` - оглавление
- `bodymatter` - основной текст
- `bibliography` - библиография

**Применение:**
```typescript
const toc = book.navigation.landmark('toc');
await rendition.display(toc.href); // Перейти к оглавлению
```

---

### 7. **PageList API - Physical Page Numbers**

#### 7.1 `book.pagelist` - Print Page Numbers
**Текущее состояние:** ❌ Не используется
**Важность:** 🟡 СРЕДНЕ (для учебников)

**Описание:** Многие EPUB (особенно учебники) содержат ссылки на страницы в печатном издании

**Применение:**
```typescript
const printPage = book.pagelist.pageFromCfi(cfi);
// "Печатное издание: стр. 42"
```

---

### 8. **Themes API - Advanced Theming**

#### 8.1 `rendition.themes.select(name)` - Multiple Named Themes
**Текущее состояние:** ⚠️ Частично реализовано
**Важность:** 🟡 СРЕДНЕ

**Текущий подход:**
```typescript
// useEpubThemes.ts
rendition.themes.default(themeStyles);
// Всегда перезаписываем default theme
```

**Лучший подход:**
```typescript
// Регистрация тем
rendition.themes.register('light', lightStyles);
rendition.themes.register('dark', darkStyles);
rendition.themes.register('sepia', sepiaStyles);

// Переключение
rendition.themes.select('dark');
```

**Преимущества:**
- Не нужно перезаписывать стили каждый раз
- Быстрее переключение
- Можно сохранять кастомные темы пользователя

---

#### 8.2 `rendition.themes.fontSize(size)` - Font Size Method
**Текущее состояние:** ⚠️ Работает через default theme
**Важность:** 🟢 LOW (текущий подход OK)

**Доступно:**
```typescript
rendition.themes.fontSize('120%');
```

---

#### 8.3 `rendition.themes.font(family)` - Font Family
**Текущее состояние:** ❌ Не реализовано
**Важность:** 🟡 СРЕДНЕ

**Применение:**
```typescript
rendition.themes.font('Georgia');
rendition.themes.font('Arial');
// Пользователь выбирает шрифт
```

---

### 9. **Contents API - Advanced DOM Manipulation**

#### 9.1 `contents.viewport()` - Responsive Viewport
**Текущее состояние:** ❌ Не используется
**Важность:** 🟡 СРЕДНЕ

**Описание:** Управление meta viewport для адаптивности

---

#### 9.2 `contents.columns()` - Multi-Column Layout
**Текущее состояние:** ❌ Не используется
**Важность:** 🟢 LOW

**Описание:** Создание многоколоночного layout (газетный стиль)

---

#### 9.3 `contents.direction(dir)` - RTL Support
**Текущее состояние:** ❌ Не реализовано
**Важность:** 🔴 КРИТИЧНО для RTL языков

**Применение:**
```typescript
contents.direction('rtl'); // Для арабского, иврита
contents.direction('ltr'); // Для большинства
```

**react-reader имеет:** `isRTL` prop

---

#### 9.4 `contents.writingMode(mode)` - Vertical Text
**Текущее состояние:** ❌ Не реализовано
**Важность:** 🟡 СРЕДНЕ (для японского, китайского)

**Режимы:**
- `horizontal-tb` - горизонтальный (default)
- `vertical-rl` - вертикальный справа-налево (японский)
- `vertical-lr` - вертикальный слева-направо

---

### 10. **Spine API - Chapter Navigation**

#### 10.1 `book.spine.get(index)` - Get Section
**Текущее состояние:** ❌ Не используется напрямую
**Важность:** 🟡 СРЕДНЕ

**Применение:**
```typescript
const section = book.spine.get(5); // 6-я глава
await rendition.display(section.href);
```

---

#### 10.2 `book.spine.hooks.serialize` - Pre-render Hook
**Текущее состояние:** ❌ Не используется
**Важность:** 🟢 LOW

**Описание:** Hook перед конвертацией section в текст

---

#### 10.3 `book.spine.hooks.content` - Content Loaded Hook
**Текущее состояние:** ❌ Не используется
**Важность:** 🟢 LOW (у нас есть rendition.hooks.content)

---

### 11. **Rendition Methods - Missing Navigation**

#### 11.1 `rendition.moveTo(offset)` - Precise Positioning
**Текущее состояние:** ❌ Не используется
**Важность:** 🟡 СРЕДНЕ

**Описание:** Перемещение на точный offset (пиксели)

---

#### 11.2 `rendition.resize(width, height)` - Manual Resize
**Текущее состояние:** ❌ Не используется
**Важность:** 🟡 СРЕДНЕ

**Применение:**
```typescript
window.addEventListener('resize', () => {
  rendition.resize(window.innerWidth, window.innerHeight);
});
```

---

#### 11.3 `rendition.reportLocation()` - Force Location Update
**Текущее состояние:** ❌ Не используется
**Важность:** 🟢 LOW

---

#### 11.4 `rendition.getRange(cfi)` - Get DOM Range from CFI
**Текущее состояние:** ❌ Не используется
**Важность:** 🟡 СРЕДНЕ

**Применение:**
```typescript
const range = rendition.getRange(cfi);
// DOM Range для манипуляций
```

---

## ⚠️ ВАЖНЫЕ упущенные функции (Priority 2)

### 12. **react-reader Features - Упущенные возможности wrapper**

#### 12.1 `ReactReader` vs Custom Implementation
**Текущее состояние:** ❌ Используем кастомную реализацию
**Важность:** ⚠️ ВАЖНО - архитектурное решение

**react-reader предоставляет:**
```tsx
<ReactReader
  url={epubUrl}
  location={location}
  locationChanged={setLocation}
  tocChanged={setToc}
  getRendition={setRendition}
  showToc={true} // ← Built-in TOC sidebar!
  swipeable={true} // ← Built-in swipe!
  title="Book Title"
  epubOptions={{...}}
  epubInitOptions={{...}}
/>
```

**Мы реализовали вручную:**
- ✅ EPUB loading
- ✅ Location tracking
- ✅ Swipe gestures
- ❌ TOC sidebar (НЕТ!)
- ❌ Title display
- ⚠️ Built-in styles

**Вопрос:** Стоит ли перейти на ReactReader?

**Плюсы перехода:**
- ✅ Built-in TOC sidebar
- ✅ Built-in swipe (проще)
- ✅ Меньше кода
- ✅ Официальная поддержка

**Минусы перехода:**
- ❌ Потеря кастомизации
- ❌ Нужно переписывать hooks
- ❌ Меньше контроля над рендерингом

**Решение:** Остаться на кастомной, но добавить TOC sidebar

---

#### 12.2 `showToc` - Table of Contents Sidebar
**Текущее состояние:** ❌ НЕТ вообще!
**Важность:** 🔴 КРИТИЧНО

**react-reader TOC:**
```tsx
<ReactReader showToc={true} />
// Показывает боковую панель с оглавлением
```

**Нужно реализовать:**
- Sidebar с chapters
- Клик → переход к главе
- Highlight текущей главы
- Expand/collapse подглав

---

#### 12.3 `tocChanged` callback - TOC Data
**Текущее состояние:** ❌ Не используем
**Важность:** 🔴 КРИТИЧНО

```typescript
const [toc, setToc] = useState([]);

tocChanged={(toc) => setToc(toc)}
// toc = [
//   { label: "Chapter 1", href: "...", subitems: [...] },
//   ...
// ]
```

---

#### 12.4 `epubInitOptions` - Init Configuration
**Текущее состояние:** ❌ Не передаем
**Важность:** 🟡 СРЕДНЕ

**Доступные опции:**
```typescript
epubInitOptions={{
  openAs: 'epub', // Force file type
  requestCredentials: false,
  requestHeaders: {...},
  encoding: 'binary',
  replacements: 'blobUrl', // ← Оптимизация изображений!
}}
```

**`replacements` важно:**
- `'none'` - загружать каждый раз
- `'base64'` - встроить в CSS (тяжело)
- `'blobUrl'` - создать blob URLs (оптимально!)

---

### 13. **Manager/Flow Combinations - Reading Modes**

#### 13.1 Continuous Manager - Scrolling
**Текущее состояние:** ❌ Только Default manager
**Важность:** 🔴 КРИТИЧНО

**Default Manager:**
- Показывает одну section (главу) за раз
- Перелистывание = загрузка новой section
- Прерывания при смене главы

**Continuous Manager:**
- Предзагружает соседние sections
- Плавный scroll между главами
- Нет прерываний
- Больше memory

**Комбинации:**
```typescript
// Paginated mode (current)
{ manager: 'default', flow: 'paginated' }

// Scrolled mode (missing!)
{ manager: 'continuous', flow: 'scrolled' }

// Hybrid (experimental)
{ manager: 'continuous', flow: 'paginated' }
```

---

### 14. **EpubCFI API - Advanced CFI Operations**

#### 14.1 `new EpubCFI(cfi)` - CFI Manipulation
**Текущее состояние:** ❌ Не используем
**Важность:** 🟡 СРЕДНЕ

**Доступно:**
```typescript
const cfi = new EpubCFI(cfiString);
cfi.compare(otherCfi); // -1, 0, 1
```

---

### 15. **Resource Loading - Custom Request**

#### 15.1 `book.setRequestCredentials()` / `setRequestHeaders()`
**Текущее состояние:** ⚠️ Частично (в useEpubLoader)
**Важность:** 🟡 СРЕДНЕ

**Текущий код:**
```typescript
// useEpubLoader.ts
const response = await fetch(bookUrl, {
  headers: authToken ? {
    'Authorization': `Bearer ${authToken}`,
  } : {},
});
```

**Лучше:**
```typescript
book.setRequestCredentials(true);
book.setRequestHeaders({
  'Authorization': `Bearer ${authToken}`,
});
```

---

## 💡 Nice-to-Have функции (Priority 3)

### 16. **Archive API - Работа с ZIP**

#### 16.1 Direct EPUB Archive Loading
**Текущее состояние:** ⚠️ Используем ArrayBuffer
**Важность:** 🟢 LOW (текущий подход OK)

**Текущий:**
```typescript
const arrayBuffer = await response.arrayBuffer();
const epubBook = ePub(arrayBuffer);
```

**Альтернатива:**
```typescript
const epubBook = ePub(url); // Пусть epub.js скачает
```

---

### 17. **Queue API - Rendering Queue**

#### 17.1 `rendition.q` - Task Queue
**Текущее состояние:** ❌ Не используем
**Важность:** 🟢 LOW (автоматически)

**Описание:** epub.js внутренняя очередь задач

---

### 18. **Layout API - Advanced Layout**

#### 18.1 `layout.calculate()` - Custom Pagination
**Текущее состояние:** ❌ Не используем
**Важность:** 🟢 LOW

---

### 19. **Mapping API - Element Mapping**

#### 19.1 `new Mapping()` - Layout Mapping
**Текущее состояние:** ❌ Не используем
**Важность:** 🟢 LOW

---

### 20. **Core API - Low-Level**

#### 20.1 Various Utilities
**Текущее состояние:** ❌ Не используем
**Важность:** 🟢 LOW

---

## 📋 Категоризация по функциональности

### 🎯 Navigation & Location (10 функций)
1. ❌ `book.navigation.toc` - TOC display
2. ❌ `book.navigation.get()` - TOC items
3. ❌ `book.navigation.landmark()` - Landmarks
4. ❌ `locations.locationFromCfi()` - Page numbers
5. ❌ `locations.cfiFromLocation()` - CFI from page
6. ❌ `locations.cfiFromPercentage()` - CFI from %
7. ❌ `locations.total` - Total pages display
8. ❌ `book.pagelist` - Print page numbers
9. ❌ TOC Sidebar UI
10. ❌ `rendition.moveTo()` - Precise positioning

### 🎨 Themes & Styling (8 функций)
1. ⚠️ `rendition.themes.register()` - Named themes
2. ⚠️ `rendition.themes.select()` - Theme switching
3. ❌ `rendition.themes.font()` - Font family
4. ⚠️ `contents.direction()` - RTL support
5. ❌ `contents.writingMode()` - Vertical text
6. ❌ `stylesheet` option - CSS injection
7. ❌ `contents.viewport()` - Responsive
8. ❌ `contents.columns()` - Multi-column

### ✨ Interactions & Events (8 функций)
1. ❌ `rendition.on('selected')` - Text selection
2. ❌ `rendition.on('markClicked')` - Highlight click
3. ❌ `rendition.on('resized')` - Resize handling
4. ❌ `rendition.on('displayed')` - Page displayed
5. ❌ `rendition.annotations.*` - Proper highlights
6. ❌ User highlights CRUD
7. ❌ Copy to clipboard
8. ❌ Search in book

### 📖 Book Info & Metadata (5 функций)
1. ❌ `book.coverUrl()` - Cover image
2. ❌ `book.packaging.metadata.*` - Metadata
3. ❌ Book info modal
4. ❌ Author/title display
5. ❌ Language detection

### 🔄 Reading Modes (6 функций)
1. ❌ `flow: 'scrolled'` - Scroll mode
2. ❌ `manager: 'continuous'` - Continuous rendering
3. ❌ `spread: 'auto'` - Two-page spreads
4. ❌ Mode switcher UI
5. ❌ Preference persistence
6. ❌ `allowScriptedContent` - Interactive EPUBs

### ⚙️ Advanced Configuration (10 функций)
1. ❌ `epubInitOptions.replacements` - Image optimization
2. ❌ `epubInitOptions.openAs` - Force type
3. ❌ `book.setRequestCredentials()` - Better auth
4. ❌ `book.setRequestHeaders()` - Custom headers
5. ❌ `rendition.resize()` - Manual resize
6. ❌ `rendition.getRange()` - CFI → Range
7. ❌ `EpubCFI` API - CFI operations
8. ❌ `script` option - JS injection
9. ❌ Custom View class
10. ❌ Custom Manager class

---

## 🚨 Технические долги и проблемы

### 1. **Architecture Issues**

#### Проблема: Manual DOM Highlights
**Файл:** `useDescriptionHighlighting.ts`

**Текущий подход:**
```typescript
// Плохо: ручная манипуляция DOM
const span = doc.createElement('span');
parent.insertBefore(span, node);
```

**Правильно:**
```typescript
// Хорошо: использовать Annotations API
rendition.annotations.highlight(cfiRange, data, callback, className, styles);
```

**Проблема:**
- Хрупкость кода
- Не сохраняется при навигации
- Поиск текста вместо CFI
- Ре-хайлайтинг при каждой странице

**Решение:**
1. Бэкенд должен сохранять CFI ranges при парсинге
2. Фронтенд использует `rendition.annotations` API
3. Highlights сохраняются автоматически

---

#### Проблема: No TOC Sidebar
**Отсутствует:** Table of Contents UI

**Сейчас:**
- Нет способа увидеть список глав
- Нельзя быстро перейти к главе
- Не видно структуру книги

**Решение:**
- Создать `<TocSidebar>` компонент
- Использовать `book.navigation.toc`
- Drawer/modal с chapters
- Highlight текущей главы

---

#### Проблема: Hardcoded Paginated Mode
**Файл:** `useEpubLoader.ts`

**Сейчас:**
```typescript
// Всегда paginated
spread: 'none',
```

**Должно:**
```typescript
// User preference
spread: userSettings.spread, // 'none' | 'auto'
flow: userSettings.flow, // 'paginated' | 'scrolled'
manager: userSettings.flow === 'scrolled' ? 'continuous' : 'default',
```

---

### 2. **Missing User Preferences**

**Не сохраняем:**
1. ❌ Reading mode (paginated/scrolled)
2. ❌ Spread preference (single/double page)
3. ❌ Font family
4. ⚠️ Line height
5. ⚠️ Margins/padding
6. ❌ RTL/LTR override

**Сохраняем:**
1. ✅ Theme (light/dark/sepia)
2. ✅ Font size

---

### 3. **Missing State Management**

**Нет состояния для:**
1. ❌ Book metadata (title, author, etc.)
2. ❌ TOC data
3. ❌ Total pages
4. ❌ Current page number
5. ❌ Chapter title
6. ❌ User highlights
7. ❌ Bookmarks
8. ❌ Last read timestamp

---

### 4. **Missing Error Handling**

**Нет обработки:**
1. ❌ Invalid EPUB files
2. ❌ Missing chapters
3. ❌ Network errors при загрузке resources
4. ❌ CFI parsing errors
5. ❌ Rendering errors

---

## 📊 Сводная таблица приоритетов

| Функция | Приоритет | Сложность | Польза | Статус |
|---------|-----------|-----------|--------|--------|
| TOC Sidebar | 🔴 HIGH | MEDIUM | 🌟🌟🌟🌟🌟 | ❌ |
| Text Selection Events | 🔴 HIGH | LOW | 🌟🌟🌟🌟🌟 | ❌ |
| Annotations API | 🔴 HIGH | HIGH* | 🌟🌟🌟🌟🌟 | ❌ |
| Page Numbers Display | 🔴 HIGH | LOW | 🌟🌟🌟🌟 | ❌ |
| Book Metadata | 🔴 HIGH | LOW | 🌟🌟🌟🌟 | ❌ |
| Scrolled Mode | 🔴 HIGH | MEDIUM | 🌟🌟🌟🌟 | ❌ |
| Spreads Support | 🔴 HIGH | LOW | 🌟🌟🌟 | ❌ |
| Resize Events | 🔴 HIGH | LOW | 🌟🌟🌟🌟 | ❌ |
| RTL Support | ⚠️ MEDIUM | MEDIUM | 🌟🌟🌟 | ❌ |
| Named Themes | ⚠️ MEDIUM | LOW | 🌟🌟 | ⚠️ |
| Font Family | ⚠️ MEDIUM | LOW | 🌟🌟🌟 | ❌ |
| Cover Image | ⚠️ MEDIUM | LOW | 🌟🌟 | ❌ |
| Request Config | ⚠️ MEDIUM | LOW | 🌟🌟 | ⚠️ |

*Annotations API требует CFI ranges от бэкенда

---

## 📝 Выводы

### Что работает хорошо ✅
1. Базовая навигация (next/prev)
2. CFI position tracking
3. Progress sync
4. Theme switching (light/dark/sepia)
5. Font size controls
6. Touch gestures
7. Content hooks для стилей
8. Keyboard navigation

### Критичные пробелы 🔴
1. **Нет TOC sidebar** - пользователь не может видеть главы
2. **Нет text selection** - нельзя копировать, делать highlights
3. **Нет page numbers** - показываем только %
4. **Manual DOM highlights** - хрупкая архитектура
5. **Нет scrolled mode** - только paginated
6. **Нет book metadata UI** - не показываем автора, название

### Важные улучшения ⚠️
1. **Spreads для планшетов** - показывать 2 страницы
2. **RTL support** - для арабского, иврита
3. **Font family selection** - выбор шрифта
4. **Resize handling** - адаптивность
5. **Better theming** - named themes вместо override

### Nice-to-have 💡
1. Print page numbers (для учебников)
2. Landmarks navigation
3. Vertical text (CJK)
4. Multi-column layout
5. Interactive EPUBs

---

## 🎯 Итоговые рекомендации

### Immediate Actions (Sprint 1)
1. ✅ Добавить TOC Sidebar
2. ✅ Реализовать text selection events
3. ✅ Показывать page numbers
4. ✅ Отображать book metadata

### Short-term (Sprint 2-3)
1. ✅ Добавить scrolled mode
2. ✅ Spreads support
3. ✅ Resize events handling
4. ✅ Font family selector

### Mid-term (Sprint 4-6)
1. ✅ Migrate highlights to Annotations API (требует бэкенд)
2. ✅ User highlights CRUD
3. ✅ RTL support
4. ✅ Better error handling

### Long-term (Backlog)
1. ⏳ Interactive EPUB support
2. ⏳ Print page numbers
3. ⏳ Vertical text
4. ⏳ Advanced layout options

---

**Документ подготовлен:** 26 октября 2025
**Автор анализа:** Claude Code AI
**Источники:** epub.js v0.3.93 docs, react-reader v2.0.15 docs
**Всего упущенных функций:** 47
