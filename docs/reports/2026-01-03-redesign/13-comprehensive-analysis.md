# Комплексный анализ Frontend - Отчёт

**Дата:** 3 января 2026
**Статус:** ВСЕ ФАЗЫ ЗАВЕРШЕНЫ ✅ (24 задачи)

---

## Резюме

Проведён глубокий анализ всего frontend приложения fancai по 7 направлениям. Выявлено **150+ проблем** различной критичности.

### Общая оценка по категориям

| Категория | Оценка | Критических | Важных | Средних |
|-----------|--------|-------------|--------|---------|
| Mobile UX | 7.5/10 | 5 | 9 | 10+ |
| Design System | 6/10 | 4 | 25+ | 100+ |
| Components Consistency | 6.5/10 | 3 | 8 | 15+ |
| Layout & Navigation | 6/10 | 9 | 8 | 6 |
| Reader Components | 7/10 | 10 | 10 | 12 |
| Accessibility | 6/10 | 15 | 10+ | - |
| Performance | 7/10 | 3 | 10 | - |
| Forms & Inputs | 7/10 | 6 | 8 | 10 |

---

## I. КРИТИЧЕСКИЕ ПРОБЛЕМЫ (P0)

### 1. z-index хаос

**Проблема:** ~15 компонентов конкурируют за z-index: 50

| Компонент | z-index | Конфликт |
|-----------|---------|----------|
| Header | 50 | Перекрывается modals |
| Sidebar | 50 | Перекрывается alerts |
| MobileDrawer overlay | 50 | Конфликт с Header |
| ToastContainer | 50 | Перекрывается drawer |
| AlertDialog overlay | 50 | Конфликт со всеми |
| BookUploadModal | 50 | Не виден toast |

**Рекомендация:** Создать z-index scale:
```css
--z-dropdown: 100;
--z-sticky: 200;
--z-fixed: 300;
--z-modal-backdrop: 400;
--z-modal: 500;
--z-popover: 600;
--z-tooltip: 700;
--z-toast: 800;
```

---

### 2. Reader: useTouchNavigation отключен

**Файл:** `EpubReader.tsx:259-264`

**Проблема:** Swipe navigation полностью отключена (`enabled: false`), но код загружается. Пользователи на mobile не могут свайпать для навигации страниц.

**Влияние:** Критическое для mobile UX

**Рекомендация:** Либо включить с proper debounce, либо удалить код полностью.

---

### 3. Три разные системы CSS переменных

**Проблема:** Параллельно используются три подхода:
1. HSL переменные shadcn (`--primary: 24 95% 53%`)
2. HEX переменные legacy (`--color-primary-500: #f97316`)
3. Hardcoded значения в компонентах

**Файлы с hardcoded цветами:**
- `ErrorBoundary.tsx` - 10+ hardcoded HEX
- `ReaderSettings.tsx` - 5+ hardcoded HEX
- `LibraryStats.tsx` - 3 hardcoded RGB
- `BookReader.tsx` - 10+ hardcoded RGBA
- `HomePage.tsx` - hardcoded градиенты

**Рекомендация:** Унифицировать на HSL систему shadcn/ui.

---

### 4. Desktop Sidebar перекрывает Header

**Файл:** `Sidebar.tsx:151`

**Проблема:** Sidebar имеет `top-0` вместо `top-16` (высота header). На desktop sidebar залезает под header.

**Рекомендация:**
```tsx
className="top-16 h-[calc(100vh-4rem)]"
```

---

### 5. BottomNav не интегрирован

**Файл:** `BottomNav.tsx`

**Проблема:** Компонент существует с хорошей реализацией (56px высота, touch targets), но НЕ используется ни в одном layout.

**Рекомендация:** Интегрировать в Layout.tsx для mobile или удалить.

---

### 6. Modals без focus trap

**Файлы:**
- `BookUploadModal.tsx`
- `ImageModal.tsx`
- `DeleteConfirmModal.tsx`

**Проблема:** Пользователь может Tab-ом выйти за пределы modal. Focus не возвращается на trigger при закрытии.

**WCAG:** 2.4.3 Focus Order (A)

---

### 7. Отсутствует skip-link

**Файл:** `App.tsx` / `Layout.tsx`

**Проблема:** Нет skip-link для перехода к основному контенту.

**WCAG:** 2.4.1 Bypass Blocks (A)

---

### 8. epubjs не lazy-loaded

