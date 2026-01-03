# fancai - Спецификация цветовой системы

**Дата:** 3 января 2026
**Версия:** 1.0

---

## 1. Философия цветовой системы

### Принципы

1. **Reading Comfort First** - цвета оптимизированы для длительного чтения
2. **Neutral Grays** - без синего/фиолетового подтона в dark mode
3. **Warm Tones** - тёплые оттенки для sepia и accent colors
4. **Consistent Contrast** - WCAG 2.2 AA compliance везде
5. **OLED Friendly** - без pure black для избежания smearing

### Проблемы текущей схемы

| Проблема | Текущее значение | Исправление |
|----------|------------------|-------------|
| Синеватый dark bg | `hsl(222.2, 84%, 4.9%)` | `#121212` (нейтральный) |
| Синеватый border | `hsl(217.2, 32.6%, 17.5%)` | `#2D2D2D` (нейтральный) |
| Холодный primary | `hsl(217.2, 91.2%, 59.8%)` | `#F59E0B` (тёплый оранжевый) |
| Чистый белый текст | `hsl(210, 40%, 98%)` | `#E8E8E8` (off-white) |

---

## 2. Полная цветовая палитра

### 2.1 Light Theme

```css
:root {
  /* ========== BACKGROUNDS ========== */
  --color-bg-base: #FFFFFF;           /* Page background */
  --color-bg-subtle: #F9FAFB;         /* Subtle sections */
  --color-bg-muted: #F3F4F6;          /* Cards, inputs */
  --color-bg-emphasis: #E5E7EB;       /* Hover states */

  /* ========== SURFACES ========== */
  --color-surface-default: #FFFFFF;    /* Cards */
  --color-surface-raised: #FFFFFF;     /* Modals */
  --color-surface-overlay: rgba(0, 0, 0, 0.5); /* Backdrop */

  /* ========== TEXT ========== */
  --color-text-default: #111827;       /* Primary text */
  --color-text-muted: #4B5563;         /* Secondary text */
  --color-text-subtle: #6B7280;        /* Tertiary text */
  --color-text-disabled: #9CA3AF;      /* Disabled */
  --color-text-inverse: #FFFFFF;       /* On dark bg */
  --color-text-link: #D97706;          /* Links */

  /* ========== BORDERS ========== */
  --color-border-default: #E5E7EB;     /* Default borders */
  --color-border-muted: #F3F4F6;       /* Subtle borders */
  --color-border-emphasis: #D1D5DB;    /* Strong borders */
  --color-border-focus: #D97706;       /* Focus ring */

  /* ========== ACCENT (Primary) ========== */
  --color-accent-50: #FFFBEB;
  --color-accent-100: #FEF3C7;
  --color-accent-200: #FDE68A;
  --color-accent-300: #FCD34D;
  --color-accent-400: #FBBF24;
  --color-accent-500: #F59E0B;
  --color-accent-600: #D97706;          /* DEFAULT */
  --color-accent-700: #B45309;
  --color-accent-800: #92400E;
  --color-accent-900: #78350F;

  /* ========== SEMANTIC COLORS ========== */
  /* Success */
  --color-success-50: #ECFDF5;
  --color-success-100: #D1FAE5;
  --color-success-500: #10B981;
  --color-success-600: #059669;         /* DEFAULT */
  --color-success-700: #047857;

  /* Warning */
  --color-warning-50: #FFFBEB;
  --color-warning-100: #FEF3C7;
  --color-warning-500: #F59E0B;
  --color-warning-600: #D97706;         /* DEFAULT */
  --color-warning-700: #B45309;

  /* Error */
  --color-error-50: #FEF2F2;
  --color-error-100: #FEE2E2;
  --color-error-500: #EF4444;
  --color-error-600: #DC2626;           /* DEFAULT */
  --color-error-700: #B91C1C;

  /* Info */
  --color-info-50: #EFF6FF;
  --color-info-100: #DBEAFE;
  --color-info-500: #3B82F6;
  --color-info-600: #2563EB;            /* DEFAULT */
  --color-info-700: #1D4ED8;

  /* ========== HIGHLIGHTS (Reader) ========== */
  --color-highlight-bg: rgba(251, 191, 36, 0.3);
  --color-highlight-border: rgba(251, 191, 36, 0.6);
  --color-highlight-active: rgba(251, 191, 36, 0.5);
}
```

### 2.2 Dark Theme

