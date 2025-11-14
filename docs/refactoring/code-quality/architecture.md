# BookReader Refactoring Architecture

## Before: Monolithic Component (1,038 lines)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    BookReader.tsx                           │
│                     (1,038 lines)                           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ • Pagination Logic (90 lines)                         │ │
│  │ • Reading Progress (151 lines)                        │ │
│  │ • Auto-parsing (130 lines)                            │ │
│  │ • Description Highlighting (102 lines)                │ │
│  │ • Image Modal (38 lines)                              │ │
│  │ • Settings Management (73 lines)                      │ │
│  │ • Navigation (33 lines)                                │ │
│  │ • Chapter Management (22 lines)                        │ │
│  │ • UI Rendering (409 lines)                             │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│              ❌ Hard to maintain                            │
│              ❌ Hard to test                                │
│              ❌ Hard to reuse                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## After: Modular Architecture (370 + 867 + 354 lines)

```
┌───────────────────────────────────────────────────────────────────────┐
│                                                                       │
│                        BookReader.tsx                                 │
│                         (370 lines)                                   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    Hook Integration Layer                       │ │
│  │                                                                 │ │
│  │  const { pages, currentPage } = usePagination(...)             │ │
│  │  const { hasRestored } = useReadingProgress(...)               │ │
│  │  useAutoParser(...)                                            │ │
│  │  const { highlightDescription } = useDescriptionManagement(...) │ │
│  │  const { nextPage, prevPage } = useChapterNavigation(...)      │ │
│  │  const { openModal, closeModal } = useReaderImageModal()       │ │
│  │  useKeyboardNavigation(...)                                     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                 Component Composition Layer                     │ │
│  │                                                                 │ │
│  │  <ReaderHeader {...headerProps} />                             │ │
│  │  <ReaderSettingsPanel {...settingsProps} />                    │ │
│  │  <ReaderContent {...contentProps} />                           │ │
│  │  <ReaderNavigationControls {...navProps} />                    │ │
│  │  <ImageModal {...modalProps} />                                │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                                    │
                ┌───────────────────┴───────────────────┐
                │                                       │
                ▼                                       ▼
    ┌─────────────────────┐              ┌──────────────────────────┐
    │   Custom Hooks      │              │   Sub-Components         │
    │   (867 lines)       │              │   (354 lines)            │
    │                     │              │                          │
    │ ┌─────────────────┐ │              │ ┌──────────────────────┐ │
    │ │ usePagination   │ │              │ │ ReaderHeader         │ │
    │ │ (139 lines)     │ │              │ │ (70 lines)           │ │
    │ └─────────────────┘ │              │ └──────────────────────┘ │
    │                     │              │                          │
    │ ┌─────────────────┐ │              │ ┌──────────────────────┐ │
    │ │ useReading      │ │              │ │ ReaderSettings       │ │
    │ │ Progress        │ │              │ │ Panel                │ │
    │ │ (161 lines)     │ │              │ │ (96 lines)           │ │
    │ └─────────────────┘ │              │ └──────────────────────┘ │
    │                     │              │                          │
    │ ┌─────────────────┐ │              │ ┌──────────────────────┐ │
    │ │ useAutoParser   │ │              │ │ ReaderContent        │ │
    │ │ (175 lines)     │ │              │ │ (79 lines)           │ │
    │ └─────────────────┘ │              │ └──────────────────────┘ │
    │                     │              │                          │
    │ ┌─────────────────┐ │              │ ┌──────────────────────┐ │
    │ │ useDescription  │ │              │ │ ReaderNavigation     │ │
    │ │ Management      │ │              │ │ Controls             │ │
    │ │ (166 lines)     │ │              │ │ (109 lines)          │ │
    │ └─────────────────┘ │              │ └──────────────────────┘ │
    │                     │              │                          │
    │ ┌─────────────────┐ │              └──────────────────────────┘
    │ │ useChapter      │ │
    │ │ Navigation      │ │              ✅ Presentational
    │ │ (136 lines)     │ │              ✅ Reusable
    │ └─────────────────┘ │              ✅ React.memo optimized
    │                     │
    │ ┌─────────────────┐ │
    │ │ useReaderImage  │ │
    │ │ Modal           │ │
    │ │ (68 lines)      │ │
    │ └─────────────────┘ │
    │                     │
    └─────────────────────┘

    ✅ Reusable
    ✅ Testable
    ✅ Single responsibility
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interaction                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────────────────┐
    │              Event Handlers                        │
    │  (onClick, onChange, onKeyPress)                   │
    └────────────────┬───────────────────────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────────────────┐
    │            Custom Hook Actions                     │
    │                                                    │
    │  • setCurrentPage() - usePagination                │
    │  • nextPage() - useChapterNavigation               │
    │  • handleDescriptionClick() - useDescriptionMgmt   │
    │  • openModal() - useReaderImageModal               │
    └────────────────┬───────────────────────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────────────────┐
    │            State Updates                           │
    │  (useState, Zustand store)                         │
    └────────────────┬───────────────────────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────────────────┐
    │            Side Effects                            │
    │  (useEffect, API calls)                            │
    │                                                    │
    │  • Save reading progress                           │
    │  • Re-paginate content                             │
    │  • Fetch chapter data                              │
    └────────────────┬───────────────────────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────────────────┐
    │            Component Re-render                     │
    │  (React.memo prevents unnecessary renders)         │
    └────────────────┬───────────────────────────────────┘
                     │
                     ▼
    ┌────────────────────────────────────────────────────┐
    │              UI Update                             │
    │  (Sub-components receive new props)                │
    └────────────────────────────────────────────────────┘
```

---

## Hook Dependency Graph

