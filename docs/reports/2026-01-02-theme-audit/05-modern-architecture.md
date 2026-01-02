# Современная архитектура системы тем

**Дата:** 2 января 2026
**Версия:** 2.0
**Основано на:** Исследование best practices 2025-2026

---

## Критические находки анализа

### Три параллельные системы тем (АРХИТЕКТУРНАЯ ПРОБЛЕМА)

| Система | Расположение | Поддержка тем | Использование |
|---------|--------------|---------------|---------------|
| **shadcn/ui CSS Variables** | `globals.css` (строки 9-52) | Light + Dark | 5 UI компонентов |
| **Custom CSS Variables** | `globals.css` (строки 83-117) | Light + Dark + Sepia | Inline styles в pages |
| **Hardcoded Tailwind** | Компоненты | Light + Dark | 46+ файлов, 409+ использований gray-* |

### Sepia тема определена в 4 местах с РАЗНЫМИ цветами

| Файл | Background | Text |
|------|------------|------|
| `globals.css` | `#f7f3e9` | `#5d4037` |
| `useEpubThemes.ts` | `#f4ecd8` | `#5c4a3c` |
| `stores/reader.ts` | `#f7f3e4` | `#5d4e37` |
| `ReaderToolbar.tsx` | `amber-50` (Tailwind) | `amber-900` (Tailwind) |

**Нарушение:** Single Source of Truth, DRY principle

---

## Рекомендуемый подход: OKLCH + Unified shadcn

### Почему OKLCH вместо HSL?

| Цветовое пространство | Преимущества | Недостатки |
|----------------------|--------------|------------|
| **OKLCH** | Перцептуально равномерное, лучшие градиенты, 92%+ поддержка | Новый формат |
| **HSL** | Интуитивный контроль hue | Неконсистентная светлота |
| **RGB/Hex** | Универсальная поддержка | Сложно манипулировать |

**OKLCH** - стандарт 2025 года:
- Одинаковые значения lightness выглядят одинаково ярко для всех оттенков
- Градиенты не становятся "грязными" посередине
- Легко создавать палитры через `calc()` на hue

### Новая структура CSS Variables

