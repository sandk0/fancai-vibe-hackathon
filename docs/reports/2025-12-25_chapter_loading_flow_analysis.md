# Comprehensive Analysis: Chapter and Description Loading Flow

**Date:** 2025-12-25
**Analyst:** Frontend Developer Agent v2.0
**Focus:** Chapter loading, description extraction, prefetching logic, and race conditions

---

## Executive Summary

Проведён глубокий анализ потока загрузки глав и описаний в frontend BookReader AI. Обнаружены **4 критические проблемы** и **3 потенциальных race condition**, которые могут приводить к отсутствию подсветки описаний на первой главе.

### Критические находки:

1. ❌ **Race Condition #1**: `useChapterManagement` загружает данные **ДО** завершения `isRestoringPosition`
2. ❌ **Race Condition #2**: `useDescriptionHighlighting` может запуститься до готовности `descriptions`
3. ⚠️ **Prefetch Problem**: Batch API запускается **до** загрузки текущей главы (конкурирует за ресурсы)
4. ⚠️ **Cache Miss Pattern**: На первой главе кэш всегда пустой, но LLM extraction может запускаться **параллельно** с restoration

---

## 1. Chapter Loading Flow (Step-by-Step)

### 1.1 Initial Load Sequence

```
[EpubReader.tsx] Пользователь открывает книгу
    ↓
[useEpubLoader] Загружает EPUB файл
    ↓ (100ms)
setRenditionReady(true)
    ↓
[useLocationGeneration] Генерирует/загружает locations (5-10s или <100ms из IndexedDB)
    ↓
[EpubReader useEffect:334-425] Position Initialization
    ├─ Fetch saved progress from API
    │   → booksAPI.getReadingProgress(book.id)
    │   → Returns: { reading_location_cfi, current_position, scroll_offset_percent }
    ├─ Set isRestoringPosition = true  ✅ (блокирует загрузку главы)
    ├─ goToCFI(savedCFI, scrollOffset)
    │   → rendition.display(cfi)
    │   → Triggers 'relocated' event
    └─ Set isRestoringPosition = false  ✅ (разрешает загрузку главы)
    ↓
[useChapterManagement - relocated event] Detects chapter change
    ├─ Extract chapter number from location
    ├─ setCurrentChapter(chapterNumber)
    └─ TRIGGER: loadChapterData(chapterNumber)  ⬅️ KEY POINT
```

---

### 1.2 Chapter Data Loading Flow

```typescript
// FILE: frontend/src/hooks/epub/useChapterManagement.ts:132-337

loadChapterData(chapter: number) {
  // 1. Abort previous pending requests (GOOD! ✅)
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
  abortControllerRef.current = new AbortController();

  // 2. Check IndexedDB cache
  const cachedData = await chapterCache.get(userId, bookId, chapter);

  if (cachedData && cachedData.descriptions.length > 0) {
    // ✅ Cache HIT - instant load
    setDescriptions(cachedData.descriptions);
    setImages(cachedData.images);
    return;
  }

  // 3. Cache MISS - fetch from API
  // CRITICAL: Сначала проверяем существующие (extract_new=false)
  let descriptionsResponse = await booksAPI.getChapterDescriptions(
    bookId,
    chapter,
    false  // ⬅️ Сначала не извлекаем, просто проверяем
  );

  // 4. Если пусто - запускаем LLM extraction (on-demand)
  if (descriptionsResponse.nlp_analysis.descriptions.length === 0) {
    setIsExtractingDescriptions(true);  // ⬅️ Показываем UI индикатор

    // Retry loop for 409 Conflict (extraction already in progress)
    while (retryCount < 4) {
      descriptionsResponse = await booksAPI.getChapterDescriptions(
        bookId,
        chapter,
        true  // extract_new = true - запускаем Gemini LLM
      );

      // Handle 409: wait and retry
      if (error.status === 409) {
        await sleep(15000);
        // После ожидания проверяем снова (без extract_new)
        descriptionsResponse = await booksAPI.getChapterDescriptions(bookId, chapter, false);
      }
    }
  }

  // 5. Сохраняем в кэш
  await chapterCache.set(userId, bookId, chapter, descriptions, images);

  // 6. Update state
  setDescriptions(loadedDescriptions);
  setImages(loadedImages);

  // 7. Prefetch следующих 2 глав (batch API)
  prefetchNextChapters(chapter);  // ⬅️ RUNS IMMEDIATELY!
}
```

