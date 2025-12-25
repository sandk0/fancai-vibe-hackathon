# 🏗️ Reader Architecture Diagram

Визуализация архитектуры EPUB Reader с 18 модульными hooks.

---

## 📐 Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EpubReader.tsx                              │
│                      (Main Component, 636 lines)                    │
└─────────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌────────────────┐     ┌──────────────┐
│  ReaderHeader │      │ ExtractionInd. │     │  ImageModal  │
│  (197 lines)  │      │  (142 lines)   │     │  Component   │
└───────────────┘      └────────────────┘     └──────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌────────────────┐     ┌──────────────┐
│   Settings    │      │   Sparkles     │     │  Generation  │
│  Dropdown     │      │   Spinner      │     │   Status     │
│  Controls     │      │  Cancel Btn    │     │  (226 lines) │
└───────────────┘      └────────────────┘     └──────────────┘
```

---

## 🔗 Hooks Dependency Graph

```
┌──────────────────────────────────────────────────────────────────┐
│                        EpubReader.tsx                            │
│                   (Orchestrates 18 hooks)                        │
└──────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼─────────────────────────┐
        │                       │                         │
        ▼                       ▼                         ▼
┌───────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ 1. useEpubLoader│      │ 4. useChapterMgmt│     │ 7. useImageModal│
│ ├─ Download    │      │ ├─ Track chapter │     │ ├─ Modal state  │
│ ├─ Parse EPUB  │      │ ├─ Load data     │     │ ├─ Generation   │
│ └─ Rendition   │      │ └─ Prefetch      │     │ └─ Cache (IDB)  │
└───────┬───────┘      └─────────┬───────┘      └─────────────────┘
        │                         │
        ▼                         ▼
┌───────────────┐      ┌─────────────────┐
│ 2. useLocationGen│    │ 5. useProgressSync│
│ ├─ Generate    │      │ ├─ Debounce 5s  │
│ ├─ Cache (IDB) │      │ └─ Save to DB   │
│ └─ Page numbers│      └─────────────────┘
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ 3. useCFITracking│
│ ├─ Current CFI │
│ ├─ Progress %  │
│ ├─ Page numbers│
│ └─ Scroll offset│
└───────┬───────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│            Navigation & Interaction Hooks             │
├───────────────┬───────────────┬──────────────┬────────┤
│ 6. Navigation │ 8. Keyboard   │ 10. Touch    │ 15. Text│
│    (next/prev)│    (arrows)   │     (swipe)  │ Selection│
└───────────────┴───────────────┴──────────────┴────────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│                  UI Enhancement Hooks                 │
├───────────────┬───────────────┬──────────────┬────────┤
│ 9. Themes     │ 11. Content   │ 12. Highlight│ 13. Resize│
│    (L/D/S)    │     Hooks     │    (9 strat) │  Handler │
└───────────────┴───────────────┴──────────────┴────────┘
        │
        ▼
┌───────────────────────────────────────────────────────┐
│                  Metadata & TOC Hooks                 │
├───────────────┬───────────────┬──────────────┬────────┤
│ 14. Metadata  │ 16. TOC       │ 17. Chapter  │ 18. Session│
│    (title)    │    (sidebar)  │    Mapping   │  Tracking │
└───────────────┴───────────────┴──────────────┴────────┘
```

---

## 🔄 Data Flow: User Navigation

```
┌──────────────────┐
│ User Input       │
│ - Keyboard (→)   │
│ - Touch (swipe)  │
│ - Tap zones      │
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────────────────┐
│ Navigation Hooks (parallel)                    │
├────────────────┬───────────────┬───────────────┤
│ useKeyboardNav │ useTouchNav   │ Tap Zone      │
│ (if enabled)   │ (if enabled)  │ (if enabled)  │
└────────┬───────┴───────┬───────┴───────┬───────┘
         │               │               │
         └───────────────┼───────────────┘
                         ▼
                 ┌───────────────┐
                 │ nextPage() /  │
                 │ prevPage()    │
                 │ (from hook 6) │
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ rendition     │
                 │ .next() /     │
                 │ .prev()       │
                 │ (epub.js API) │
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ 'relocated'   │
                 │ event fires   │
                 └───────┬───────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌────────────────┐ ┌────────────┐ ┌──────────────┐
