# Фаза 3: Memory leaks и focus - Отчёт

**Дата:** 5 января 2026
**Статус:** ✅ ЗАВЕРШЕНА
**Приоритет:** P0-P1

---

## Резюме

Выполнены все 3 задачи Фазы 3 по исправлению memory leaks и focus issues:

| Задача | Статус | Файлы |
|--------|--------|-------|
| 3.1 Cleanup event listeners | ✅ | useDescriptionHighlighting.ts |
| 3.2 Fix stale closure | ✅ | useProgressSync.ts |
| 3.3 Fix TocSidebar overflow | ✅ | Уже исправлено ранее |

**Сборка:** Успешна (4.05s)

---

## Выполненные изменения

### 3.1 Cleanup event listeners в useDescriptionHighlighting

**Файл:** `frontend/src/hooks/epub/useDescriptionHighlighting.ts`

**Добавлен ref для cleanup функций:**
```typescript
const cleanupFunctionsRef = useRef<(() => void)[]>([]);
```

**В функции highlightDescriptions добавлено сохранение cleanup:**
```typescript
const handleMouseEnter = () => { /* ... */ };
const handleMouseLeave = () => { /* ... */ };
const handleClick = (event: MouseEvent) => { /* ... */ };

span.addEventListener('mouseenter', handleMouseEnter);
span.addEventListener('mouseleave', handleMouseLeave);
span.addEventListener('click', handleClick);

// Save cleanup function
cleanupFunctionsRef.current.push(() => {
  span.removeEventListener('mouseenter', handleMouseEnter);
  span.removeEventListener('mouseleave', handleMouseLeave);
  span.removeEventListener('click', handleClick);
});
```

**В removeAllHighlights добавлен вызов cleanup:**
```typescript
const removeAllHighlights = useCallback(() => {
  // Run all cleanup functions first
  cleanupFunctionsRef.current.forEach(cleanup => cleanup());
  cleanupFunctionsRef.current = [];

  // Existing highlight removal code...
}, [rendition]);
```

**Результат:** Event listeners корректно удаляются при смене главы или unmount компонента.

---

### 3.2 Fix stale closure в useProgressSync

**Файл:** `frontend/src/hooks/epub/useProgressSync.ts`

**Добавлен ref для актуальных значений:**
```typescript
const latestPositionRef = useRef<{
  cfi: string;
  progress: number;
  scrollOffset: number;
  chapter: number;
}>({
  cfi: '',
  progress: 0,
  scrollOffset: 0,
  chapter: 0,
});
```

**Добавлен effect для обновления ref:**
```typescript
useEffect(() => {
  latestPositionRef.current = {
    cfi: currentCFI || '',
    progress: progress || 0,
    scrollOffset: scrollOffset || 0,
    chapter: currentChapter || 0,
  };
}, [currentCFI, progress, scrollOffset, currentChapter]);
```

**beforeunload использует ref:**
```typescript
useEffect(() => {
  const handleBeforeUnload = () => {
    const position = latestPositionRef.current;
    if (position.cfi && bookId) {
      // Синхронное сохранение с актуальными данными
      navigator.sendBeacon(
        `/api/v1/books/${bookId}/progress`,
        JSON.stringify({
          cfi: position.cfi,
          progress: position.progress,
          scrollOffset: position.scrollOffset,
          chapter: position.chapter,
        })
      );
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [bookId]); // Только bookId в зависимостях
```

**Результат:** beforeunload всегда сохраняет актуальную позицию чтения.

---

### 3.3 TocSidebar overflow - уже исправлено

**Файл:** `frontend/src/components/Reader/TocSidebar.tsx`

При анализе обнаружено, что cleanup overflow уже корректно реализован:

```typescript
useEffect(() => {
  if (isOpen) {
    document.body.style.overflow = 'hidden';
  }

  return () => {
    document.body.style.overflow = '';
  };
}, [isOpen]);
```

**Результат:** Дополнительные изменения не требуются.

---

## Исправленные проблемы

| Проблема | Решение |
|----------|---------|
| Memory leak: event listeners накапливаются | cleanupFunctionsRef + вызов cleanup в removeAllHighlights |
| Stale closure: устаревшая позиция сохраняется | latestPositionRef с актуальными значениями |
| TocSidebar overflow остаётся | Уже исправлено, cleanup в return useEffect |

---

## Архитектура cleanup

### До (Memory leak)

```
1. highlightDescriptions() создаёт spans с listeners
2. Смена главы → removeAllHighlights()
3. Listeners НЕ удаляются (утечка памяти)
4. Новая глава → ещё больше listeners
5. После 10+ глав → заметное замедление
```

### После (Proper cleanup)

```
1. highlightDescriptions() создаёт spans с listeners
2. Каждый listener сохраняется в cleanupFunctionsRef
3. Смена главы → removeAllHighlights()
4. cleanupFunctionsRef.forEach(cleanup => cleanup())
5. Все listeners удалены, память освобождена
```

---

## Чеклист тестирования

После деплоя проверить:

- [ ] Долгое чтение (10+ глав) → RAM не растёт
- [ ] Переключение глав → нет замедления
- [ ] Закрытие вкладки → позиция сохранена корректно
- [ ] Refresh страницы → возврат к правильной позиции
- [ ] TocSidebar → body overflow восстанавливается после закрытия

---

## Итоги Фаз 1-3

| Фаза | Проблемы | Исправлено |
|------|----------|------------|
| Фаза 1 | Навигация после модала, mobile tap, keyboard в iframe | 5/5 ✅ |
| Фаза 2 | Тема при refresh, FOUC, race condition | 4/4 ✅ |
| Фаза 3 | Memory leak, stale closure, TocSidebar | 3/3 ✅ |
| **Итого** | **12 P0-P1 задач** | **12/12 ✅** |

---

## Оставшиеся задачи (Фаза 4)

| # | Задача | Приоритет | Файл |
|---|--------|-----------|------|
| 4.1 | SelectionMenu z-index (100 → 600) | P1 | SelectionMenu.tsx |
| 4.2 | PositionConflictDialog focus trap | P1 | PositionConflictDialog.tsx |
| 4.3 | Удалить console.log в production | P2 | Множество файлов |

---

## Связанные документы

- [01-analysis.md](./01-analysis.md) - Полный анализ
- [02-action-plan.md](./02-action-plan.md) - План доработок
- [03-phase1-completion.md](./03-phase1-completion.md) - Отчёт Фазы 1
- [04-phase2-completion.md](./04-phase2-completion.md) - Отчёт Фазы 2
- [06-phase4-completion.md](./06-phase4-completion.md) - Отчёт Фазы 4
