# Анализ парсинга глав

**Дата:** 29 декабря 2025

---

## 1. Текущая архитектура

### Когда запускается LLM extraction?

**ON-DEMAND** - при открытии главы пользователем:

```typescript
// useChapterManagement.ts:194-207
if (loadedDescriptions.length === 0) {
  descriptionsResponse = await booksAPI.getChapterDescriptions(
    bookId,
    chapter,
    true // extract_new = true
  );
}
```

### Prefetch следующих глав

**Prefetch НЕ запускает LLM extraction:**

```typescript
// useChapterManagement.ts:419-535
// NOTE: LLM extraction disabled in prefetch to avoid confusion
// when 'AI analyzing' shows while still reading another chapter
```

---

## 2. Проблема UX

```
Пользователь читает главу 5
    ↓
Prefetch глав 4, 6, 7 (только существующие описания)
    ↓
Переход на главу 6
    ↓
Описаний нет → LLM extraction (ОЖИДАНИЕ 3-5 сек!)
```

---

## 3. Решение: Background Extraction

### Backend: Новый эндпоинт

**Файл:** `backend/app/routers/descriptions.py`

```python
@router.post("/{book_id}/chapters/{chapter_number}/extract-background")
async def trigger_background_extraction(
    book_id: UUID,
    chapter_number: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> dict:
    """Запускает LLM extraction в фоне. Возвращается сразу."""

    # Проверяем наличие описаний
    existing = await db.execute(
        select(Description).where(Description.chapter_id == chapter.id).limit(1)
    )
    if existing.scalar_one_or_none():
        return {"status": "already_extracted"}

    # Запускаем в background
    background_tasks.add_task(
        _extract_descriptions_background,
        chapter_id=chapter.id,
        chapter_content=chapter.content,
    )

    return {"status": "extraction_started"}
```

### Frontend: Вызов в prefetch

**Файл:** `frontend/src/hooks/epub/useChapterManagement.ts`

```typescript
// В prefetchNextChapters
const nextEmptyChapter = emptyChapters.find(
  c => c.chapter_number === currentChapter + 1
);

if (nextEmptyChapter) {
  // Fire and forget
  booksAPI.triggerBackgroundExtraction(bookId, nextEmptyChapter.chapter_number)
    .catch(err => console.warn('Background extraction failed:', err));
}
```

---

## 4. Новый flow

```
Пользователь открывает главу N
    ↓
[Параллельно]
├── Загрузка описаний главы N (+ LLM если нужно)
└── Background extraction главы N+1 (fire & forget)
    ↓
Переход на главу N+1
    ↓
Описания уже готовы! (мгновенная загрузка)
```

---

## 5. Оценка времени

| Задача | Время |
|--------|-------|
| Backend: Background endpoint | 1.5 часа |
| Frontend: API метод | 30 мин |
| Frontend: Интеграция в prefetch | 1 час |
| Тестирование | 1 час |
| **Итого** | **~4 часа** |