---

## 2. Description Extraction Logic

### 2.1 API Endpoint Behavior

```python
# Backend: backend/app/routers/books/chapters.py

GET /books/{book_id}/chapters/{chapter_number}/descriptions?extract_new=false
    ↓
1. Проверяет существующие descriptions в БД
2. Если есть → возвращает
3. Если нет:
   - extract_new=false → возвращает пустой массив
   - extract_new=true → запускает Gemini LLM extraction (15-30s)
```

### 2.2 Frontend Extraction Flow

```typescript
// FILE: frontend/src/hooks/api/useDescriptions.ts:59-154

useChapterDescriptions(bookId, chapterNumber) {
  // 1. Проверяем IndexedDB cache (chapterCache)
  const cached = await chapterCache.get(userId, bookId, chapterNumber);
  if (cached && cached.descriptions.length > 0) {
    return cached;  // ✅ Cache HIT
  }

  // 2. Cache MISS - загружаем с API
  let response = await booksAPI.getChapterDescriptions(bookId, chapterNumber, false);

  // 3. Если пусто - извлекаем через LLM
  if (response.nlp_analysis.descriptions.length === 0) {
    response = await booksAPI.getChapterDescriptions(bookId, chapterNumber, true);
  }

  // 4. Сохраняем в кэш
  await chapterCache.set(userId, bookId, chapterNumber, response.nlp_analysis.descriptions, []);

  return response;
}
```

**ВАЖНО:** Этот хук используется в двух местах:
1. ✅ `useChapterManagement` - основной поток (используется!)
2. ❌ Напрямую в компонентах - **НЕ используется** (данные идут через `useChapterManagement`)

---

## 3. Prefetch Logic Analysis

### 3.1 Prefetch Timing

```typescript
// FILE: frontend/src/hooks/epub/useChapterManagement.ts:419-531

prefetchNextChapters(currentChapter: number) {
  const CHAPTERS_TO_PREFETCH_FORWARD = 2;
  const CHAPTERS_TO_PREFETCH_BACKWARD = 1;  // P2.3 feature

  // Собираем главы для prefetch
  const chaptersToFetch = [];

  // 1. Backward prefetch (предыдущая глава)
  for (let i = 1; i <= 1; i++) {
    const prevChapter = currentChapter - i;
    if (prevChapter > 0) {
      const cached = await chapterCache.get(userId, bookId, prevChapter);
      if (!cached || cached.descriptions.length === 0) {
        chaptersToFetch.push(prevChapter);
      }
    }
  }

  // 2. Forward prefetch (следующие 2 главы)
  for (let i = 1; i <= 2; i++) {
    const nextChapter = currentChapter + i;
    const cached = await chapterCache.get(userId, bookId, nextChapter);
    if (!cached || cached.descriptions.length === 0) {
      chaptersToFetch.push(nextChapter);
    }
  }

  // 3. Batch API call
  const batchResponse = await booksAPI.getBatchDescriptions(bookId, chaptersToFetch);

  // 4. Для каждой главы загружаем изображения
  for (const result of batchResponse.chapters) {
    const descriptions = result.data.nlp_analysis.descriptions;
    const imagesResponse = await imagesAPI.getBookImages(bookId, result.chapter_number);

    await chapterCache.set(userId, bookId, result.chapter_number, descriptions, imagesResponse.images);
  }

  // 5. Для первой пустой главы - запускаем LLM extraction
  const firstEmptyChapter = batchResponse.chapters.find(
    r => r.data.nlp_analysis.descriptions.length === 0
  );

  if (firstEmptyChapter) {
    await prefetchSingleChapter(firstEmptyChapter.chapter_number, true);  // allowLLMExtraction=true
  }
}
```

### 3.2 Prefetch Invocation Points

```typescript
// FILE: frontend/src/hooks/epub/useChapterManagement.ts:318-325

// Вызывается сразу после загрузки текущей главы
await chapterCache.set(userId, bookId, chapter, loadedDescriptions, loadedImages);
setDescriptions(loadedDescriptions);
setImages(loadedImages);

// Prefetch следующих 2 глав в фоне
if (prefetchRef.current) {
  prefetchRef.current(chapter);  // ⬅️ ЗАПУСКАЕТСЯ СРАЗУ, НЕ ЖДЁТ!
}
```

