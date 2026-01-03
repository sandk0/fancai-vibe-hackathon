# fancai - Дорожная карта реализации редизайна

**Дата:** 3 января 2026
**Версия:** 1.0

---

## Обзор фаз

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: Foundation (5-7 дней) ✅ ЗАВЕРШЕНО                                 │
│  ├─ ✅ Новая цветовая система CSS variables                                  │
│  ├─ ✅ Tailwind config обновление                                            │
│  ├─ ✅ useTheme + data-theme атрибут                                         │
│  └─ Результат: Dark mode без синих тонов                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 2: Core Components (7-10 дней) ✅ ЗАВЕРШЕНО                            │
│  ├─ ✅ Button, Input, Select, Checkbox, Radio                                 │
│  ├─ ✅ Card, Modal, Dialog, Toast                                             │
│  ├─ ✅ Skeleton components                                                    │
│  └─ Результат: Консистентные базовые компоненты                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 3: Navigation (5-7 дней) ✅ ЗАВЕРШЕНО                                  │
│  ├─ ✅ Responsive Header                                                      │
│  ├─ ✅ Mobile Bottom Navigation                                               │
│  ├─ ✅ Sidebar redesign (collapsible)                                         │
│  └─ Результат: Mobile-first навигация                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 4: Reader (7-10 дней) ✅ ЗАВЕРШЕНО                                     │
│  ├─ ✅ Минималистичный Toolbar + auto-hide                                    │
│  ├─ ✅ 4 темы чтения (light, dark, sepia, night)                              │
│  ├─ ✅ EasyReach tap zones + Swipe gestures                                   │
│  └─ Результат: Улучшенный reading experience                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 5: Pages (7-10 дней) ✅ ЗАВЕРШЕНО                                      │
│  ├─ ✅ HomePage, LibraryPage, BookCard                                        │
│  ├─ ✅ Auth pages (Login, Register)                                           │
│  ├─ ✅ Settings, Profile, Stats                                               │
│  └─ Результат: Все страницы обновлены                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  PHASE 6: Polish & QA (5-7 дней) ✅ ЗАВЕРШЕНО                                 │
│  ├─ ✅ Accessibility audit (10 исправлений)                                   │
│  ├─ ✅ Performance audit (lazy loading, preconnect)                           │
│  ├─ ✅ Test coverage audit (документация)                                     │
│  └─ Результат: Production-ready                                              │
└─────────────────────────────────────────────────────────────────────────────┘

ИТОГО: 6-8 недель
```

---

## Phase 1: Foundation ✅ ЗАВЕРШЕНО

**Дата завершения:** 3 января 2026

### Цель
Создать основу design system с новой цветовой схемой.

### Задачи

| # | Задача | Файлы | Статус |
|---|--------|-------|--------|
| 1.1 | Обновить globals.css с новыми CSS vars | `globals.css` | ✅ |
| 1.2 | Обновить tailwind.config.js | `tailwind.config.js` | ✅ |
| 1.3 | Обновить useTheme hook с data-theme | `useTheme.ts` | ✅ |
| 1.4 | Обновить FOUC prevention | `index.html` | ✅ |
| 1.5 | Примитивы Box/Flex/Stack | - | 🔜 Phase 2 |

### Результаты

- **Dark mode:** Нейтральные серые (#121212, #1E1E1E) вместо синеватых
- **Text:** Off-white (#E8E8E8) вместо чистого белого
- **Accent:** Тёплый оранжевый (#D97706, #F59E0B)
- **Sepia:** Kindle-подобные цвета (#FBF0D9)
- **Build:** Успешен (4.17s)

См. подробный отчёт: [04-phase1-completion.md](./04-phase1-completion.md)

### Детали: 1.2 Обновление globals.css

```css
/* ЗАМЕНИТЬ текущие переменные на: */

