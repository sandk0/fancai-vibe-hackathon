# 📖 Reader UX Flows - Quick Reference

Краткий справочник по пользовательским сценариям в EPUB Reader.

**Полный отчет:** [docs/reports/2025-12-25_reader_ux_flow_analysis.md](../docs/reports/2025-12-25_reader_ux_flow_analysis.md)

---

## 🎬 Основные сценарии

### 1. Первое открытие книги (Cold Start)

```
User clicks "Читать" (BookPage)
    ↓
[0-3s]   Loading: "Загрузка книги..."
    ├── fetch EPUB file
    ├── ePub(arrayBuffer)
    └── book.renderTo(viewerRef)
    ↓
[3-13s]  Loading: "Подготовка книги..."
    ├── locations.generate(1600) [SLOW ⚠️]
    └── Save to IndexedDB
    ↓
[13-14s] Loading: "Восстановление позиции..."
    ├── Fetch saved progress
    └── goToCFI(cfi, scrollOffset)
    ↓
[14s]    ✅ READER VISIBLE - Can navigate
    ↓
[14s+]   Background tasks (NON-BLOCKING):
    ├── Load chapter descriptions
    ├── LLM extraction if needed (5-15s)
    │   └── ExtractionIndicator visible
    └── Apply description highlighting (30-80ms)
```

**Time to Interactive:** 6-13 секунд (cold) / <4 секунд (warm)

### 2. Возврат к книге (Warm Start)

```
User clicks "Читать" (returning user)
    ↓
[0-3s]   EPUB download + parse (same as cold)
    ↓
[3s]     locations.generate() → IndexedDB HIT ⚡
         (5-10s → <100ms, 98% faster!)
    ↓
[3-4s]   Position restoration
    ↓
[4s]     ✅ READER VISIBLE
    ↓
[4s+]    Chapter data → IndexedDB HIT ⚡
         (200-800ms → <50ms, 94% faster!)
```

**Time to Interactive:** <4 секунд (60-70% faster)

### 3. Навигация между страницами

```
User presses → / swipes left / taps right zone
    ↓
rendition.next() [<50ms, INSTANT]
    ↓
'relocated' event fires
    ├── Update CFI position
    ├── Calculate progress (8% → 9%)
    ├── Calculate page number (42 → 43)
    ├── Check if chapter changed
    │   ├── YES: Load new chapter data
    │   │   ├── IndexedDB check
    │   │   └── Prefetch next 2 chapters
    │   └── NO: Continue
    └── Debounced save (after 5 seconds)
```

**Performance:** <50ms instant navigation, 0.2 req/s (vs 60 req/s without debounce)

### 4. Быстрая навигация (Rapid Page Turns)

```
User holds → key (10 pages in 2 seconds)
    ↓
10 'relocated' events fire rapidly
    ↓
Debounce timer resets on each event
    ↓
User stops navigating
    ↓
[5 seconds later]
    ↓
Single API request to save progress
```

**Optimization:** 60 req/s → 0.2 req/s (98% reduction)

---

## 👆 Touch & Gesture Handling

### Tap Zones (Mobile only)

```
┌─────────────────────────────────────────────────┐
│  Header (70px + safe-area-inset-top)           │
├─────────────────────────────────────────────────┤
│ ◄────────┬──────────────────┬────────► │
│ PREVIOUS │                  │   NEXT      │
│   PAGE   │    EPUB TEXT     │   PAGE      │
│  (25%)   │    (center 50%)  │  (25%)      │
│          │                  │             │
│          │  User can tap    │             │
│          │  descriptions    │             │
│          │  in this area    │             │
│          │                  │             │
│ ◄────────┴──────────────────┴────────► │
└─────────────────────────────────────────────────┘
```

**Characteristics:**
- ✅ 25% zones left/right (not too big, not intrusive)
- ✅ Mobile-only (`md:hidden`)
- ✅ Safe area aware (iPhone notch, bottom bar)
- ✅ Disabled when modals/TOC/settings open

### Swipe Gestures

**Parameters:**
- `swipeThreshold`: 50px minimum
- `timeThreshold`: 300ms maximum
- Direction: Horizontal only (deltaX > deltaY)