```
BookReader Component
    │
    ├─▶ usePagination
    │       └─▶ chapter data, fontSize, lineHeight
    │
    ├─▶ useReadingProgress
    │       ├─▶ bookId, currentChapter, currentPage
    │       └─▶ booksAPI.getReadingProgress()
    │
    ├─▶ useAutoParser
    │       ├─▶ chapter data
    │       └─▶ booksAPI.processBook()
    │
    ├─▶ useDescriptionManagement
    │       ├─▶ descriptions array
    │       ├─▶ imagesAPI.generateImage()
    │       └─▶ openModal callback
    │
    ├─▶ useChapterNavigation
    │       ├─▶ currentChapter, currentPage
    │       ├─▶ setCurrentChapter, setCurrentPage
    │       └─▶ totalPages, totalChapters
    │
    ├─▶ useReaderImageModal
    │       └─▶ (independent - modal state only)
    │
    └─▶ useKeyboardNavigation
            └─▶ nextPage, prevPage callbacks
```

---

## Component Hierarchy

```
<BookReader>
    │
    ├─▶ <ReaderHeader>
    │       ├─ Book title
    │       ├─ Chapter info
    │       ├─ Page counter
    │       └─ Settings button
    │
    ├─▶ <ReaderSettingsPanel> (conditional)
    │       ├─ Font size slider
    │       └─ Theme buttons
    │
    ├─▶ <div className="reading-area">
    │       │
    │       ├─▶ <ReaderContent>
    │       │       ├─ Highlighted content
    │       │       └─ Framer Motion animation
    │       │
    │       └─▶ <ReaderNavigationControls>
    │               ├─ Previous button
    │               ├─ Chapter selector
    │               ├─ Next button
    │               └─ Progress bar
    │
    └─▶ <ImageModal> (via AnimatePresence)
            ├─ Generated image
            ├─ Description text
            └─ Regenerate button
```

---

## Performance Optimizations

```
┌──────────────────────────────────────────────────────────┐
│                   Optimization Layer                     │
└──────────────────────────────────────────────────────────┘

1. React.memo on all sub-components
   ────────────────────────────────
   ✓ ReaderHeader - memoized by props
   ✓ ReaderSettingsPanel - memoized by props
   ✓ ReaderContent - memoized by props
   ✓ ReaderNavigationControls - memoized by props

2. useCallback for event handlers
   ────────────────────────────────
   ✓ nextPage() - stable reference
   ✓ prevPage() - stable reference
   ✓ handleDescriptionClick() - stable reference
   ✓ All navigation functions

3. Debouncing
   ────────────────────────────────
   ✓ Pagination (200ms) - prevents excessive calculations
   ✓ Progress save - via useEffect dependencies

4. Conditional Rendering
   ────────────────────────────────
   ✓ Settings panel - only when showSettings === true
   ✓ Image modal - AnimatePresence for smooth transitions

5. Memoization
   ────────────────────────────────
   ✓ Pages array - only recalculate on content/font change
   ✓ Highlighted text - only recalculate on descriptions change
```

---

## Testing Strategy

```
┌──────────────────────────────────────────────────────────┐
│                    Testing Pyramid                       │
└──────────────────────────────────────────────────────────┘

                      ╱╲
                     ╱  ╲
                    ╱ E2E╲
                   ╱──────╲
                  ╱        ╲
                 ╱Integration╲
                ╱────────────╲
               ╱              ╱
              ╱     Unit      ╱
             ╱────────────────╱

Unit Tests (hooks & components)
────────────────────────────────
• usePagination.test.ts
  - Test page calculation
  - Test HTML vs plain text
  - Test debouncing

• useReadingProgress.test.ts
  - Test position restoration
  - Test auto-save
  - Test race conditions

• useAutoParser.test.ts
  - Test cooldown mechanism
  - Test polling
  - Test error handling

• useDescriptionManagement.test.ts
  - Test highlighting logic
  - Test nesting prevention
  - Test image generation

• useChapterNavigation.test.ts
  - Test next/prev page
  - Test chapter boundaries
  - Test keyboard shortcuts

• ReaderHeader.test.tsx
  - Test props rendering
  - Test button clicks

• ReaderContent.test.tsx
  - Test content rendering
  - Test highlighting
  - Test DOMPurify

Integration Tests
────────────────────────────────
• BookReader.integration.test.tsx
  - Test hook interactions
  - Test data flow
  - Test side effects

E2E Tests (Playwright/Cypress)
────────────────────────────────
• Full reading flow
• Navigation between chapters
• Progress restoration
• Image generation
```

---

## Migration Path (For Future Components)

```
Step 1: Identify Responsibilities
──────────────────────────────────
└─▶ List all things the component does
    └─▶ Group related functionality

Step 2: Extract Hooks
──────────────────────────────────
└─▶ Create custom hook for each responsibility
    ├─▶ Write JSDoc comments
    ├─▶ Add TypeScript types
    └─▶ Export from index.ts

Step 3: Create Sub-Components
──────────────────────────────────
└─▶ Extract presentational logic
    ├─▶ Define props interface
    ├─▶ Add React.memo
    └─▶ Use semantic HTML

Step 4: Refactor Main Component
──────────────────────────────────
└─▶ Replace inline logic with hooks
    ├─▶ Replace UI blocks with components
    ├─▶ Simplify event handlers
    └─▶ Clean up useEffects

Step 5: Test & Verify
──────────────────────────────────
└─▶ Run TypeScript checks
    ├─▶ Run existing tests
    ├─▶ Add new tests
    └─▶ Manual testing

Step 6: Document
──────────────────────────────────
└─▶ Write refactoring report
    ├─▶ Update component docs
    └─▶ Create migration guide
```

---

**Architecture designed by:** Claude Code (Frontend Developer Agent)
**Date:** October 24, 2025
**Pattern:** Hooks + Composition Architecture