```css
/* frontend/src/styles/globals.css */
@import "tailwindcss";

/* ========================================
   LIGHT THEME (Default)
   ======================================== */
:root {
  /* Core */
  --background: oklch(100% 0 0);
  --foreground: oklch(14.9% 0.04 256.8);

  /* Card surfaces */
  --card: oklch(100% 0 0);
  --card-foreground: oklch(14.9% 0.04 256.8);

  /* Primary (Blue) */
  --primary: oklch(54.6% 0.245 262.9);
  --primary-foreground: oklch(98.5% 0.004 247.9);

  /* Primary scale for buttons, etc. */
  --primary-50: oklch(97% 0.02 262);
  --primary-100: oklch(93% 0.04 262);
  --primary-200: oklch(87% 0.08 262);
  --primary-300: oklch(78% 0.14 262);
  --primary-400: oklch(68% 0.19 262);
  --primary-500: oklch(60% 0.22 262);
  --primary-600: oklch(54.6% 0.245 262.9);
  --primary-700: oklch(48% 0.22 262);
  --primary-800: oklch(40% 0.18 262);
  --primary-900: oklch(33% 0.14 262);
  --primary-950: oklch(21% 0.10 262);

  /* Secondary */
  --secondary: oklch(96.1% 0.008 247.9);
  --secondary-foreground: oklch(14.9% 0.04 256.8);

  /* Muted */
  --muted: oklch(96.1% 0.008 247.9);
  --muted-foreground: oklch(46.9% 0.02 256.8);

  /* Accent */
  --accent: oklch(96.1% 0.008 247.9);
  --accent-foreground: oklch(14.9% 0.04 256.8);

  /* Destructive */
  --destructive: oklch(57.7% 0.245 27.3);
  --destructive-foreground: oklch(98.5% 0.004 247.9);

  /* Borders & inputs */
  --border: oklch(91.4% 0.013 255.5);
  --input: oklch(91.4% 0.013 255.5);
  --ring: oklch(54.6% 0.245 262.9);

  /* Reader-specific */
  --highlight-bg: oklch(95% 0.1 90 / 0.4);
  --highlight-border: oklch(85% 0.15 90);
  --highlight-active: oklch(90% 0.12 90 / 0.6);

  /* Radius */
  --radius: 0.5rem;
}

/* ========================================
   DARK THEME
   ======================================== */
.dark {
  --background: oklch(14.9% 0.04 256.8);
  --foreground: oklch(98.5% 0.016 247.9);

  --card: oklch(14.9% 0.04 256.8);
  --card-foreground: oklch(98.5% 0.016 247.9);

  --primary: oklch(59.8% 0.205 262.9);
  --primary-foreground: oklch(14.9% 0.04 256.8);

  /* Primary scale (inverted for dark) */
  --primary-50: oklch(21% 0.08 262);
  --primary-100: oklch(25% 0.10 262);
  --primary-200: oklch(30% 0.12 262);
  --primary-300: oklch(38% 0.15 262);
  --primary-400: oklch(48% 0.18 262);
  --primary-500: oklch(55% 0.20 262);
  --primary-600: oklch(59.8% 0.205 262.9);
  --primary-700: oklch(68% 0.18 262);
  --primary-800: oklch(78% 0.14 262);
  --primary-900: oklch(88% 0.08 262);
  --primary-950: oklch(95% 0.04 262);

  --secondary: oklch(17.5% 0.03 256.8);
  --secondary-foreground: oklch(98.5% 0.016 247.9);

  --muted: oklch(17.5% 0.03 256.8);
  --muted-foreground: oklch(65.1% 0.02 256.8);

  --accent: oklch(17.5% 0.03 256.8);
  --accent-foreground: oklch(98.5% 0.016 247.9);

  --destructive: oklch(42% 0.19 29);
  --destructive-foreground: oklch(98.5% 0.004 247.9);

  --border: oklch(17.5% 0.03 256.8);
  --input: oklch(17.5% 0.03 256.8);
  --ring: oklch(59.8% 0.205 262.9);

  /* Reader highlights (blue-tinted for dark) */
  --highlight-bg: oklch(30% 0.1 250 / 0.5);
  --highlight-border: oklch(50% 0.15 250);
  --highlight-active: oklch(40% 0.12 250 / 0.7);
}

/* ========================================
   SEPIA THEME (Reading Mode)
   ======================================== */
.sepia {
  /* Warm paper background - based on Kindle/Kobo research */
  --background: oklch(96.5% 0.025 85);
  --foreground: oklch(35% 0.05 50);

  --card: oklch(95% 0.028 83);
  --card-foreground: oklch(35% 0.05 50);

  /* Amber primary for sepia */
  --primary: oklch(50% 0.12 50);
  --primary-foreground: oklch(96% 0.02 85);

  /* Amber scale */
  --primary-50: oklch(97% 0.02 85);
  --primary-100: oklch(93% 0.04 82);
  --primary-200: oklch(88% 0.06 78);
  --primary-300: oklch(80% 0.09 70);
  --primary-400: oklch(70% 0.11 60);
  --primary-500: oklch(58% 0.12 55);
  --primary-600: oklch(50% 0.12 50);
  --primary-700: oklch(42% 0.10 48);
  --primary-800: oklch(35% 0.08 45);
  --primary-900: oklch(28% 0.06 42);
  --primary-950: oklch(20% 0.04 40);

  --secondary: oklch(92% 0.03 80);
  --secondary-foreground: oklch(35% 0.05 50);

  --muted: oklch(92% 0.03 80);
  --muted-foreground: oklch(50% 0.04 55);

  --accent: oklch(92% 0.035 78);
  --accent-foreground: oklch(35% 0.05 50);

  /* Warm destructive */
  --destructive: oklch(50% 0.18 25);
  --destructive-foreground: oklch(96% 0.02 85);

  --border: oklch(85% 0.03 75);
  --input: oklch(90% 0.025 80);
  --ring: oklch(50% 0.12 50);

  /* Amber highlights for sepia (NOT blue!) */
  --highlight-bg: oklch(88% 0.06 85 / 0.5);
  --highlight-border: oklch(70% 0.1 75);
  --highlight-active: oklch(82% 0.08 80 / 0.7);
}

/* ========================================
   TAILWIND v4 THEME REGISTRATION
   ======================================== */
@theme inline {
  /* Core colors */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);

  /* Primary with full scale */
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary-50: var(--primary-50);
  --color-primary-100: var(--primary-100);
  --color-primary-200: var(--primary-200);
  --color-primary-300: var(--primary-300);
  --color-primary-400: var(--primary-400);
  --color-primary-500: var(--primary-500);
  --color-primary-600: var(--primary-600);
  --color-primary-700: var(--primary-700);
  --color-primary-800: var(--primary-800);
  --color-primary-900: var(--primary-900);
  --color-primary-950: var(--primary-950);

  /* Semantic colors */
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);

  /* Borders */
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  /* Reader highlights */
  --color-highlight-bg: var(--highlight-bg);
  --color-highlight-border: var(--highlight-border);
  --color-highlight-active: var(--highlight-active);

  /* Radius */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 4px);
}

/* ========================================
   BASE STYLES
   ======================================== */
@layer base {
  * {
    border-color: var(--border);
  }

  body {
    background-color: var(--background);
    color: var(--foreground);
  }
}

/* Theme transition (respects reduced-motion) */
@media (prefers-reduced-motion: no-preference) {
  * {
    transition:
      background-color 0.2s ease,
      color 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }
}
```

