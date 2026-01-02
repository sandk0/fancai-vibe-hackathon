# План исправления проблем с темами

**Дата:** 2 января 2026
**Версия:** 1.0
**Автор:** Claude Code

---

## Краткое содержание

| Фаза | Описание | Файлов | Сложность |
|------|----------|--------|-----------|
| Фаза 0 | Hotfix кнопки загрузки | 1 | Низкая |
| Фаза 1 | CSS-переменные для primary | 2 | Средняя |
| Фаза 2 | Миграция компонентов на CSS-переменные | ~15 | Высокая |
| Фаза 3 | Адаптация подсветок описаний | 2 | Средняя |
| Фаза 4 | Тестирование и QA | - | - |

---

## Фаза 0: Hotfix (Немедленно)

### Задача: Исправить невидимую кнопку "Выбрать файлы"

**Файл:** `frontend/src/components/Books/BookUploadModal.tsx`

**Изменение:**
```tsx
// Строки 314-320
// До:
<label
  htmlFor="file-upload"
  className="cursor-pointer bg-primary-600 text-white
             hover:bg-primary-700 px-4 py-2 rounded-lg
             transition-colors duration-200"
>

// После:
<label
  htmlFor="file-upload"
  className="cursor-pointer bg-primary text-primary-foreground
             hover:opacity-90 px-4 py-2 rounded-lg
             transition-colors duration-200"
>
```

**Статус:** Готово к применению

---

## Фаза 1: CSS-переменные для Primary Colors

### Задача 1.1: Обновить tailwind.config.js

**Файл:** `frontend/tailwind.config.js`

```javascript
// Добавить в colors.primary:
primary: {
  DEFAULT: "hsl(var(--primary))",
  foreground: "hsl(var(--primary-foreground))",
  50: "hsl(var(--primary-50))",
  100: "hsl(var(--primary-100))",
  200: "hsl(var(--primary-200))",
  300: "hsl(var(--primary-300))",
  400: "hsl(var(--primary-400))",
  500: "hsl(var(--primary-500))",
  600: "hsl(var(--primary-600))",
  700: "hsl(var(--primary-700))",
  800: "hsl(var(--primary-800))",
  900: "hsl(var(--primary-900))",
  950: "hsl(var(--primary-950))",
},
```

### Задача 1.2: Добавить CSS-переменные в globals.css

**Файл:** `frontend/src/styles/globals.css`

```css
:root {
  /* Существующие */
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;

  /* Новые нумерованные варианты (Blue palette) */
  --primary-50: 214 100% 97%;
  --primary-100: 214 95% 93%;
  --primary-200: 213 97% 87%;
  --primary-300: 212 96% 78%;
  --primary-400: 213 94% 68%;
  --primary-500: 217 91% 60%;
  --primary-600: 221.2 83.2% 53.3%;
  --primary-700: 224 76% 48%;
  --primary-800: 226 71% 40%;
  --primary-900: 224 64% 33%;
  --primary-950: 226 57% 21%;
}

.dark {
  /* Dark theme primary variants */
  --primary-50: 222 47% 95%;
  --primary-100: 222 47% 90%;
  --primary-200: 222 47% 80%;
  --primary-300: 222 47% 70%;
  --primary-400: 222 47% 60%;
  --primary-500: 217 91% 60%;
  --primary-600: 221.2 83.2% 53.3%;
  --primary-700: 224 70% 58%;
  --primary-800: 226 65% 65%;
  --primary-900: 224 60% 75%;
  --primary-950: 226 55% 85%;
}

.sepia {
  /* Sepia theme primary variants (Amber palette) */
  --primary: 36 60% 45%;
  --primary-foreground: 39 100% 97%;
  --primary-50: 36 100% 97%;
  --primary-100: 36 95% 93%;
  --primary-200: 36 90% 85%;
  --primary-300: 36 85% 75%;
  --primary-400: 36 80% 60%;
  --primary-500: 36 70% 50%;
  --primary-600: 36 60% 45%;
  --primary-700: 36 55% 38%;
  --primary-800: 36 50% 30%;
  --primary-900: 36 45% 22%;
  --primary-950: 36 40% 15%;
}
```