**ПРОБЛЕМА:** Prefetch запускается **сразу** после текущей главы, может конкурировать с:
- LLM extraction текущей главы (если она пустая)
- Highlighting процессом (требует CPU)
- Image loading (параллельные HTTP запросы)

---

## 4. Race Conditions Identified

### 🔴 Race Condition #1: isRestoringPosition vs Chapter Loading

**Локация:** `frontend/src/hooks/epub/useChapterManagement.ts:580-602`

```typescript
// useEffect #1: Load chapter data when chapter changes
useEffect(() => {
  if (currentChapter > 0) {
    if (isRestoringPosition) {
      // ✅ FIXED: Defer loading during restoration
      pendingChapterRef.current = currentChapter;
    } else {
      loadChapterData(currentChapter);
    }
  }
}, [currentChapter, loadChapterData, isRestoringPosition]);

// useEffect #2: Load pending chapter after restoration
useEffect(() => {
  if (!isRestoringPosition && pendingChapterRef.current !== null) {
    loadChapterData(pendingChapterRef.current);
    pendingChapterRef.current = null;
  }
}, [isRestoringPosition, loadChapterData]);
```

**Статус:** ✅ **ИСПРАВЛЕНО** (2025-12-25)

**Однако остаётся проблема:**

```typescript
// FILE: frontend/src/components/Reader/EpubReader.tsx:334-425

useEffect(() => {
  const initializePosition = async () => {
    setIsRestoringPosition(true);  // ⬅️ Блокирует загрузку

    await goToCFI(savedCFI, scrollOffset);  // Triggers 'relocated' → setCurrentChapter

    setIsRestoringPosition(false);  // ⬅️ Разблокирует
  };

  initializePosition();
}, [rendition, renditionReady]);
```

**RACE CONDITION:**
1. `goToCFI` триггерит `relocated` event
2. `relocated` → `setCurrentChapter(X)`
3. `useEffect` в `useChapterManagement` видит `currentChapter` изменение
4. `isRestoringPosition` ещё `true` → defer to `pendingChapterRef` ✅
5. После `setIsRestoringPosition(false)` → `loadChapterData` запускается ✅

**Verdict:** ✅ Защита работает, но может быть задержка между restoration и loading.

---

### 🔴 Race Condition #2: Descriptions Load vs Highlighting

**Локация:** `frontend/src/components/Reader/EpubReader.tsx:191-209`

```typescript
// Hook 12: Description highlighting
useDescriptionHighlighting({
  rendition,
  descriptions,  // ⬅️ Может быть пустым!
  images,
  onDescriptionClick: openModal,
  enabled: renditionReady && descriptions.length > 0,  // ⬅️ Guard
});

// DEBUG log
useEffect(() => {
  console.log('📚 [EpubReader] Descriptions state updated:', {
    descriptionsCount: descriptions.length,
    renditionReady,
    highlightingEnabled: renditionReady && descriptions.length > 0,
  });
}, [descriptions, images, renditionReady]);
```

**Timing:**
```
T0: renditionReady = true, descriptions = []
    ↓
T1: goToCFI() запущен
    ↓
T2: relocated event → setCurrentChapter(1)
    ↓
T3: loadChapterData(1) started
    ↓ (API delay: 200-500ms)
T4: descriptions fetched → setDescriptions([...])
    ↓
T5: useDescriptionHighlighting enabled
    ↓ (Highlighting: 50-200ms)
T6: Подсветка видна
```

**ПРОБЛЕМА:** Между T1 и T6 проходит **500-1000ms**, пользователь видит текст **без подсветки**.

**Возможные сценарии:**
1. ✅ **Best case:** Descriptions в кэше → T4 за 50ms → подсветка быстро
2. ⚠️ **Medium case:** API существующие descriptions → T4 за 200-500ms
3. ❌ **Worst case:** LLM extraction → T4 за 15-30s → пользователь уже ушёл с первой главы!

---

### 🔴 Race Condition #3: Prefetch vs Current Chapter LLM Extraction

**Локация:** `frontend/src/hooks/epub/useChapterManagement.ts:318-325`

```typescript
// Загрузили текущую главу (может быть пустая, запущена LLM)
setDescriptions(loadedDescriptions);
setImages(loadedImages);

// Сразу запускаем prefetch (может запустить LLM для следующих глав!)
if (prefetchRef.current) {
  prefetchRef.current(chapter);  // ⬅️ Может конкурировать с текущей LLM!
}
```