**Detection:**
```
Tap:     deltaTime < 200ms  AND  distance < 10px  → Ignore
Swipe:   deltaTime < 300ms  AND  deltaX > 50px    → Navigate
Invalid: deltaTime > 300ms  OR   deltaX < 50px    → Ignore
```

**Actions:**
- Swipe left → Next page
- Swipe right → Previous page

### Long Press

```
User long presses text
    ↓
Browser native selection appears
    ↓
SelectionMenu shows with copy button
    ↓
User taps "Copy"
    ↓
navigator.clipboard.writeText()
    ↓
Notification: "Текст скопирован"
```

---

## 🎨 Visual Feedback

### 1. Loading Indicators

| State | Message | Duration | Blocking? |
|-------|---------|----------|-----------|
| `isLoading` | "Загрузка книги..." | 1-3s | ✅ Yes |
| `isGenerating` | "Подготовка книги..." | 5-10s (cold) / <100ms (warm) | ✅ Yes |
| `isRestoringPosition` | "Восстановление позиции..." | 200-500ms | ✅ Yes |

### 2. LLM Extraction Indicator

```
┌──────────────────────────────────────────┐
│ 🟡 AI анализирует главу...              │
│    Обычно занимает 5-15 секунд          │
│                                     [X] │
└──────────────────────────────────────────┘
```

**Features:**
- ✅ Prominent floating card (below header)
- ✅ Animated spinner with Sparkles icon
- ✅ Cancelable (X button)
- ✅ NON-BLOCKING (can still read)
- ✅ Theme-aware (Light/Dark/Sepia)

**Positioning:** `top: calc(80px + env(safe-area-inset-top))`

### 3. Description Highlighting

**9 Search Strategies** (ordered by speed):

| Strategy | Speed | Success | Use Case |
|----------|-------|---------|----------|
| S1: First 40 chars | ⚡⚡⚡ <5ms | ~85% | Fastest |
| S2: Skip 10, take 10-50 | ⚡⚡⚡ <10ms | ~10% | Chapter headers |
| S5: First 5 words | ⚡⚡ <15ms | ~3% | Fuzzy |
| S4: Full match | ⚡⚡ <20ms | ~1% | Short texts |
| S3: Skip 20, take 20-60 | ⚡ <30ms | ~0.5% | Edge cases |
| S7: Middle section | ⚡ <40ms | ~0.3% | Unreliable start/end |
| S9: First sentence | <50ms | ~0.2% | Case-insensitive |

**Performance Targets:**

| Descriptions | Target | Actual |
|--------------|--------|--------|
| <20 | <50ms | 30-45ms ✅ |
| 20-50 | <100ms | 60-90ms ✅ |
| 50+ | <200ms | 120-180ms 🟡 |

**Visual:**
```css
.description-highlight {
  background-color: rgba(96, 165, 250, 0.2); /* Blue */
  border-bottom: 2px solid #60a5fa;
  cursor: pointer;
}

.description-highlight:hover {
  background-color: rgba(96, 165, 250, 0.3); /* Brighter */
}
```

### 4. Image Generation Status

```
User clicks highlighted description
    ↓
0ms    Modal opens (loading)
       │
100ms  🟡 ImageGenerationStatus (top-right)
       │   "Генерация изображения..."
       │   ├── Spinner + progress bar
       │   ├── Description preview
       │   └── Cancel button
       │
5-30s  (API call to Imagen 4)
       │
       ✅ "Изображение создано"
       │   Auto-hide after 3s
       │
3s     Status fades out
```

**Timeline:**

| Action | Time | Visual |
|--------|------|--------|
| Click description | 0ms | Modal loading spinner |
| Status appears | 100ms | Top-right card |
| API processing | 5-30s | Animated progress bar |
| Success | - | Green checkmark |
| Auto-hide | +3s | Fade out animation |

---

## ⚙️ Settings Persistence

### Font Size

- **Storage:** `localStorage` (`epub_reader_font_size`)
- **Range:** 75% - 200%
- **Step:** 10%
- **Default:** 100%
- **Controls:** A- / A+ buttons

### Theme

- **Storage:** `localStorage` (`epub_reader_theme`)
- **Options:** `light` / `dark` / `sepia`
- **Default:** `dark`
- **Controls:** ☀️ / 🌙 / 📜 buttons

**Theme Colors:**