│ useCFITracking │ │ useChapterMgmt│ │ useProgressSync│
│ (hook 3)       │ │ (hook 4)    │ │ (hook 5)     │
├────────────────┤ ├────────────┤ ├──────────────┤
│ - Update CFI   │ │ - Detect   │ │ - Debounce   │
│ - Calc progress│ │   chapter  │ │ - Save after │
│ - Calc page #  │ │ - Load data│ │   5 seconds  │
│ - Scroll offset│ │ - Prefetch │ │              │
└────────┬───────┘ └──────┬─────┘ └──────┬───────┘
         │                │                │
         ▼                ▼                ▼
┌──────────────────────────────────────────────┐
│ UI Updates                                    │
├──────────────┬───────────────┬───────────────┤
│ ReaderHeader │ Descriptions  │ API Request   │
│ - Progress % │ - Highlighting│ - Debounced   │
│ - Page #     │ - New chapter │ - 60→0.2 req/s│
└──────────────┴───────────────┴───────────────┘
```

---

## 🗂️ IndexedDB Caching Strategy

```
┌─────────────────────────────────────────────────────┐
│            IndexedDB (Browser Storage)              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────┐    ┌─────────────────────┐  │
│  │ Locations Cache  │    │ Chapter Data Cache  │  │
│  ├──────────────────┤    ├─────────────────────┤  │
│  │ Key: bookId      │    │ Key: userId +       │  │
│  │ Data: locations  │    │      bookId +       │  │
│  │       (1600 pts) │    │      chapterNum     │  │
│  │                  │    │ Data: descriptions  │  │
│  │ Size: ~500KB     │    │       + images      │  │
│  │ TTL: 30 days     │    │ Size: ~100KB/ch     │  │
│  │                  │    │ TTL: 7 days         │  │
│  │ Impact:          │    │ Impact:             │  │
│  │ 5-10s → <100ms   │    │ 200-800ms → <50ms   │  │
│  │ (98% faster) ⚡   │    │ (94% faster) ⚡      │  │
│  └──────────────────┘    └─────────────────────┘  │
│                                                     │
│  ┌──────────────────┐                              │
│  │ Image Cache      │                              │
│  ├──────────────────┤                              │
│  │ Key: userId +    │                              │
│  │      descId      │                              │
│  │ Data: Blob       │                              │
│  │       (image)    │                              │
│  │                  │                              │
│  │ Size: ~50KB/img  │                              │
│  │ TTL: 14 days     │                              │
│  │ Auto-cleanup:    │                              │
│  │ - LRU eviction   │                              │
│  │ - Max 100MB      │                              │
│  │                  │                              │
│  │ Impact:          │                              │
│  │ Offline support  │                              │
│  │ Instant display  │                              │
│  └──────────────────┘                              │
│                                                     │
└─────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌────────────────┐ ┌────────────┐ ┌──────────────┐
│ Hook 2:        │ │ Hook 4:    │ │ Hook 7:      │
│ useLocationGen │ │ useChapterMgmt│ │ useImageModal│
│ (cache read)   │ │ (cache read)│ │ (cache read) │
└────────────────┘ └────────────┘ └──────────────┘
```

---

## 🎬 State Management: Loading States

```
┌─────────────────────────────────────────────────────┐
│                  EpubReader States                  │
└─────────────────────────────────────────────────────┘
         │
         ├─── isLoading (useEpubLoader)
         │    ├─ true: "Загрузка книги..."
         │    └─ false: Ready
         │
         ├─── isGenerating (useLocationGeneration)
         │    ├─ true: "Подготовка книги..."
         │    └─ false: Locations ready
         │
         ├─── isRestoringPosition (local state)
         │    ├─ true: "Восстановление позиции..."
         │    │         (prevents useChapterManagement race)
         │    └─ false: Can load chapter data
         │
         ├─── renditionReady (local state)
         │    ├─ true: Enable navigation hooks
         │    └─ false: Disable navigation
         │
         ├─── isExtractingDescriptions (useChapterManagement)
         │    ├─ true: ExtractionIndicator visible
         │    └─ false: Hidden
         │
         └─── isGeneratingImage (useImageModal)
              ├─ true: ImageGenerationStatus visible
              └─ false: Hidden
