# Аудит системы тем - Сводный отчёт

**Дата:** 2 января 2026
**Версия:** 1.0
**Статус:** Критические проблемы выявлены

---

## Обзор

Проведён комплексный аудит системы тем приложения (светлая, тёмная, сепия). Выявлены критические проблемы, влияющие на UX пользователей.

## Критические находки

### 1. Несуществующие классы `primary-600` (КРИТИЧНО)

**Проблема:** В ~35+ файлах используются классы `bg-primary-600`, `text-primary-600`, `hover:bg-primary-700`, которые **не существуют** в конфигурации Tailwind.

**Причина:** В `tailwind.config.js` цвет `primary` определён только как:
```javascript
primary: {
  DEFAULT: "hsl(var(--primary))",
  foreground: "hsl(var(--primary-foreground))",
}
```

Tailwind не генерирует нумерованные варианты (50, 100, 200... 900) без явного определения.

**Симптом:** Кнопка "Выбрать файлы" невидима в светлой теме - белый текст на белом фоне.

**Затронутые файлы:**
- `BookUploadModal.tsx` (строки 314-320)
- `AdminPanelPage.tsx`
- `LoginPage.tsx`, `RegisterPage.tsx`
- `ProfilePage.tsx`
- И ещё ~30 файлов

### 2. Неполная поддержка темы Sepia (ВЫСОКИЙ)

**Проблема:** Многие компоненты не имеют стилей для темы sepia.

**Затронутые компоненты:**
| Компонент | Проблема |
|-----------|----------|
| `Sidebar.tsx` | Нет sepia вариантов для `dark:` классов |
| `NotificationContainer.tsx` | Hardcoded dark/light, нет sepia |
| `ErrorBoundary.tsx` | Только dark: варианты |
| `Navbar.tsx` | Частичная поддержка sepia |
| `BookCard.tsx` | Sepia цвета не адаптированы |

### 3. Хардкоженные цвета в подсветках (СРЕДНИЙ)

**Проблема:** Подсветки описаний используют фиксированные синие цвета вместо CSS-переменных темы.

**Файл:** `useDescriptionHighlighting.ts`
```typescript
// Hardcoded цвета:
backgroundColor: 'rgba(59, 130, 246, 0.3)'  // Синий
border: '2px solid rgba(59, 130, 246, 0.6)'
```

**Последствие:** В теме sepia синяя подсветка выглядит неестественно.

### 4. Несогласованность CSS-переменных (НИЗКИЙ)

**Проблема:** Некоторые компоненты напрямую используют Tailwind классы вместо CSS-переменных.

**Пример:**
```css
/* Неправильно */
.component { @apply bg-gray-100 dark:bg-gray-800; }

/* Правильно */
.component { background: hsl(var(--card)); }
```

---

## Статистика

| Метрика | Значение |
|---------|----------|
| Файлов с `primary-600` | ~35 |
| Компонентов без sepia | ~15 |
| Хардкоженных цветов | ~20 мест |
| CSS-переменных темы | 24 (определены) |

## Приоритизация

| Приоритет | Проблема | Влияние |
|-----------|----------|---------|
| P0 | primary-600 классы | Кнопки невидимы |
| P1 | Sepia поддержка | UX ухудшен |
| P2 | Hardcoded подсветки | Визуальный диссонанс |
| P3 | CSS-переменные | Maintainability |

---

## Рекомендации

1. **Немедленно:** Добавить нумерованные варианты primary в Tailwind config
2. **Высокий приоритет:** Добавить sepia варианты в ключевые компоненты
3. **Средний приоритет:** Заменить hardcoded цвета на CSS-переменные
4. **Низкий приоритет:** Рефакторинг на использование CSS-переменных везде

---

## Архитектурные проблемы (выявлены при углублённом анализе)

### Три параллельные системы тем

| Система | Расположение | Темы | Файлов |
|---------|--------------|------|--------|
| shadcn/ui CSS vars | `globals.css:9-52` | Light + Dark | 5 |
| Custom CSS vars | `globals.css:83-117` | Light + Dark + Sepia | ~6 |
| Hardcoded Tailwind | Компоненты | Light + Dark | 46+ |

### Sepia определена в 4 местах с разными цветами

- `globals.css` → `#f7f3e9`, `#5d4037`
- `useEpubThemes.ts` → `#f4ecd8`, `#5c4a3c`
- `stores/reader.ts` → `#f7f3e4`, `#5d4e37`
- `ReaderToolbar.tsx` → Tailwind `amber-*`

**Нарушение:** Single Source of Truth, DRY principle

---

## Рекомендованное решение (2025-2026 Best Practices)

1. **OKLCH вместо HSL** - перцептуально равномерное цветовое пространство
2. **Unified shadcn/ui variables** - единственный источник правды для цветов
3. **Primary scale (50-950)** - полная шкала для кнопок и акцентов
4. **View Transitions API** - современная анимация переключения тем
5. **System theme detection** - `prefers-color-scheme` support

---

## Прогресс реализации

| Фаза | Статус | Дата |
|------|--------|------|
| Фаза 0: Hotfix primary-XXX | ✅ Завершено | 2 января 2026 |
| Фаза 1: CSS Infrastructure | ✅ Завершено | 2 января 2026 |
| Фаза 2: Hooks Update | ✅ Завершено | 2 января 2026 |
| Фаза 3: Reader Components | ✅ Завершено | 2 января 2026 |
| Фаза 4: UI Components | ✅ Завершено | 2 января 2026 |
| Фаза 5: Pages & Cleanup | ✅ Завершено | 2 января 2026 |
| Фаза 5.5: Full Migration | ✅ Завершено | 2 января 2026 |
| Фаза 6: Testing & Polish | ✅ Завершено | 3 января 2026 |

---

## Связанные документы

- [02-primary-color-issue.md](./02-primary-color-issue.md) - Детальный анализ проблемы primary
- [03-sepia-theme-gaps.md](./03-sepia-theme-gaps.md) - Пробелы темы sepia
- [04-fix-plan.md](./04-fix-plan.md) - Базовый план исправлений
- [05-modern-architecture.md](./05-modern-architecture.md) - **Современная архитектура (OKLCH, full CSS vars)**
- [06-implementation-roadmap.md](./06-implementation-roadmap.md) - **Дорожная карта реализации**
- [07-phase0-completion.md](./07-phase0-completion.md) - **Отчёт о выполнении Фазы 0**
- [08-phase1-completion.md](./08-phase1-completion.md) - **Отчёт о выполнении Фазы 1**
- [09-phase2-completion.md](./09-phase2-completion.md) - **Отчёт о выполнении Фазы 2**
- [10-phase3-completion.md](./10-phase3-completion.md) - **Отчёт о выполнении Фазы 3**
- [11-phase4-completion.md](./11-phase4-completion.md) - **Отчёт о выполнении Фазы 4**
- [12-phase5-completion.md](./12-phase5-completion.md) - **Отчёт о выполнении Фазы 5**
- [13-phase5.5-completion.md](./13-phase5.5-completion.md) - **Отчёт о выполнении Фазы 5.5 (полная миграция)**
- [14-phase6-completion.md](./14-phase6-completion.md) - **Отчёт о выполнении Фазы 6 (тестирование и polish)**