| Element | Light | Dark | Sepia |
|---------|-------|------|-------|
| Background | `#ffffff` | `#1f2937` | `#f4ecd8` |
| Text | `#1f2937` | `#e5e7eb` | `#5c4a3c` |
| Links | `#2563eb` | `#60a5fa` | `#8b5a2b` |

### Reading Progress

- **Storage:** PostgreSQL `reading_progress` table
- **Debounce:** 5 seconds
- **Fields:**
  - `reading_location_cfi` - EPUB CFI position (paragraph-level)
  - `scroll_offset_percent` - Scroll within page (pixel-level)
  - `current_position_percent` - Overall progress
  - `current_chapter` - Chapter number

**Hybrid Position Tracking:**
```
CFI (paragraph)  +  Scroll Offset (pixel)  =  Pixel-perfect
```

**Save Triggers:**
1. Debounced (5s after navigation)
2. Immediate on unmount
3. On page close (`beforeunload` with `keepalive: true`)

### TOC Sidebar State

- **Storage:** `localStorage` (`reader_settings_toc_open`)
- **Default:** `false`
- **Persists between sessions**

---

## 🐛 Known Issues & Fixes

### ✅ FIXED: Race Condition при восстановлении позиции

**Issue:** Multiple API calls during position restoration
```
Position restoration triggers 'relocated' events
    ↓
useChapterManagement reacts to each event
    ↓
Multiple loadChapterData() calls
    ↓
AbortController cancels previous, creates new
    ↓
RACE CONDITION: Wrong chapter data loaded
```

**Fix:** `isRestoringPosition` flag
```typescript
// EpubReader.tsx
const [isRestoringPosition, setIsRestoringPosition] = useState(true);

// Pass to useChapterManagement
useChapterManagement({
  isRestoringPosition, // Prevents loading during restoration
});

// useChapterManagement.ts
if (isRestoringPosition) {
  pendingChapterRef.current = currentChapter; // Defer loading
} else {
  loadChapterData(currentChapter); // Normal load
}
```

**Result:**
- ✅ No API calls during restoration
- ✅ Only 1 call after restoration completes
- ✅ Correct chapter data loaded

### ✅ FIXED: Stale data в BookPage после unmount

**Issue:** BookPage shows old progress after reader unmount
```
User closes reader
    ↓
useProgressSync saves async (200ms delay)
    ↓
BookPage fetches BEFORE save completes
    ↓
Shows stale progress
```

**Fix:** Invalidate React Query cache after save
```typescript
// useProgressSync.ts
return () => {
  saveImmediate().then(() => {
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] });
    }, 200);
  });
};
```

**Result:**
- ✅ Progress saved before navigation
- ✅ Cache invalidated after save
- ✅ BookPage fetches fresh data

### ⚠️ Известная проблема: Медленный LLM Extraction

**Issue:** 5-15 секунд ожидания при первом открытии главы

**Mitigation:**
- ✅ ExtractionIndicator с clear feedback
- ✅ Cancel button (user can abort)
- ✅ NON-BLOCKING (can read while extraction runs)
- ✅ Time expectation ("5-15 секунд")

