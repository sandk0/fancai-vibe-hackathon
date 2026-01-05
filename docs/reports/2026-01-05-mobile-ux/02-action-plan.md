# Mobile UX - План доработок

**Дата:** 5 января 2026
**Статус:** ✅ ВСЕ ФАЗЫ ЗАВЕРШЕНЫ
**Всего проблем:** 27 (6 P0, 11 P1, 10 P2)

---

## Стратегия реализации

Исправления организованы в **4 фазы** по зависимостям и приоритету:

| Фаза | Фокус | Задачи | Статус |
|------|-------|--------|--------|
| Фаза 1 | Touch Navigation (Критично) | 6 | ✅ ЗАВЕРШЕНА |
| Фаза 2 | Progress Sync | 4 | ✅ ЗАВЕРШЕНА |
| Фаза 3 | Accessibility | 4 | ✅ ЗАВЕРШЕНА |
| Фаза 4 | UX Polish & Performance | 6 | ✅ ЗАВЕРШЕНА |

---

## Фаза 1: Touch Navigation (P0 Критично) ✅ ЗАВЕРШЕНА

**Цель:** Исправить все проблемы touch-взаимодействия, препятствующие базовому использованию на мобильных.

**Отчёт:** [03-phase1-completion.md](./03-phase1-completion.md)

### Task 1.1: Fix passive event listeners

**File:** `frontend/src/hooks/epub/useTouchNavigation.ts`

```typescript
// BEFORE (lines 166-167):
container.addEventListener('touchstart', handleTouchStart, { passive: true });
container.addEventListener('touchend', handleTouchEnd, { passive: true });

// AFTER:
container.addEventListener('touchstart', handleTouchStart, { passive: false });
container.addEventListener('touchend', handleTouchEnd, { passive: false });
```

**Add preventDefault in handleTouchEnd:**
```typescript
const handleTouchEnd = useCallback((e: TouchEvent) => {
  if (!enabled || !touchStartRef.current) return;
  // ... existing code ...

  if (isTap) {
    const tapX = touchEnd.x;
    const screenWidth = window.innerWidth;
    const leftZone = screenWidth * LEFT_ZONE_END;
    const rightZone = screenWidth * RIGHT_ZONE_START;

    if (tapX < leftZone) {
      e.preventDefault(); // ADD: Block text selection
      e.stopPropagation();
      prevPage();
      return;
    } else if (tapX > rightZone) {
      e.preventDefault(); // ADD: Block text selection
      e.stopPropagation();
      nextPage();
      return;
    }
    // Center tap - do nothing, allow text selection
  }
  // ... swipe handling ...
}, [enabled, nextPage, prevPage, swipeThreshold, timeThreshold]);
```

---

### Task 1.2: Fix CSS touch-action

**File:** `frontend/src/styles/globals.css`

```css
/* BEFORE (lines 668-678): */
.epub-container iframe,
.epub-container iframe body {
  touch-action: pan-y !important;
  overscroll-behavior-x: none !important;
}

/* AFTER: */
.epub-container iframe,
.epub-container iframe body {
  touch-action: manipulation !important; /* Allow horizontal gestures for JS */
  overscroll-behavior: contain !important;
}
```

---

### Task 1.3: Increase TAP_MAX_DURATION

**File:** `frontend/src/hooks/epub/useTouchNavigation.ts`

```typescript
// BEFORE (line 24):
const TAP_MAX_DURATION = 200;

// AFTER:
const TAP_MAX_DURATION = 350; // More forgiving for slower taps
```

---

### Task 1.4: Add highlight span detection before navigation

**File:** `frontend/src/hooks/epub/useTouchNavigation.ts`

```typescript
const handleTouchEnd = useCallback((e: TouchEvent) => {
  // ... existing code ...

  if (isTap) {
    // ADD: Check if tap is on highlight span
    const target = e.target as HTMLElement;
    if (target?.classList?.contains('description-highlight') ||
        target?.closest('.description-highlight')) {
      // Don't navigate - let click handler open modal
      return;
    }

    const tapX = touchEnd.x;
    // ... rest of navigation logic ...
  }
}, [/* ... */]);
```

---

### Task 1.5: Add touch handlers to highlight spans

**File:** `frontend/src/hooks/epub/useDescriptionHighlighting.ts`

```typescript
// After line 685, add touch handlers:
const handleTouchEnd = (event: TouchEvent) => {
  event.preventDefault();
  event.stopPropagation();

  const descId = span.getAttribute('data-description-id');
  if (descId) {
    const desc = descriptions.find(d => d.id === descId);
    if (desc) {
      const image = imagesByDescId.get(descId);
      onDescriptionClick(desc, image);
    }
  }
};

span.addEventListener('touchend', handleTouchEnd, { passive: false });

// Add to cleanup:
cleanupFunctionsRef.current.push(() => {
  span.removeEventListener('touchend', handleTouchEnd);
  // ... existing cleanup ...
});
```