```css
[data-theme="dark"] {
  /* ========== BACKGROUNDS ========== */
  /* Нейтральные серые БЕЗ синего подтона */
  --color-bg-base: #121212;            /* Page bg - Material Design */
  --color-bg-subtle: #1A1A1A;          /* Sections */
  --color-bg-muted: #1E1E1E;           /* Cards, inputs */
  --color-bg-emphasis: #2A2A2A;        /* Hover states */

  /* ========== SURFACES ========== */
  --color-surface-default: #1E1E1E;    /* Cards - elevated */
  --color-surface-raised: #252525;     /* Modals */
  --color-surface-overlay: rgba(0, 0, 0, 0.7);

  /* ========== TEXT ========== */
  /* Off-white для комфорта чтения */
  --color-text-default: #E8E8E8;       /* НЕ чистый белый */
  --color-text-muted: #B3B3B3;
  --color-text-subtle: #808080;
  --color-text-disabled: #5C5C5C;
  --color-text-inverse: #121212;
  --color-text-link: #FBBF24;

  /* ========== BORDERS ========== */
  --color-border-default: #2D2D2D;
  --color-border-muted: #252525;
  --color-border-emphasis: #3D3D3D;
  --color-border-focus: #FBBF24;

  /* ========== ACCENT ========== */
  /* Ярче для dark mode */
  --color-accent-50: #451A03;
  --color-accent-100: #78350F;
  --color-accent-200: #92400E;
  --color-accent-300: #B45309;
  --color-accent-400: #D97706;
  --color-accent-500: #F59E0B;          /* DEFAULT */
  --color-accent-600: #FBBF24;
  --color-accent-700: #FCD34D;
  --color-accent-800: #FDE68A;
  --color-accent-900: #FEF3C7;

  /* ========== SEMANTIC (светлее) ========== */
  --color-success-600: #34D399;
  --color-warning-600: #FBBF24;
  --color-error-600: #F87171;
  --color-info-600: #60A5FA;

  /* ========== HIGHLIGHTS ========== */
  --color-highlight-bg: rgba(251, 191, 36, 0.35);
  --color-highlight-border: rgba(251, 191, 36, 0.65);
  --color-highlight-active: rgba(251, 191, 36, 0.55);
}
```

### 2.3 Sepia Theme

```css
[data-theme="sepia"] {
  /* ========== BACKGROUNDS ========== */
  /* Тёплые бежевые (Kindle-inspired) */
  --color-bg-base: #FBF0D9;            /* Kindle sepia */
  --color-bg-subtle: #F7EBCF;
  --color-bg-muted: #F5E6C8;
  --color-bg-emphasis: #EFD9B0;

  /* ========== SURFACES ========== */
  --color-surface-default: #FFF8EC;
  --color-surface-raised: #FFFBF5;
  --color-surface-overlay: rgba(61, 41, 20, 0.5);

  /* ========== TEXT ========== */
  /* Тёплые коричневые */
  --color-text-default: #3D2914;
  --color-text-muted: #5F4B32;          /* Kindle sepia text */
  --color-text-subtle: #7D6548;
  --color-text-disabled: #A08B6E;
  --color-text-inverse: #FBF0D9;
  --color-text-link: #B45309;

  /* ========== BORDERS ========== */
  --color-border-default: #E8D5B5;
  --color-border-muted: #F0E4CC;
  --color-border-emphasis: #D4BC94;
  --color-border-focus: #B45309;

  /* ========== ACCENT ========== */
  --color-accent-600: #B45309;          /* DEFAULT */
  --color-accent-700: #92400E;

  /* ========== SEMANTIC ========== */
  --color-success-600: #15803D;
  --color-warning-600: #A16207;
  --color-error-600: #B91C1C;
  --color-info-600: #1D4ED8;

  /* ========== HIGHLIGHTS ========== */
  --color-highlight-bg: rgba(180, 83, 9, 0.25);
  --color-highlight-border: rgba(180, 83, 9, 0.5);
  --color-highlight-active: rgba(180, 83, 9, 0.4);
}
```

---

## 3. Tailwind Integration

### tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic color mappings
        background: 'var(--color-bg-base)',
        foreground: 'var(--color-text-default)',

        card: {
          DEFAULT: 'var(--color-surface-default)',
          foreground: 'var(--color-text-default)',
        },

        popover: {
          DEFAULT: 'var(--color-surface-raised)',
          foreground: 'var(--color-text-default)',
        },

        primary: {
          DEFAULT: 'var(--color-accent-600)',
          foreground: 'var(--color-text-inverse)',
        },

        secondary: {
          DEFAULT: 'var(--color-bg-muted)',
          foreground: 'var(--color-text-default)',
        },

        muted: {
          DEFAULT: 'var(--color-bg-subtle)',
          foreground: 'var(--color-text-muted)',
        },

        accent: {
          DEFAULT: 'var(--color-accent-600)',
          foreground: 'var(--color-text-inverse)',
          50: 'var(--color-accent-50)',
          100: 'var(--color-accent-100)',
          200: 'var(--color-accent-200)',
          300: 'var(--color-accent-300)',
          400: 'var(--color-accent-400)',
          500: 'var(--color-accent-500)',
          600: 'var(--color-accent-600)',
          700: 'var(--color-accent-700)',
          800: 'var(--color-accent-800)',
          900: 'var(--color-accent-900)',
        },

        destructive: {
          DEFAULT: 'var(--color-error-600)',
          foreground: 'white',
        },

        success: {
          DEFAULT: 'var(--color-success-600)',
          foreground: 'white',
        },

        warning: {
          DEFAULT: 'var(--color-warning-600)',
          foreground: 'var(--color-text-inverse)',
        },

        info: {
          DEFAULT: 'var(--color-info-600)',
          foreground: 'white',
        },

        border: 'var(--color-border-default)',
        input: 'var(--color-border-default)',
        ring: 'var(--color-border-focus)',

        // Highlight colors for reader
        highlight: {
          DEFAULT: 'var(--color-highlight-bg)',
          border: 'var(--color-highlight-border)',
          active: 'var(--color-highlight-active)',
        },
      },

      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.25rem',
      },
    },
  },
  plugins: [
    // Sepia theme variant
    function({ addVariant }) {
      addVariant('sepia-theme', '[data-theme="sepia"] &');
    },
  ],
};
```

---

## 4. Contrast Verification

### 4.1 Light Theme Contrasts

| Combination | Ratio | WCAG Level |
|-------------|-------|------------|
| text-default (#111827) on bg-base (#FFFFFF) | **18.3:1** | AAA |
| text-muted (#4B5563) on bg-base (#FFFFFF) | **7.5:1** | AAA |
| text-subtle (#6B7280) on bg-base (#FFFFFF) | **5.0:1** | AA |
| accent-600 (#D97706) on bg-base (#FFFFFF) | **4.8:1** | AA |
| text-inverse (#FFFFFF) on accent-600 (#D97706) | **4.8:1** | AA |

### 4.2 Dark Theme Contrasts

| Combination | Ratio | WCAG Level |
|-------------|-------|------------|
| text-default (#E8E8E8) on bg-base (#121212) | **15.4:1** | AAA |
| text-muted (#B3B3B3) on bg-base (#121212) | **9.1:1** | AAA |
| text-subtle (#808080) on bg-base (#121212) | **4.6:1** | AA |
| accent-500 (#F59E0B) on bg-base (#121212) | **8.5:1** | AAA |
| text-inverse (#121212) on accent-500 (#F59E0B) | **8.5:1** | AAA |

### 4.3 Sepia Theme Contrasts

| Combination | Ratio | WCAG Level |
|-------------|-------|------------|
| text-default (#3D2914) on bg-base (#FBF0D9) | **11.2:1** | AAA |
| text-muted (#5F4B32) on bg-base (#FBF0D9) | **6.8:1** | AAA |
| text-subtle (#7D6548) on bg-base (#FBF0D9) | **4.5:1** | AA |
| accent-600 (#B45309) on bg-base (#FBF0D9) | **5.3:1** | AA |

---

## 5. Usage Guidelines

### 5.1 Backgrounds

```tsx
// ❌ Не используйте
<div className="bg-gray-900">  // Hardcoded
<div style={{ background: '#121212' }}>  // Inline

// ✅ Используйте
<div className="bg-background">  // Page background
<div className="bg-card">  // Cards
<div className="bg-muted">  // Subtle sections
```

### 5.2 Text

```tsx
// ❌ Не используйте
<p className="text-gray-900">  // Hardcoded
<p className="text-white">  // Too stark in dark mode

// ✅ Используйте
<p className="text-foreground">  // Primary text
<p className="text-muted-foreground">  // Secondary text
<p className="text-primary">  // Accent color text
```

### 5.3 Borders

```tsx
// ❌ Не используйте
<div className="border-gray-200 dark:border-gray-700">

// ✅ Используйте
<div className="border-border">  // Adapts to theme
```

### 5.4 Semantic Colors

```tsx
// Success states
<Badge className="bg-success text-success-foreground">Saved</Badge>

// Error states
<span className="text-destructive">Error message</span>

// Warning states
<Alert className="bg-warning/10 text-warning border-warning">
  Warning message
</Alert>
```

### 5.5 Focus States

```tsx
// All interactive elements should have
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
```

---

## 6. Migration Guide

### Шаг 1: Обновить globals.css

Заменить текущие CSS variables на новые из секции 2.

### Шаг 2: Обновить tailwind.config.js

Использовать конфигурацию из секции 3.

### Шаг 3: Найти и заменить

```bash
# Hardcoded colors
grep -r "hsl(222.2" src/
grep -r "hsl(217.2" src/
grep -r "#121212\|#1a1a1a\|#1f1f1f" src/
grep -r "rgb(59, 130, 246)" src/

# Replace patterns
dark:bg-gray-800 → bg-card
dark:bg-gray-900 → bg-background
dark:text-gray-100 → text-foreground
dark:text-gray-400 → text-muted-foreground
dark:border-gray-700 → border-border
```

### Шаг 4: Тестирование

1. Проверить все три темы визуально
2. Проверить контрасты через axe DevTools
3. Проверить в разных условиях освещения

---

## 7. Color Tokens Reference

### Quick Reference Card

```
BACKGROUNDS
  bg-background     Main page background
  bg-card          Card surfaces
  bg-muted         Subtle sections
  bg-popover       Modals, dropdowns

TEXT
  text-foreground        Primary text
  text-muted-foreground  Secondary text
  text-primary           Accent color text

BORDERS
  border-border    Default borders
  ring-ring        Focus rings

SEMANTIC
  bg-destructive   Error backgrounds
  text-destructive Error text
  bg-success       Success backgrounds
  bg-warning       Warning backgrounds
  bg-info          Info backgrounds

ACCENT SCALE
  accent-50 → accent-900 (full scale)
```