---

## Обновлённый tailwind.config.js

```javascript
// frontend/tailwind.config.js
import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic colors via CSS variables
        border: 'oklch(var(--border) / <alpha-value>)',
        input: 'oklch(var(--input) / <alpha-value>)',
        ring: 'oklch(var(--ring) / <alpha-value>)',
        background: 'oklch(var(--background) / <alpha-value>)',
        foreground: 'oklch(var(--foreground) / <alpha-value>)',

        primary: {
          DEFAULT: 'oklch(var(--primary) / <alpha-value>)',
          foreground: 'oklch(var(--primary-foreground) / <alpha-value>)',
          50: 'oklch(var(--primary-50) / <alpha-value>)',
          100: 'oklch(var(--primary-100) / <alpha-value>)',
          200: 'oklch(var(--primary-200) / <alpha-value>)',
          300: 'oklch(var(--primary-300) / <alpha-value>)',
          400: 'oklch(var(--primary-400) / <alpha-value>)',
          500: 'oklch(var(--primary-500) / <alpha-value>)',
          600: 'oklch(var(--primary-600) / <alpha-value>)',
          700: 'oklch(var(--primary-700) / <alpha-value>)',
          800: 'oklch(var(--primary-800) / <alpha-value>)',
          900: 'oklch(var(--primary-900) / <alpha-value>)',
          950: 'oklch(var(--primary-950) / <alpha-value>)',
        },

        secondary: {
          DEFAULT: 'oklch(var(--secondary) / <alpha-value>)',
          foreground: 'oklch(var(--secondary-foreground) / <alpha-value>)',
        },

        destructive: {
          DEFAULT: 'oklch(var(--destructive) / <alpha-value>)',
          foreground: 'oklch(var(--destructive-foreground) / <alpha-value>)',
        },

        muted: {
          DEFAULT: 'oklch(var(--muted) / <alpha-value>)',
          foreground: 'oklch(var(--muted-foreground) / <alpha-value>)',
        },

        accent: {
          DEFAULT: 'oklch(var(--accent) / <alpha-value>)',
          foreground: 'oklch(var(--accent-foreground) / <alpha-value>)',
        },

        card: {
          DEFAULT: 'oklch(var(--card) / <alpha-value>)',
          foreground: 'oklch(var(--card-foreground) / <alpha-value>)',
        },

        // Reader highlights
        highlight: {
          DEFAULT: 'oklch(var(--highlight-bg))',
          border: 'oklch(var(--highlight-border))',
          active: 'oklch(var(--highlight-active))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [
    // Add sepia: variant for explicit sepia-only styles
    plugin(function({ addVariant }) {
      addVariant('sepia-theme', '.sepia &');
    }),
  ],
};
```