```

**Loading Overlay Logic:**

```typescript
{(isLoading || isGenerating || isRestoringPosition) && (
  <LoadingOverlay>
    {isRestoringPosition ? 'Восстановление позиции...' :
     isGenerating ? 'Подготовка книги...' :
     'Загрузка книги...'}
  </LoadingOverlay>
)}

// Reader visible when ALL blocking states are false
const isReaderVisible = !isLoading && !isGenerating && !isRestoringPosition && renditionReady;
```

---

## 🔍 Description Highlighting: Search Strategies

```
┌──────────────────────────────────────────────────────┐
│         useDescriptionHighlighting v2.2              │
│              (Performance Optimized)                 │
└──────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌────────────────┐ ┌────────────┐ ┌──────────────┐
│ Preprocessing  │ │ DOM Map    │ │ Search Loop  │
│ (cache)        │ │ (single)   │ │ (early exit) │
└────────┬───────┘ └──────┬─────┘ └──────┬───────┘
         │                │                │
         ▼                ▼                ▼
┌─────────────────────────────────────────────────────┐
│ Memoized Search Patterns (Map<descId, patterns>)   │
├─────────────────────────────────────────────────────┤
│ {                                                   │
│   normalized: "Tom Merrylin appeared..."           │
│   first40: "Tom Merrylin appeared from the sh..."  │
│   skip10: "Merrylin appeared from the shadows..." │
│   firstWords: "Tom Merrylin appeared from the"     │
│   ...                                               │
│ }                                                   │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ Single DOM Traversal (buildTextNodeMap)            │
├─────────────────────────────────────────────────────┤
│ textNodes = [                                       │
│   { node, originalText, normalizedText },          │
│   ...                                               │
│ ]                                                   │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ Search Strategies (ordered fast → slow)            │
├─────────────────────────────────────────────────────┤
│ for each description:                               │
│   searchLoop: for each textNode:                   │
│                                                     │
│     // S1: First 40 chars (⚡⚡⚡ <5ms, 85%)         │
│     if (normalizedText.indexOf(first40) !== -1) {  │
│       ✅ MATCH - BREAK searchLoop                  │
│     }                                               │
│                                                     │
│     // S2: Skip 10, take 10-50 (⚡⚡⚡ <10ms, 10%)   │
│     if (normalizedText.indexOf(skip10) !== -1) {   │
│       ✅ MATCH - BREAK searchLoop                  │
│     }                                               │
│                                                     │
│     // S5: First 5 words (⚡⚡ <15ms, 3%)            │
│     // S4: Full match (<20ms, 1%)                  │
│     // S3, S7, S9: Fallback strategies             │
│     // ... (only if previous failed)               │
│                                                     │
│   // If match found, apply highlight               │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ Apply Highlights                                    │
├─────────────────────────────────────────────────────┤
│ <span class="description-highlight"                │
│       data-description-id="..."                    │
│       data-strategy="S1_First_40"                  │
│       style="background: rgba(96,165,250,0.2);     │
│              border-bottom: 2px solid #60a5fa;">   │
│   Tom Merrylin appeared from the shadows...        │
│ </span>                                             │
│                                                     │
│ Click handler → onDescriptionClick(desc, image)    │
└─────────────────────────────────────────────────────┘
```

**Performance Impact:**

| Optimization | Before | After | Improvement |
|--------------|--------|-------|-------------|
| Search patterns | Compute per-node | Compute once (cache) | 90% faster |
| DOM traversal | N iterations | 1 iteration | N:1 ratio |
| Strategy order | Slow → fast | Fast → slow | 3-5x faster |
| Early exit | No | Yes (break loop) | 50% faster avg |
| **Overall** | **200-500ms** | **30-80ms** | **75-85% faster** |

---

## 📱 Touch Navigation Architecture

```
┌─────────────────────────────────────────────────────┐
│              Mobile Touch Input                     │
└─────────────────────────────────────────────────────┘
         │
         ├─── Tap (quick touch <200ms, <10px movement)
         │    ├─ Left zone (25%) → prevPage()
         │    └─ Right zone (25%) → nextPage()
         │
         ├─── Swipe (quick <300ms, >50px horizontal)
         │    ├─ Swipe left → nextPage()
         │    └─ Swipe right → prevPage()
         │
         └─── Long press (>500ms)
              └─ Text selection → SelectionMenu
