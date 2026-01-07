# Современные практики мобильного UX/UI 2025-2026

**Дата:** 7 января 2026
**Применение:** fancai book reading app
**Источники:** Apple HIG, Material Design 3, WCAG 2.2, отраслевые исследования

---

## 1. Touch Targets и сенсорные цели

### Минимальные размеры

| Стандарт | Минимум | Рекомендация | Промежуток |
|----------|---------|--------------|------------|
| Apple HIG | 44×44 pt | 48×48 pt | 8 pt |
| Material Design 3 | 48×48 dp | 56×56 dp | 8 dp |
| WCAG 2.2 AA | 24×24 px | 44×44 px | - |
| MIT Touch Lab | ~10mm × 10mm | - | - |

**Научное обоснование:**
- Средняя ширина пальца: 1.6-2.0 см
- Ширина большого пальца: 2.5 см
- **30% снижение ошибок** при использовании targets 48×48dp

### Текущее состояние fancai

| Компонент | Размер | Статус |
|-----------|--------|--------|
| Button | min-h-[44px] min-w-[44px] | ✅ |
| Input | min-h-[44px] | ✅ |
| BottomNav items | min-h-[56px] | ✅ |
| **Slider thumb** | h-5 w-5 (20×20px) | 🔴 КРИТИЧНО |
| **Modal close** | h-8 w-8 (32×32px) | 🔴 |
| **Dropdown items** | py-1.5 (~28px) | 🟠 |

---

## 2. Thumb Zone (Зона большого пальца)

### Статистика использования

- **49%** держат смартфон одной рукой
- **75%** взаимодействий — большим пальцем
- **80%+** используют одной рукой в движении
- **27% увеличение скорости** при размещении в thumb zone

### Три зоны досягаемости (6.5" экран)

```
┌─────────────────────────┐
│      HARD ZONE 🔴       │  Верх: сложно достать
│      (Верхняя часть)    │  • Вторичные действия
│                         │  • Меню, настройки
├─────────────────────────┤
│    STRETCH ZONE 🟡      │  Середина: некомфортно для повтора
│    (Средняя часть)      │  • Контент просмотра
│                         │  • Второстепенные CTA
├─────────────────────────┤
│      EASY ZONE 🟢       │  Низ: комфортно, естественно
│    (Нижняя часть)       │  • PRIMARY CTA (кнопка "Далее")
│                         │  • Основная навигация
└─────────────────────────┘
```

### Рекомендации для Reader

- **Основные элементы управления** → внизу экрана
- **Tab bar** → 3-5 вкладок в easy zone
- **FAB** → bottom-right (не конфликтует с nav)
- **Вторичные опции** → hamburger или в hard zone

---

## 3. Жесты и взаимодействия

### Основные жесты 2025

| Жест | Применение | Время отклика |
|------|-----------|---------------|
| Tap | Выбор, переход | < 100ms |
| Swipe | Навигация страниц | 200-300ms |
| Pull-to-refresh | Обновление контента | 300-500ms |
| Long-press | Контекстное меню | 500ms |
| Pinch-to-zoom | Масштабирование | 200ms |

### Правила жестов

- **Максимум 2 основных жеста на экран**
- Swipe gestures → **+19% session duration**
- Всегда предоставляйте **альтернативу кнопками**
- Визуальные подсказки для неочевидных жестов

### iOS vs Android различия

| Жест | iOS | Android |
|------|-----|---------|
| Назад | Edge swipe слева | Back button / swipe |
| Меню | Long-press | Long-press / 3-dot |
| Refresh | Pull-down | Pull-down |

---

## 4. Bottom Sheet vs Modal

### Матрица выбора

| Критерий | Bottom Sheet | Fullscreen Modal |
|----------|--------------|------------------|
| Контент | Дополнительная информация | Сложные формы |
| Фокус | Частичный | Полный |
| Взаимодействие с фоном | Возможно | Заблокировано |
| Max высота | 50% экрана | 100% |
| Закрытие | Swipe down + tap outside | X button |