---

## Обновлённый useTheme.ts

```typescript
// frontend/src/hooks/useTheme.ts
import { useState, useEffect, useCallback } from 'react';

export type AppTheme = 'light' | 'dark' | 'sepia' | 'system';
type ResolvedTheme = 'light' | 'dark' | 'sepia';

const STORAGE_KEY = 'app-theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: AppTheme): ResolvedTheme {
  if (theme === 'system') return getSystemTheme();
  return theme;
}

export const useTheme = () => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem(STORAGE_KEY) as AppTheme | null;
    return saved || 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(theme)
  );

  // Apply theme to document
  const applyTheme = useCallback((resolved: ResolvedTheme) => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark', 'sepia');
    if (resolved !== 'light') {
      root.classList.add(resolved);
    }
    // Set color-scheme for native elements
    root.style.colorScheme = resolved === 'dark' ? 'dark' : 'light';
  }, []);

  // Handle theme changes
  const setTheme = useCallback((newTheme: AppTheme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);

    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, [applyTheme]);

  // Initial setup and system theme listener
  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyTheme(resolved);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        const newResolved = getSystemTheme();
        setResolvedTheme(newResolved);
        applyTheme(newResolved);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, applyTheme]);

  return {
    theme,           // User's preference: 'light' | 'dark' | 'sepia' | 'system'
    resolvedTheme,   // Actual applied theme: 'light' | 'dark' | 'sepia'
    setTheme,
    isSystem: theme === 'system',
  };
};

// Предотвращение FOUC - добавить в index.html <head>
export const themeInitScript = `
(function() {
  try {
    var theme = localStorage.getItem('${STORAGE_KEY}');
    if (theme === 'system' || !theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (theme !== 'light') {
      document.documentElement.classList.add(theme);
    }
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  } catch (e) {}
})();
`;
```

---

## Миграция компонентов

### Паттерн: До и После

```tsx
// ❌ БЫЛО: Hardcoded + dark: prefix
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
  <button className="bg-blue-600 hover:bg-blue-700 text-white">
    Click
  </button>
</div>

// ✅ СТАЛО: Semantic tokens (работает для всех 3 тем)
<div className="bg-card text-card-foreground">
  <button className="bg-primary hover:bg-primary-700 text-primary-foreground">
    Click
  </button>
</div>
```

### Таблица замен

| Было | Стало | Примечание |
|------|-------|------------|
| `bg-white` | `bg-background` | Основной фон |
| `bg-gray-50/100` | `bg-secondary` | Вторичный фон |
| `bg-gray-800/900` | `bg-card` (в dark) | Карточки |
| `text-gray-900` | `text-foreground` | Основной текст |
| `text-gray-500/600` | `text-muted-foreground` | Приглушённый текст |
| `border-gray-200` | `border-border` | Границы |
| `bg-blue-600` | `bg-primary` или `bg-primary-600` | Primary кнопки |
| `hover:bg-blue-700` | `hover:bg-primary-700` | Hover states |

---

## Highlights для описаний

```typescript
// frontend/src/hooks/epub/useDescriptionHighlighting.ts

// ❌ БЫЛО: Hardcoded синий цвет
const highlightStyle = {
  backgroundColor: 'rgba(59, 130, 246, 0.3)',
  border: '2px solid rgba(59, 130, 246, 0.6)',
};

// ✅ СТАЛО: CSS-переменные (адаптируются к теме)
const getHighlightStyles = () => {
  const root = document.documentElement;
  const computedStyle = getComputedStyle(root);

  return {
    backgroundColor: computedStyle.getPropertyValue('--highlight-bg').trim()
      || 'oklch(95% 0.1 90 / 0.4)',
    border: `2px solid ${computedStyle.getPropertyValue('--highlight-border').trim()
      || 'oklch(85% 0.15 90)'}`,
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  };
};

// Для epub.js iframe - инжектим CSS
const injectHighlightCSS = (iframe: HTMLIFrameElement) => {
  const style = iframe.contentDocument?.createElement('style');
  if (style) {
    style.textContent = `
      .description-highlight {
        background-color: var(--highlight-bg, oklch(95% 0.1 90 / 0.4));
        border: 2px solid var(--highlight-border, oklch(85% 0.15 90));
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      .description-highlight:hover,
      .description-highlight.active {
        background-color: var(--highlight-active, oklch(90% 0.12 90 / 0.6));
      }
    `;
    iframe.contentDocument?.head.appendChild(style);
  }
};
```

---

## View Transitions API (Modern UX)

```typescript
// Плавное переключение тем с анимацией
const setThemeWithTransition = (newTheme: AppTheme) => {
  // Проверяем поддержку View Transitions API
  if (!document.startViewTransition) {
    setTheme(newTheme);
    return;
  }

  // Сохраняем позицию клика для анимации
  document.startViewTransition(() => {
    setTheme(newTheme);
  });
};
```

```css
/* Анимация переключения темы */
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}

::view-transition-old(root) {
  z-index: 1;
}

::view-transition-new(root) {
  z-index: 999;
}

/* Круговое раскрытие от позиции клика */
::view-transition-new(root) {
  animation: reveal 0.4s ease-out;
}

@keyframes reveal {
  from {
    clip-path: circle(0% at var(--click-x, 50%) var(--click-y, 50%));
  }
  to {
    clip-path: circle(150% at var(--click-x, 50%) var(--click-y, 50%));
  }
}
```

---

## Accessibility (WCAG 2.1)

### Контраст по темам

| Тема | Background | Foreground | Contrast Ratio | WCAG Level |
|------|------------|------------|----------------|------------|
| Light | `oklch(100% 0 0)` | `oklch(14.9% 0.04 256.8)` | **15.2:1** | AAA |
| Dark | `oklch(14.9% 0.04 256.8)` | `oklch(98.5% 0.016 247.9)` | **14.8:1** | AAA |
| Sepia | `oklch(96.5% 0.025 85)` | `oklch(35% 0.05 50)` | **8.5:1** | AAA |

### Focus states

```css
/* Видимый focus во всех темах */
*:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* High contrast mode */
@media (prefers-contrast: high) {
  :root {
    --ring: oklch(0% 0 0);
  }
  .dark {
    --ring: oklch(100% 0 0);
  }
}
```

---

## Файлы для изменения (полный список)

### Фаза 1: CSS Infrastructure
- `frontend/src/styles/globals.css` - Полная переработка
- `frontend/tailwind.config.js` - Обновление colors

### Фаза 2: Core Hooks
- `frontend/src/hooks/useTheme.ts` - Система + sepia поддержка
- `frontend/src/hooks/epub/useEpubThemes.ts` - Синхронизация с CSS vars
- `frontend/src/hooks/epub/useDescriptionHighlighting.ts` - CSS vars для highlights

### Фаза 3: Layout Components (8 файлов)
- `src/components/Layout/Header.tsx`
- `src/components/Layout/Sidebar.tsx`
- `src/components/Layout/Footer.tsx`
- `src/components/Reader/ReaderHeader.tsx`
- `src/components/Reader/ReaderToolbar.tsx`
- `src/components/Reader/TocSidebar.tsx`
- `src/components/Reader/ReaderSettingsPanel.tsx`
- `src/components/Reader/SelectionMenu.tsx`

### Фаза 4: UI Components (12 файлов)
- `src/components/UI/ThemeSwitcher.tsx`
- `src/components/UI/NotificationContainer.tsx`
- `src/components/UI/Modal.tsx`
- `src/components/UI/Dialog.tsx`
- `src/components/UI/Dropdown.tsx`
- `src/components/UI/Tooltip.tsx`
- `src/components/Books/BookCard.tsx`
- `src/components/Books/BookUploadModal.tsx`
- `src/components/Library/BookGrid.tsx`
- `src/components/Library/Pagination.tsx`
- `src/components/Library/LibraryHeader.tsx`
- `src/components/Library/SearchFilters.tsx`

### Фаза 5: Pages (11 файлов)
- Все страницы в `src/pages/`

**Итого: ~52 файла для миграции**
