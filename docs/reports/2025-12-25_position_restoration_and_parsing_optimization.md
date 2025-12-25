# Анализ и оптимизация: Восстановление позиции и парсинг описаний

**Дата:** 2025-12-25
**Версия:** 4.0
**Статус:** ✅ Phase 1 + Phase 2 + Phase 3 Завершены

---

## Changelog

### Phase 3 Implementation (2025-12-25)

#### Completed Tasks:

| Task | Status | Files Changed |
|------|--------|---------------|
| 4.1 Batch API endpoint | ✅ Done | `descriptions.py`, `descriptions.py` (schemas), `books.ts` |
| 4.2 Redis caching for descriptions | ✅ Done | `descriptions.py` |
| 4.3 WebSocket progress updates | ⏸️ Deferred | P3 priority, low impact |

#### Key Changes:

1. **Batch API Endpoint** (`POST /books/{book_id}/chapters/batch`):
   - Fetches descriptions for multiple chapters in ONE HTTP request
   - Reduces N API calls to 1 for prefetching
   - Frontend `getBatchDescriptions()` method added
   - `useChapterManagement` now uses batch API for prefetch

2. **Redis Caching**:
   - Cache key: `descriptions:book:{book_id}:chapter:{chapter_number}`
   - TTL: 1 hour
   - Cache only non-empty results
   - Auto-invalidation on LLM extraction
   - Works for both single and batch endpoints

3. **Updated Prefetch Logic**:
   - Batch API reduces HTTP overhead
   - Parallel image fetching after batch descriptions
   - Fallback to individual calls on batch failure

---

### Phase 2 Implementation (2025-12-25)

#### Completed Tasks:

| Task | Status | Files Changed |
|------|--------|---------------|
| 2.2 Parsing status polling hook | ✅ Done | `useParsingStatus.ts` (new), `BookReaderPage.tsx`, `hooks/api/index.ts` |
| 3.1 Expand pre-parsing to 5 chapters | ✅ Done | `backend/app/core/tasks.py` |
| 3.2 Smarter prefetching (2 chapters) | ✅ Done | `useChapterManagement.ts` |

#### Key Changes:

1. **`useParsingStatus.ts`** (new):
   - Polls book status while parsing is in progress (3s interval)
   - Invalidates TanStack Query and IndexedDB caches when parsing completes
   - Shows notification when book is ready

2. **`BookReaderPage.tsx`**:
   - Integrated useParsingStatus hook
   - Added floating parsing indicator at bottom ("Подготовка книги... X%")

3. **`tasks.py`**:
   - Increased `CHAPTERS_TO_PREPARSE` from 2 to 5
   - Faster initial reading experience