```

**useTouchNavigation Flow:**

```
┌──────────────────┐
│ touchstart event │
│ (iframe.document)│
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────┐
│ handleTouchStart                   │
│ touchStartRef = {                  │
│   x: clientX,                      │
│   y: clientY,                      │
│   time: Date.now()                 │
│ }                                  │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ touchmove events                   │
│ (multiple times during swipe)      │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ handleTouchMove                    │
│ IF deltaX > deltaY + 10px:         │
│   e.preventDefault()                │
│   (prevent vertical scroll)        │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ touchend event                     │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ handleTouchEnd                     │
│ Calculate:                         │
│ - deltaX, deltaY                   │
│ - deltaTime                        │
│ - distance                         │
│                                    │
│ Validate:                          │
│ ✓ NOT tap (distance > 10px)       │
│ ✓ Horizontal (|X| > |Y|)          │
│ ✓ Long enough (X > 50px)          │
│ ✓ Quick enough (time < 300ms)     │
│                                    │
│ Navigate:                          │
│ IF deltaX < 0: nextPage()          │
│ IF deltaX > 0: prevPage()          │
└────────────────────────────────────┘
```

**Tap Zones Logic:**

```typescript
// Tap zones enabled ONLY when all conditions met:
const tapZonesEnabled = (
  renditionReady &&       // Rendition ready
  !isModalOpen &&         // No modals open
  !isTocOpen &&           // TOC closed
  !isSettingsOpen &&      // Settings closed
  !isBookInfoOpen         // Book info closed
);

// handleTapZone
const handleTapZone = (zone: 'left' | 'right') => {
  if (!tapZonesEnabled) return; // Guard clause

  if (zone === 'left') {
    prevPage();
  } else {
    nextPage();
  }
};
```

---

## 🎨 Theme System Architecture

```
┌─────────────────────────────────────────────────────┐
│                  useEpubThemes                      │
│              (Theme Management Hook)                │
└─────────────────────────────────────────────────────┘
         │
         ├─── Theme State (localStorage)
         │    ├─ light (☀️ Светлая)
         │    ├─ dark  (🌙 Тёмная)
         │    └─ sepia (📜 Сепия)
         │
         └─── Font Size State (localStorage)
              ├─ Range: 75% - 200%
              ├─ Step: 10%
              └─ Default: 100%
```

**Theme Propagation:**

```
localStorage
    │
    ▼
┌───────────────────────────────────┐
│ useEpubThemes: setTheme(newTheme) │
│ ├─ Save to localStorage           │
│ └─ Apply to rendition             │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│ rendition.themes.default({        │
│   body: {                         │
│     color: '#e5e7eb',  // Dark    │
│     background: '#1f2937',        │
│     font-size: '1.0em'            │
│   },                              │
│   p: { margin-bottom: '1em' },    │
│   a: { color: '#60a5fa' },        │
│   ...                             │
│ })                                │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│ epub.js applies styles to iframe  │
└───────────────┬───────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│ Components receive theme prop     │
│ ├─ ReaderHeader (theme-aware)    │
│ ├─ ExtractionIndicator           │
│ ├─ ImageGenerationStatus         │
│ └─ All UI components              │
└───────────────────────────────────┘
```

**Theme Colors Definition:**

```typescript
const THEMES = {
  light: {
    body: {
      color: '#1f2937',           // Gray-800
      background: '#ffffff',      // White
      'font-family': 'Georgia, serif',
      'line-height': '1.6',
    },
    // ... other elements
  },
  dark: {
    body: {
      color: '#e5e7eb',           // Gray-200
      background: '#1f2937',      // Gray-800
      'font-family': 'Georgia, serif',
      'line-height': '1.6',
    },
    // ... other elements
  },
  sepia: {
    body: {
      color: '#5c4a3c',           // Brown
      background: '#f4ecd8',      // Sepia
      'font-family': 'Georgia, serif',
      'line-height': '1.6',
    },
    // ... other elements
  },
};
```

---

## 💾 Progress Persistence: Hybrid Approach

```
┌─────────────────────────────────────────────────────┐
│      Hybrid Position Tracking (Pixel-Perfect)       │
└─────────────────────────────────────────────────────┘
         │
         ├─── CFI (Paragraph-level)
         │    └─ "epubcfi(/6/4!/4/2/10)"
         │       ↓
         │       epub.js gets CLOSE to position
         │       (rounds to nearest paragraph)
         │
         └─── Scroll Offset (Pixel-level)
              └─ 42.3% (percentage within page)
                 ↓
                 Manual scrollTop calculation
                 achieves EXACT position