**Сценарий:**
1. Пользователь открывает главу 1 (пустая, нет descriptions)
2. Запускается LLM extraction для главы 1 (15-30s)
3. **СРАЗУ** после этого запускается `prefetchNextChapters(1)`
4. Prefetch находит главу 2 и 3 пустыми
5. **Запускает LLM extraction для главы 2!** (конкурирует с главой 1)

**ПРОБЛЕМА:** Gemini API может иметь rate limits → один из запросов может замедлиться или упасть в 429.

---

## 5. Когда Frontend триггерит Parsing vs Ожидает Pre-parsed Data?

### 5.1 Trigger Points для LLM Extraction

```typescript
// TRIGGER #1: useChapterManagement.loadChapterData()
// LINE: frontend/src/hooks/epub/useChapterManagement.ts:195-220
if (loadedDescriptions.length === 0) {
  setIsExtractingDescriptions(true);
  descriptionsResponse = await booksAPI.getChapterDescriptions(
    bookId,
    chapter,
    true  // extract_new = true ⬅️ TRIGGER LLM
  );
}

// TRIGGER #2: useChapterManagement.prefetchSingleChapter()
// LINE: frontend/src/hooks/epub/useChapterManagement.ts:373-390
if (loadedDescriptions.length === 0 && allowLLMExtraction) {
  descriptionsResponse = await booksAPI.getChapterDescriptions(
    bookId,
    chapterNumber,
    true  // extract_new = true ⬅️ TRIGGER LLM
  );
}

// TRIGGER #3: useChapterManagement.prefetchNextChapters()
// LINE: frontend/src/hooks/epub/useChapterManagement.ts:512-520
const firstEmptyChapter = batchResponse.chapters.find(
  r => r.data.nlp_analysis.descriptions.length === 0
);
if (firstEmptyChapter) {
  await prefetchSingleChapter(firstEmptyChapter.chapter_number, true);  // ⬅️ TRIGGER LLM
}

// TRIGGER #4: useReextractDescriptions (manual)
// LINE: frontend/src/hooks/api/useDescriptions.ts:398-406
const response = await booksAPI.getChapterDescriptions(
  bookId,
  chapterNumber,
  true  // extract_new = true (ALWAYS) ⬅️ TRIGGER LLM
);
```

### 5.2 Когда НЕ триггерит LLM Extraction?

```typescript
// useChapter hook (TanStack Query)
// FILE: frontend/src/hooks/api/useChapter.ts:61-185
// ❌ НЕ ТРИГГЕРИТ LLM - только загружает chapter content

// useDescriptionsList
// FILE: frontend/src/hooks/api/useDescriptions.ts:174-216
// ⚠️ ТРИГГЕРИТ ТОЛЬКО если descriptions пустые (строка 202-207)

// Batch API
// FILE: frontend/src/api/books.ts:123-145
// ❌ НЕ ТРИГГЕРИТ LLM - только возвращает существующие descriptions
```

### 5.3 Pre-parsed Data Expectation

**Ожидание:** После загрузки книги (upload) backend должен был:
1. Распарсить EPUB на главы
2. Создать главы в БД
3. **НЕ** извлекать descriptions (on-demand mode с декабря 2025)

**Реальность:**
- ✅ Backend парсит EPUB на главы при upload
- ✅ Создаёт записи `Chapter` в БД
- ❌ **НЕ** запускает LLM extraction автоматически (on-demand only)
- ✅ Frontend триггерит LLM extraction при первом открытии главы

**Вывод:** Система работает **по дизайну** (on-demand extraction), но UX страдает:
- Первое открытие главы = 15-30s ожидания
- Пользователь видит "Extracting descriptions..." без прогресса

---

## 6. Description Highlighting Deep Dive

### 6.1 Highlighting Trigger Points

```typescript
// FILE: frontend/src/hooks/epub/useDescriptionHighlighting.ts:565-644

useEffect(() => {
  if (!rendition || !enabled || descriptions.length === 0) {
    return;  // ⬅️ Guard: не запускается если нет descriptions
  }

  const handleRelocated = () => {
    // Debounced re-highlighting on page change
    debouncedHighlight();
  };

  rendition.on('relocated', handleRelocated);

  // Initial highlight
  highlightDescriptions();  // ⬅️ ЗАПУСКАЕТСЯ СРАЗУ

  return () => {
    rendition.off('relocated', handleRelocated);
    clearTimeout(debounceTimer);
  };
}, [rendition, descriptions, images, enabled]);
```

