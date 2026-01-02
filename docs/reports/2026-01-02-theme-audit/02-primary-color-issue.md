# Проблема классов Primary-600

**Дата:** 2 января 2026
**Критичность:** КРИТИЧЕСКАЯ
**Статус:** Требует немедленного исправления

---

## Описание проблемы

### Симптом
Кнопка "Выбрать файлы" в модальном окне загрузки книги **невидима в светлой теме**. Текст кнопки белый, фон отсутствует - сливается с белым фоном модала.

### Корневая причина

В `tailwind.config.js` цвет `primary` определён без нумерованных вариантов:

```javascript
// frontend/tailwind.config.js (текущее состояние)
colors: {
  primary: {
    DEFAULT: "hsl(var(--primary))",
    foreground: "hsl(var(--primary-foreground))",
  },
  // ...
}
```

При такой конфигурации Tailwind генерирует **только**:
- `bg-primary` (DEFAULT)
- `text-primary-foreground`

**НЕ генерируются:**
- `bg-primary-50` через `bg-primary-950`
- `text-primary-600`, `hover:bg-primary-700` и т.д.

### Проблемный код

**Файл:** `frontend/src/components/Books/BookUploadModal.tsx` (строки 314-320)

```tsx
<label
  htmlFor="file-upload"
  className="cursor-pointer bg-primary-600 text-white
             hover:bg-primary-700 px-4 py-2 rounded-lg
             transition-colors duration-200"
>
  Выбрать файлы
</label>
```

Класс `bg-primary-600` **не существует**, поэтому:
- Фон не применяется (transparent)
- `text-white` работает
- Результат: белый текст на прозрачном фоне = невидимо на светлом фоне

---

## Затронутые файлы

### Компоненты с `primary-600`

| Файл | Строки | Классы |
|------|--------|--------|
| `BookUploadModal.tsx` | 314-320 | `bg-primary-600`, `hover:bg-primary-700` |
| `AdminPanelPage.tsx` | ~50+ | `bg-primary-600`, `text-primary-600` |
| `LoginPage.tsx` | ~30+ | `bg-primary-600`, `hover:bg-primary-700` |
| `RegisterPage.tsx` | ~35+ | `bg-primary-600`, `hover:bg-primary-700` |
| `ProfilePage.tsx` | ~25+ | `text-primary-600`, `bg-primary-100` |
| `SettingsPage.tsx` | ~20+ | `bg-primary-600`, `ring-primary-500` |
| `StatsPage.tsx` | ~15+ | `text-primary-600`, `bg-primary-50` |
| `LibraryPage.tsx` | ~10+ | `hover:text-primary-600` |

### Полный список файлов

```bash
# Результат grep по проекту:
grep -r "primary-[0-9]" frontend/src --include="*.tsx" --include="*.ts" | wc -l
# ~35+ файлов
```

**Файлы:**
1. `src/components/Books/BookUploadModal.tsx`
2. `src/components/Books/BookCard.tsx`
3. `src/components/Reader/EpubReader.tsx`
4. `src/components/Reader/ReaderControls.tsx`
5. `src/components/UI/Button.tsx`
6. `src/components/UI/Input.tsx`
7. `src/components/UI/Select.tsx`
8. `src/components/UI/Tabs.tsx`
9. `src/components/Admin/AdminHeader.tsx`
10. `src/components/Admin/TabNavigation.tsx`
11. `src/components/Library/LibraryHeader.tsx`
12. `src/components/Library/Pagination.tsx`
13. `src/pages/LoginPage.tsx`
14. `src/pages/RegisterPage.tsx`
15. `src/pages/ProfilePage.tsx`
16. `src/pages/AdminPanelPage.tsx`
17. `src/pages/SettingsPage.tsx`
18. `src/pages/StatsPage.tsx`
... и другие

---

## Варианты исправления

### Вариант 1: Добавить нумерованные варианты (Рекомендуется)

**Файл:** `frontend/tailwind.config.js`

```javascript
colors: {
  primary: {
    DEFAULT: "hsl(var(--primary))",
    foreground: "hsl(var(--primary-foreground))",
    // Добавить нумерованные варианты
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
}
```

**Файл:** `frontend/src/styles/globals.css`

```css
:root {
  /* Existing */
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;

  /* Add numbered variants */
  --primary-50: 214 100% 97%;
  --primary-100: 214 95% 93%;
  --primary-200: 213 97% 87%;
  --primary-300: 212 96% 78%;
  --primary-400: 213 94% 68%;
  --primary-500: 217 91% 60%;
  --primary-600: 221 83% 53%;  /* Same as DEFAULT */
  --primary-700: 224 76% 48%;
  --primary-800: 226 71% 40%;
  --primary-900: 224 64% 33%;
  --primary-950: 226 57% 21%;
}

.dark {
  --primary-50: 222 47% 11%;
  --primary-100: 222 47% 15%;
  /* ... остальные варианты для dark theme */
}

.sepia {
  --primary-50: 36 45% 95%;
  --primary-100: 36 45% 90%;
  /* ... остальные варианты для sepia theme */
}
```

**Плюсы:**
- Минимальные изменения в компонентах
- Сохраняется текущий код
- Поддержка всех тем

**Минусы:**
- Нужно определить ~33 новых CSS-переменных (11 оттенков × 3 темы)

### Вариант 2: Заменить на существующие классы

Заменить `bg-primary-600` на `bg-primary`:

```tsx
// До
<label className="bg-primary-600 text-white hover:bg-primary-700">

// После
<label className="bg-primary text-primary-foreground hover:opacity-90">
```

**Плюсы:**
- Использует существующую конфигурацию
- Не требует новых CSS-переменных

**Минусы:**
- Нужно изменить ~35+ файлов
- `hover:opacity-90` менее красив чем `hover:bg-primary-700`

### Вариант 3: Использовать Tailwind CSS цвета напрямую

```javascript
// tailwind.config.js
const colors = require('tailwindcss/colors')

colors: {
  primary: colors.blue,  // Использовать стандартную палитру blue
}
```

**Плюсы:**
- Автоматически все 11 оттенков
- Стандартная палитра Tailwind

**Минусы:**
- Теряется связь с CSS-переменными
- Сложнее поддерживать темы

---

## Рекомендация

**Использовать Вариант 1** - добавить CSS-переменные для нумерованных вариантов.

Это обеспечит:
1. Обратную совместимость с существующим кодом
2. Поддержку всех трёх тем
3. Консистентность с текущей архитектурой

---

## Временное исправление (hotfix)

Если нужно быстро исправить только кнопку загрузки:

```tsx
// BookUploadModal.tsx
<label
  htmlFor="file-upload"
  className="cursor-pointer bg-primary text-primary-foreground
             hover:opacity-90 px-4 py-2 rounded-lg
             transition-colors duration-200"
>
  Выбрать файлы
</label>
```

Это исправит видимость кнопки во всех темах немедленно.
