# Фаза 2: Завершение Hooks Update

**Дата:** 2 января 2026
**Статус:** ЗАВЕРШЕНО

---

## Сводка изменений

### Изменённые файлы (3 файла)

| Файл | Строки | Изменения |
|------|--------|-----------|
| `src/hooks/useTheme.ts` | 42 → 85 | System preference, resolvedTheme, media listener |
| `src/hooks/epub/useDescriptionHighlighting.ts` | 819 | CSS variables для подсветок |
| `src/hooks/epub/useEpubThemes.ts` | 220 | Синхронизация с глобальной темой |

---

## Детали изменений

### 1. useTheme.ts - System Preference Support

#### Новые типы

```typescript
export type AppTheme = 'light' | 'dark' | 'sepia' | 'system';
export type ResolvedTheme = 'light' | 'dark' | 'sepia';
```

**AppTheme** - выбор пользователя (включая 'system')
**ResolvedTheme** - фактически применённая тема (никогда 'system')

#### Новые функции

```typescript
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const resolveTheme = (theme: AppTheme): ResolvedTheme => {
  if (theme === 'system') return getSystemTheme();
  return theme;
};
```

#### Media Query Listener

```typescript
useEffect(() => {
  if (theme !== 'system') return;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = () => {
    setResolvedTheme(getSystemTheme());
  };

  mediaQuery.addEventListener('change', handleChange);
  return () => mediaQuery.removeEventListener('change', handleChange);
}, [theme]);
```

**Функциональность:**
- Автоматически реагирует на изменение системной темы
- Очищается при смене на явную тему

#### Возвращаемые значения

```typescript
return {
  theme,           // Выбор пользователя: 'light' | 'dark' | 'sepia' | 'system'
  resolvedTheme,   // Фактическая тема: 'light' | 'dark' | 'sepia'
  setTheme,        // Функция установки темы
  isDark,          // resolvedTheme === 'dark'
  isLight,         // resolvedTheme === 'light'
  isSepia,         // resolvedTheme === 'sepia'
  isSystem,        // theme === 'system'
};
```

---

### 2. useDescriptionHighlighting.ts - CSS Variables

#### Добавлена helper функция

```typescript
const getHighlightColors = (): { bg: string; border: string; active: string } => {
  if (typeof window === 'undefined') {
    return {
      bg: 'rgba(96, 165, 250, 0.25)',
      border: 'rgba(96, 165, 250, 0.5)',
      active: 'rgba(96, 165, 250, 0.4)',
    };
  }

  const root = document.documentElement;
  const style = getComputedStyle(root);

  const bgVar = style.getPropertyValue('--highlight-bg').trim();
  const borderVar = style.getPropertyValue('--highlight-border').trim();
  const activeVar = style.getPropertyValue('--highlight-active').trim();

  return {
    bg: bgVar ? `hsl(${bgVar})` : 'rgba(96, 165, 250, 0.25)',
    border: borderVar ? `hsl(${borderVar})` : 'rgba(96, 165, 250, 0.5)',
    active: activeVar ? `hsl(${activeVar})` : 'rgba(96, 165, 250, 0.4)',
  };
};
```

**Особенности:**
- SSR-safe (проверка `typeof window`)
- Fallback на синие цвета при отсутствии CSS variables
- Читает HSL значения из CSS и преобразует в `hsl()` формат

#### Обновлённые стили span

```typescript
// До:
backgroundColor: 'rgba(59, 130, 246, 0.3)',
border: '2px solid rgba(59, 130, 246, 0.6)',

// После:
const colors = getHighlightColors();
backgroundColor: colors.bg,
border: `2px solid ${colors.border}`,
```

#### Обновлённые hover handlers

```typescript
// До:
backgroundColor: 'rgba(59, 130, 246, 0.5)',

// После:
const colors = getHighlightColors();
backgroundColor: colors.active,
```

---

### 3. useEpubThemes.ts - Синхронизация с глобальной темой

#### Изменён storage key

```typescript
// До:
const THEME_STORAGE_KEY = 'epub_reader_theme';

// После:
const THEME_STORAGE_KEY = 'app-theme'; // Sync with useTheme.ts
```

**Результат:** Тема EPUB reader синхронизирована с глобальной темой приложения

#### Обновлён DEFAULT_THEME