```

**Save Flow:**

```
User navigates
    ↓
useCFITracking: 'relocated' event
    ├─ Extract CFI
    ├─ Calculate progress %
    ├─ Calculate scroll offset
    └─ Trigger useProgressSync
        ↓
useProgressSync: Debounced save (5 seconds)
    ├─ Clear previous timeout (reset timer)
    ├─ Schedule new timeout
    └─ IF user stops navigating:
        ├─ Save to backend (PUT /api/v1/books/{id}/progress)
        └─ Update lastSavedRef (prevent duplicates)
```

**Restore Flow:**

```
User opens book
    ↓
EpubReader: Position initialization
    ├─ Fetch saved progress (GET /api/v1/books/{id}/progress)
    │   ↓
    │   {
    │     reading_location_cfi: "epubcfi(...)",
    │     scroll_offset_percent: 42.3,
    │     current_position_percent: 8.5,
    │     current_chapter: 4
    │   }
    │
    ├─ Validate CFI format
    ├─ skipNextRelocated() (prevent auto-save on restored position)
    ├─ goToCFI(cfi, scrollOffset):
    │   ├─ rendition.display(cfi) [gets close]
    │   ├─ Wait 300ms for rendering
    │   └─ Apply scroll offset [pixel-perfect]
    │       ├─ Get iframe document
    │       ├─ Calculate: targetScrollTop = (scrollOffset / 100) * maxScroll
    │       └─ Set: doc.documentElement.scrollTop = targetScrollTop
    │
    └─ setInitialProgress(cfi, percentage)
```

**Save Triggers:**

| Trigger | When | Method | Reliability |
|---------|------|--------|-------------|
| Debounced | 5s after last navigation | Normal async | ✅ Good |
| Unmount | Component cleanup | Async with cache invalidation | ✅ Excellent |
| Page close | beforeunload event | fetch(..., {keepalive: true}) | ✅ Best effort |

---

## 📊 Performance Monitoring Points

```
┌─────────────────────────────────────────────────────┐
│              Performance Checkpoints                │
└─────────────────────────────────────────────────────┘

1. EPUB Loading
   ├─ Start: fetch(bookUrl) called
   ├─ End: rendition.renderTo() complete
   └─ Target: <3 seconds
       Actual: 1-3 seconds ✅

2. Locations Generation
   ├─ Start: book.locations.generate() called
   ├─ End: locations ready
   └─ Target: <2 seconds (with cache)
       Actual (cold): 5-10 seconds ⚠️
       Actual (warm): <100ms ✅

3. Position Restoration
   ├─ Start: booksAPI.getReadingProgress() called
   ├─ End: goToCFI() complete + scroll applied
   └─ Target: <500ms
       Actual: 200-500ms ✅

4. Chapter Data Load
   ├─ Start: booksAPI.getChapterDescriptions() called
   ├─ End: descriptions + images loaded
   └─ Target: <500ms (with cache)
       Actual (cold): 200-800ms 🟡
       Actual (warm): <50ms ✅

5. Description Highlighting
   ├─ Start: highlightDescriptions() called
   ├─ End: All highlights applied
   └─ Target: <50ms for <20 descriptions
       Actual: 30-45ms ✅

6. Page Navigation
   ├─ Start: nextPage() / prevPage() called
   ├─ End: rendition.next() / prev() complete
   └─ Target: <50ms
       Actual: <50ms ✅

7. Image Generation
   ├─ Start: imagesAPI.generateImageForDescription() called
   ├─ End: image URL received
   └─ Target: <30 seconds
       Actual: 5-30 seconds 🟡
```

**Console Logging Pattern:**

```typescript
// All hooks use consistent logging format
console.log('🎨 [useDescriptionHighlighting v2.2] Starting...', {
  descriptionsCount,
  imagesCount,
  timestamp: new Date().toISOString(),
});

// Performance tracking
const startTime = performance.now();
// ... operation ...
const duration = performance.now() - startTime;
console.log(`✅ [useDescriptionHighlighting] Complete in ${duration.toFixed(2)}ms`);

// Error logging
console.error('❌ [useImageModal] Error generating image:', error);