---

## Фаза 2: Миграция компонентов на CSS-переменные

### Задача 2.1: Layout компоненты

| Компонент | Файл | Изменения |
|-----------|------|-----------|
| Sidebar | `Layout/Sidebar.tsx` | `bg-white dark:bg-gray-900` → `bg-card` |
| Navbar | `Layout/Navbar.tsx` | `bg-white dark:bg-gray-800` → `bg-card` |
| Footer | `Layout/Footer.tsx` | Аналогично |

**Пример изменения Sidebar:**
```tsx
// До
<aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">

// После
<aside className="w-64 bg-card border-r border-border">
```

### Задача 2.2: Modal/Dialog компоненты

| Компонент | Файл | Изменения |
|-----------|------|-----------|
| Modal | `UI/Modal.tsx` | Backdrop + Content |
| Dialog | `UI/Dialog.tsx` | Backdrop + Content |

**Пример изменения Modal:**
```tsx
// До
<div className="fixed inset-0 bg-black/50">
  <div className="bg-white dark:bg-gray-800 rounded-lg">

// После
<div className="fixed inset-0 bg-background/80 backdrop-blur-sm">
  <div className="bg-card rounded-lg border border-border">
```

### Задача 2.3: Notification компоненты

**Файл:** `UI/NotificationContainer.tsx`

```tsx
// Добавить sepia-адаптированные варианты
const variants = {
  success: 'bg-green-100 dark:bg-green-900/30 sepia:bg-green-100/80 text-green-800 dark:text-green-100',
  error: 'bg-red-100 dark:bg-red-900/30 sepia:bg-red-100/80 text-red-800 dark:text-red-100',
  warning: 'bg-yellow-100 dark:bg-yellow-900/30 sepia:bg-yellow-100/80 text-yellow-800 dark:text-yellow-100',
  info: 'bg-blue-100 dark:bg-blue-900/30 sepia:bg-amber-100/80 text-blue-800 dark:text-blue-100 sepia:text-amber-800',
};
```

### Задача 2.4: Book компоненты

| Компонент | Файл | Изменения |
|-----------|------|-----------|
| BookCard | `Books/BookCard.tsx` | Hover states |
| BookGrid | `Library/BookGrid.tsx` | Container styles |
| BookUploadModal | `Books/BookUploadModal.tsx` | Полная ревизия |

### Задача 2.5: Reader компоненты

| Компонент | Файл | Изменения |
|-----------|------|-----------|
| ReaderControls | `Reader/ReaderControls.tsx` | Toolbar styles |
| SettingsPanel | `Reader/SettingsPanel.tsx` | Panel background |
| ChapterList | `Reader/ChapterList.tsx` | List items |

---

## Фаза 3: Адаптация подсветок описаний

### Задача 3.1: Добавить CSS-переменные для highlights

**Файл:** `frontend/src/styles/globals.css`

```css
:root {
  /* Highlight colors (Blue) */
  --highlight-bg: 217 91% 60% / 0.25;
  --highlight-border: 217 91% 60% / 0.5;
  --highlight-active: 217 91% 60% / 0.4;
}

.dark {
  /* Highlight colors (Blue, lighter for dark bg) */
  --highlight-bg: 217 91% 60% / 0.3;
  --highlight-border: 217 91% 60% / 0.6;
  --highlight-active: 217 91% 60% / 0.5;
}

.sepia {
  /* Highlight colors (Amber for sepia) */
  --highlight-bg: 36 80% 50% / 0.25;
  --highlight-border: 36 80% 50% / 0.5;
  --highlight-active: 36 80% 50% / 0.4;
}
```