### Рекомендация для fancai

- **Настройки читалки** → Bottom sheet (уже реализовано ✅)
- **Загрузка книги** → Fullscreen modal
- **Выбор главы** → Bottom sheet
- **Подтверждение удаления** → Dialog (не fullscreen)

---

## 5. Навигация

### Tab Bar vs Hamburger

| Критерий | Tab Bar | Hamburger |
|----------|---------|-----------|
| Discoverability | Высокая | Низкая |
| Engagement | +30% | Базовый |
| Thumb-friendly | ✅ | ❌ |
| Max элементов | 4-5 | 8+ |

**Рекомендация:** Tab bar (4-5 вкладок) + hamburger "More"

### FAB (Floating Action Button)

- **Один FAB на экран**
- **Только позитивные действия** (Create, Add)
- Размер: 56×56 dp
- Позиция: bottom-right или bottom-center

---

## 6. Формы на мобильных

### Размеры полей

| Элемент | Минимум | Рекомендация |
|---------|---------|--------------|
| Высота input | 44px | 48px |
| Padding вертикальный | 12px | 16px |
| Padding горизонтальный | 16px | 16px |
| Шрифт | 16px | 16px (избежать zoom iOS) |

### Input Types (критично!)

```html
<input type="email" />     <!-- @ на клавиатуре -->
<input type="tel" />       <!-- Цифровая клавиатура -->
<input type="number" />    <!-- Цифры с +/- -->
<input type="url" />       <!-- / и . на клавиатуре -->
<input type="search" />    <!-- Search button -->
```

### Autocomplete атрибуты

```html
<input autocomplete="email" />
<input autocomplete="tel" />
<input autocomplete="current-password" />
<input autocomplete="new-password" />
```

**Снижает ошибки на 30%**

---

## 7. Типография

### Минимальные размеры (WCAG 2.2)

| Тип текста | Минимум | Рекомендация | Контраст |
|------------|---------|--------------|----------|
| Body text | 16px | 18px | 4.5:1 (AA) |
| Large text | 14pt | 16px | 3:1 (AA) |
| Headings | 24px+ | 28px+ | 4.5:1 |
| Captions | 12px | 14px | 4.5:1 |

### Line Height

- **Body text:** 1.4-1.6 (рекомендуется 1.5)
- **Headings:** 1.2-1.3
- **Minimum WCAG:** 1.2

### Fluid Typography (рекомендация)

```css
h1 { font-size: clamp(1.75rem, 4vw + 1rem, 3rem); }
body { font-size: clamp(1rem, 1vw + 0.5rem, 1.25rem); }
```

---

## 8. Dark Mode

### Цветовые рекомендации

| Элемент | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Фон | #FFFFFF | #1E1E1E (не #000000) |
| Текст | #1A1A1A | #E0E0E0 (не #FFFFFF) |
| Accent | #2196F3 | #64B5F6 |

**Почему не чистый чёрный/белый:**
- Pure white → eye strain
- Pure black → избыточный контраст на LCD
- OLED: #000000 экономит 63% батареи

### Текущее состояние fancai

```css
/* globals.css - правильно! */
.dark {
  --background: 0 0% 11.8%;  /* #1E1E1E */
  --foreground: 0 0% 87.8%;  /* #E0E0E0 */
}
```

---

## 9. Анимации на мобильных

### GPU-ускоренные свойства (используйте)

- `transform` (translate, scale, rotate)
- `opacity`

### CPU-затратные свойства (избегайте)

- `width`, `height`
- `margin`, `padding`
- `background-color`
- `border-width`

### Timing рекомендации

| Тип анимации | Длительность |
|--------------|--------------|
| Микро-взаимодействие | 100-200ms |
| Page transition | 200-300ms |
| Modal open/close | 200-300ms |
| Loading indicator | бесконечно |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**fancai уже реализует это ✅**

---

## 10. Performance UX

### Skeleton Screens vs Spinners

- Skeleton screens выглядят **на 30% быстрее**
- Должны точно соответствовать реальному UI

### Doherty Threshold