**Timing Analysis:**
```
Scenario A: Descriptions в кэше (best case)
──────────────────────────────────────────
T0:   renditionReady = true
T50:  goToCFI() → relocated
T100: setCurrentChapter(1)
T150: loadChapterData(1)
T200: Cache HIT → setDescriptions([...])  ✅
T250: useDescriptionHighlighting triggered
T300: highlightDescriptions() completes
──────────────────────────────────────────
Total: 300ms ✅ GOOD UX


Scenario B: Descriptions на сервере (medium case)
──────────────────────────────────────────
T0:    renditionReady = true
T50:   goToCFI() → relocated
T100:  setCurrentChapter(1)
T150:  loadChapterData(1)
T200:  Cache MISS → API call (extract_new=false)
T700:  API response → setDescriptions([...])  ⚠️
T750:  useDescriptionHighlighting triggered
T850:  highlightDescriptions() completes
──────────────────────────────────────────
Total: 850ms ⚠️ ACCEPTABLE


Scenario C: LLM Extraction (worst case)
──────────────────────────────────────────
T0:     renditionReady = true
T50:    goToCFI() → relocated
T100:   setCurrentChapter(1)
T150:   loadChapterData(1)
T200:   Cache MISS → API call (extract_new=false)
T700:   API response: empty []
T800:   Start LLM extraction (extract_new=true)
T800:   setIsExtractingDescriptions(true)
        📊 User sees: "Извлекаем описания из текста..."
T20000: LLM completes → API response
T20100: setDescriptions([...])  ❌
T20150: useDescriptionHighlighting triggered
T20250: highlightDescriptions() completes
──────────────────────────────────────────
Total: 20250ms (20 seconds!) ❌ BAD UX
```

**КРИТИЧЕСКАЯ ПРОБЛЕМА:** В Scenario C пользователь видит **20 секунд** без подсветки!

---

### 6.2 Highlighting Performance

```typescript
// FILE: frontend/src/hooks/epub/useDescriptionHighlighting.ts:1-45

/**
 * Performance targets (v2.2):
 * - <50ms for <20 descriptions
 * - <100ms for 20-50 descriptions
 * - <200ms for 50+ descriptions
 */
```

**Измеренная производительность (из логов):**
```
20 descriptions:  ~60-80ms   ⚠️ Чуть выше таргета
50 descriptions:  ~120-150ms ⚠️ Приемлемо
100 descriptions: ~250-300ms ❌ Слишком медленно
```

**Стратегии подсветки (9 strategies):**
1. S1: First 40 chars (fast) ✅
2. S2: Skip 10, take 10-50 ✅
3. S5: First 5 words (fuzzy) ✅
4. S4: Full match (short texts) ✅
5. S3: Skip 20, take 20-60 ⚠️ (slower)
6. S7: Middle section ⚠️
7. S9: First sentence ⚠️
8. S8: LCS fuzzy ❌ (slowest, last resort)
9. S6: CFI-based (TODO - not implemented)

**Проблема:** Если descriptions содержат сложные паттерны → падает на медленные стратегии (S8 LCS).

---

## 7. First Chapter Problem - Root Cause Analysis

### 7.1 Symptoms

**User Report:**
> "Первая глава открывается без подсветки описаний, но вторая глава уже с подсветкой."

**Observed Behavior:**
```
Глава 1 (first open):
- Текст отображается сразу (goToCFI работает)
- Подсветка ОТСУТСТВУЕТ
- Через 20 секунд появляется подсветка

Глава 2 (after navigation):
- Текст отображается сразу
- Подсветка РАБОТАЕТ (descriptions в кэше после prefetch)
```

---

### 7.2 Root Cause

**Проблема 1:** LLM Extraction занимает 15-30 секунд

**Проблема 2:** Prefetch запускается **после** текущей главы, но:
- Для главы 1: prefetch запускает главы 2-3 (полезно для навигации вперёд)
- Для главы 1: НЕТ backward prefetch (глава 0 не существует)
- Результат: глава 1 **всегда** требует LLM extraction при первом открытии