:root {
  /* Backgrounds - нейтральные */
  --color-bg-base: #FFFFFF;
  --color-bg-subtle: #F9FAFB;
  --color-bg-muted: #F3F4F6;
  --color-bg-emphasis: #E5E7EB;

  /* Text */
  --color-text-default: #111827;
  --color-text-muted: #4B5563;
  --color-text-subtle: #6B7280;
  --color-text-disabled: #9CA3AF;

  /* Borders */
  --color-border-default: #E5E7EB;
  --color-border-muted: #F3F4F6;

  /* Accent - тёплый оранжевый */
  --color-accent-600: #D97706;
  --color-accent-700: #B45309;

  /* Semantic */
  --color-success-600: #059669;
  --color-warning-600: #D97706;
  --color-error-600: #DC2626;
  --color-info-600: #2563EB;

  /* Focus */
  --color-border-focus: #D97706;
}

[data-theme="dark"] {
  /* Backgrounds - НЕЙТРАЛЬНЫЕ СЕРЫЕ */
  --color-bg-base: #121212;
  --color-bg-subtle: #1A1A1A;
  --color-bg-muted: #1E1E1E;
  --color-bg-emphasis: #2A2A2A;

  /* Text - OFF-WHITE */
  --color-text-default: #E8E8E8;
  --color-text-muted: #B3B3B3;
  --color-text-subtle: #808080;
  --color-text-disabled: #5C5C5C;

  /* Borders - нейтральные */
  --color-border-default: #2D2D2D;
  --color-border-muted: #252525;

  /* Accent - ярче для dark */
  --color-accent-600: #F59E0B;
  --color-accent-700: #FBBF24;

  /* Semantic - светлее */
  --color-success-600: #34D399;
  --color-warning-600: #FBBF24;
  --color-error-600: #F87171;
  --color-info-600: #60A5FA;

  --color-border-focus: #FBBF24;
}

[data-theme="sepia"] {
  /* Backgrounds - тёплые бежевые */
  --color-bg-base: #FBF0D9;
  --color-bg-subtle: #F7EBCF;
  --color-bg-muted: #F5E6C8;

  /* Text - тёплые коричневые */
  --color-text-default: #3D2914;
  --color-text-muted: #5F4B32;

  /* Borders */
  --color-border-default: #E8D5B5;

  /* Accent */
  --color-accent-600: #B45309;

  --color-border-focus: #B45309;
}
```

### Критерии завершения Phase 1

- [ ] Dark mode использует нейтральные серые (#121212, #1E1E1E)
- [ ] Текст в dark mode off-white (#E8E8E8)
- [ ] Sepia тема с Kindle-подобными цветами
- [ ] Accent color тёплый оранжевый
- [ ] Build проходит без ошибок
- [ ] Визуально нет синеватых тонов

---

## Phase 2: Core Components ✅ ЗАВЕРШЕНО

**Дата завершения:** 3 января 2026

### Цель
Редизайн базовых UI компонентов.

### Компоненты

| Компонент | Файл | Статус | Изменения |
|-----------|------|--------|-----------|
| Button | `UI/button.tsx` | ✅ | 6 variants, 4 sizes, loading state |
| Input | `UI/Input.tsx` | ✅ | 3 variants, icons, label/helper |
| Select | `UI/Select.tsx` | ✅ | Native select, chevron icon |
| Checkbox | `UI/Checkbox.tsx` | ✅ | Indeterminate, animated |
| Radio | `UI/Radio.tsx` | ✅ | RadioGroup, RadioGroupItem |
| Card | `UI/Card.tsx` | ✅ | 3 variants, sub-components |
| Modal | `UI/Modal.tsx` | ✅ | Focus trap, framer-motion |
| Dialog | `UI/Dialog.tsx` | ✅ | useDialog hook, variants |
| Toast | `UI/NotificationContainer.tsx` | ✅ | Progress bar, animations |
| Skeleton | `UI/Skeleton.tsx` | ✅ | 6 specialized skeletons |

### Результаты

- **Touch targets:** Все ≥44px (Apple HIG)
- **Accessibility:** ARIA, keyboard navigation, focus trap
- **Animations:** framer-motion для Modal/Toast
- **Build:** Успешен (4.18s)

См. подробный отчёт: [05-phase2-completion.md](./05-phase2-completion.md)

### Детали: Button Redesign

```tsx
// src/design-system/components/Button/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base styles
  [
    'inline-flex items-center justify-center',
    'font-medium',
    'transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        primary: [
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90',
        ],
        secondary: [
          'bg-secondary text-secondary-foreground',
          'hover:bg-secondary/80',
        ],
        ghost: [
          'hover:bg-accent/10 hover:text-accent-foreground',
        ],
        destructive: [
          'bg-destructive text-destructive-foreground',
          'hover:bg-destructive/90',
        ],
        outline: [
          'border border-input bg-background',
          'hover:bg-accent/10 hover:text-accent-foreground',
        ],
        link: [
          'text-primary underline-offset-4 hover:underline',
        ],
      },
      size: {
        sm: 'h-9 px-3 text-sm rounded-md',
        md: 'h-11 px-4 text-base rounded-lg',     // Touch-friendly
        lg: 'h-12 px-6 text-lg rounded-lg',
        icon: 'h-11 w-11 rounded-lg',             // 44x44 minimum
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? (
          <span className="animate-spin mr-2">⏳</span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
```

### Детали: Skeleton Component

```tsx
// src/design-system/components/Skeleton/Skeleton.tsx
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className,
  variant = 'text',
  width,
  height,
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-muted',
        variant === 'text' && 'h-4 rounded',
        variant === 'circular' && 'rounded-full',
        variant === 'rectangular' && 'rounded-lg',
        className
      )}
      style={{ width, height }}
    />
  );
}

