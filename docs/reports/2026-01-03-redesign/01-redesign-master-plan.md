# fancai - Полный Редизайн: Master Plan

**Дата:** 3 января 2026
**Версия:** 1.6 (FINAL)
**Статус:** Phase 1 ✅ | Phase 2 ✅ | Phase 3 ✅ | Phase 4 ✅ | Phase 5 ✅ | Phase 6 ✅ COMPLETE

---

## Содержание

1. [Executive Summary](#1-executive-summary)
2. [Текущие проблемы](#2-текущие-проблемы)
3. [Цели редизайна](#3-цели-редизайна)
4. [Технологический стек](#4-технологический-стек)
5. [Design System](#5-design-system)
6. [Цветовая система](#6-цветовая-система)
7. [Типографика](#7-типографика)
8. [Компоненты](#8-компоненты)
9. [Страницы и навигация](#9-страницы-и-навигация)
10. [Mobile-First подход](#10-mobile-first-подход)
11. [Accessibility](#11-accessibility)
12. [Анимации](#12-анимации)
13. [План реализации](#13-план-реализации)
14. [Метрики успеха](#14-метрики-успеха)

---

## 1. Executive Summary

### Проблема

Текущий дизайн fancai имеет критические проблемы:
- **Dark mode с синеватыми тонами** - холодный, некомфортный для чтения
- **Несогласованность цветов** - разные компоненты используют разные оттенки
- **Hardcoded цвета** - ~9 мест с RGB/hex в коде
- **Слабая мобильная адаптация** - не mobile-first
- **Accessibility issues** - недостаточный контраст, плохие focus states

### Решение

Полный редизайн с фокусом на:
- **Mobile-first** - все компоненты проектируются сначала для мобильных
- **Reading comfort** - оптимальные цвета для длительного чтения
- **Modern UX patterns** - best practices от Kindle, Apple Books, Kobo
- **WCAG 2.2 AA compliance** - полная доступность
- **Unified design system** - единая система токенов и компонентов

---

## 2. Текущие проблемы

### 2.1 Проблемы с цветом

| Проблема | Описание | Серьёзность |
|----------|----------|-------------|
| Синий dark mode | `hsl(222.2, 84%, 4.9%)` - синеватый фон | Критическая |
| Hardcoded цвета | RGB/hex в 9+ местах | Высокая |
| Низкий контраст | Некоторые тексты < 4.5:1 | Высокая |
| Несогласованные оттенки | Разные серые в компонентах | Средняя |

### 2.2 Проблемы с UX

| Проблема | Описание | Серьёзность |
|----------|----------|-------------|
| Delete на hover | Кнопка удаления не видна на мобильных | Критическая |
| Перегруженный Reader | Слишком много controls | Высокая |
| Нет skeleton screens | Только spinners | Средняя |
| Пагинация не в URL | Нельзя скопировать ссылку | Низкая |

### 2.3 Проблемы с доступностью

| Проблема | Описание | WCAG |
|----------|----------|------|
| Focus styles | Не везде видимые | 2.4.7 |
| Touch targets | Некоторые < 44px | 2.5.5 |
| Color only | Информация только цветом | 1.4.1 |

---

## 3. Цели редизайна

### Основные цели

1. **Комфортное чтение** - оптимальные цвета для всех условий освещения
2. **Современный дизайн** - соответствие трендам 2025-2026
3. **Mobile-first** - идеальный опыт на любом устройстве
4. **Accessibility** - WCAG 2.2 AA compliance
5. **Консистентность** - единая design system

### KPIs

| Метрика | До | Цель |
|---------|-----|------|
| Lighthouse Accessibility | ~70 | 95+ |
| Color contrast ratio | 3.5:1-15:1 | 4.5:1-12:1 |
| Touch target compliance | 60% | 100% |
| Mobile usability score | ~80 | 95+ |
| Time to interactive | ~3s | <2s |

---

## 4. Технологический стек

### 4.1 Текущий стек (сохраняем)

| Технология | Версия | Роль |
|------------|--------|------|
| React | 19.0.0 | UI Framework |
| TypeScript | 5.7.2 | Type Safety |
| Tailwind CSS | 3.4.17 → **4.0** | Styling |
| Radix UI | 2.x | Headless Components |
| Framer Motion | 11.x → **12.x** | Animations |
| Lucide Icons | 0.469.0 | Icons |
| TanStack Query | 5.90 | Server State |
| Zustand | 5.0 | Client State |

### 4.2 Обновления стека

```bash
# Обновления
npm update framer-motion@12  # Новые features
npm install @formkit/auto-animate  # Простые анимации списков

# Новые зависимости
npm install @radix-ui/react-visually-hidden  # Accessibility
npm install usehooks-ts  # Полезные hooks
```

### 4.3 Почему НЕ меняем UI библиотеку

| Вариант | Решение | Причина |
|---------|---------|---------|
| shadcn/ui | Сохранить подход | Полный контроль над кодом |
| Mantine | Отклонить | Миграция дорогая |
| Chakra UI | Отклонить | CSS-in-JS overhead |

---

## 5. Design System

### 5.1 Design Tokens

```typescript
// design-tokens.ts
export const tokens = {
  // Spacing scale (8px base)
  spacing: {
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
  },

  // Border radius
  radius: {
    none: '0',
    sm: '0.25rem',   // 4px
    md: '0.5rem',    // 8px
    lg: '0.75rem',   // 12px
    xl: '1rem',      // 16px
    '2xl': '1.5rem', // 24px
    full: '9999px',
  },

  // Shadows (elevation)
  shadow: {
    sm: '0 1px 2px rgba(0,0,0,0.05)',
    md: '0 4px 6px rgba(0,0,0,0.07)',
    lg: '0 10px 15px rgba(0,0,0,0.1)',
    xl: '0 20px 25px rgba(0,0,0,0.15)',
  },

  // Z-index scale
  zIndex: {
    dropdown: 50,
    sticky: 100,
    modal: 200,
    popover: 300,
    tooltip: 400,
  },
};
```

### 5.2 Структура компонентов

```
src/
├── design-system/
│   ├── tokens/
│   │   ├── colors.ts
│   │   ├── spacing.ts
│   │   ├── typography.ts
│   │   └── index.ts
│   ├── primitives/
│   │   ├── Box/
│   │   ├── Flex/
│   │   ├── Stack/
│   │   ├── Grid/
│   │   └── Text/
│   └── components/
│       ├── Button/
│       ├── Input/
│       ├── Card/
│       ├── Modal/
│       └── ...
```

---

## 6. Цветовая система

### 6.1 Философия

**Для reading app:**
- Нейтральные серые (без синего подтона)
- Тёплые оттенки для sepia
- Комфортный контраст (не чрезмерный)
- OLED-friendly dark mode

### 6.2 Light Theme

```css
:root {
  /* Backgrounds */
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #F8F9FA;
  --color-bg-tertiary: #F1F3F5;
  --color-bg-elevated: #FFFFFF;

  /* Text */
  --color-text-primary: #1A1A1A;
  --color-text-secondary: #4A4A4A;
  --color-text-tertiary: #6B7280;
  --color-text-disabled: #9CA3AF;

  /* Borders */
  --color-border-light: #E5E7EB;
  --color-border-medium: #D1D5DB;
  --color-border-strong: #9CA3AF;

  /* Accent */
  --color-accent: #D97706;
  --color-accent-hover: #B45309;
  --color-accent-text: #FFFFFF;

  /* Semantic */
  --color-success: #059669;
  --color-warning: #D97706;
  --color-error: #DC2626;
  --color-info: #2563EB;
}
```

### 6.3 Dark Theme

```css
[data-theme="dark"] {
  /* Backgrounds - нейтральные серые, НЕ синие */
  --color-bg-primary: #121212;      /* Material Design рекомендация */
  --color-bg-secondary: #1E1E1E;
  --color-bg-tertiary: #252525;
  --color-bg-elevated: #2D2D2D;

  /* Text - off-white для комфорта */
  --color-text-primary: #E8E8E8;    /* НЕ чистый белый */
  --color-text-secondary: #B3B3B3;
  --color-text-tertiary: #808080;
  --color-text-disabled: #5C5C5C;

  /* Borders */
  --color-border-light: #2D2D2D;
  --color-border-medium: #3D3D3D;
  --color-border-strong: #525252;

  /* Accent - ярче для dark mode */
  --color-accent: #F59E0B;
  --color-accent-hover: #FBBF24;
  --color-accent-text: #121212;

  /* Semantic - светлее для dark */
  --color-success: #34D399;
  --color-warning: #FBBF24;
  --color-error: #F87171;
  --color-info: #60A5FA;
}
```

### 6.4 Sepia Theme (для Reader)

```css
[data-theme="sepia"] {
  /* Backgrounds - тёплые бежевые (Kindle-inspired) */
  --color-bg-primary: #FBF0D9;
  --color-bg-secondary: #F5E6C8;
  --color-bg-tertiary: #EFD9B0;
  --color-bg-elevated: #FFF8EC;

  /* Text - тёплые коричневые */
  --color-text-primary: #3D2914;
  --color-text-secondary: #5F4B32;
  --color-text-tertiary: #7D6548;
  --color-text-disabled: #A08B6E;

  /* Borders */
  --color-border-light: #E8D5B5;
  --color-border-medium: #D4BC94;

  /* Accent - тёплый оранжевый */
  --color-accent: #B45309;
  --color-accent-hover: #92400E;
}
```

### 6.5 Contrast Matrix

| Комбинация | Light | Dark | Sepia | WCAG |
|------------|-------|------|-------|------|
| text-primary on bg-primary | 16.1:1 | 15.4:1 | 11.2:1 | AAA |
| text-secondary on bg-primary | 9.3:1 | 9.1:1 | 6.8:1 | AAA |
| accent on bg-primary | 4.8:1 | 4.6:1 | 5.2:1 | AA |

---

## 7. Типографика

### 7.1 Font Stack

```css
:root {
  /* UI font */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;

  /* Reader font */
  --font-serif: 'Crimson Text', 'Georgia', serif;

  /* Code font */
  --font-mono: 'Fira Code', 'Monaco', monospace;
}
```

### 7.2 Type Scale (fluid)

```css
:root {
  --text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.8rem);
  --text-sm: clamp(0.875rem, 0.8rem + 0.35vw, 0.95rem);
  --text-base: clamp(1rem, 0.9rem + 0.5vw, 1.125rem);
  --text-lg: clamp(1.125rem, 1rem + 0.6vw, 1.25rem);
  --text-xl: clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem);
  --text-2xl: clamp(1.5rem, 1.25rem + 1.25vw, 2rem);
  --text-3xl: clamp(1.875rem, 1.5rem + 1.875vw, 2.5rem);
  --text-4xl: clamp(2.25rem, 1.75rem + 2.5vw, 3rem);
}
```

### 7.3 Line Heights

| Использование | Line Height |
|---------------|-------------|
| Заголовки | 1.2 |
| Body text (UI) | 1.5 |
| Body text (Reader) | 1.6-1.8 |
| Labels/captions | 1.4 |

---

## 8. Компоненты

### 8.1 Приоритет редизайна

**Tier 1 - Критические (неделя 1-2):**
- Button (variants: primary, secondary, ghost, destructive)
- Input, Select, Checkbox, Radio
- Card, Modal, Dialog
- Toast/Notification

**Tier 2 - Важные (неделя 3-4):**
- Navigation (Header, Sidebar, BottomNav)
- BookCard, BookGrid
- Reader components (Toolbar, Settings, TOC)

**Tier 3 - Остальные (неделя 5-6):**
- Stats cards, Progress indicators
- Forms (Login, Register, Settings)
- Admin components

### 8.2 Button Variants

```tsx
// Button.tsx с CVA
const buttonVariants = cva(
  // Base styles
  "inline-flex items-center justify-center font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-foreground hover:bg-accent/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent/10 hover:text-accent",
        destructive: "bg-error text-white hover:bg-error/90",
        outline: "border border-border bg-transparent hover:bg-accent/10",
      },
      size: {
        sm: "h-9 px-3 text-sm rounded-md",
        md: "h-11 px-4 text-base rounded-lg",  // Touch-friendly default
        lg: "h-12 px-6 text-lg rounded-lg",
        icon: "h-11 w-11 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);
```

### 8.3 Card Component

```tsx
// Card.tsx
const Card = ({ children, variant = 'default', ...props }) => (
  <div
    className={cn(
      "rounded-xl border border-border bg-card p-4",
      "transition-shadow duration-200",
      variant === 'elevated' && "shadow-md hover:shadow-lg",
      variant === 'interactive' && "cursor-pointer hover:border-accent/50",
    )}
    {...props}
  >
    {children}
  </div>
);
```

---

## 9. Страницы и навигация

### 9.1 Information Architecture

```
App
├── / (HomePage) - Landing, stats, recent activity
├── /library - Book grid with search/filters
│   └── /library/:id - Book details
├── /reader/:bookId - EPUB reader (immersive)
├── /images - Generated images gallery
├── /profile - User info, reading goals
├── /settings - App settings
├── /stats - Detailed reading statistics
├── /admin - Admin dashboard
└── /auth
    ├── /login
    └── /register
```

### 9.2 Navigation Patterns

**Desktop (≥1024px):**
- Top header с logo, search, user menu
- Left sidebar с navigation (collapsible)

**Tablet (768px-1023px):**
- Top header
- Hamburger → drawer menu

**Mobile (<768px):**
- Bottom navigation (5 items max)
- Top header minimal (logo, search icon)

### 9.3 Bottom Navigation Items

```tsx
const bottomNavItems = [
  { icon: Home, label: 'Главная', path: '/' },
  { icon: Library, label: 'Библиотека', path: '/library' },
  { icon: Images, label: 'Галерея', path: '/images' },
  { icon: BarChart3, label: 'Статистика', path: '/stats' },
  { icon: User, label: 'Профиль', path: '/profile' },
];
```

---

## 10. Mobile-First подход

### 10.1 Breakpoints

```css
/* Mobile-first breakpoints */
--breakpoint-sm: 640px;   /* Large phones */
--breakpoint-md: 768px;   /* Tablets */
--breakpoint-lg: 1024px;  /* Laptops */
--breakpoint-xl: 1280px;  /* Desktops */
--breakpoint-2xl: 1536px; /* Large desktops */
```

### 10.2 Touch Targets

| Элемент | Минимальный размер | Рекомендуемый |
|---------|-------------------|---------------|
| Buttons | 44×44px | 48×48px |
| Links (inline) | 44×24px | - |
| Icons (clickable) | 44×44px | 48×48px |
| Spacing между targets | 8px | 12px |

### 10.3 Safe Areas

```css
/* iOS Safe Areas */
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.header {
  padding-top: env(safe-area-inset-top, 0);
}
```

### 10.4 Gestures в Reader

| Gesture | Action |
|---------|--------|
| Tap left 20% | Previous page |
| Tap right 80% | Next page |
| Tap center | Toggle UI |
| Swipe left | Next page |
| Swipe right | Previous page |
| Swipe down from top | Show header |
| Long press | Selection menu |

---

## 11. Accessibility

### 11.1 WCAG 2.2 AA Checklist

**Perceivable:**
- [x] Color contrast ≥ 4.5:1 для текста
- [x] Color contrast ≥ 3:1 для UI
- [ ] Images имеют alt text
- [ ] Video/audio имеют captions

**Operable:**
- [x] Keyboard navigation везде
- [x] Focus indicators видимые
- [ ] Skip links
- [ ] Touch targets ≥ 44px

**Understandable:**
- [ ] Language declared
- [ ] Error messages понятные
- [ ] Labels для всех inputs

**Robust:**
- [x] Valid HTML
- [ ] ARIA где необходимо
- [ ] Screen reader тестирование

### 11.2 Focus Styles

```css
/* Focus visible styles */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Для dark backgrounds */
[data-theme="dark"] :focus-visible {
  outline-color: var(--color-accent);
  box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.3);
}
```

### 11.3 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 12. Анимации

### 12.1 Timing Guidelines

| Тип анимации | Длительность | Easing |
|--------------|--------------|--------|
| Micro (hover, focus) | 150-200ms | ease-out |
| Standard (modal, dropdown) | 200-300ms | ease-in-out |
| Complex (page transitions) | 300-500ms | cubic-bezier |

### 12.2 Framer Motion Presets

```typescript
// animation-presets.ts
export const presets = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },

  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.3 },
  },

  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2 },
  },

  stagger: {
    animate: {
      transition: {
        staggerChildren: 0.05,
      },
    },
  },
};
```

### 12.3 AutoAnimate для списков

```tsx
import { useAutoAnimate } from '@formkit/auto-animate/react';

function BookList({ books }) {
  const [parent] = useAutoAnimate();

  return (
    <div ref={parent} className="grid gap-4">
      {books.map(book => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}
```

---

## 13. План реализации

### Phase 1: Foundation (Неделя 1)

**Задачи:**
1. Создать структуру design-system/
2. Определить все CSS custom properties
3. Обновить globals.css с новой цветовой схемой
4. Обновить tailwind.config.js
5. Создать примитивы (Box, Flex, Stack, Text)

**Результат:** Новая цветовая схема применена глобально

### Phase 2: Core Components (Неделя 2)

**Задачи:**
1. Переделать Button с новыми variants
2. Переделать Input, Select, Checkbox
3. Переделать Card, Modal
4. Переделать Toast/Notification
5. Добавить Skeleton components

**Результат:** Базовые компоненты готовы

### Phase 3: Navigation (Неделя 3)

**Задачи:**
1. Редизайн Header (responsive)
2. Создать BottomNav для mobile
3. Редизайн Sidebar
4. Добавить mobile drawer menu

**Результат:** Навигация работает на всех устройствах

### Phase 4: Reader (Неделя 4)

**Задачи:**
1. Редизайн ReaderToolbar (минималистичный)
2. Редизайн ReaderSettings (новые темы)
3. Редизайн TocSidebar
4. Улучшить touch interactions
5. Добавить gesture navigation

**Результат:** Reader с улучшенным UX

### Phase 5: Pages (Неделя 5)

**Задачи:**
1. Редизайн HomePage
2. Редизайн LibraryPage + BookCard
3. Редизайн Login/Register
4. Редизайн SettingsPage
5. Редизайн ProfilePage, StatsPage

**Результат:** Все страницы обновлены

### Phase 6: Polish & Testing (Неделя 6)

**Задачи:**
1. Accessibility аудит (axe, Lighthouse)
2. Cross-browser тестирование
3. Mobile device тестирование
4. Performance оптимизация
5. Документация обновлена

**Результат:** Production-ready дизайн

---

## 14. Метрики успеха

### До/После сравнение

| Метрика | До | После |
|---------|-----|-------|
| Lighthouse Accessibility | ~70 | 95+ |
| Lighthouse Performance | ~75 | 90+ |
| Color contrast (min) | 3.5:1 | 4.5:1 |
| Touch targets compliant | 60% | 100% |
| Hardcoded colors | 9+ | 0 |
| Design systems | 0 | 1 unified |
| Mobile usability | Fair | Excellent |

### Quality Gates

Каждая фаза должна пройти:
- [ ] TypeScript компиляция без ошибок
- [ ] Lighthouse Accessibility ≥ 90
- [ ] Все touch targets ≥ 44px
- [ ] Все contrast ratios ≥ 4.5:1
- [ ] Tested на iOS Safari, Android Chrome
- [ ] Reviewed peer developer

---

## Связанные документы

- [02-color-system-spec.md](./02-color-system-spec.md) - Детальная спецификация цветов
- [03-component-library.md](./03-component-library.md) - Библиотека компонентов
- [04-page-wireframes.md](./04-page-wireframes.md) - Wireframes страниц
- [05-accessibility-checklist.md](./05-accessibility-checklist.md) - Чеклист доступности

---

## Источники исследования

### Веб-дизайн 2025-2026
- Glassmorphism и Liquid Glass (Apple, Figma)
- Micro-animations и transitions
- Variable fonts и fluid typography
- Aurora/Mesh gradients

### UX читалок книг
- Kindle: EasyReach tap zones, Time to Read
- Apple Books: Typography settings, themes
- Kobo: Customization, Pageless mode

### Dark Mode
- Material Design recommendations (#121212)
- OLED considerations
- Off-white text (#E8E8E8)
- Halation effect avoidance

### Accessibility
- WCAG 2.2 AA requirements
- Focus indicators 2.4.7, 2.4.13
- Touch targets 2.5.5
- Color contrast 1.4.3

### Tech Stack
- Tailwind CSS 4.0 features
- Framer Motion 12.x
- AutoAnimate
- Radix UI primitives