**Future improvements:**
- 💡 Background extraction на server (pre-generate for popular books)
- 💡 Streaming responses (show descriptions as they're found)
- 💡 Better caching strategy (never expire descriptions)

---

## 💡 Рекомендации по улучшению

### 1. Adaptive Tap Zones

**Current:** Fixed 25% zones
**Proposed:** Dynamic zones based on description density

```typescript
const getTapZoneWidth = () => {
  if (descriptions.length > 5) {
    return '20%'; // More descriptions → smaller zones
  } else {
    return '30%'; // Fewer descriptions → larger zones
  }
};
```

### 2. Predictive Prefetch

**Current:** Prefetch after chapter change
**Proposed:** Prefetch when near end of chapter

```typescript
const handleRelocated = (location) => {
  const progress = location.start.percentage || 0;

  if (progress > 0.8 && !prefetchTriggered) {
    prefetchNextChapters(currentChapter); // Prefetch BEFORE user turns page
  }
};
```

### 3. Skeleton Screens

**Current:** Fullscreen loading overlay
**Proposed:** Skeleton UI showing layout

```typescript
<div className="animate-pulse">
  <div className="h-16 bg-gray-200" /> {/* Header skeleton */}
  <div className="p-8 space-y-4">
    <div className="h-4 bg-gray-200 rounded w-3/4" /> {/* Text lines */}
    <div className="h-4 bg-gray-200 rounded w-full" />
    {/* ... */}
  </div>
</div>
```

### 4. Interactive Progress Bar

**Current:** Display-only
**Proposed:** Clickable to jump to position

```typescript
<div
  className="progress-bar cursor-pointer"
  onClick={(e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickPercentage = ((e.clientX - rect.left) / rect.width) * 100;
    const targetCfi = locations.cfiFromPercentage(clickPercentage / 100);
    goToCFI(targetCfi);
  }}
>
  {/* Chapter markers */}
  {chapters.map((ch, i) => (
    <div
      key={i}
      className="chapter-marker"
      style={{ left: `${(ch.startPage / totalPages) * 100}%` }}
    />
  ))}
</div>
```

### 5. Visual Swipe Feedback

**Current:** No visual feedback during swipe
**Proposed:** Arrow icon indicating direction

```typescript
{swipeProgress > 0 && (
  <div className="fixed inset-0 pointer-events-none" style={{ opacity: swipeProgress / 100 }}>
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      {deltaX > 0 ? <ChevronLeft size={48} /> : <ChevronRight size={48} />}
    </div>
  </div>
)}
```

---

## 📈 Performance Metrics

### Loading Performance

| Metric | Cold Start | Warm Start | Improvement |
|--------|------------|------------|-------------|
| EPUB download + parse | 1-3s | 1-3s | - |
| Locations generation | 5-10s | <100ms | **98%** ⚡ |
| Position restoration | 200-500ms | 200-500ms | - |
| **Time to Interactive** | **6-13s** | **<4s** | **60-70%** ⚡ |
| Chapter data load | 200-800ms | <50ms | **94%** ⚡ |

### Navigation Performance

| Operation | Target | Actual | Status |
|-----------|--------|--------|--------|
| Page turn | <50ms | <50ms | ✅ |
| CFI calculation | <10ms | <10ms | ✅ |
| Progress update | <5ms | <5ms | ✅ |
| Highlighting | <50ms | 30-80ms | ✅ |

### API Optimization

| Scenario | Before | After | Reduction |
|----------|--------|-------|-----------|
| Rapid navigation | 60 req/s | 0.2 req/s | **98%** ⚡ |
| Position restoration | 3-5 requests | 1 request | **70-80%** ⚡ |

---

## 📚 Related Files

### Core Components
- `src/components/Reader/EpubReader.tsx` (636 lines) - Main reader component
- `src/components/Reader/ReaderHeader.tsx` (197 lines) - Theme-aware header
- `src/components/Reader/ExtractionIndicator.tsx` (142 lines) - LLM extraction feedback
- `src/components/Reader/ImageGenerationStatus.tsx` (226 lines) - Image generation status

### Custom Hooks (18 hooks)
- `src/hooks/epub/useEpubLoader.ts` (200 lines) - EPUB loading
- `src/hooks/epub/useLocationGeneration.ts` - Locations cache
- `src/hooks/epub/useCFITracking.ts` (344 lines) - Position tracking
- `src/hooks/epub/useChapterManagement.ts` (628 lines) - Chapter data + prefetch
- `src/hooks/epub/useProgressSync.ts` (234 lines) - Debounced save
- `src/hooks/epub/useEpubNavigation.ts` - Page navigation
- `src/hooks/epub/useImageModal.ts` (330 lines) - Image modal + generation
- `src/hooks/epub/useKeyboardNavigation.ts` - Keyboard controls
- `src/hooks/epub/useEpubThemes.ts` (220 lines) - Theme + font size
- `src/hooks/epub/useTouchNavigation.ts` (195 lines) - Swipe gestures
- `src/hooks/epub/useDescriptionHighlighting.ts` (699 lines) - Highlighting v2.2

### Services
- `src/services/chapterCache.ts` (~600 lines) - IndexedDB chapter cache
- `src/services/imageCache.ts` (~500 lines) - IndexedDB image cache

---

**Полный отчет:** [docs/reports/2025-12-25_reader_ux_flow_analysis.md](../docs/reports/2025-12-25_reader_ux_flow_analysis.md)