// Usage examples
export function BookCardSkeleton() {
  return (
    <div className="rounded-xl border border-border p-4 space-y-4">
      <Skeleton variant="rectangular" className="aspect-[2/3] w-full" />
      <Skeleton variant="text" className="h-5 w-3/4" />
      <Skeleton variant="text" className="h-4 w-1/2" />
    </div>
  );
}
```

### Критерии завершения Phase 2

- [ ] Все кнопки минимум 44px touch target
- [ ] Все inputs имеют visible focus states
- [ ] Skeleton компоненты для loading states
- [ ] Toast/Notification с новыми цветами
- [ ] Modal с focus trap и mobile fullscreen

---

## Phase 3: Navigation ✅ ЗАВЕРШЕНО

**Дата завершения:** 3 января 2026

### Цель
Mobile-first навигация с bottom nav для мобильных.

### Задачи

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 3.1 | Создать BottomNav | `Navigation/BottomNav.tsx` | ✅ |
| 3.2 | Редизайн Header | `Layout/Header.tsx` | ✅ |
| 3.3 | Редизайн Sidebar | `Layout/Sidebar.tsx` | ✅ |
| 3.4 | Mobile drawer | `Navigation/MobileDrawer.tsx` | ✅ |
| 3.5 | Safe areas | `tailwind.config.js` | ✅ |

### Результаты

- **BottomNav:** 5 пунктов, backdrop-blur, safe areas
- **Header:** Responsive (mobile/desktop), hamburger menu
- **Sidebar:** Collapsible (240px/64px), localStorage persistence
- **MobileDrawer:** framer-motion, focus trap, body scroll lock
- **Safe areas:** pt-safe, pb-safe, touch-target utilities
- **Build:** Успешен (4.15s)

См. подробный отчёт: [06-phase3-completion.md](./06-phase3-completion.md)

### Детали: Bottom Navigation

```tsx
// src/components/Navigation/BottomNav.tsx
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  Library,
  Images,
  BarChart3,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: 'Главная', path: '/' },
  { icon: Library, label: 'Библиотека', path: '/library' },
  { icon: Images, label: 'Галерея', path: '/images' },
  { icon: BarChart3, label: 'Статистика', path: '/stats' },
  { icon: User, label: 'Профиль', path: '/profile' },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-card/95 backdrop-blur-md',
        'border-t border-border',
        'pb-safe',  // iOS safe area
        'md:hidden' // Hide on desktop
      )}
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex flex-col items-center justify-center',
                'w-16 h-14 rounded-lg',
                'transition-colors duration-150',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'w-6 h-6 mb-1',
                  isActive && 'stroke-[2.5]'
                )}
              />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