---

### Task 1.6: Add mobile touch CSS to iframe

**File:** `frontend/src/hooks/epub/useContentHooks.ts`

Add to injected styles:
```typescript
const style = doc.createElement('style');
style.textContent = `
  /* Existing styles... */

  /* Mobile touch optimizations */
  * {
    -webkit-tap-highlight-color: transparent;
  }

  body {
    -webkit-overflow-scrolling: touch;
    touch-action: manipulation;
    overscroll-behavior: contain;
  }

  .description-highlight {
    touch-action: manipulation;
    -webkit-touch-callout: none;
    cursor: pointer;
  }
`;
```

---

## Phase 2: Progress Sync (P0-P1) ✅ ЗАВЕРШЕНА

**Goal:** Fix progress tracking so it updates on every page turn.

**Отчёт:** [04-phase2-completion.md](./04-phase2-completion.md)

### Task 2.1: Add fallback relocated listener

**File:** `frontend/src/hooks/epub/useCFITracking.ts`

Split into two useEffects:

```typescript
// Effect 1: Basic listener (always works, no locations dependency)
useEffect(() => {
  if (!rendition) return;

  const handleRelocatedBasic = (location: EpubLocationEvent) => {
    const cfi = location.start.cfi;
    setCurrentCFI(cfi);

    // Use epub.js built-in percentage as fallback
    if (location.start.percentage !== undefined) {
      const fallbackProgress = Math.round(location.start.percentage * 100);
      setProgress(fallbackProgress);
    }
  };

  rendition.on('relocated', handleRelocatedBasic);
  return () => rendition.off('relocated', handleRelocatedBasic);
}, [rendition]); // Minimal dependencies!

// Effect 2: Enhanced progress with locations (optional improvement)
useEffect(() => {
  if (!rendition || !locations || !locations.total) return;

  const handleRelocatedWithLocations = (location: EpubLocationEvent) => {
    const preciseProgress = Math.round(
      (locations.percentageFromCfi(location.start.cfi) || 0) * 100
    );
    setProgress(preciseProgress);
  };

  rendition.on('relocated', handleRelocatedWithLocations);
  return () => rendition.off('relocated', handleRelocatedWithLocations);
}, [rendition, locations]);
```

---

### Task 2.2: Fix restored position skip logic

**File:** `frontend/src/hooks/epub/useCFITracking.ts`

```typescript
// BEFORE (lines 222-240):
// Skip if within 3% threshold - BUGGY

// AFTER:
const handleRelocated = (location: EpubLocationEvent) => {
  const cfi = location.start.cfi;

  // Only skip the FIRST relocated after restore
  if (restoredCfiRef.current) {
    if (cfi === restoredCfiRef.current) {
      devLog('Skip: First relocated after restore (exact match)');
      restoredCfiRef.current = null; // Clear IMMEDIATELY
      return;
    }
    // Any other CFI - clear ref and process normally
    restoredCfiRef.current = null;
  }

  // Continue with progress update...
};
```

---

### Task 2.3: Add error handling to navigation

**File:** `frontend/src/hooks/epub/useEpubNavigation.ts`

```typescript
const nextPage = useCallback(async () => {
  if (!rendition) return;
  try {
    await rendition.next();
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[Navigation] Could not go to next page:', err);
    }
  }
}, [rendition]);

const prevPage = useCallback(async () => {
  if (!rendition) return;
  try {
    await rendition.prev();
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[Navigation] Could not go to prev page:', err);
    }
  }
}, [rendition]);
```

---

## Phase 3: Accessibility (P0) ✅ ЗАВЕРШЕНА

**Goal:** Meet WCAG AA requirements for screen reader users.

**Отчёт:** [05-phase3-completion.md](./05-phase3-completion.md)

### Task 3.1: Add ARIA to progress bar

**File:** `frontend/src/components/Reader/ReaderHeader.tsx`

```tsx
// BEFORE (lines 106-112):
<div className="h-2 sm:h-1.5 bg-secondary/30 rounded-full overflow-hidden">
  <div
    className="h-full bg-primary transition-all duration-300"
    style={{ width: `${progress}%` }}
  />
</div>

// AFTER:
<div
  role="progressbar"
  aria-valuenow={progress}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label={`Reading progress: ${progress}%`}
  className="h-2 sm:h-1.5 bg-secondary/30 rounded-full overflow-hidden"
>
  <div
    className="h-full bg-primary transition-all duration-300"
    style={{ width: `${progress}%` }}
  />
</div>
```

---

### Task 3.2: Add aria-live to ExtractionIndicator

**File:** `frontend/src/components/Reader/ExtractionIndicator.tsx`