// Warning logging
console.warn('⚠️ [useCFITracking] Invalid CFI format:', cfi.substring(0, 50));
```

---

## 🔐 Security & Isolation

```
┌─────────────────────────────────────────────────────┐
│              User Data Isolation                    │
└─────────────────────────────────────────────────────┘
         │
         ├─── TanStack Query Keys (user-scoped)
         │    ├─ ['books', userId, ...] - Book list
         │    ├─ ['book', userId, bookId] - Book details
         │    ├─ ['chapter', userId, bookId, chapterNum]
         │    └─ ['images', userId, bookId, chapterNum]
         │
         ├─── IndexedDB Keys (user-scoped)
         │    ├─ Locations: `${bookId}` (no userId - book-specific)
         │    ├─ Chapters: `${userId}:${bookId}:${chapterNum}`
         │    └─ Images: `${userId}:${descriptionId}`
         │
         └─── localStorage Keys (user-agnostic)
              ├─ `auth_token` - JWT token
              ├─ `epub_reader_theme` - Theme preference
              └─ `epub_reader_font_size` - Font size
```

**Cache Invalidation on Login/Logout:**

```typescript
// On logout (AuthContext)
const handleLogout = async () => {
  // 1. Clear all TanStack Query caches
  queryClient.clear();

  // 2. Clear all IndexedDB databases
  await chapterCache.clearAll();
  await imageCache.clearAll();
  await locationCache.clearAll();

  // 3. Clear localStorage auth
  localStorage.removeItem('auth_token');

  // 4. Redirect to login
  navigate('/login');
};

// On login (AuthContext)
const handleLogin = async (token: string) => {
  // 1. Set auth token
  localStorage.setItem('auth_token', token);

  // 2. Invalidate all queries (will refetch with new userId)
  queryClient.invalidateQueries();

  // 3. Redirect to library
  navigate('/library');
};
```

---

## 📏 Component Size Metrics

### Main Components

| File | Lines | Complexity | Maintainability |
|------|-------|-----------|-----------------|
| `EpubReader.tsx` | 636 | Medium | ✅ Good (modular hooks) |
| `ReaderHeader.tsx` | 197 | Low | ✅ Excellent |
| `ExtractionIndicator.tsx` | 142 | Low | ✅ Excellent |
| `ImageGenerationStatus.tsx` | 226 | Low-Med | ✅ Good |

### Custom Hooks (Top 5 by size)

| Hook | Lines | Complexity | Purpose |
|------|-------|-----------|---------|
| `useDescriptionHighlighting.ts` | 699 | High | 9 search strategies |
| `useChapterManagement.ts` | 628 | High | Chapter data + prefetch |
| `useCFITracking.ts` | 344 | Medium | Position tracking |
| `useImageModal.ts` | 330 | Medium | Image modal + generation |
| `useProgressSync.ts` | 234 | Medium | Debounced save |

### Services

| Service | Lines | Purpose |
|---------|-------|---------|
| `chapterCache.ts` | ~600 | IndexedDB chapter cache |
| `imageCache.ts` | ~500 | IndexedDB image cache |

**Total Frontend Reader Code:** ~5,000+ lines (highly modular)

---

## 🎯 Critical Paths

### Path 1: First Page Load (Critical)

```
User clicks "Читать" → EPUB download (1-3s) → Locations gen (5-10s / <100ms cached)
→ Position restore (200-500ms) → ✅ READER VISIBLE (Time to Interactive: 6-13s / <4s cached)
```

### Path 2: Navigation (Hot Path)

```
User input (key/swipe/tap) → rendition.next() (<50ms) → 'relocated' event
→ CFI/progress update (<10ms) → UI update (<5ms) → ✅ INSTANT
```

### Path 3: Chapter Change (Moderate)

```
Navigate to new chapter → Chapter detection (<5ms) → Load data (200-800ms / <50ms cached)
→ LLM extraction if needed (5-15s, NON-BLOCKING) → Highlighting (30-80ms) → ✅ READY
```

### Path 4: Image Generation (Background)

```
Click description → Check cache (instant if hit) → Generate if miss (5-30s)
→ Cache result → ✅ COMPLETE (Modal shows loading, non-blocking)
```

---

**For detailed flow diagrams, see:** [docs/reports/2025-12-25_reader_ux_flow_analysis.md](../docs/reports/2025-12-25_reader_ux_flow_analysis.md)
