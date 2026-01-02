# Пробелы в поддержке темы Sepia

**Дата:** 2 января 2026
**Критичность:** ВЫСОКАЯ
**Статус:** Требует доработки

---

## Обзор

Тема sepia была добавлена для комфортного чтения, но многие компоненты UI не адаптированы под неё. Компоненты используют только `dark:` варианты Tailwind без `sepia:` классов.

---

## Архитектура тем

### Текущая реализация

**Файл:** `frontend/src/styles/globals.css`

```css
:root {
  /* Light theme (default) */
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  /* ... */
}

.sepia {
  --background: 39 100% 97%;
  --foreground: 30 10% 20%;
  --card: 39 80% 95%;
  /* ... */
}
```

### Проблема

Многие компоненты используют паттерн:
```tsx
className="bg-white dark:bg-gray-800"
```

Этот код **не учитывает sepia**. В результате sepia-тема получает светлые стили вместо тёплых оттенков.

---

## Затронутые компоненты

### 1. Sidebar.tsx

**Проблема:** Использует `dark:` без `sepia:` вариантов

```tsx
// Текущий код
<aside className="bg-white dark:bg-gray-900 border-r dark:border-gray-700">
  <nav className="text-gray-600 dark:text-gray-300">
```

**Требуется:**
```tsx
<aside className="bg-card border-r border-border">
  <nav className="text-foreground">
```

### 2. NotificationContainer.tsx

**Проблема:** Хардкоженные цвета для success/error/warning

```tsx
// Текущий код
const variants = {
  success: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100',
  error: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100',
  warning: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100',
};
```

**Проблема:** В sepia теме зелёный/красный/жёлтый выглядят резко.

### 3. ErrorBoundary.tsx

**Проблема:** Только `dark:` варианты

```tsx
<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
```

### 4. Navbar.tsx

**Проблема:** Частичная поддержка

```tsx
<header className="bg-white dark:bg-gray-800 shadow">
  // Нет sepia адаптации
```

### 5. BookCard.tsx

**Проблема:** Hover эффекты не адаптированы

```tsx
<div className="hover:bg-gray-50 dark:hover:bg-gray-700">
  // Sepia должен быть hover:bg-amber-50/50
```

### 6. Modal.tsx / Dialog.tsx

**Проблема:** Backdrop и контент не адаптированы

```tsx
<div className="bg-black/50">  // Backdrop
  <div className="bg-white dark:bg-gray-800">  // Content
```

### 7. Dropdown.tsx

**Проблема:** Меню не имеет sepia стилей

```tsx
<div className="bg-white dark:bg-gray-700 shadow-lg">
```

### 8. Tooltip.tsx

**Проблема:** Фиксированные цвета

```tsx
<div className="bg-gray-900 text-white">
```

---

## Подсветки описаний (Description Highlights)

### Файл: `useDescriptionHighlighting.ts`

**Проблема:** Хардкоженные синие цвета

```typescript
const highlightStyle = {
  backgroundColor: 'rgba(59, 130, 246, 0.3)',  // Blue-500
  border: '2px solid rgba(59, 130, 246, 0.6)',
  borderRadius: '4px',
  cursor: 'pointer',
};
```

**В sepia теме:** Синяя подсветка выглядит неестественно на тёплом фоне.

**Рекомендация:** Использовать CSS-переменные или адаптивные цвета:

```typescript
// Вариант 1: CSS-переменные
const highlightStyle = {
  backgroundColor: 'hsl(var(--highlight-bg))',
  border: '2px solid hsl(var(--highlight-border))',
};

// В globals.css
:root { --highlight-bg: 217 91% 60% / 0.3; }
.sepia { --highlight-bg: 36 80% 50% / 0.3; }  // Amber для sepia
```

---

## Список всех компонентов без sepia

| Компонент | Файл | Приоритет |
|-----------|------|-----------|
| Sidebar | `src/components/Layout/Sidebar.tsx` | Высокий |
| Navbar | `src/components/Layout/Navbar.tsx` | Высокий |
| NotificationContainer | `src/components/UI/NotificationContainer.tsx` | Средний |
| ErrorBoundary | `src/components/UI/ErrorBoundary.tsx` | Средний |
| Modal | `src/components/UI/Modal.tsx` | Высокий |
| Dialog | `src/components/UI/Dialog.tsx` | Высокий |
| Dropdown | `src/components/UI/Dropdown.tsx` | Средний |
| Tooltip | `src/components/UI/Tooltip.tsx` | Низкий |
| BookCard | `src/components/Books/BookCard.tsx` | Высокий |
| BookGrid | `src/components/Library/BookGrid.tsx` | Средний |
| ReaderControls | `src/components/Reader/ReaderControls.tsx` | Высокий |
| SettingsPanel | `src/components/Reader/SettingsPanel.tsx` | Средний |
| ChapterList | `src/components/Reader/ChapterList.tsx` | Средний |
| Description Highlights | `src/hooks/epub/useDescriptionHighlighting.ts` | Средний |

---

## Рекомендации по исправлению

### Стратегия 1: CSS-переменные везде (Рекомендуется)

Заменить все `bg-white dark:bg-gray-800` на семантические классы:

```tsx
// До
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">

// После
<div className="bg-card text-card-foreground">
```

**Плюсы:**
- Автоматическая поддержка всех тем
- Один источник правды (globals.css)
- Легко добавлять новые темы

### Стратегия 2: Добавить sepia: варианты

Tailwind поддерживает кастомные варианты:

```javascript
// tailwind.config.js
plugins: [
  plugin(function({ addVariant }) {
    addVariant('sepia', '.sepia &')
  })
]
```

Затем:
```tsx
<div className="bg-white dark:bg-gray-800 sepia:bg-amber-50">
```

**Плюсы:**
- Минимальные изменения в архитектуре
- Явный контроль над каждым компонентом

**Минусы:**
- Много мест для изменения
- Дублирование стилей

### Стратегия 3: Гибридный подход

1. Для layout компонентов (Sidebar, Navbar, Modal) - CSS-переменные
2. Для UI компонентов (Button, Input) - уже используют CSS-переменные
3. Для специфичных компонентов (BookCard hover) - sepia: варианты

---

## CSS-переменные для sepia (добавить в globals.css)

```css
.sepia {
  /* Backgrounds */
  --background: 39 100% 97%;        /* Warm white */
  --foreground: 30 10% 20%;         /* Dark brown */
  --card: 39 80% 95%;               /* Slightly darker */
  --card-foreground: 30 10% 20%;
  --popover: 39 80% 95%;
  --popover-foreground: 30 10% 20%;

  /* Borders */
  --border: 30 20% 85%;             /* Warm gray */
  --input: 30 20% 85%;
  --ring: 36 60% 50%;               /* Amber focus */

  /* Primary (warm variant) */
  --primary: 36 60% 45%;            /* Warm amber */
  --primary-foreground: 39 100% 97%;

  /* Semantic colors */
  --muted: 30 20% 90%;
  --muted-foreground: 30 10% 40%;
  --accent: 36 50% 88%;
  --accent-foreground: 30 10% 20%;

  /* Highlights (for descriptions) */
  --highlight-bg: 36 80% 50% / 0.25;
  --highlight-border: 36 80% 50% / 0.5;
  --highlight-active: 36 80% 50% / 0.4;
}
```

---

## Приоритет исправлений

1. **P0 (Критично):** Modal, Dialog - используются для загрузки книг
2. **P1 (Высокий):** Sidebar, Navbar - видны постоянно
3. **P2 (Средний):** BookCard, ReaderControls - основной UX
4. **P3 (Низкий):** Tooltip, Dropdown - редко используются