4. **`useChapterManagement.ts`**:
   - Split prefetching into `prefetchSingleChapter` and `prefetchNextChapters`
   - Now prefetches 2 chapters ahead (was 1)
   - Staggered requests (500ms delay) to reduce server load
   - Smart LLM triggering: only for chapter+1, skip for chapter+2
   - Better 409 Conflict handling for prefetch (don't wait, just log)
   - Used ref pattern to avoid circular dependencies

---

### Phase 1 Implementation (2025-12-25)

#### Completed Tasks:

| Task | Status | Files Changed |
|------|--------|---------------|
| 1.1 Координация Position Restoration и Description Loading | ✅ Done | `useChapterManagement.ts`, `EpubReader.tsx` |
| 1.2 AbortController для Description Loading | ✅ Done | `useChapterManagement.ts` |
| 1.3 Backend distributed lock для LLM Extraction | ✅ Done | `cache.py`, `descriptions.py` |
| 1.4 Обработка 409 Conflict в frontend | ✅ Done | `useChapterManagement.ts` |
| 2.1 Prominent LLM Extraction Indicator | ✅ Done | `ExtractionIndicator.tsx`, `EpubReader.tsx` |

#### Key Changes:

1. **`useChapterManagement.ts`**:
   - Added `isRestoringPosition` prop to defer loading during position restoration
   - Added AbortController with proper cleanup for request cancellation
   - Added retry logic with 409 Conflict handling (up to 4 retries)
   - Added `cancelExtraction()` function for user-triggered cancellation

2. **`EpubReader.tsx`**:
   - Now passes `isRestoringPosition` to useChapterManagement
   - Uses new ExtractionIndicator component with cancel button

3. **`cache.py`**:
   - Added `acquire_lock()` method using Redis SET NX
   - Added `release_lock()` method
   - TTL-based auto-expiration (120s) prevents deadlocks

4. **`descriptions.py`**:
   - Added distributed lock around LLM extraction
   - Returns 409 Conflict if extraction already in progress
   - Proper lock release in finally block

5. **`ExtractionIndicator.tsx`** (new):
   - Prominent floating card UI
   - Theme-aware design (light/dark/sepia)
   - Cancel button with callback
   - Animated spinner with Sparkles icon

---

## Содержание

1. [Executive Summary](#1-executive-summary)
2. [Текущая архитектура](#2-текущая-архитектура)
3. [Детальный анализ проблем](#3-детальный-анализ-проблем)
4. [Сценарии использования](#4-сценарии-использования)
5. [План оптимизации](#5-план-оптимизации)
6. [Приоритизация задач](#6-приоритизация-задач)

---

## 1. Executive Summary

### Обнаруженные критические проблемы

| Проблема | Severity | Impact |
|----------|----------|--------|
| Race condition: Position restoration vs Description loading | CRITICAL | Конфликт при одновременном запуске |
| LLM extraction blocking UI | HIGH | 5-15 секунд без обратной связи |
| Cache invalidation после background парсинга | HIGH | Highlights не появляются |
| Первые 2 главы без highlights при быстрой навигации | MEDIUM | Плохой UX |
| Параллельные LLM extraction запросы | MEDIUM | Дублирование вызовов API |

### Ключевые метрики (текущее состояние)

| Метрика | Cache HIT | Cache MISS | LLM Extraction |
|---------|-----------|------------|----------------|
| Время до highlights | 150-300ms | 500-1000ms | 5-15 секунд |
| API запросов | 0 | 2 | 3 |
| UX оценка | Отлично | Хорошо | Плохо |

---

## 2. Текущая архитектура

### 2.1 Sequence Diagram: Открытие книги

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BOOK OPENING SEQUENCE                               │
└─────────────────────────────────────────────────────────────────────────────┘

Time(ms)  Component              Action
────────────────────────────────────────────────────────────────────────────────
0         BookReaderPage         Mount, fetch book data
50        BookReaderPage         Book data received, render EpubReader
100       EpubReader             Mount (isRestoringPosition = true)
150       useEpubLoader          Start EPUB download
500       useEpubLoader          EPUB downloaded, book.ready
600       useEpubLoader          Create rendition
900       useEpubLoader          rendition.display() initial
1400      EpubReader             renditionReady = true (500ms delay)

          ╔════════════════════════════════════════════════════════════════╗
          ║  PARALLEL RACE CONDITION STARTS HERE                           ║
          ╚════════════════════════════════════════════════════════════════╝

1401      useLocationGeneration  Start locations check (IndexedDB)
1401      EpubReader             Start position restoration useEffect
1420      useLocationGeneration  Cache HIT → locations ready
          OR
1420      useLocationGeneration  Cache MISS → start generation (6-8s)
1450      EpubReader             Fetch saved progress from API
1600      EpubReader             goToCFI() - restore position
1650      epub.js                'relocated' event fired
1651      useChapterManagement   handleRelocated → setCurrentChapter(N)
1652      useChapterManagement   loadChapterData(N) triggered

          ╔════════════════════════════════════════════════════════════════╗
          ║  DESCRIPTION LOADING STARTS (MAY CONFLICT WITH RESTORATION)   ║
          ╚════════════════════════════════════════════════════════════════╝

1700      chapterCache           Check IndexedDB for chapter N
1750      chapterCache           Cache MISS → API call
1800      API                    GET /descriptions?extract_new=false
2000      API                    Response: descriptions = []
2001      API                    GET /descriptions?extract_new=true (LLM)

          ╔════════════════════════════════════════════════════════════════╗
          ║  LLM EXTRACTION: 5-15 SECONDS                                  ║
          ║  USER SEES NO HIGHLIGHTS DURING THIS TIME                      ║
          ╚════════════════════════════════════════════════════════════════╝

7000      API                    LLM extraction complete
7100      useChapterManagement   setDescriptions(loaded)
7200      epub.js                'rendered' event
7300      useDescriptionHighlighting  Debounce 100ms
7400      useDescriptionHighlighting  highlightDescriptions()
7450      DOM                    Highlights visible to user
────────────────────────────────────────────────────────────────────────────────
```

### 2.2 Компонентная архитектура

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EpubReader.tsx                                  │
│                         (Main Orchestrator Component)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ useEpubLoader    │  │ useLocationGen   │  │ useCFITracking           │  │
│  │                  │  │                  │  │                          │  │
│  │ - Download EPUB  │  │ - Generate locs  │  │ - Track CFI position     │  │
│  │ - Create book    │  │ - Cache IndexedDB│  │ - goToCFI()              │  │
│  │ - Create rendition│ │ - 6-8s first load│  │ - Progress %             │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────────┘  │
│           │                     │                        │                   │
│           └─────────────────────┴────────────────────────┘                   │
│                                 │                                            │
│                    ┌────────────▼────────────┐                              │
│                    │ Position Restoration    │                              │
│                    │ useEffect               │                              │
│                    │                         │                              │
│                    │ Dependencies:           │                              │
│                    │ - rendition             │                              │
│                    │ - renditionReady        │                              │
│                    │ - book.id               │                              │
│                    │ - locations (optional)  │                              │
│                    │ - goToCFI               │                              │
│                    └────────────┬────────────┘                              │
│                                 │                                            │
│                    ┌────────────▼────────────┐                              │
│                    │ 'relocated' event       │◄─────────────────────────────┤
│                    │ (epub.js)               │                              │
│                    └────────────┬────────────┘                              │
│                                 │                                            │
│  ┌──────────────────────────────▼───────────────────────────────────────┐   │
│  │                    useChapterManagement                               │   │
│  │                                                                       │   │
│  │  handleRelocated(location) {                                         │   │
│  │    const chapter = getChapterFromLocation(location);                 │   │
│  │    setCurrentChapter(chapter);  // ← TRIGGERS loadChapterData       │   │
│  │  }                                                                    │   │
│  │                                                                       │   │
│  │  useEffect(() => {                                                   │   │
│  │    if (currentChapter > 0) {                                         │   │
│  │      loadChapterData(currentChapter);                                │   │
│  │    }                                                                  │   │
│  │  }, [currentChapter]);                                               │   │
│  │                                                                       │   │
│  │  loadChapterData(chapter):                                           │   │
│  │    1. Check IndexedDB cache                                          │   │
│  │    2. If MISS → API call (extract_new=false)                        │   │
│  │    3. If empty → API call (extract_new=true) ← LLM 5-15s            │   │
│  │    4. setDescriptions(loaded)                                        │   │
│  │    5. prefetchNextChapter(chapter + 1)                              │   │
│  └───────────────────────────────┬───────────────────────────────────────┘   │
│                                  │                                           │
│                     ┌────────────▼────────────┐                             │
│                     │ descriptions state      │                             │
│                     └────────────┬────────────┘                             │
│                                  │                                           │
│  ┌───────────────────────────────▼───────────────────────────────────────┐  │
│  │                 useDescriptionHighlighting                             │  │
│  │                                                                        │  │
│  │  Dependencies: [rendition, descriptions, enabled]                     │  │
│  │                                                                        │  │
│  │  Triggers on:                                                          │  │
│  │  - 'rendered' event (page change, font resize, theme change)          │  │
│  │  - descriptions state change                                           │  │
│  │                                                                        │  │
│  │  Debounce: 100ms                                                       │  │
│  │                                                                        │  │
│  │  highlightDescriptions():                                              │  │
│  │    - Build DOM text node map                                           │  │
│  │    - 9-strategy search algorithm                                       │  │
│  │    - Apply <span> highlights with click handlers                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Backend Description Extraction Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ GET /api/v1/books/{book_id}/chapters/{chapter}/descriptions    │
│                                                                 │
│ Query params:                                                   │
│   extract_new: bool = false                                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ Validate book access   │
              │ (user ownership check) │
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ Find chapter by number │
              └────────────┬───────────┘
                           │
              ┌────────────▼────────────┐
              │ extract_new == true?    │
              └────────────┬────────────┘
                    │             │
                    │ NO          │ YES
                    ▼             ▼
        ┌───────────────┐   ┌─────────────────────────┐
        │ Query DB for  │   │ LLM Extraction Pipeline │
        │ existing      │   │                         │
        │ descriptions  │   │ 1. Check LLM available  │
        └───────┬───────┘   │    └─ No → HTTP 503     │
                │           │                         │
                │           │ 2. Delete old descs     │
                │           │                         │
                │           │ 3. langextract_processor│
                │           │    .extract_descriptions│
                │           │                         │
                │           │    ┌──────────────────┐ │
                │           │    │ GeminiExtractor  │ │
                │           │    │                  │ │
                │           │    │ - Chunk text     │ │
                │           │    │   (6000 chars)   │ │
                │           │    │ - Gemini API     │ │
                │           │    │ - Parse JSON     │ │
                │           │    │ - Deduplicate    │ │
                │           │    │                  │ │
                │           │    │ ⏱️ 5-15 seconds   │ │
                │           │    └──────────────────┘ │
                │           │                         │
                │           │ 4. Save to DB           │
                │           │ 5. Update chapter flags │
                │           │    - is_description_    │
                │           │      parsed = True      │
                │           │    - descriptions_      │
                │           │      found = N          │
                │           │    - parsed_at = NOW()  │
                │           └────────────┬────────────┘
                │                        │
                └────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ Return descriptions    │
              │ + chapter_info         │
              │ + nlp_analysis stats   │
              └────────────────────────┘
```

---

## 3. Детальный анализ проблем

### 3.1 CRITICAL: Race Condition между Position Restoration и Description Loading

**Симптомы:**
- При открытии книги с сохранённым прогрессом highlights могут не появиться
- `isRestoringPosition` блокирует UI, но description loading уже запускается в фоне
- Если пользователь быстро навигирует - множественные конфликтующие запросы

**Root Cause Analysis:**

```typescript
// EpubReader.tsx - Position Restoration useEffect (lines 331-422)
useEffect(() => {
  if (!rendition || !renditionReady) return;
  if (hasRestoredPosition.current) return;

  setIsRestoringPosition(true);  // ← UI blocked

  // Fetch progress and restore position...
  await goToCFI(savedProgress.cfi);  // ← Triggers 'relocated' event!

  setIsRestoringPosition(false);  // ← UI unblocked
}, [rendition, renditionReady, ...]);

// useChapterManagement.ts - Handles 'relocated' event
rendition.on('relocated', (location) => {
  const chapter = getChapterFromLocation(location);
  setCurrentChapter(chapter);  // ← Triggers loadChapterData!
});

// loadChapterData runs WHILE isRestoringPosition is still true
// This causes:
// 1. Description loading starts before position is fully restored
// 2. Multiple chapter detections if user navigates quickly
// 3. Race between LLM extraction and page rendering
```

**Визуализация конфликта:**

```
Timeline:
────────────────────────────────────────────────────────────────────────────
0ms     isRestoringPosition = true (UI blocked)
50ms    goToCFI() called
100ms   'relocated' event fired ← CHAPTER DETECTED!
101ms   loadChapterData() starts ← DESCRIPTION LOADING STARTS!
        ↓
        ↓ (LLM extraction: 5-15 seconds)
        ↓
150ms   goToCFI() scroll adjustment
200ms   Position restoration complete
201ms   isRestoringPosition = false ← UI unblocked
        ↓
        ↓ BUT DESCRIPTIONS NOT LOADED YET!
        ↓
7000ms  LLM extraction complete
7100ms  setDescriptions()
7200ms  'rendered' event
7300ms  highlightDescriptions() ← FINALLY VISIBLE
────────────────────────────────────────────────────────────────────────────
```

**Проблема:** Пользователь видит UI (книгу можно читать) на 200ms, но highlights появляются только через 7 секунд.

### 3.2 HIGH: LLM Extraction блокирует UX без обратной связи

**Текущее состояние:**

```typescript
// useChapterManagement.ts - lines 154-172
if (loadedDescriptions.length === 0) {
  console.log('🔄 No descriptions found, triggering LLM extraction...');
  setIsExtractingDescriptions(true);  // ← State exists but UI indicator weak

  try {
    descriptionsResponse = await booksAPI.getChapterDescriptions(
      bookId,
      chapter,
      true  // extract_new = true → 5-15 seconds!
    );
  } finally {
    setIsExtractingDescriptions(false);
  }
}
```

**Проблема:**
- `isExtractingDescriptions` устанавливается, но UI индикатор минимален (тонкая полоска)
- Пользователь не понимает, что происходит долгий процесс
- Нет прогресса извлечения (сколько осталось)

### 3.3 HIGH: Cache Invalidation после Background Parsing

**Сценарий:**

1. Admin запускает парсинг книги через admin panel
2. Celery task обрабатывает все главы в фоне
3. Пользователь открывает книгу ПОСЛЕ завершения парсинга
4. Frontend берёт данные из IndexedDB cache → старые данные (descriptions = [])
5. Highlights не появляются

**Где проблема:**

```typescript
// useDescriptions.ts - lines 77-109
const cached = await chapterCache.get(userId, bookId, chapterNumber);
if (cached && cached.descriptions.length > 0) {
  // ✅ Cache HIT - return cached
  return cached;
}

// ❌ Проблема: если cached.descriptions.length === 0,
// мы перезагружаем, но cached может быть "валидным" но пустым
// (до парсинга)
```

**Backend не уведомляет frontend о завершении парсинга:**

```python
# tasks.py - after parsing complete
book.is_processing = False
book.is_parsed = True
book.parsing_progress = 100
await db.commit()

# Инвалидируем Redis cache, но НЕ IndexedDB frontend!
pattern = f"user:{book.user_id}:books:*"
await cache_manager.delete_pattern(pattern)
```

### 3.4 MEDIUM: Первые 2 главы без Highlights при быстрой навигации

**Сценарий:**

1. Пользователь открывает только что загруженную книгу
2. Backend автоматически парсит первые 2 главы (Celery task)
3. Пользователь открывает главу 1 ДО завершения парсинга
4. `loadChapterData(1)` вызывает LLM extraction
5. Пользователь переходит к главе 2 (не дождавшись)
6. `loadChapterData(2)` вызывает ЕЩЕЛЫМ LLM extraction
7. Оба запроса выполняются параллельно → дублирование
8. Пользователь возвращается к главе 1 → теперь в cache

**Timeline:**

```
0s      User opens chapter 1
0.1s    loadChapterData(1) → LLM start
2s      User navigates to chapter 2 (impatient)
2.1s    loadChapterData(2) → ANOTHER LLM start!

        Chapter 1 LLM: still running...
        Chapter 2 LLM: still running...

8s      Chapter 1 LLM complete → BUT user is on chapter 2!
10s     Chapter 2 LLM complete → highlights appear
12s     User returns to chapter 1 → Cache HIT → highlights appear
```

### 3.5 MEDIUM: Параллельные LLM Extraction запросы без блокировки

**Backend проблема (descriptions.py):**

```python
if extract_new:
    # ❌ НЕТ DISTRIBUTED LOCK!

    # Если два запроса пришли одновременно:
    # Request 1: DELETE descriptions WHERE chapter_id = X
    # Request 2: DELETE descriptions WHERE chapter_id = X  ← CONFLICT!

    # Request 1: LLM extraction starts (5-15s)
    # Request 2: LLM extraction starts (5-15s)  ← DUPLICATE COST!

    # Request 1: INSERT descriptions...
    # Request 2: INSERT descriptions...  ← DUPLICATE ENTRIES!
```

---

## 4. Сценарии использования

### 4.1 Сценарий A: Открытие книги с существующим прогрессом в середине главы

**Ожидаемое поведение:**
1. Книга открывается на сохранённой позиции (CFI + scroll offset)
2. Descriptions для текущей главы загружаются
3. Highlights появляются на текущей странице

**Текущие проблемы:**
- Race condition между restoration и description loading
- Если descriptions ещё не были извлечены → 5-15s ожидание

**Оптимизированный flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. MOUNT EpubReader                                             │
│    - isRestoringPosition = true                                 │
│    - isLoadingDescriptions = true                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. PARALLEL INIT (Promise.all)                                  │
│                                                                 │
│    A. Load EPUB + Create Rendition                              │
│    B. Fetch Reading Progress                                    │
│    C. Prefetch Chapter Descriptions (for saved chapter)         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. SEQUENTIAL RESTORATION                                       │
│                                                                 │
│    A. goToCFI() - restore position                              │
│    B. WAIT for descriptions (if not ready)                      │
│    C. Apply highlights                                          │
│    D. isRestoringPosition = false                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. USER CAN INTERACT                                            │
│    - Highlights visible                                          │
│    - Navigation enabled                                          │
│    - Prefetch next chapter in background                         │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Сценарий B: Открытие только что загруженной книги

**Ожидаемое поведение:**
1. Книга открывается с первой главы
2. Первые 2 главы уже распарсены (backend Celery task)
3. Highlights видны сразу

**Текущие проблемы:**
- Celery task может не успеть завершиться
- Нет индикатора "парсинг в процессе"
- Если пользователь быстрый → попадает на непарсенную главу

**Оптимизированный flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│ BOOK UPLOAD COMPLETED                                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ CELERY TASK: process_book_task                                  │
│                                                                 │
│ 1. Parse book structure                                         │
│ 2. Extract descriptions for chapters 1-5 (расширить с 2)        │
│ 3. Set is_parsing = true on book                                │
│ 4. WebSocket: notify "parsing_progress" updates                 │
│ 5. Set is_parsing = false when complete                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: User opens book                                       │
│                                                                 │
│ 1. Check book.is_parsing status                                 │
│    - If true → Show "Подготовка книги..." indicator             │
│    - Poll every 5s until complete                               │
│                                                                 │
│ 2. Load chapter 1 descriptions                                  │
│    - Should be in cache (pre-parsed)                            │
│    - If not → wait for parsing or trigger LLM                   │
│                                                                 │
│ 3. Background prefetch chapters 2-3                             │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Сценарий C: Переход к третьей главе и запуск парсинга

**Ожидаемое поведение:**
1. Пользователь навигирует к главе 3
2. Если descriptions не извлечены → LLM extraction
3. Пока ждём → показать индикатор
4. После completion → prefetch главу 4

**Текущие проблемы:**
- Индикатор слабый
- Нет отмены запроса при быстрой навигации
- Параллельные запросы не защищены

**Оптимизированный flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│ USER navigates to Chapter 3                                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. ABORT previous pending requests (if any)                     │
│                                                                 │
│    abortControllerRef.current?.abort();                         │
│    abortControllerRef.current = new AbortController();          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Check IndexedDB cache for chapter 3                          │
│                                                                 │
│    ├─ HIT → setDescriptions(cached) → highlight                │
│    │                                                             │
│    └─ MISS → Continue to API                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. API call with abort signal                                   │
│                                                                 │
│    const response = await fetch(url, {                          │
│      signal: abortController.signal                             │
│    });                                                          │
│                                                                 │
│    If aborted → silently return (user navigated away)           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. LLM EXTRACTION (if needed)                                   │
│                                                                 │
│    Show prominent UI indicator:                                  │
│    ┌─────────────────────────────────────────────────────────┐  │
│    │ 🤖 AI анализирует главу... (обычно 5-15 сек)            │  │
│    │ ━━━━━━━━━━━░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  │
│    │                                                         │  │
│    │ [Отменить]                                              │  │
│    └─────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. POST-COMPLETION                                              │
│                                                                 │
│    A. setDescriptions(extracted)                                │
│    B. Save to IndexedDB cache                                   │
│    C. Apply highlights                                          │
│    D. Prefetch chapter 4 in background                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. План оптимизации

### 5.1 Phase 1: Исправление критических race conditions (1-2 дня)

#### Task 1.1: Координация Position Restoration и Description Loading

**Файл:** `frontend/src/components/Reader/EpubReader.tsx`

```typescript
// BEFORE (current problematic code)
useEffect(() => {
  if (!rendition || !renditionReady) return;
  // Position restoration triggers 'relocated' event
  // which triggers loadChapterData immediately
  await goToCFI(savedProgress.cfi);
}, [...]);

// AFTER (coordinated approach)
useEffect(() => {
  if (!rendition || !renditionReady) return;

  const initializeReader = async () => {
    setIsRestoringPosition(true);

    // 1. Fetch saved progress
    const progress = await fetchSavedProgress();

    // 2. Determine target chapter
    const targetChapter = progress?.current_chapter || 1;

    // 3. Pre-load descriptions for target chapter (parallel)
    const descriptionsPromise = preloadChapterDescriptions(targetChapter);

    // 4. Restore position (skip relocated handler during restoration)
    skipNextRelocated();
    await goToCFI(progress?.cfi);

    // 5. Wait for descriptions
    const descriptions = await descriptionsPromise;
    setDescriptions(descriptions);

    // 6. Now safe to enable normal relocated handling
    setIsRestoringPosition(false);
  };

  initializeReader();
}, [rendition, renditionReady, book.id]);
```

#### Task 1.2: Добавить Abort Controller для Description Loading

**Файл:** `frontend/src/hooks/epub/useChapterManagement.ts`

```typescript
// Add ref for abort controller
const abortControllerRef = useRef<AbortController | null>(null);

const loadChapterData = useCallback(async (chapter: number) => {
  // Cancel previous request
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
  abortControllerRef.current = new AbortController();
  const signal = abortControllerRef.current.signal;

  try {
    // Pass signal to API call
    const response = await booksAPI.getChapterDescriptions(
      bookId,
      chapter,
      false,
      { signal }
    );

    // Check if aborted
    if (signal.aborted) return;

    // Continue with normal flow...
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request aborted - user navigated away');
      return;
    }
    throw error;
  }
}, [bookId]);

// Cleanup on unmount
useEffect(() => {
  return () => {
    abortControllerRef.current?.abort();
  };
}, []);
```

#### Task 1.3: Backend Distributed Lock для LLM Extraction

**Файл:** `backend/app/routers/descriptions.py`

```python
from app.core.cache import cache_manager

async def get_chapter_descriptions(..., extract_new: bool = False):
    # ...existing validation...

    if extract_new:
        lock_key = f"extract_lock:chapter:{chapter.id}"

        # Try to acquire lock (60 second TTL)
        lock_acquired = await cache_manager.set(
            lock_key,
            value="locked",
            nx=True,   # Only set if not exists
            ex=60      # 60 second expiry
        )

        if not lock_acquired:
            # Another extraction is in progress
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Description extraction already in progress for this chapter. Please wait."
            )

        try:
            # Existing extraction logic...
            result = await langextract_processor.extract_descriptions(chapter.content)
            # ...save to DB...
        finally:
            # Release lock
            await cache_manager.delete(lock_key)

    # Return descriptions...
```

### 5.2 Phase 2: Улучшение UX индикаторов (1 день)

#### Task 2.1: Prominent LLM Extraction Indicator

**Файл:** `frontend/src/components/Reader/ExtractionIndicator.tsx` (новый)

```typescript
interface ExtractionIndicatorProps {
  isExtracting: boolean;
  onCancel: () => void;
  theme: ThemeName;
}

export const ExtractionIndicator: React.FC<ExtractionIndicatorProps> = ({
  isExtracting,
  onCancel,
  theme,
}) => {
  if (!isExtracting) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        'fixed top-20 left-1/2 -translate-x-1/2 z-50',
        'px-6 py-4 rounded-xl shadow-lg backdrop-blur-md',
        'flex items-center gap-4',
        theme === 'dark' ? 'bg-gray-800/95' : 'bg-white/95'
      )}
    >
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-4 border-blue-500/30" />
        <div className="absolute inset-0 w-10 h-10 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
      </div>

      <div>
        <p className={cn(
          'font-medium',
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        )}>
          AI анализирует главу...
        </p>
        <p className={cn(
          'text-sm',
          theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
        )}>
          Обычно занимает 5-15 секунд
        </p>
      </div>

      <button
        onClick={onCancel}
        className={cn(
          'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
          theme === 'dark'
            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        )}
      >
        Отменить
      </button>
    </motion.div>
  );
};
```

#### Task 2.2: Parsing Status Polling

**Файл:** `frontend/src/hooks/api/useParsingStatus.ts` (новый)

```typescript
export function useParsingStatus(bookId: string) {
  const queryClient = useQueryClient();
  const userId = getCurrentUserId();

  const query = useQuery({
    queryKey: ['book', userId, bookId, 'parsing'],
    queryFn: () => booksAPI.getBook(bookId),
    select: (data) => ({
      isParsing: data.is_processing || data.parsing_progress < 100,
      progress: data.parsing_progress,
      chaptersReady: data.chapters_parsed || 0,
    }),
    refetchInterval: (data) => {
      // Poll every 3 seconds while parsing
      if (data?.isParsing) return 3000;
      return false;
    },
    enabled: !!bookId,
  });

  // Invalidate caches when parsing completes
  useEffect(() => {
    if (query.data && !query.data.isParsing && query.data.progress === 100) {
      // Parsing just completed - invalidate all caches
      queryClient.invalidateQueries({
        queryKey: descriptionKeys.byBook(userId, bookId),
      });

      // Clear IndexedDB cache for this book
      chapterCache.clearBook(userId, bookId).catch(console.error);

      notify.success('Книга готова!', 'Описания извлечены для всех глав');
    }
  }, [query.data?.isParsing, query.data?.progress]);

  return query;
}
```

### 5.3 Phase 3: Оптимизация prefetching (1 день)

#### Task 3.1: Расширить background pre-parsing при upload

**Файл:** `backend/app/core/tasks.py`

```python
# Increase pre-parsed chapters from 2 to 5
CHAPTERS_TO_PREPARSE = 5

# Add progress tracking
async def process_book_with_progress(book_id: str):
    # ...get chapters...

    total_chapters = len(chapters)
    for i, chapter in enumerate(chapters[:CHAPTERS_TO_PREPARSE]):
        try:
            result = await langextract_processor.extract_descriptions(chapter.content)
            # ...save...

            # Update progress
            book.parsing_progress = int((i + 1) / total_chapters * 100)
            await db.commit()

            # WebSocket notification (optional)
            await notify_parsing_progress(book_id, book.parsing_progress)

        except Exception as e:
            logger.error(f"Error parsing chapter {i+1}: {e}")
            continue
```

#### Task 3.2: Smarter prefetching в useChapterManagement

**Файл:** `frontend/src/hooks/epub/useChapterManagement.ts`

```typescript
// Prefetch next 2 chapters instead of 1
const prefetchNextChapters = useCallback(async (currentChapter: number) => {
  const chaptersToFetch = [currentChapter + 1, currentChapter + 2];

  for (const chapter of chaptersToFetch) {
    if (chapter > totalChapters) continue;

    // Check if already cached
    const cached = await chapterCache.get(userId, bookId, chapter);
    if (cached && cached.descriptions.length > 0) continue;

    // Prefetch in background (low priority)
    requestIdleCallback(async () => {
      try {
        const response = await booksAPI.getChapterDescriptions(
          bookId,
          chapter,
          false // Don't trigger LLM, just check existing
        );

        if (response.nlp_analysis.descriptions.length > 0) {
          await chapterCache.set(
            userId, bookId, chapter,
            response.nlp_analysis.descriptions,
            []
          );
        }
      } catch (error) {
        // Silent fail for prefetch
        console.debug('Prefetch failed for chapter', chapter);
      }
    });
  }
}, [userId, bookId, totalChapters]);
```

### 5.4 Phase 4: Backend оптимизации (2 дня)

#### Task 4.1: Batch API для множественных глав

**Файл:** `backend/app/routers/descriptions.py`

```python
@router.post(
    "/books/{book_id}/chapters/batch-descriptions",
    response_model=BatchDescriptionsResponse
)
async def get_batch_descriptions(
    book_id: UUID,
    request: BatchDescriptionsRequest,  # { chapter_numbers: [1, 2, 3] }
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
):
    """Get descriptions for multiple chapters in one request."""

    results = {}
    for chapter_num in request.chapter_numbers:
        try:
            descriptions = await get_chapter_descriptions_internal(
                db, book_id, chapter_num, extract_new=False
            )
            results[chapter_num] = descriptions
        except Exception as e:
            results[chapter_num] = {"error": str(e)}

    return BatchDescriptionsResponse(chapters=results)
```

#### Task 4.2: Redis caching для descriptions

**Файл:** `backend/app/routers/descriptions.py`

```python
async def get_chapter_descriptions(...):
    # Try Redis cache first
    cache_key = f"descriptions:{book_id}:{chapter_number}"
    cached = await cache_manager.get(cache_key)

    if cached:
        return ChapterDescriptionsResponse(**cached)

    # ... fetch from DB ...

    # Cache for 1 hour
    await cache_manager.set(cache_key, response.dict(), ttl=3600)

    return response
```

---

## 6. Приоритизация задач

### ✅ Immediate (Sprint 1 - COMPLETED 2025-12-25)

| Task | Priority | Effort | Impact | Status |
|------|----------|--------|--------|--------|
| 1.1 Координация restoration/loading | P0 | 4h | Critical | ✅ Done |
| 1.2 Abort Controller | P0 | 2h | High | ✅ Done |
| 1.3 Backend distributed lock | P0 | 3h | High | ✅ Done |
| 1.4 Обработка 409 Conflict | P0 | 2h | High | ✅ Done |
| 2.1 Extraction indicator | P1 | 3h | High | ✅ Done |

### ✅ Short-term (Sprint 2 - COMPLETED 2025-12-25)

| Task | Priority | Effort | Impact | Status |
|------|----------|--------|--------|--------|
| 2.2 Parsing status polling | P1 | 4h | High | ✅ Done |
| 3.1 Expand pre-parsing to 5 chapters | P1 | 2h | Medium | ✅ Done |
| 3.2 Smarter prefetching | P2 | 4h | Medium | ✅ Done |

### Medium-term (Sprint 3 - 4 дня)

| Task | Priority | Effort | Impact | Status |
|------|----------|--------|--------|--------|
| 4.1 Batch API endpoint | P2 | 4h | Medium | Pending |
| 4.2 Redis caching descriptions | P2 | 3h | Medium | Pending |
| WebSocket progress updates | P3 | 8h | Low | Pending |

---

## Appendix A: Ключевые файлы

| Файл | Строки | Описание |
|------|--------|----------|
| `frontend/src/components/Reader/EpubReader.tsx` | 633 | Main reader component |
| `frontend/src/hooks/epub/useChapterManagement.ts` | ~350 | Chapter & description loading |
| `frontend/src/hooks/epub/useDescriptionHighlighting.ts` | ~700 | DOM highlighting |
| `frontend/src/hooks/epub/useCFITracking.ts` | ~300 | Position tracking |
| `frontend/src/hooks/api/useDescriptions.ts` | ~450 | API hooks |
| `backend/app/routers/descriptions.py` | ~250 | API endpoints |
| `backend/app/services/langextract_processor.py` | ~600 | LLM extraction |
| `backend/app/core/tasks.py` | ~250 | Celery tasks |

---

## Appendix B: Метрики для мониторинга

```typescript
// Frontend metrics
const metrics = {
  position_restoration_time_ms: number,
  description_load_time_ms: number,
  llm_extraction_time_ms: number,
  highlight_apply_time_ms: number,
  cache_hit_rate: number,
  abort_rate: number,  // How often users navigate away during loading
};

// Backend metrics
const backendMetrics = {
  llm_extraction_duration_seconds: number,
  llm_tokens_used: number,
  llm_api_calls: number,
  extraction_errors: number,
  lock_conflicts: number,  // 409 responses
  descriptions_per_chapter_avg: number,
};
```

---

**Дата создания:** 2025-12-25
**Дата обновления:** 2025-12-25
**Автор:** Claude Code Analysis
**Статус:** Phase 1 + Phase 2 Complete
**Следующий review:** После Sprint 3 (Medium-term tasks)
