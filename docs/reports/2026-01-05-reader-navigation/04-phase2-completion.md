# Фаза 2: Исправление темы - Отчёт

**Дата:** 5 января 2026
**Статус:** ✅ ЗАВЕРШЕНА
**Приоритет:** P0 (Критический)

---

## Резюме

Выполнены все 4 задачи Фазы 2 по исправлению проблем с темой при обновлении страницы:

| Задача | Статус | Файлы |
|--------|--------|-------|
| 2.1 Явные цвета backgroundColor | ✅ | EpubReader.tsx |
| 2.2 Убрать 500ms задержку | ✅ | EpubReader.tsx |
| 2.3 Тема сразу в useEpubLoader | ✅ | useEpubLoader.ts |
| 2.4 Синхронизация с HTML root | ✅ | useEpubThemes.ts |

**Сборка:** Успешна (4.03s)

---

## Выполненные изменения

### 2.1 Явные цвета вместо CSS переменных

**Файл:** `frontend/src/components/Reader/EpubReader.tsx` (строки 620-633)

```typescript
// БЫЛО:
const backgroundColor = useMemo(() => {
  switch (theme) {
    case 'light':
      return 'bg-background';  // CSS variable
    case 'sepia':
      return 'bg-[#FBF0D9]';
    case 'dark':
    default:
      return 'bg-background';  // CSS variable
  }
}, [theme]);

// СТАЛО:
const backgroundColor = useMemo(() => {
  switch (theme) {
    case 'light':
      return 'bg-white';
    case 'sepia':
      return 'bg-[#FBF0D9]';
    case 'dark':
      return 'bg-[#121212]';
    case 'night':
      return 'bg-black';
    default:
      return 'bg-[#121212]';
  }
}, [theme]);
```

**Результат:** Фон больше не зависит от CSS переменных и класса `.dark` на root.

---

### 2.2 Убрана 500ms задержка

**Файл:** `frontend/src/components/Reader/EpubReader.tsx` (строки 150-155)

```typescript
// БЫЛО:
onReady: () => {
  setTimeout(() => {
    setRenditionReady(true);
  }, 500);
},

// СТАЛО:
onReady: () => {
  requestAnimationFrame(() => {
    setRenditionReady(true);
  });
},
```

**Результат:** Тема применяется за ~16ms вместо 500ms.

---

### 2.3 Тема применяется сразу в useEpubLoader

**Файл:** `frontend/src/hooks/epub/useEpubLoader.ts` (строки 117-129)

```typescript
const newRendition = epubBook.renderTo(viewerRef.current, {
  width: '100%',
  height: '100%',
  spread: 'none',
});

// ДОБАВЛЕНО: Apply initial theme immediately BEFORE rendering content
const savedTheme = localStorage.getItem('app-theme') || 'dark';
const INITIAL_THEMES: Record<string, Record<string, Record<string, string>>> = {
  light: { body: { color: '#1A1A1A', background: '#FFFFFF' } },
  dark: { body: { color: '#E8E8E8', background: '#121212' } },
  sepia: { body: { color: '#3D2914', background: '#FBF0D9' } },
  night: { body: { color: '#B0B0B0', background: '#000000' } },
};
const themeStyles = INITIAL_THEMES[savedTheme] || INITIAL_THEMES.dark;
newRendition.themes.default(themeStyles);
console.log('[useEpubLoader] Applied initial theme:', savedTheme);
```

**Результат:** epub.js рендерит контент сразу с правильной темой.

---

### 2.4 Синхронизация темы с HTML root

**Файл:** `frontend/src/hooks/epub/useEpubThemes.ts`

**Добавлена функция syncHtmlRoot (строки 171-188):**
```typescript
const syncHtmlRoot = useCallback((themeName: ThemeName) => {
  const root = document.documentElement;
  root.classList.remove('light', 'dark', 'sepia');
  root.setAttribute('data-theme', themeName);

  if (themeName === 'dark' || themeName === 'night') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else if (themeName === 'sepia') {
    root.classList.add('sepia');
    root.style.colorScheme = 'light';
  } else {
    root.style.colorScheme = 'light';
  }
}, []);
```

**Обновлена функция setTheme (строки 193-202):**
```typescript
const setTheme = useCallback((newTheme: ThemeName) => {
  console.log('[useEpubThemes] Changing theme to:', newTheme);
  setThemeState(newTheme);
  localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  syncHtmlRoot(newTheme);  // ДОБАВЛЕНО
  applyTheme(newTheme, fontSize);
}, [fontSize, applyTheme, syncHtmlRoot]);
```

**Добавлен useEffect для начальной синхронизации (строки 238-244):**
```typescript
useEffect(() => {
  syncHtmlRoot(theme);
}, [theme, syncHtmlRoot]);
```

**Результат:** HTML root всегда синхронизирован с темой читалки.

---

## Исправленные проблемы

| Проблема | Решение |
|----------|---------|
| Вспышка светлого контента (FOUC) | Тема применяется ДО рендера epub.js |
| 500ms задержка темы | Заменена на requestAnimationFrame (~16ms) |
| bg-background зависит от .dark класса | Явные hex-цвета |
| HTML root не синхронизирован | syncHtmlRoot при каждом изменении |

---

## Архитектура до/после

### До (Race condition)

```
1. useEpubLoader создаёт rendition
2. epub.js рендерит с DEFAULT (светлой) темой
3. 500ms задержка...
4. setRenditionReady(true)
5. useEpubThemes применяет тему
6. ПОЛЬЗОВАТЕЛЬ ВИДИТ ВСПЫШКУ СВЕТЛОГО КОНТЕНТА
```

### После (Синхронная инициализация)

```
1. useEpubLoader создаёт rendition
2. useEpubLoader читает тему из localStorage
3. useEpubLoader применяет тему к rendition
4. epub.js рендерит с ПРАВИЛЬНОЙ темой
5. requestAnimationFrame (~16ms)
6. setRenditionReady(true)
7. useEpubThemes синхронизирует HTML root
8. ПОЛЬЗОВАТЕЛЬ ВИДИТ ПРАВИЛЬНУЮ ТЕМУ СРАЗУ
```

---

## Чеклист тестирования

После деплоя проверить:

- [ ] Refresh в тёмной теме → сразу тёмная (без вспышки)
- [ ] Refresh в sepia теме → сразу sepia
- [ ] Refresh в светлой теме → сразу светлая
- [ ] Переключение темы → мгновенное применение
- [ ] HTML root имеет правильный класс (.dark / .sepia)
- [ ] data-theme атрибут установлен
- [ ] colorScheme CSS property корректен

---

## Связанные документы

- [01-analysis.md](./01-analysis.md) - Полный анализ
- [02-action-plan.md](./02-action-plan.md) - План доработок
- [03-phase1-completion.md](./03-phase1-completion.md) - Отчёт Фазы 1
- [05-phase3-completion.md](./05-phase3-completion.md) - Отчёт Фазы 3
- [06-phase4-completion.md](./06-phase4-completion.md) - Отчёт Фазы 4