**Файл:** `vite.config.ts`

**Проблема:** epubjs (~300KB) загружается на всех страницах, хотя нужен только в Reader.

**Влияние:** +300KB к initial bundle для всех пользователей.

---

### 9. ImageModal: Zoom без pan

**Файл:** `ImageModal.tsx:296-299`

**Проблема:** Zoom реализован через CSS scale без возможности перемещения. Пользователь не может рассмотреть детали увеличенного изображения.

---

### 10. 100+ использований gray-* вместо semantic

**Проблема:** Вместо semantic классов (`text-foreground`, `bg-muted`) используются hardcoded gray-*:

| Файл | Нарушений |
|------|-----------|
| HomePageOld.tsx | 25+ |
| BookPageOld.tsx | 20+ |
| ReaderSettings.tsx | 15+ |
| AdminParsingSettings.tsx | 12+ |
| ImageModal.tsx | 10+ |

---

## II. ВАЖНЫЕ ПРОБЛЕМЫ (P1)

### Mobile UX

| # | Проблема | Файл |
|---|----------|------|
| 1 | Touch targets < 44px в PositionConflictDialog кнопках | PositionConflictDialog.tsx |
| 2 | Input zoom на iOS (font-size < 16px) в ImagesGalleryPage | ImagesGalleryPage.tsx |
| 3 | Select элементы без min-height 44px | ImagesGalleryPage.tsx |
| 4 | Close button p-2 (~32px) в BookUploadModal | BookUploadModal.tsx |
| 5 | Delete file button p-1 (~24px) | BookUploadModal.tsx |
| 6 | Header mobile menu button 40px (< 44px) | Header.tsx |
| 7 | User avatar button 32-36px | Header.tsx |
| 8 | Нет swipe-to-close в MobileDrawer | MobileDrawer.tsx |

### Design System

| # | Проблема | Файл |
|---|----------|------|
| 1 | tailwind.config ссылается на несуществующие CSS vars | tailwind.config.js |
| 2 | Несогласованные border-radius (lg/xl/2xl/3xl) | Глобально |
| 3 | Разные transition durations (200/300/500ms) | Глобально |
| 4 | Legacy компоненты (*Old.tsx) с устаревшими стилями | 5 файлов |
| 5 | Hardcoded inline styles в ErrorBoundary | ErrorBoundary.tsx |
| 6 | Inline CSS через dangerouslySetInnerHTML | ReaderSettings.tsx |

### Layout & Navigation

| # | Проблема | Файл |
|---|----------|------|
| 1 | Header/Content padding рассинхронизация (h-14 vs pt-16) | Layout.tsx, Header.tsx |
| 2 | Дублирование backdrop overlays в Layout и Sidebar | Layout.tsx, Sidebar.tsx |
| 3 | Sidebar open state не синхронизирован с URL | Sidebar.tsx |
| 4 | MobileDrawer без aria-modal | MobileDrawer.tsx |

### Reader

| # | Проблема | Файл |
|---|----------|------|
| 1 | Tap zones z-index conflict с iframe highlights | EpubReader.tsx |
| 2 | 4 темы в Settings vs 3 в useEpubThemes | ReaderSettingsPanel.tsx |
| 3 | DEBUG console.log в production | EpubReader.tsx |
| 4 | Retry loop без exponential backoff | useChapterManagement.ts |
| 5 | ProgressSaveIndicator hardcoded dark bg | ProgressSaveIndicator.tsx |
| 6 | BookReader vs EpubReader дублирование логики | Оба файла |

### Accessibility

| # | Проблема | WCAG |
|---|----------|------|
| 1 | BookUploadModal без role="dialog" | 4.1.2 |
| 2 | BookCard div без keyboard handlers | 2.1.1 |
| 3 | LoginPage form без aria-live errors | 4.1.3 |
| 4 | Images без proper alt text | 1.1.1 |
| 5 | TocSidebar без role="navigation" | 1.3.1 |
| 6 | HomePage skeleton без aria-busy | 4.1.3 |
| 7 | Input required без aria-required | 3.3.2 |

### Forms

| # | Проблема | Файл |
|---|----------|------|
| 1 | Library search без debounce | LibrarySearch.tsx |
| 2 | Number inputs без валидации (NaN) | AdminParsingSettings.tsx |
| 3 | Не используется Button компонент | BookUploadModal.tsx |
| 4 | Не используется Select компонент | ReaderSettings.tsx |
| 5 | View mode buttons без aria-pressed | LibrarySearch.tsx |