### Breakpoint Strategy

```css
/* Mobile: Bottom nav visible, header minimal */
@media (max-width: 767px) {
  .main-content {
    padding-bottom: calc(4rem + env(safe-area-inset-bottom));
  }
}

/* Tablet: Hamburger + drawer */
@media (min-width: 768px) and (max-width: 1023px) {
  .bottom-nav { display: none; }
  .mobile-drawer { display: block; }
}

/* Desktop: Full sidebar */
@media (min-width: 1024px) {
  .bottom-nav { display: none; }
  .sidebar { display: flex; }
}
```

### Критерии завершения Phase 3

- [ ] Bottom nav работает на iOS и Android
- [ ] Safe areas поддержаны (notch, home indicator)
- [ ] Header адаптивен (mobile/tablet/desktop)
- [ ] Smooth transitions между layouts

---

## Phase 4: Reader ✅ ЗАВЕРШЕНО

**Дата завершения:** 3 января 2026

### Цель
Улучшить reading experience с фокусом на immersion.

### Задачи

| # | Задача | Файл | Статус |
|---|--------|------|--------|
| 4.1 | ReaderToolbar (минималистичный) | `Reader/ReaderToolbar.tsx` | ✅ |
| 4.2 | Reader themes (4 темы) | `styles/globals.css` | ✅ |
| 4.3 | EasyReach tap zones | `Reader/EpubReader.tsx` | ✅ |
| 4.4 | Gesture navigation | `Reader/EpubReader.tsx` | ✅ |
| 4.5 | TocSidebar (progress) | `Reader/TocSidebar.tsx` | ✅ |
| 4.6 | ReaderSettings (bottom sheet) | `Reader/ReaderSettingsPanel.tsx` | ✅ |

### Результаты

- **Immersive mode:** Auto-hide toolbar через 3 секунды
- **Tap zones:** 20% left, 60% center, 20% right (EasyReach)
- **Swipe:** Left/right для page navigation
- **Themes:** Light, Dark, Sepia, Night (AMOLED)
- **TocSidebar:** Progress indicators, search, animations
- **Settings:** Bottom sheet на mobile, side panel на desktop
- **Build:** Успешен (4.13s)

См. подробный отчёт: [07-phase4-completion.md](./07-phase4-completion.md)

### Детали: Reader Tap Zones

```tsx
// EasyReach zones (Kindle pattern)
// Left 20%: Previous page
// Center: Toggle UI
// Right 80%: Next page

const handleTap = (e: React.MouseEvent) => {
  const { clientX } = e;
  const { width } = e.currentTarget.getBoundingClientRect();
  const ratio = clientX / width;

  if (ratio < 0.2) {
    goToPreviousPage();
  } else if (ratio > 0.8) {
    goToNextPage();
  } else {
    toggleUI();
  }
};
```

### Детали: Immersive Mode

```tsx
// Toggle all UI with center tap or swipe
const [isImmersive, setIsImmersive] = useState(true);

return (
  <div className="relative h-screen">
    {/* Header - slides up when hidden */}
    <motion.header
      initial={false}
      animate={{ y: isImmersive ? -100 : 0 }}
      className="absolute top-0 inset-x-0 z-10"
    >
      <ReaderToolbar />
    </motion.header>

    {/* Content */}
    <EpubContent onClick={handleTap} />

    {/* Footer - slides down when hidden */}
    <motion.footer
      initial={false}
      animate={{ y: isImmersive ? 100 : 0 }}
      className="absolute bottom-0 inset-x-0 z-10"
    >
      <ProgressBar />
    </motion.footer>
  </div>
);
```

