# Фаза 1: Завершение CSS Infrastructure

**Дата:** 2 января 2026
**Статус:** ЗАВЕРШЕНО

---

## Сводка изменений

### Изменённые файлы (3 файла)

| Файл | Изменения |
|------|-----------|
| `src/styles/globals.css` | Sepia тема для shadcn, highlight variables, theme transitions |
| `tailwind.config.js` | Highlight colors, sepia-theme variant |
| `index.html` | FOUC prevention script, sepia loading styles |

---

## Детали изменений

### 1. globals.css

#### Добавлена `.sepia` тема для shadcn/ui

```css
.sepia {
  --background: 39 39% 94%;
  --foreground: 18 28% 29%;
  --card: 39 35% 92%;
  --card-foreground: 18 28% 29%;
  --popover: 39 35% 92%;
  --popover-foreground: 18 28% 29%;
  --primary: 28 79% 45%;
  --primary-foreground: 39 39% 98%;
  --secondary: 33 35% 85%;
  --secondary-foreground: 18 28% 29%;
  --muted: 33 35% 85%;
  --muted-foreground: 17 22% 45%;
  --accent: 33 35% 85%;
  --accent-foreground: 18 28% 29%;
  --destructive: 0 72% 51%;
  --destructive-foreground: 39 39% 98%;
  --border: 23 20% 82%;
  --input: 30 25% 88%;
  --ring: 28 79% 45%;
  --highlight-bg: 36 80% 50% / 0.25;
  --highlight-border: 36 80% 50% / 0.5;
  --highlight-active: 36 80% 50% / 0.4;
}
```

#### Добавлены highlight variables для всех тем

| Тема | --highlight-bg | --highlight-border | --highlight-active |
|------|----------------|--------------------|--------------------|
| Light | `217 91% 60% / 0.25` | `217 91% 60% / 0.5` | `217 91% 60% / 0.4` |
| Dark | `217 91% 60% / 0.35` | `217 91% 60% / 0.6` | `217 91% 60% / 0.5` |
| Sepia | `36 80% 50% / 0.25` | `36 80% 50% / 0.5` | `36 80% 50% / 0.4` |

**Цветовая схема:**
- Light/Dark: Синий (Blue 500) для подсветок
- Sepia: Янтарный (Amber) для подсветок - гармонирует с тёплым фоном

#### Добавлены theme transitions

```css
@media (prefers-reduced-motion: no-preference) {
  * {
    transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  }
}
```

**Особенности:**
- Плавный переход при смене темы (200ms)
- Уважает `prefers-reduced-motion` для accessibility

---

### 2. tailwind.config.js

#### Добавлен import plugin

```javascript
import plugin from 'tailwindcss/plugin';
```

#### Добавлены highlight colors

```javascript
highlight: {
  DEFAULT: "hsl(var(--highlight-bg))",
  border: "hsl(var(--highlight-border))",
  active: "hsl(var(--highlight-active))",
},
```

**Использование:**
- `bg-highlight` - фон подсветки описаний
- `border-highlight-border` - граница подсветки
- `bg-highlight-active` - активная подсветка

#### Добавлен sepia-theme variant

```javascript
plugins: [
  plugin(function({ addVariant }) {
    addVariant('sepia-theme', '.sepia &');
  }),
],
```

**Использование:**
```tsx
<div className="bg-white dark:bg-gray-800 sepia-theme:bg-amber-50">
```

---

### 3. index.html

#### FOUC Prevention Script

```javascript
(function() {
  try {
    var theme = localStorage.getItem('app-theme');
    if (theme === 'system' || !theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (theme && theme !== 'light') {
      document.documentElement.classList.add(theme);
    }
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  } catch (e) {}
})();
```

**Функциональность:**
1. Читает тему из `localStorage` (ключ `app-theme`)
2. Если `system` или не задана - определяет по `prefers-color-scheme`
3. Добавляет класс темы к `<html>` до рендеринга React
4. Устанавливает `colorScheme` для нативных элементов (scrollbars, inputs)

#### Добавлены стили загрузки для sepia

```css
html.sepia #initial-loading {
  background: linear-gradient(135deg, #f7f3e9 0%, #f0e6d2 100%);
}

html.sepia .loading-text {
  color: #8d6e63;
}
```

---

## Результат

### До Фазы 1

- shadcn/ui компоненты: ❌ Не поддерживали sepia
- Highlight colors: ❌ Hardcoded синие цвета
- Theme transitions: ❌ Резкое переключение
- FOUC: ❌ Мерцание при загрузке

### После Фазы 1

- shadcn/ui компоненты: ✅ Полная поддержка light/dark/sepia
- Highlight colors: ✅ Адаптивные под тему (синий/янтарный)
- Theme transitions: ✅ Плавные 200ms анимации
- FOUC: ✅ Тема применяется до рендеринга

---

## Архитектурные улучшения

### Было: 3 системы тем

```
shadcn variables (light + dark only)
    ↓
custom variables (:root.light/dark/sepia)
    ↓
hardcoded Tailwind classes
```

### Стало: Унифицированная система

```
shadcn variables (light + dark + sepia)
    ↓
Tailwind utilities (bg-primary, text-foreground, etc.)
    ↓
sepia-theme: variant для специфичных случаев
```

---

## Следующие шаги

Фаза 1 завершена. Теперь shadcn/ui компоненты автоматически поддерживают sepia.

Рекомендуется:
1. **Фаза 2:** Обновить useTheme.ts с поддержкой system preference
2. **Фаза 3:** Мигрировать Reader компоненты на semantic tokens
3. **Cleanup:** Удалить legacy `:root.light/dark/sepia` variables (после полной миграции)

---

## Тестирование

### Проверить вручную:

1. **Переключение тем:**
   - [ ] Light → Dark: плавная анимация
   - [ ] Dark → Sepia: плавная анимация
   - [ ] Sepia → Light: плавная анимация

2. **shadcn/ui компоненты в sepia:**
   - [ ] Button primary - янтарный цвет
   - [ ] Card - тёплый фон
   - [ ] Input - тёплые границы

3. **FOUC prevention:**
   - [ ] Обновить страницу в dark mode - нет мерцания
   - [ ] Обновить страницу в sepia mode - нет мерцания

4. **Highlight colors:**
   - [ ] Light: синяя подсветка описаний
   - [ ] Dark: синяя подсветка (чуть ярче)
   - [ ] Sepia: янтарная подсветка