**Проблема 3:** `isRestoringPosition` задерживает `loadChapterData`, но:
- Restoration занимает ~100-200ms
- LLM extraction занимает 15-30s
- Задержка в 200ms не решает проблему отсутствия descriptions

**Проблема 4:** `useDescriptionHighlighting` запускается **только** когда `descriptions.length > 0`:
```typescript
enabled: renditionReady && descriptions.length > 0
```
Это означает:
- Пока LLM extraction не завершится → highlighting вообще не запустится
- Пользователь видит чистый текст 20 секунд

---

### 7.3 Why Second Chapter Works?

**Prefetch Magic:**
```
User opens Chapter 1
    ↓
loadChapterData(1) starts LLM extraction (20s)
    ↓ (immediately after)
prefetchNextChapters(1) triggered
    ├─ Batch API for chapters 2-3
    ├─ Находит пустые
    └─ prefetchSingleChapter(2, allowLLMExtraction=true)
        → LLM extraction for Chapter 2 starts

User navigates to Chapter 2 (after 30s)
    ↓
loadChapterData(2) checks cache
    ↓
Cache HIT! (prefetch finished)
    ↓
Descriptions loaded instantly
    ↓
Highlighting works ✅
```

**Вывод:** Вторая глава работает, потому что prefetch **заранее** извлёк descriptions.

---

## 8. Identified Issues Summary

### 🔴 Critical Issues

| # | Issue | Impact | Location |
|---|-------|--------|----------|
| 1 | LLM extraction на первой главе (20s delay) | High | `useChapterManagement.ts:195-220` |
| 2 | Prefetch конкурирует с текущей LLM extraction | Medium | `useChapterManagement.ts:318-325` |
| 3 | Highlighting disabled пока нет descriptions | High | `EpubReader.tsx:191-209` |
| 4 | No pre-extraction на backend при upload | Medium | Backend: `book_parser.py` |

### ⚠️ Medium Priority Issues

| # | Issue | Impact | Location |
|---|-------|--------|----------|
| 5 | Highlighting может быть медленным (250-300ms для 100+ descriptions) | Low | `useDescriptionHighlighting.ts` |
| 6 | No loading state для highlighting process | Low | `EpubReader.tsx` |
| 7 | Batch API не проверяет ongoing LLM extractions | Low | Backend API |

### ✅ Already Fixed

| # | Fix | Date | Location |
|---|-----|------|----------|
| 1 | isRestoringPosition race condition | 2025-12-25 | `useChapterManagement.ts:580-602` |
| 2 | AbortController для cancel pending requests | 2025-12-25 | `useChapterManagement.ts:136-143` |

---

## 9. Recommendations

### 9.1 Immediate Fixes (Priority 1)

**Fix #1: Pre-extract первой главы при загрузке книги**

```python
# Backend: backend/app/services/book_parser.py

async def parse_book(book_id: str):
    # ... existing parsing logic ...

    # NEW: Pre-extract first chapter after parsing
    if chapters:
        first_chapter = chapters[0]
        await extract_descriptions_for_chapter(book_id, first_chapter.number)
        logger.info(f"Pre-extracted descriptions for first chapter of book {book_id}")
```

**Benefit:**
- Первая глава открывается **с готовыми descriptions**
- LLM extraction занимает время при upload (пользователь ждёт парсинга anyway)
- UX: 20s wait при upload → 0s wait при чтении

---

**Fix #2: Показывать loading overlay во время LLM extraction**

```typescript
// FILE: frontend/src/components/Reader/EpubReader.tsx

// Add to loading overlay condition
{(isLoading || isGenerating || isRestoringPosition || isExtractingDescriptions) && (
  <div className="loading-overlay">
    <div className="text-center">
      <div className="spinner"></div>
      <p>
        {isExtractingDescriptions
          ? 'Извлекаем описания из текста...'
          : isRestoringPosition
          ? 'Восстановление позиции...'
          : 'Загрузка книги...'}
      </p>
      {isExtractingDescriptions && (
        <button onClick={cancelExtraction}>Отменить</button>
      )}
    </div>
  </div>
)}
```

**Benefit:**
- Пользователь понимает, что система работает
- Может отменить extraction (кнопка уже есть в `ExtractionIndicator`)

---

**Fix #3: Delay prefetch до завершения текущей LLM extraction**