### Критерии завершения Phase 4

- [ ] UI скрывается в immersive mode
- [ ] Tap zones работают (20/80 split)
- [ ] Swipe navigation работает
- [ ] Новые темы применяются корректно
- [ ] Settings удобны на mobile

---

## Phase 5: Pages

### Цель
Редизайн всех страниц приложения.

### Порядок редизайна

| # | Страница | Приоритет | Ключевые изменения |
|---|----------|-----------|-------------------|
| 5.1 | LibraryPage + BookCard | P0 | Grid, filters, skeleton |
| 5.2 | HomePage | P0 | Hero, stats, activity |
| 5.3 | LoginPage | P0 | Mobile-first form |
| 5.4 | RegisterPage | P0 | Mobile-first form |
| 5.5 | BookPage | P1 | Book details, actions |
| 5.6 | SettingsPage | P1 | Tab navigation |
| 5.7 | ProfilePage | P1 | User info, goals |
| 5.8 | StatsPage | P1 | Charts, achievements |
| 5.9 | ImagesGalleryPage | P2 | Gallery grid |
| 5.10 | AdminPage | P2 | Dashboard |

### Детали: BookCard Redesign

```tsx
// src/components/Library/BookCard.tsx
import { motion } from 'framer-motion';
import { MoreVertical, Trash2, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BookCardProps {
  book: Book;
  onDelete: () => void;
  onRead: () => void;
}

export function BookCard({ book, onDelete, onRead }: BookCardProps) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'group relative rounded-xl overflow-hidden',
        'bg-card border border-border',
        'transition-shadow hover:shadow-lg'
      )}
    >
      {/* Cover */}
      <div className="aspect-[2/3] relative">
        <img
          src={book.coverUrl || '/placeholder-cover.jpg'}
          alt={book.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Progress overlay */}
        {book.progress > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-muted">
            <div
              className="h-full bg-primary"
              style={{ width: `${book.progress}%` }}
            />
          </div>
        )}

        {/* Actions overlay - visible on hover/focus */}
        <div
          className={cn(
            'absolute inset-0 bg-black/50 opacity-0',
            'group-hover:opacity-100 group-focus-within:opacity-100',
            'transition-opacity duration-200',
            'flex items-center justify-center gap-2'
          )}
        >
          <button
            onClick={onRead}
            className="p-3 rounded-full bg-primary text-primary-foreground"
            aria-label={`Читать ${book.title}`}
          >
            <BookOpen className="w-6 h-6" />
          </button>
          <button
            onClick={onDelete}
            className="p-3 rounded-full bg-destructive text-destructive-foreground"
            aria-label={`Удалить ${book.title}`}
          >
            <Trash2 className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-foreground line-clamp-1">
          {book.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-1">
          {book.author}
        </p>
      </div>

      {/* Mobile actions - always visible */}
      <button
        className="md:hidden absolute top-2 right-2 p-2 rounded-full bg-card/90"
        aria-label="Действия"
      >
        <MoreVertical className="w-5 h-5" />
      </button>
    </motion.article>
  );
}
```

### Критерии завершения Phase 5

- [ ] Все страницы используют новые компоненты
- [ ] Нет hardcoded цветов
- [ ] Mobile-first responsive
- [ ] Skeleton states для loading
- [ ] Accessible forms

---

## Phase 6: Polish & QA

### Цель
Финальная полировка и тестирование.

### Задачи

| # | Задача | Приоритет |
|---|--------|-----------|
| 6.1 | Accessibility audit (axe) | P0 |
| 6.2 | Lighthouse audit | P0 |
| 6.3 | Cross-browser testing | P0 |
| 6.4 | Mobile device testing | P0 |
| 6.5 | Performance optimization | P1 |
| 6.6 | Documentation update | P1 |