### Задача 3.2: Обновить useDescriptionHighlighting.ts

**Файл:** `frontend/src/hooks/epub/useDescriptionHighlighting.ts`

```typescript
// До
const highlightStyle = {
  backgroundColor: 'rgba(59, 130, 246, 0.3)',
  border: '2px solid rgba(59, 130, 246, 0.6)',
};

// После
const highlightStyle = {
  backgroundColor: 'hsl(var(--highlight-bg))',
  border: '2px solid hsl(var(--highlight-border))',
};
```

**Примечание:** Для inline styles в JavaScript нужно получить computed value CSS-переменной:

```typescript
const getHighlightColor = () => {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  return {
    bg: style.getPropertyValue('--highlight-bg').trim(),
    border: style.getPropertyValue('--highlight-border').trim(),
  };
};
```

---

## Фаза 4: Тестирование и QA

### Чек-лист тестирования

#### Светлая тема
- [ ] Кнопка "Выбрать файлы" видна и кликабельна
- [ ] Все кнопки имеют контраст
- [ ] Модальные окна читаемы
- [ ] Навигация видна

#### Тёмная тема
- [ ] Фоны достаточно тёмные
- [ ] Текст контрастный
- [ ] Borders видны
- [ ] Hover эффекты работают

#### Sepia тема
- [ ] Тёплые оттенки везде
- [ ] Подсветки описаний в amber тонах
- [ ] Нет резких холодных цветов
- [ ] Комфортно для чтения

### Автоматизированные тесты

```typescript
// frontend/src/__tests__/themes.test.tsx
describe('Theme Support', () => {
  const themes = ['light', 'dark', 'sepia'];

  themes.forEach(theme => {
    describe(`${theme} theme`, () => {
      beforeEach(() => {
        document.documentElement.className = theme === 'light' ? '' : theme;
      });

      it('should have visible primary buttons', () => {
        const button = render(<Button variant="primary">Test</Button>);
        const styles = getComputedStyle(button);
        expect(styles.backgroundColor).not.toBe('transparent');
      });

      it('should have readable text contrast', () => {
        // Проверка контраста WCAG
      });
    });
  });
});
```

---

## Порядок выполнения

```
Фаза 0 (Hotfix)     ─────► Немедленно
       │
       ▼
Фаза 1 (CSS vars)   ─────► 1-2 часа
       │
       ▼
Фаза 2 (Миграция)   ─────► Последовательно
       │                    - Layout: 1 час
       │                    - Modals: 1 час
       │                    - Notifications: 30 мин
       │                    - Books: 1 час
       │                    - Reader: 1 час
       ▼
Фаза 3 (Highlights) ─────► 1 час
       │
       ▼
Фаза 4 (QA)         ─────► Финальная проверка
```

---

## Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Регрессия стилей | Средняя | Высокое | Визуальное тестирование после каждой фазы |
| Несовместимость браузеров | Низкая | Среднее | CSS-переменные поддерживаются везде |
| Пропущенные компоненты | Средняя | Низкое | Grep по проекту после миграции |

---

## Команды для проверки

```bash
# Найти все использования primary-600
grep -r "primary-[0-9]" frontend/src --include="*.tsx" --include="*.ts"

# Найти компоненты с dark: без sepia:
grep -r "dark:bg-" frontend/src --include="*.tsx" | grep -v "sepia:"

# Найти хардкоженные цвета
grep -r "rgba\|#[0-9a-fA-F]" frontend/src/hooks --include="*.ts"
```

---

## Заключение

После выполнения всех фаз:
1. Все три темы будут полностью поддержаны
2. Кнопки будут видны во всех темах
3. Подсветки описаний адаптируются к теме
4. Код станет более maintainable

**Приоритет:** Фаза 0 (Hotfix) должна быть выполнена немедленно для исправления критической проблемы с видимостью кнопки.