```typescript
// До:
const DEFAULT_THEME: ThemeName = 'dark';

// После:
const DEFAULT_THEME: ThemeName = 'light';
```

#### Обновлён объект THEMES

Все цвета теперь используют HSL, соответствующий CSS variables в globals.css:

```typescript
// Sepia тема - до:
sepia: {
  body: {
    color: '#5c4a3c',
    background: '#f4ecd8',
  },
  a: {
    color: '#8b6914',
  },
}

// Sepia тема - после:
sepia: {
  body: {
    color: 'hsl(18, 28%, 29%)',      // --foreground (sepia)
    background: 'hsl(39, 39%, 94%)', // --background (sepia)
  },
  a: {
    color: 'hsl(28, 79%, 45%)',      // --primary (sepia)
  },
}
```

**Все три темы обновлены:**

| Тема | CSS Variable | HSL Value |
|------|--------------|-----------|
| **Light** | --background | `hsl(0, 0%, 100%)` |
| **Light** | --foreground | `hsl(222.2, 84%, 4.9%)` |
| **Light** | --primary | `hsl(221.2, 83.2%, 53.3%)` |
| **Dark** | --background | `hsl(222.2, 84%, 4.9%)` |
| **Dark** | --foreground | `hsl(210, 40%, 98%)` |
| **Dark** | --primary | `hsl(217.2, 91.2%, 59.8%)` |
| **Sepia** | --background | `hsl(39, 39%, 94%)` |
| **Sepia** | --foreground | `hsl(18, 28%, 29%)` |
| **Sepia** | --primary | `hsl(28, 79%, 45%)` |

---

## Результат

### До Фазы 2

- useTheme.ts: ❌ Нет поддержки system preference
- useDescriptionHighlighting.ts: ❌ Hardcoded синие цвета
- useEpubThemes.ts: ❌ Отдельный storage key, разные цвета

### После Фазы 2

- useTheme.ts: ✅ System preference + автоматическое переключение
- useDescriptionHighlighting.ts: ✅ Адаптивные цвета через CSS variables
- useEpubThemes.ts: ✅ Синхронизация с глобальной темой

---

## Архитектурные улучшения

### Единый источник правды для темы

```
localStorage 'app-theme'
    ↓
useTheme.ts (resolves 'system' → actual theme)
    ↓
┌─────────────────────────────────────┐
│  document.documentElement.classList │
│  (.dark / .sepia / [none for light])│
└─────────────────────────────────────┘
    ↓                     ↓
CSS Variables         useEpubThemes.ts
(globals.css)         (EPUB iframe)
    ↓
useDescriptionHighlighting.ts
(reads CSS vars)
```

### Удалена дублирование

| До | После |
|----|-------|
| 2 storage keys | 1 storage key (`app-theme`) |
| 4 источника цветов sepia | 1 источник (globals.css) |
| Hardcoded hex в hooks | HSL из CSS variables |

---

## Тестирование

### Проверить вручную:

1. **System preference:**
   - [ ] Выбрать "System" в настройках темы
   - [ ] Изменить системную тему (macOS: System Settings → Appearance)
   - [ ] Приложение должно переключиться автоматически

2. **Синхронизация EPUB:**
   - [ ] Открыть книгу в Reader
   - [ ] Переключить тему в настройках
   - [ ] EPUB content должен обновиться синхронно

3. **Подсветки описаний:**
   - [ ] Light: синяя подсветка
   - [ ] Dark: синяя подсветка (ярче)
   - [ ] Sepia: янтарная подсветка

4. **Hover эффекты:**
   - [ ] Навести на подсветку - должна стать ярче
   - [ ] Цвет hover должен соответствовать теме

---

## Следующие шаги

Фаза 2 завершена. Рекомендуется:

1. **Фаза 3:** Миграция Reader компонентов на semantic tokens
2. **Фаза 4:** Миграция UI компонентов
3. **Cleanup:** Удаление legacy `:root.light/dark/sepia` из globals.css (после полной миграции)

---

## Связанные документы

- [01-summary.md](./01-summary.md) - Сводный отчёт
- [05-modern-architecture.md](./05-modern-architecture.md) - Современная архитектура
- [06-implementation-roadmap.md](./06-implementation-roadmap.md) - Дорожная карта
- [08-phase1-completion.md](./08-phase1-completion.md) - Отчёт о Фазе 1