```tsx
// Add to root element:
<div
  aria-live="polite"
  aria-atomic="true"
  className={/* existing classes */}
>
  {/* existing content */}
</div>
```

---

### Task 3.3: Increase back button touch target

**File:** `frontend/src/components/Reader/ReaderHeader.tsx`

```tsx
// BEFORE (lines 54-61):
<button className="px-3 py-2 ...">

// AFTER:
<button className="min-h-[44px] min-w-[44px] px-3 py-2 ...">
```

---

### Task 3.4: Increase page numbers font size

**File:** `frontend/src/components/Reader/ReaderHeader.tsx`

```tsx
// BEFORE (line 97):
<span className="text-[10px] sm:text-xs ...">

// AFTER:
<span className="text-xs sm:text-sm ...">
```

---

## Phase 4: UX Polish & Performance (P1-P2) ✅ ЗАВЕРШЕНА

**Отчёт:** [06-phase4-completion.md](./06-phase4-completion.md)

### Task 4.1: Fix cancel button size

**File:** `frontend/src/components/Reader/ImageGenerationStatus.tsx`

```tsx
// BEFORE (lines 122-130):
<button className="p-1 ...">

// AFTER:
<button className="min-h-[44px] min-w-[44px] p-2 ...">
```

---

### Task 4.2: Add debounce to TOC search

**File:** `frontend/src/components/Reader/TocSidebar.tsx`

```typescript
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

// In component:
const [searchInput, setSearchInput] = useState('');
const debouncedSearch = useDebouncedValue(searchInput, 200);

// Use debouncedSearch for filtering
```

---

### Task 4.3: Optimize TOC animations for mobile

**File:** `frontend/src/components/Reader/TocSidebar.tsx`

```typescript
const isMobile = window.innerWidth <= 768;

// Reduce stagger delay on mobile
const staggerDelay = isMobile ? 0.02 : 0.05;

// Or disable animations entirely on low-end devices
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

---

### Task 4.4: Add relative swipe threshold

**File:** `frontend/src/hooks/epub/useTouchNavigation.ts`

```typescript
// BEFORE:
swipeThreshold = 50; // Fixed 50px

// AFTER:
const defaultSwipeThreshold = Math.max(50, window.innerWidth * 0.1); // 10% of screen width, min 50px
```

---

### Task 4.5: Fix settings panel safe areas

**File:** `frontend/src/components/Reader/ReaderControls.tsx`

```tsx
// Ensure panel respects safe areas
<div className="fixed top-16 right-4 pt-safe pr-safe ...">
```

---

### Task 4.6 (Optional): Add bottom navigation

Create new component for mobile-optimized navigation:
- Previous page button
- Page slider/indicator
- Next page button
- Settings toggle

---

## Testing Checklist

### Phase 1 Verification

- [ ] Tap on left 25% → previous page (no text selection)
- [ ] Tap on right 25% → next page (no text selection)
- [ ] Tap on center → no navigation, can select text
- [ ] Swipe left → next page
- [ ] Swipe right → previous page
- [ ] Tap on highlighted description → opens modal
- [ ] Long press → text selection works

### Phase 2 Verification

- [ ] Progress updates immediately on page turn
- [ ] Progress bar shows correct percentage
- [ ] Works before locations generation completes
- [ ] Works after position restore

### Phase 3 Verification

- [ ] VoiceOver announces progress
- [ ] VoiceOver announces extraction status
- [ ] All buttons have 44px minimum touch targets
- [ ] Text is readable (12px minimum)

### Phase 4 Verification

- [ ] TOC search doesn't lag
- [ ] TOC animations smooth on mobile
- [ ] Settings panel doesn't overlap notch

---

## Dependencies

```
Phase 1 (Touch) ─┬─► Phase 2 (Progress) ─► Phase 4 (Polish)
                 │
                 └─► Phase 3 (A11y)
```

Phase 1 must be completed first as it affects core functionality.
Phases 2 and 3 can run in parallel.
Phase 4 is polish and can be done incrementally.

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| epub.js internal handlers conflict | Medium | High | Test thoroughly, may need to disable epub.js gestures |
| iOS-specific touch behavior | Medium | Medium | Test on real iOS devices |
| Performance regression from more event handlers | Low | Medium | Profile after changes |
| Breaking desktop experience | Low | High | Test both mobile and desktop |

---

## Связанные документы

- [01-analysis.md](./01-analysis.md) - Полный анализ всех проблем
- [03-phase1-completion.md](./03-phase1-completion.md) - Отчёт Фазы 1
- [04-phase2-completion.md](./04-phase2-completion.md) - Отчёт Фазы 2
- [05-phase3-completion.md](./05-phase3-completion.md) - Отчёт Фазы 3
- [06-phase4-completion.md](./06-phase4-completion.md) - Отчёт Фазы 4