### Accessibility Checklist

```
PERCEIVABLE
✅ Color contrast ≥ 4.5:1 text, ≥ 3:1 UI
✅ Images have alt text
✅ Focus visible on all interactive elements
✅ No information conveyed by color alone

OPERABLE
✅ All functionality keyboard accessible
✅ Touch targets ≥ 44px
✅ Focus order logical
✅ Skip links present
✅ No keyboard traps

UNDERSTANDABLE
✅ Page language set
✅ Error messages descriptive
✅ Labels on all inputs
✅ Consistent navigation

ROBUST
✅ Valid HTML
✅ ARIA used correctly
✅ Works with screen readers
```

### Browser Matrix

| Browser | Version | Priority |
|---------|---------|----------|
| Chrome | Latest | P0 |
| Safari (iOS) | 16+ | P0 |
| Firefox | Latest | P1 |
| Edge | Latest | P1 |
| Safari (macOS) | Latest | P1 |
| Samsung Internet | Latest | P2 |

### Device Testing

| Device | Screen | Priority |
|--------|--------|----------|
| iPhone SE | 375×667 | P0 |
| iPhone 14 Pro | 393×852 | P0 |
| iPad | 768×1024 | P0 |
| Android Phone | 360×800 | P0 |
| Desktop | 1920×1080 | P0 |

### Критерии завершения Phase 6

- [ ] Lighthouse Accessibility ≥ 95
- [ ] Lighthouse Performance ≥ 90
- [ ] Все contrast ratios ≥ 4.5:1
- [ ] Все touch targets ≥ 44px
- [ ] Работает на всех target devices
- [ ] CLAUDE.md обновлён

---

## Timeline Summary

| Phase | Длительность | Результат |
|-------|--------------|-----------|
| Phase 1: Foundation | 5-7 дней | Новая цветовая схема |
| Phase 2: Core Components | 7-10 дней | Базовые компоненты |
| Phase 3: Navigation | 5-7 дней | Mobile-first nav |
| Phase 4: Reader | 7-10 дней | Улучшенный reader |
| Phase 5: Pages | 7-10 дней | Все страницы |
| Phase 6: Polish | 5-7 дней | Production ready |
| **ИТОГО** | **6-8 недель** | **Полный редизайн** |

---

## Risk Mitigation

### Риск: Breaking changes

**Митигация:**
- Feature flags для постепенного rollout
- A/B testing критичных изменений
- Сохранение old components до полной миграции

### Риск: Performance regression

**Митигация:**
- Lighthouse CI в pipeline
- Bundle size monitoring
- Lazy loading для тяжёлых компонентов

### Риск: Accessibility regression

**Митигация:**
- axe-core в unit tests
- Manual testing с VoiceOver/NVDA
- Automated contrast checking

---

## Success Metrics

### Технические метрики

| Метрика | Текущее | Цель |
|---------|---------|------|
| Lighthouse Accessibility | ~70 | 95+ |
| Lighthouse Performance | ~75 | 90+ |
| Bundle size | ~2.7MB | <2.5MB |
| FCP | ~2.5s | <1.5s |
| LCP | ~3.5s | <2.5s |

### UX метрики

| Метрика | Текущее | Цель |
|---------|---------|------|
| Mobile usability | Fair | Excellent |
| Touch target compliance | 60% | 100% |
| Color contrast compliance | 80% | 100% |
| Hardcoded colors | 9+ | 0 |

---

## Связанные документы

- [01-redesign-master-plan.md](./01-redesign-master-plan.md) - Master Plan
- [02-color-system-spec.md](./02-color-system-spec.md) - Цветовая система
- [04-component-specs.md](./04-component-specs.md) - Спецификации компонентов
- [05-accessibility-checklist.md](./05-accessibility-checklist.md) - Чеклист доступности