| Время загрузки | UX требование |
|----------------|---------------|
| < 400ms | Мгновенно (без индикатора) |
| 400-2000ms | Skeleton/spinner |
| > 2000ms | Progress bar + время |

### Optimistic Updates

1. Обновить UI немедленно
2. Отправить запрос в фоне
3. При ошибке — откатить и показать toast

**fancai реализует через TanStack Query ✅**

---

## 11. Offline-First

### Стратегия fancai (уже реализована)

1. **IndexedDB кэширование** (chapterCache, imageCache)
2. **Sync Queue** (syncQueue.ts)
3. **Conflict Resolution** (PositionConflictDialog)

### Рекомендации

- Показывать "Syncing..." индикатор
- Batch sync каждые 5 секунд
- Retry with exponential backoff

---

## 12. Accessibility (WCAG 2.2)

### Критические критерии

| Критерий | Требование |
|----------|------------|
| 1.4.3 Contrast | 4.5:1 для normal text |
| 1.4.11 Focus | 2px outline с контрастом |
| 2.5.5 Target Size | 24×24px minimum (44×44 recommended) |
| 2.5.7 Dragging | Альтернатива для drag-drop |

### Focus Management

```tsx
<button className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
```

### Color Not Alone

```tsx
// ❌ Только цвет
<span className="text-red-500">Error</span>

// ✅ Цвет + иконка
<span className="text-red-500">✗ Error</span>
```

---

## 13. Тренды 2025-2026

### Glassmorphism (осторожно)

- ✅ Для overlay, floating buttons
- ❌ Для основного контента
- ⚠️ Performance cost на слабых устройствах

### Haptic Feedback

```javascript
navigator.vibrate(10);  // Light tap
navigator.vibrate([10, 20, 10]);  // Success
```

- Для критичных действий (сохранение, удаление)
- НЕ для каждого клика

### Voice Interfaces

- Adoption: ~50% US population к 2026
- Дополнение к touch, не замена

---

## Чеклист для fancai

### Touch Targets
- [ ] Все кнопки минимум 44×44px
- [ ] Slider thumb увеличить до 44×44px
- [ ] Dropdown items минимум 44px высота
- [ ] Modal close button минимум 44×44px

### Navigation
- [ ] Primary CTA в easy zone (низ экрана)
- [ ] Tab bar 4-5 элементов
- [ ] Hamburger для extra (Settings, Admin)

### Forms
- [ ] Input types (email, tel, search)
- [ ] Autocomplete атрибуты
- [ ] 16px font size (избежать zoom)

### Typography
- [ ] Body text минимум 16px
- [ ] Line height 1.5
- [ ] Контраст 4.5:1

### Performance
- [ ] Skeleton screens для loading
- [ ] Optimistic updates
- [ ] Offline sync queue

### Accessibility
- [ ] Focus indicators
- [ ] Reduced motion support
- [ ] Color + icon для errors

---

## Источники

- [Mobile UX Design Guide 2025 - Webstacks](https://www.webstacks.com/blog/mobile-ux-design)
- [Touch UX Best Practices - Moldstud](https://moldstud.com/articles/p-best-practices-for-designing-touch-ux-in-hybrid-mobile-apps)
- [Tap Targets & Touch Zones - eDesignify](https://edesignify.com/blogs/tap-targets-and-touch-zones-mobile-ux-that-works)
- [UI/UX Best Practices 2025/2026 - WhizzBridge](https://www.whizzbridge.com/blog/ui-ux-best-practices-2025)
- [Designing for Touch - Devoq](https://devoq.medium.com/designing-for-touch-mobile-ui-ux-best-practices-c0c71aa615ee)
- [UI/UX Trends 2025 - Chop Dawg](https://www.chopdawg.com/ui-ux-design-trends-in-mobile-apps-for-2025/)
- [Impact of Gestures - Codebridge](https://www.codebridge.tech/articles/the-impact-of-gestures-on-mobile-user-experience)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
- [Material Design 3](https://m3.material.io/)
- [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/)
