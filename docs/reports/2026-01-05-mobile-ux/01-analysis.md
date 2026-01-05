# Mobile UX Analysis - EPUB Reader

**Date:** 5 January 2026
**Status:** Analysis Complete
**Scope:** Full mobile UX audit of EPUB reader

---

## Executive Summary

Comprehensive analysis of the mobile EPUB reader revealed **27 issues** across 6 categories:
- **6 Critical (P0)** - Breaking functionality
- **11 High (P1)** - Significant UX degradation
- **10 Medium (P2)** - Polish and optimization

**Root Causes:**
1. `passive: true` on touch events prevents `preventDefault()`
2. CSS `touch-action: pan-y` blocks horizontal swipe detection
3. `locations` dependency breaks progress tracking until generation completes
4. No coordination between touch handlers (navigation vs description clicks)

---

## Table of Contents

1. [Touch Navigation Issues](#1-touch-navigation-issues)
2. [Progress Sync Issues](#2-progress-sync-issues)
3. [epub.js Integration Issues](#3-epubjs-integration-issues)
4. [UX/Accessibility Issues](#4-uxaccessibility-issues)
5. [Performance Issues](#5-performance-issues)
6. [iOS/Android Specific Issues](#6-iosandroid-specific-issues)

---

## 1. Touch Navigation Issues

### 1.1 Tap on edges triggers text selection instead of navigation

| Property | Value |
|----------|-------|
| **Severity** | P0 - Critical |
| **File** | `frontend/src/hooks/epub/useTouchNavigation.ts` |
| **Lines** | 166-167 |
| **User Report** | "При тапе на края экрана каждый раз срабатывает выделение текста" |

**Root Cause:**
```typescript
// PROBLEM: passive: true prevents preventDefault()
container.addEventListener('touchstart', handleTouchStart, { passive: true });
container.addEventListener('touchend', handleTouchEnd, { passive: true });
```

With `passive: true`, browser ignores `preventDefault()`, allowing native text selection to trigger after tap.

**Impact:** Navigation completely broken on mobile - users cannot turn pages by tapping edges.

---

### 1.2 Center tap navigates pages (should do nothing)

| Property | Value |
|----------|-------|
| **Severity** | P0 - Critical |
| **File** | `frontend/src/hooks/epub/useTouchNavigation.ts` |
| **Lines** | 78-94 |
| **User Report** | "Обычный тап по середине экрана почему-то тоже листает страницы" |

**Root Cause:**
Two contributing factors:
1. `TAP_MAX_DURATION = 200ms` is too strict - slow taps not recognized as taps
2. epub.js internal click handler may trigger page navigation

```typescript
// Line 24 - too strict
const TAP_MAX_DURATION = 200; // ms

// Line 79 - tap detection
const isTap = deltaTime < TAP_MAX_DURATION && touchDistance < TAP_MAX_MOVEMENT;
// If not recognized as tap → falls through → epub.js handles it
```

**Impact:** Unpredictable navigation, frustrating UX.

---

### 1.3 Backward swipe navigation not working correctly

| Property | Value |
|----------|-------|
| **Severity** | P0 - Critical |
| **File** | `frontend/src/styles/globals.css` |
| **Lines** | 668-678 |
| **User Report** | "Некорректно работает пролистывание назад" |

**Root Cause:**
```css
/* CSS blocks horizontal gestures BEFORE JavaScript can handle them */
.epub-container iframe,
.epub-container iframe body {
  touch-action: pan-y !important;  /* Only vertical scroll allowed! */
}
```

`touch-action: pan-y` tells browser to only allow vertical scrolling. Horizontal swipes are ignored at browser level before reaching JavaScript handlers.

**Impact:** Swipe navigation broken on mobile.

---

### 1.4 Click on highlighted description not working

| Property | Value |
|----------|-------|
| **Severity** | P0 - Critical |
| **File** | `frontend/src/hooks/epub/useDescriptionHighlighting.ts` |
| **Lines** | 672-685, 751-773 |
| **User Report** | "Клик на выделенное описание не работает" |

**Root Causes:**
1. Touch navigation intercepts tap before click event reaches highlight span
2. No coordination between `useTouchNavigation` and highlight click handler
3. 300ms browser click delay after touch

```
Touch on highlight span in edge zone (< 25%):
  touchend → useTouchNavigation → prevPage() → PAGE CHANGES
  [300ms later] click → highlight handler → NEVER REACHED
```

**Impact:** Cannot open image modal by tapping descriptions on mobile.

---

### 1.5 No distinction between tap and long-press

| Property | Value |
|----------|-------|
| **Severity** | P1 - High |
| **File** | `frontend/src/hooks/epub/useTouchNavigation.ts` |
| **Lines** | 24-28 |

**Problem:** Current implementation:
- Tap (< 200ms) → navigation
- Long press → nothing special (browser handles as selection)

**Best Practice:** Mobile readers should:
- Tap → navigation (edges) or nothing (center)
- Long press → text selection
- Current: tap also triggers selection because `preventDefault()` not working

---

### 1.6 Swipe threshold too high for some devices

| Property | Value |
|----------|-------|
| **Severity** | P2 - Medium |
| **File** | `frontend/src/hooks/epub/useTouchNavigation.ts` |
| **Lines** | 117-123 |

```typescript
swipeThreshold = 50; // 50px minimum swipe distance
```

On smaller devices (iPhone SE - 375px width), 50px may be too much. Consider making it relative to screen width (e.g., 10% of width).

---

## 2. Progress Sync Issues

### 2.1 Progress not updating when turning pages

| Property | Value |
|----------|-------|
| **Severity** | P0 - Critical |
| **File** | `frontend/src/hooks/epub/useCFITracking.ts` |
| **Lines** | 216-217 |
| **User Report** | "Не работает обновление прогресса чтения, счетчик с процентом не меняется" |

**Root Cause:**
```typescript
useEffect(() => {
  // CRITICAL: Early return if locations not ready!
  if (!rendition || !locations || !book) return;

  const handleRelocated = (location: EpubLocationEvent) => {
    // Progress calculation happens here
  };

  rendition.on('relocated', handleRelocated);
  // ...
}, [rendition, locations, book, ...]);
```

The `relocated` event listener is **NOT SET UP** until `locations` generation completes (5-10 seconds). During this time, **all page turns are ignored** for progress tracking.

**Data Flow Breakdown:**
```
Page Turn → rendition.next()
         → epub.js fires 'relocated' event
         → BUT listener not attached (locations === null)
         → Progress NOT updated
```

---

### 2.2 First page turns after position restore are skipped

| Property | Value |
|----------|-------|
| **Severity** | P1 - High |
| **File** | `frontend/src/hooks/epub/useCFITracking.ts` |
| **Lines** | 222-240 |

```typescript
const handleRelocated = (location: EpubLocationEvent) => {
  // Skip if within 3% of restored position
  if (restoredCfiRef.current && locations.total > 0) {
    const restoredPercent = ...;
    const currentPercent = ...;

    if (Math.abs(currentPercent - restoredPercent) <= 3) {
      return; // SKIP! Progress not updated
    }
  }
  // ... update progress
};
```

After restoring reading position, page turns within 3% of original position are ignored. On small books, 3% could be several pages.

---

### 2.3 epub.js percentage not used as fallback

| Property | Value |
|----------|-------|
| **Severity** | P1 - High |
| **File** | `frontend/src/hooks/epub/useCFITracking.ts` |
| **Lines** | 243-259 |

epub.js `relocated` event already contains `percentage`:
```typescript
interface EpubLocationEvent {
  start: {
    cfi: string;
    percentage: number; // ← Available but NOT USED as fallback!
  };
}
```

This percentage could be used immediately without waiting for `locations` generation.

---

### 2.4 Navigation promises not awaited

| Property | Value |
|----------|-------|
| **Severity** | P2 - Medium |
| **File** | `frontend/src/hooks/epub/useEpubNavigation.ts` |
| **Lines** | 27-35 |

```typescript
const nextPage = useCallback(() => {
  if (!rendition) return;
  rendition.next(); // Fire and forget! No error handling
}, [rendition]);
```

`rendition.next()` returns a Promise that is ignored. Errors are silent.

---

## 3. epub.js Integration Issues

### 3.1 Missing mobile-optimized rendition options

| Property | Value |
|----------|-------|
| **Severity** | P1 - High |
| **File** | `frontend/src/hooks/epub/useEpubLoader.ts` |
| **Lines** | 104-108 |

**Current:**
```typescript
const newRendition = epubBook.renderTo(viewerRef.current, {
  width: '100%',
  height: '100%',
  spread: 'none',
  // Missing: flow, manager, snap options
});
```

**Recommended for mobile:**
```typescript
const renditionOptions = {
  width: '100%',
  height: '100%',
  spread: 'none',
  flow: isMobile ? 'scrolled-doc' : 'paginated', // Scrolled better on mobile
  manager: 'continuous', // Smoother navigation
  snap: !isMobile,
  resizeOnOrientationChange: true,
};
```

---

### 3.2 Incomplete iframe touch CSS

| Property | Value |
|----------|-------|
| **Severity** | P1 - High |
| **File** | `frontend/src/hooks/epub/useContentHooks.ts` |
| **Lines** | 37-138 |

**Missing CSS properties:**
```css
/* Not present in useContentHooks.ts */
-webkit-tap-highlight-color: transparent;
-webkit-touch-callout: none;
-webkit-overflow-scrolling: touch;
```

---

### 3.3 Race condition in touch listener setup

| Property | Value |
|----------|-------|
| **Severity** | P2 - Medium |
| **File** | `frontend/src/hooks/epub/useTouchNavigation.ts` |
| **Lines** | 147-153 |

```typescript
const handleRendered = () => {
  setTimeout(setupListeners, 100); // Hardcoded 100ms delay - unreliable!
};
```

Hardcoded timeout is fragile. Should use proper event-based synchronization.

---

## 4. UX/Accessibility Issues

### 4.1 Progress bar missing ARIA attributes

| Property | Value |
|----------|-------|
| **Severity** | P0 - Critical (Accessibility) |
| **File** | `frontend/src/components/Reader/ReaderHeader.tsx` |
| **Lines** | 106-112 |

Progress bar lacks:
- `role="progressbar"`
- `aria-valuenow`
- `aria-valuemin`
- `aria-valuemax`

Screen reader users cannot access progress information.

---

### 4.2 ExtractionIndicator missing aria-live

| Property | Value |
|----------|-------|
| **Severity** | P0 - Critical (Accessibility) |
| **File** | `frontend/src/components/Reader/ExtractionIndicator.tsx` |
| **Lines** | 29-70 |

Status updates not announced to screen readers. Need `aria-live="polite"`.

---

### 4.3 Back button touch target too small

| Property | Value |
|----------|-------|
| **Severity** | P1 - High |
| **File** | `frontend/src/components/Reader/ReaderHeader.tsx` |
| **Lines** | 54-61 |

`px-3 py-2` gives ~36px height, less than recommended 44px minimum.

---

### 4.4 Page numbers font too small

| Property | Value |
|----------|-------|
| **Severity** | P1 - High |
| **File** | `frontend/src/components/Reader/ReaderHeader.tsx` |
| **Lines** | 97 |

`text-[10px]` is 10px - very hard to read on mobile.

---

### 4.5 No bottom navigation bar

| Property | Value |
|----------|-------|
| **Severity** | P1 - High |
| **File** | N/A |

Material Design recommends bottom navigation for primary mobile actions. Current design requires reaching to top of screen.

---

### 4.6 No visual affordance for tap zones

| Property | Value |
|----------|-------|
| **Severity** | P2 - Medium |
| **File** | `frontend/src/hooks/epub/useTouchNavigation.ts` |

Users don't know that edge taps navigate. Need onboarding or subtle indicators.

---

## 5. Performance Issues

### 5.1 Heavy animations in TOC

| Property | Value |
|----------|-------|
| **Severity** | P2 - Medium |
| **File** | `frontend/src/components/Reader/TocSidebar.tsx` |
| **Lines** | 107-231 |

Framer Motion staggered animations on every TOC item. Can lag on large TOCs or low-end devices.

---

### 5.2 Backdrop blur on multiple overlays

| Property | Value |
|----------|-------|
| **Severity** | P2 - Medium |
| **File** | Multiple |

`backdrop-blur-md` / `backdrop-blur-sm` are GPU-intensive on mobile. Consider removing or using feature detection.

---

### 5.3 No debounce on TOC search

| Property | Value |
|----------|-------|
| **Severity** | P2 - Medium |
| **File** | `frontend/src/components/Reader/TocSidebar.tsx` |
| **Lines** | 397 |

Search filters on every keystroke. Should debounce 150-200ms.

---

## 6. iOS/Android Specific Issues

### 6.1 No swipe-from-edge gesture for back (iOS)

| Property | Value |
|----------|-------|
| **Severity** | P2 - Medium |
| **File** | N/A |

iOS users expect swipe from left edge to go back (Apple HIG). Not implemented.

---

### 6.2 Sepia theme color contrast may be insufficient

| Property | Value |
|----------|-------|
| **Severity** | P2 - Medium |
| **File** | `frontend/src/styles/globals.css` |
| **Lines** | 149-211 |

`--color-text-subtle: #7A6347` on `--color-bg-base: #FBF0D9` may not meet WCAG AA contrast requirements.

---

### 6.3 Cancel button too small (ImageGenerationStatus)

| Property | Value |
|----------|-------|
| **Severity** | P1 - High |
| **File** | `frontend/src/components/Reader/ImageGenerationStatus.tsx` |
| **Lines** | 122-130 |

`p-1` gives ~28px, need `min-w-[44px] min-h-[44px]`.

---

## Summary Table

| ID | Issue | Severity | Category | File |
|----|-------|----------|----------|------|
| 1.1 | Tap triggers text selection | P0 | Touch | useTouchNavigation.ts |
| 1.2 | Center tap navigates | P0 | Touch | useTouchNavigation.ts |
| 1.3 | Backward swipe broken | P0 | Touch | globals.css |
| 1.4 | Description click not working | P0 | Touch | useDescriptionHighlighting.ts |
| 2.1 | Progress not updating | P0 | Progress | useCFITracking.ts |
| 4.1 | Progress bar no ARIA | P0 | A11y | ReaderHeader.tsx |
| 4.2 | ExtractionIndicator no aria-live | P0 | A11y | ExtractionIndicator.tsx |
| 1.5 | No tap vs long-press distinction | P1 | Touch | useTouchNavigation.ts |
| 2.2 | Restored position skip | P1 | Progress | useCFITracking.ts |
| 2.3 | No percentage fallback | P1 | Progress | useCFITracking.ts |
| 3.1 | Missing mobile rendition options | P1 | epub.js | useEpubLoader.ts |
| 3.2 | Incomplete iframe CSS | P1 | epub.js | useContentHooks.ts |
| 4.3 | Back button too small | P1 | UX | ReaderHeader.tsx |
| 4.4 | Page numbers too small | P1 | UX | ReaderHeader.tsx |
| 4.5 | No bottom navigation | P1 | UX | N/A |
| 4.6 | Settings position vs safe areas | P1 | UX | ReaderControls.tsx |
| 6.3 | Cancel button too small | P1 | UX | ImageGenerationStatus.tsx |
| 1.6 | Swipe threshold too high | P2 | Touch | useTouchNavigation.ts |
| 2.4 | Navigation promises ignored | P2 | Progress | useEpubNavigation.ts |
| 3.3 | Race condition in setup | P2 | epub.js | useTouchNavigation.ts |
| 4.7 | No tap zone affordance | P2 | UX | N/A |
| 5.1 | Heavy TOC animations | P2 | Perf | TocSidebar.tsx |
| 5.2 | Backdrop blur expensive | P2 | Perf | Multiple |
| 5.3 | No TOC search debounce | P2 | Perf | TocSidebar.tsx |
| 6.1 | No iOS back gesture | P2 | Platform | N/A |
| 6.2 | Sepia contrast issues | P2 | A11y | globals.css |

---

## Связанные документы

- [02-action-plan.md](./02-action-plan.md) - План доработок с приоритизацией
- [03-phase1-completion.md](./03-phase1-completion.md) - Отчёт о завершении Фазы 1
- [04-phase2-completion.md](./04-phase2-completion.md) - Отчёт о завершении Фазы 2
- [05-phase3-completion.md](./05-phase3-completion.md) - Отчёт о завершении Фазы 3
- [06-phase4-completion.md](./06-phase4-completion.md) - Отчёт о завершении Фазы 4