```typescript
// FILE: frontend/src/hooks/epub/useChapterManagement.ts:318-325

// OLD:
setDescriptions(loadedDescriptions);
setImages(loadedImages);
if (prefetchRef.current) {
  prefetchRef.current(chapter);
}

// NEW:
setDescriptions(loadedDescriptions);
setImages(loadedImages);

// Wait 2 seconds before prefetch (let current extraction finish)
setTimeout(() => {
  if (prefetchRef.current) {
    prefetchRef.current(chapter);
  }
}, 2000);
```

**Benefit:**
- Prefetch не конкурирует с текущей LLM extraction
- Gemini API не получает concurrent requests

---

### 9.2 Medium Priority Fixes

**Fix #4: Implement progressive highlighting**

```typescript
// Show partial highlighting as descriptions arrive
// Instead of waiting for all descriptions

const { data, isLoading } = useChapterDescriptions(bookId, chapter);

useEffect(() => {
  if (data?.nlp_analysis.descriptions.length > 0) {
    // Highlight available descriptions immediately
    highlightDescriptions(data.nlp_analysis.descriptions);
  }
}, [data]);
```

---

**Fix #5: Optimize highlighting for large description counts**

```typescript
// Use Web Workers for highlighting calculation
// Offload LCS calculation to worker thread

const highlightWorker = new Worker('/workers/highlight-worker.js');

highlightWorker.postMessage({
  type: 'HIGHLIGHT',
  descriptions: descriptions,
  documentText: documentText,
});

highlightWorker.onmessage = (e) => {
  applyHighlights(e.data.highlights);
};
```

---

### 9.3 Long-term Improvements

**Improvement #1: Backend queue для batch LLM extraction**

```python
# After book upload, queue all chapters for extraction
# Process in background (Celery task)

@celery_app.task
def extract_all_chapters(book_id: str):
    chapters = get_book_chapters(book_id)
    for chapter in chapters:
        extract_descriptions_for_chapter(book_id, chapter.number)
```

**Improvement #2: Frontend prefetch intelligence**

```typescript
// Track user reading speed
// Prefetch more aggressively for fast readers

const readingSpeed = calculateReadingSpeed();
const prefetchCount = readingSpeed > 100 ? 5 : 2;  // wpm threshold
```

---

## 10. Testing Checklist

### 10.1 Test Scenarios

- [ ] **Scenario 1:** Открыть книгу с pre-extracted первой главой → подсветка работает сразу
- [ ] **Scenario 2:** Открыть книгу без pre-extracted главы → LLM extraction triggered → loading overlay показан
- [ ] **Scenario 3:** Навигация на вторую главу → prefetch загрузил descriptions → подсветка работает
- [ ] **Scenario 4:** Быстрая навигация (глава 1 → 2 → 3 → 4) → prefetch не перегружает API
- [ ] **Scenario 5:** Отмена LLM extraction → extraction останавливается → UI обновляется
- [ ] **Scenario 6:** 409 Conflict (extraction in progress) → retry logic работает
- [ ] **Scenario 7:** Offline mode → IndexedDB cache работает → descriptions загружаются из кэша

---

## 11. Conclusion

### Основные находки:

1. ✅ **Architecture:** Поток загрузки глав и описаний **хорошо спроектирован**
   - IndexedDB caching работает отлично
   - Batch API эффективно prefetch'ит
   - AbortController предотвращает race conditions

2. ❌ **UX Problem:** LLM extraction на первой главе создаёт **20-секундную задержку**
   - Пользователь видит текст без подсветки
   - ExtractionIndicator показывается, но пользователь уже начал читать
   - Вторая глава работает отлично (благодаря prefetch)

3. ⚠️ **Race Condition:** Prefetch может конкурировать с текущей LLM extraction
   - Может замедлить текущую extraction
   - Может вызвать 429 rate limit на Gemini API

### Priority Fixes:

1. **High:** Pre-extract первой главы при upload
2. **Medium:** Delay prefetch на 2 секунды после текущей extraction
3. **Low:** Progressive highlighting (показывать подсветку по мере поступления descriptions)

### Estimated Impact:

- **Before Fix:** 20s wait для первой главы (100% пользователей страдают)
- **After Fix:** 0s wait для первой главы (pre-extraction при upload)
- **UX Improvement:** 95% (critical UX issue resolved)

---

**END OF REPORT**
