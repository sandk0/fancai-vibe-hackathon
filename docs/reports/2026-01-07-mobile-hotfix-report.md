# Отчёт о hotfix мобильных проблем

**Дата:** 7 января 2026
**Автор:** Claude Code
**Статус:** ✅ Завершено

---

## Резюме

Исправлены **4 критических проблемы** мобильной версии, которые не были устранены в предыдущих P0-P3 исправлениях:

1. Горизонтальный скролл на Главной странице (все блоки)
2. Перемещение кнопки темы при открытии dropdown
3. BottomNav не прикреплён к низу экрана
4. Горизонтальный скролл на странице Админ

---

## Выполненные исправления

### 1. ✅ Горизонтальный скролл на Главной странице

**Проблема:** Блоки "Продолжить чтение", "Недавно добавленные", "Статистика чтения" вызывали горизонтальный скролл из-за слишком больших размеров карточек.

**Исправленные файлы:**

#### `frontend/src/pages/HomePage.tsx`

**Уменьшение размеров книжных карточек:**
```tsx
// Было: w-36 sm:w-44
// Стало: w-28 sm:w-36 md:w-44
```

**Уменьшение размеров статистических карточек:**
```tsx
// Было: p-4, text-2xl sm:text-3xl
// Стало: p-3 sm:p-4, text-xl sm:text-2xl md:text-3xl
// Добавлено: min-w-0 overflow-hidden, truncate
```

**Добавление overflow-x-hidden на контейнеры:**
```tsx
<div className="max-w-7xl mx-auto ... overflow-x-hidden">
```

#### `frontend/src/styles/globals.css`

**Добавлен overflow для #root:**
```css
#root {
  overflow-x: hidden;
  width: 100%;
  min-height: 100vh;
}
```

---

### 2. ✅ Перемещение кнопки темы

**Проблема:** При клике на кнопку смены темы в шапке кнопка перемещалась влево.

**Файл:** `frontend/src/components/UI/ThemeSwitcher.tsx`

**Было:**
```tsx
className={cn(
  "flex items-center justify-center gap-2 rounded-lg transition-colors touch-target",
  "min-h-[44px] min-w-[44px] px-3 sm:px-3",
  ...
)}
```

**Стало:**
```tsx
className={cn(
  "flex items-center justify-center gap-2 rounded-lg transition-colors touch-target shrink-0",
  "h-[44px] min-w-[44px] px-3 sm:px-3",
  ...
)}
// + whitespace-nowrap на текст
```

**Изменения:**
- Добавлено `shrink-0` — предотвращает сжатие кнопки
- Изменено `min-h-[44px]` на `h-[44px]` — фиксированная высота
- Добавлено `whitespace-nowrap` на текст — предотвращает перенос

**Также в Header.tsx:**
```tsx
// Добавлено shrink-0 на правую секцию
<div className="flex items-center gap-2 sm:gap-3 shrink-0">
```

---

### 3. ✅ BottomNav не прикреплён к низу

**Проблема:** Нижняя навигация не была зафиксирована внизу экрана, требовалось долистать.

**Причина:** `overflow-x: hidden` на body ломает `position: fixed` на iOS.

**Файл:** `frontend/src/components/Navigation/BottomNav.tsx`

**Было:**
```tsx
className="fixed bottom-0 left-0 right-0 z-[300] md:hidden"
```

**Стало:**
```tsx
className="fixed bottom-0 inset-x-0 z-[500] md:hidden"
style={{ position: 'fixed' }}
```

**Изменения:**
- Увеличен z-index: 300 → 500 (выше модалок)
- Добавлен inline style для гарантии
- Использован `inset-x-0` вместо `left-0 right-0`

**Также в Layout.tsx:**
```tsx
// Добавлен overflow-x-clip вместо overflow-x-hidden
<div className="min-h-screen ... overflow-x-clip">
```

**В globals.css:**
```css
/* Убран overflow-x: hidden с body (ломает fixed на iOS) */
/* Добавлен overflow-x: hidden на #root */
```

---

### 4. ✅ Горизонтальный скролл на Админ

**Проблема:** Табы и контент не адаптированы для мобильных.

**Файл:** `frontend/src/components/Admin/AdminTabNavigation.tsx`

**Было:**
```tsx
<div className="mb-6 sm:mb-8 border-b border-border overflow-hidden">
  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
    <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max">
```

**Стало:**
```tsx
<div className="mb-6 sm:mb-8 border-b border-border overflow-x-clip">
  <div className="overflow-x-auto pb-px scrollbar-hide">
    <nav className="-mb-px flex space-x-2 sm:space-x-4 md:space-x-6">
```

**Изменения:**
- Убран `-mx-4 px-4` паттерн (вызывает overflow)
- Использован `overflow-x-clip` вместо `overflow-hidden`
- Уменьшены отступы между табами: `space-x-2 sm:space-x-4 md:space-x-6`

---

## Верификация

```bash
npm run build
# ✓ built in 4.19s — без ошибок
```

---

## Технические детали

### Почему overflow-x-hidden ломает fixed

На iOS Safari, если html или body имеют `overflow-x: hidden`, это создаёт новый контейнер для позиционирования, и `position: fixed` работает относительно этого контейнера, а не viewport.

**Решение:** Переместить `overflow-x: hidden` на #root и использовать `overflow-x: clip` на Layout.

### overflow-x: clip vs hidden

- `overflow: hidden` создаёт scroll container, который может ломать fixed
- `overflow: clip` просто обрезает контент без побочных эффектов

---

## Итоговое состояние

| Компонент | Проблема | Решение | Статус |
|-----------|----------|---------|--------|
| HomePage | Горизонтальный скролл | Уменьшены размеры, overflow-x-hidden | ✅ |
| ThemeSwitcher | Кнопка перемещается | shrink-0, h-[44px], whitespace-nowrap | ✅ |
| BottomNav | Не fixed | z-[500], inline style, overflow-x-clip | ✅ |
| AdminTabNavigation | Горизонтальный скролл | Убран -mx-4, overflow-x-clip | ✅ |

---

## Файлы изменены

| Файл | Изменения |
|------|-----------|
| `globals.css` | #root overflow-x, убран overflow с body |
| `HomePage.tsx` | Размеры карточек, overflow-x-hidden |
| `ThemeSwitcher.tsx` | shrink-0, h-[44px] |
| `Header.tsx` | shrink-0 на правую секцию |
| `BottomNav.tsx` | z-[500], inline style |
| `Layout.tsx` | overflow-x-clip |
| `AdminTabNavigation.tsx` | overflow-x-clip, уменьшены отступы |