### Performance

| # | Проблема | Влияние |
|---|----------|---------|
| 1 | framer-motion (~80KB) на всех страницах | High |
| 2 | O(n*m) поиск в useDescriptionHighlighting | 100ms+ |
| 3 | Google Fonts через @import (render-blocking) | Medium |
| 4 | AuthenticatedImage без кеширования между renders | Medium |
| 5 | searchPatternsCache без лимита (memory leak) | Medium |

---

## III. СРЕДНИЕ ПРОБЛЕМЫ (P2)

### Консистентность компонентов

| Категория | Расхождение |
|-----------|-------------|
| **Buttons** | padding py-2 vs py-2.5 vs py-3 |
| **Cards** | rounded-lg vs rounded-xl vs rounded-2xl |
| **Inputs** | border-gray-300 vs border-input vs border-border |
| **Modals** | Разные backdrop opacity (50% vs 80%) |
| **Loading** | Spinner vs Skeleton несогласованно |

### Дублирование компонентов

| Компонент A | Компонент B |
|-------------|-------------|
| DeleteConfirmModal.tsx | AlertDialog (shadcn) |
| ReaderSettings.tsx | ReaderSettingsPanel.tsx |
| BookReader.tsx | EpubReader.tsx |
| Modal.tsx | Dialog (shadcn) |

---

## IV. LEGACY КОД ДЛЯ УДАЛЕНИЯ

| Файл | Причина |
|------|---------|
| HomePageOld.tsx | Заменён на HomePage.tsx |
| BookPageOld.tsx | Заменён на BookPage.tsx |
| LoginPageOld.tsx | Заменён на LoginPage.tsx |
| RegisterPageOld.tsx | Заменён на RegisterPage.tsx |
| NotFoundPageOld.tsx | Заменён на NotFoundPage.tsx |
| ProfilePage.tsx | Возможно дублирует SettingsPage |

---

## V. МЕТРИКИ

### Текущие оценочные значения

| Метрика | Значение | Цель |
|---------|----------|------|
| Touch targets ≥44px | 85% | 100% |
| Safe area coverage | 90% | 100% |
| Responsive consistency | 95% | 100% |
| Font-size ≥16px (inputs) | 80% | 100% |
| Touch feedback | 60% | 90% |
| WCAG AA Compliance | 70% | 100% |
| Semantic colors usage | 40% | 95% |
| Initial JS Bundle | ~450KB | <300KB |
| LCP | ~2.5s | <2.5s |

---

## VI. ПОЗИТИВНЫЕ АСПЕКТЫ

### Хорошо реализовано:

1. **MobileDrawer** - focus trap, ESC key, aria-modal, body scroll lock
2. **LoadingSpinner** - role="status", aria-label
3. **OfflineBanner** - aria-live="polite"
4. **prefers-reduced-motion** - поддержка в globals.css
5. **Code splitting** - heavy pages lazy-loaded
6. **Vite manualChunks** - vendor chunks отделены
7. **AuthenticatedImage** - memo(), blob cleanup, lazy loading
8. **Button/Input/Checkbox UI** - полноценные accessible компоненты
9. **Login/Register forms** - react-hook-form + zod валидация
10. **ReaderSettingsPanel** - touch-friendly, drag-to-dismiss

---

## Прогресс исправлений

| Фаза | Статус | Задач |
|------|--------|-------|
| Фаза 1: Критические (P0) | ✅ Завершена | 7/7 |
| Фаза 2: Mobile UX (P1) | ✅ Завершена | 4/4 |
| Фаза 3: Design System (P1) | ✅ Завершена | 4/4 |
| Фаза 4: Accessibility (P1) | ✅ Завершена | 5/5 |
| Фаза 5: Performance (P2) | ✅ Завершена | 4/4 |

---

## Связанные документы

- [14-frontend-action-plan.md](./14-frontend-action-plan.md) - План исправлений
- [15-phase1-completion.md](./15-phase1-completion.md) - Отчёт Фазы 1
- [16-phase2-completion.md](./16-phase2-completion.md) - Отчёт Фазы 2
- [17-phase3-completion.md](./17-phase3-completion.md) - Отчёт Фазы 3
- [18-phase4-completion.md](./18-phase4-completion.md) - Отчёт Фазы 4
- [19-phase5-completion.md](./19-phase5-completion.md) - Отчёт Фазы 5
