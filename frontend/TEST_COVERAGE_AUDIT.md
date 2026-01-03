# Test Coverage Audit - Frontend Components
**Date:** 2026-01-03
**Auditor:** QA Testing Specialist
**Project:** fancai - Web Fiction Reader

## Executive Summary

**Total Components Audited:** 54 components
**Components with Tests:** 1 component (1.9%)
**Components without Tests:** 53 components (98.1%)
**Critical Coverage Gaps:** High-priority interactive components lack test coverage

---

## 1. UI Components (src/components/UI/)

### 1.1 Core Form Controls

| Component | Test File | Status | Priority | Use Cases to Cover |
|-----------|-----------|--------|----------|-------------------|
| `button.tsx` | None | ❌ MISSING | P0 | - All variants (primary, secondary, ghost, destructive, outline, link)<br>- All sizes (sm, md, lg, icon)<br>- Loading state with spinner<br>- Disabled state<br>- asChild (Slot) functionality<br>- Click handlers<br>- Keyboard navigation (Enter, Space) |
| `Input.tsx` | None | ❌ MISSING | P0 | - All variants (default, error, success)<br>- All sizes (sm, md, lg)<br>- Label rendering and association<br>- Error message display<br>- Helper text display<br>- Left/right icon rendering<br>- Required field indicator<br>- ARIA attributes (aria-invalid, aria-describedby)<br>- Input value changes<br>- Disabled state |
| `Select.tsx` | None | ❌ MISSING | P0 | - Native select rendering<br>- Placeholder handling<br>- Options rendering<br>- Variant styles (default, error)<br>- Size variants<br>- Disabled state<br>- SelectWrapper with label/helper/error<br>- Value changes<br>- Keyboard navigation |
| `Checkbox.tsx` | None | ❌ MISSING | P1 | - Checked/unchecked states<br>- Indeterminate state<br>- Controlled/uncontrolled modes<br>- Variant styles (default, error)<br>- Label and helper text<br>- Error message display<br>- Touch target (44px minimum)<br>- Keyboard interaction (Space)<br>- ARIA attributes |
| `Radio.tsx` | None | ❌ MISSING | P1 | - Radio button selection<br>- RadioGroup context<br>- RadioGroupItem integration<br>- Variant styles<br>- Required field indicator<br>- Horizontal/vertical orientation<br>- Error state<br>- Keyboard navigation (Arrow keys)<br>- ARIA radiogroup attributes |

### 1.2 Layout Components

| Component | Test File | Status | Priority | Use Cases to Cover |
|-----------|-----------|--------|----------|-------------------|
| `Card.tsx` | None | ❌ MISSING | P1 | - All variants (default, elevated, outlined)<br>- Padding sizes (sm, md, lg)<br>- Interactive state<br>- CardHeader, CardTitle, CardDescription<br>- CardContent, CardFooter<br>- Composition pattern |
| `Modal.tsx` | None | ❌ MISSING | P0 | - Open/close state<br>- All variants (default, fullscreen, drawer)<br>- Focus trap behavior<br>- ESC key to close<br>- Backdrop click to close<br>- Body scroll lock<br>- Focus restoration<br>- Modal.Header, Modal.Body, Modal.Footer<br>- ARIA dialog attributes<br>- Portal rendering |
| `Dialog.tsx` | None | ❌ MISSING | P0 | - Confirm dialog variant<br>- Destructive dialog variant<br>- Alert dialog variant<br>- onConfirm/onCancel callbacks<br>- Loading state<br>- Disabled confirm button<br>- Icon rendering per variant<br>- useDialog hook functionality |
| `Skeleton.tsx` | None | ❌ MISSING | P2 | - All variants (text, circular, rectangular)<br>- Width/height props<br>- Specialized skeletons:<br>  - BookCardSkeleton<br>  - TableRowSkeleton<br>  - TextBlockSkeleton<br>  - AvatarSkeleton<br>  - CardSkeleton<br>  - ListItemSkeleton<br>- Animation rendering |

### 1.3 Feedback Components

| Component | Test File | Status | Priority | Use Cases to Cover |
|-----------|-----------|--------|----------|-------------------|
| `NotificationContainer.tsx` | None | ❌ MISSING | P1 | - All toast variants (success, warning, error, info, default)<br>- Auto-dismiss after duration<br>- Manual dismiss<br>- Progress bar animation<br>- Multiple notifications stacking<br>- Position (top-right)<br>- Toast removal from store<br>- Icon rendering per variant |
| `ErrorMessage.tsx` | None | ❌ MISSING | P2 | - Error text rendering<br>- Icon display<br>- ARIA role="alert"<br>- Styling variants |
| `LoadingSpinner.tsx` | None | ❌ MISSING | P2 | - Spinner animation<br>- Size variants<br>- Color inheritance |
| `OfflineBanner.tsx` | None | ❌ MISSING | P1 | - Display when offline<br>- Hide when online<br>- useOnlineStatus integration<br>- Retry prompt |
| `ParsingOverlay.tsx` | None | ❌ MISSING | P2 | - Show during book parsing<br>- Progress indicator<br>- Cancel functionality<br>- Message display |

### 1.4 Utility Components

| Component | Test File | Status | Priority | Use Cases to Cover |
|-----------|-----------|--------|----------|-------------------|
| `ThemeSwitcher.tsx` | None | ❌ MISSING | P1 | - Theme toggle (light/dark)<br>- Current theme display<br>- useTheme hook integration<br>- Icon rendering per theme<br>- ARIA label |
| `AuthenticatedImage.tsx` | None | ❌ MISSING | P2 | - JWT token injection<br>- Image loading states<br>- Error handling<br>- Fallback image |

### 1.5 Radix UI Primitives (Low Priority)

These are wrapper components around Radix UI - testing should focus on integration:

- `button.tsx` (Radix Slot integration) - **P2**
- `dropdown-menu.tsx` - **P2**
- `popover.tsx` - **P2**
- `progress.tsx` - **P2**
- `separator.tsx` - **P3**
- `slider.tsx` - **P2**
- `tooltip.tsx` - **P2**

---

## 2. Navigation Components (src/components/Navigation/)

| Component | Test File | Status | Priority | Use Cases to Cover |
|-----------|-----------|--------|----------|-------------------|
| `BottomNav.tsx` | None | ❌ MISSING | P0 | - All navigation items rendering<br>- Active route highlighting<br>- Touch-friendly targets (56px)<br>- Icon scaling on active<br>- aria-current attribute<br>- Only visible on mobile (md:hidden)<br>- Route navigation<br>- Safe area support |
| `MobileDrawer.tsx` | None | ❌ MISSING | P0 | - Open/close animation<br>- Backdrop blur rendering<br>- Navigation links rendering<br>- Active route highlighting<br>- User info display<br>- Admin menu (conditional)<br>- Logout functionality<br>- ESC key to close<br>- Focus trap<br>- Body scroll lock<br>- Focus restoration<br>- Portal rendering |

---

## 3. Layout Components (src/components/Layout/)

| Component | Test File | Status | Priority | Use Cases to Cover |
|-----------|-----------|--------|----------|-------------------|
| `Header.tsx` | None | ❌ MISSING | P0 | - Logo and branding<br>- Menu button (mobile)<br>- User menu dropdown<br>- Upload button<br>- Theme switcher<br>- Logout functionality<br>- Click outside to close menu<br>- Navigation links<br>- Admin link (conditional) |
| `Sidebar.tsx` | None | ❌ MISSING | P0 | - Navigation items rendering<br>- Active route highlighting<br>- Collapsed/expanded state<br>- localStorage persistence<br>- User info display<br>- Admin menu (conditional)<br>- Desktop/mobile behavior<br>- Toggle button |
| `Layout.tsx` | None | ❌ MISSING | P1 | - Sidebar + Header + Content layout<br>- Mobile drawer integration<br>- Responsive behavior<br>- Children rendering |

---

## 4. Reader Components (src/components/Reader/)

| Component | Test File | Status | Priority | Use Cases to Cover |
|-----------|-----------|--------|----------|-------------------|
| `EpubReader.tsx` | ✅ EXISTS | ✅ PARTIAL | P0 | **Current Coverage:**<br>- Component rendering<br><br>**Missing:**<br>- epub.js integration<br>- Chapter navigation<br>- CFI-based position tracking<br>- Description highlighting (9 strategies)<br>- Settings panel integration<br>- TOC sidebar<br>- Image generation triggers<br>- Progress saving<br>- Keyboard shortcuts |
| `ReaderToolbar.tsx` | None | ❌ MISSING | P0 | - Visibility toggle (immersive mode)<br>- Book title truncation<br>- Back button<br>- TOC toggle<br>- Settings toggle<br>- Theme switcher<br>- Auto-hide on scroll<br>- Touch-friendly buttons (44px)<br>- Backdrop blur<br>- Animation (slide up/down) |
| `TocSidebar.tsx` | None | ❌ MISSING | P0 | - Open/close animation<br>- Chapter list rendering<br>- Current chapter highlighting<br>- Chapter progress indicators<br>- Nested chapters (subitems)<br>- Chapter click navigation<br>- Search functionality<br>- Close button<br>- ESC key support<br>- Backdrop click to close |
| `ReaderSettingsPanel.tsx` | None | ❌ MISSING | P0 | - Open/close animation<br>- Bottom sheet (mobile) / side panel (desktop)<br>- Drag-to-dismiss (mobile)<br>- Theme selection (light, dark, sepia, night)<br>- Font size slider<br>- Font family selection<br>- Line height slider<br>- Max width slider<br>- Margin slider<br>- Reset to defaults<br>- Settings persistence |
| `BookInfo.tsx` | None | ❌ MISSING | P2 | - Book metadata display<br>- Author, genre rendering<br>- Progress indicator |
| `ImageGenerationStatus.tsx` | None | ❌ MISSING | P1 | - Loading state<br>- Success state<br>- Error state<br>- Image preview<br>- Retry button |
| `ProgressSaveIndicator.tsx` | None | ❌ MISSING | P1 | - Saving state<br>- Saved state<br>- Error state<br>- Auto-hide after save |
| `ExtractionIndicator.tsx` | None | ❌ MISSING | P2 | - LLM extraction in progress<br>- Success state<br>- Error state |
| `PositionConflictDialog.tsx` | None | ❌ MISSING | P1 | - Conflict detection<br>- Server position display<br>- Local position display<br>- "Use server" action<br>- "Keep local" action<br>- Dialog dismissal |
| `SelectionMenu.tsx` | None | ❌ MISSING | P2 | - Text selection detection<br>- Menu positioning<br>- Actions (highlight, note, generate image)<br>- Menu dismissal |
| `ProgressIndicator.tsx` | None | ❌ MISSING | P2 | - Progress bar rendering<br>- Percentage display<br>- Chapter progress |
| `ReaderNavigationControls.tsx` | None | ❌ MISSING | P1 | - Previous chapter<br>- Next chapter<br>- Disabled states<br>- Keyboard shortcuts |
| `ReaderControls.tsx` | None | ❌ MISSING | P2 | - Play/pause audio (if implemented)<br>- Speed controls<br>- Volume controls |
| `ReaderHeader.tsx` | None | ❌ MISSING | P1 | - Back navigation<br>- Book title<br>- Settings toggle<br>- TOC toggle |
| `ReaderContent.tsx` | None | ❌ MISSING | P1 | - Content rendering<br>- Scrolling behavior<br>- Image lazy loading |
| `BookReader.tsx` | None | ❌ MISSING | P1 | - Reader orchestration<br>- Component integration<br>- State management |

---

## 5. Library Components (src/components/Library/)

| Component | Test File | Status | Priority | Use Cases to Cover |
|-----------|-----------|--------|----------|-------------------|
| `BookCard.tsx` | None | ❌ MISSING | P0 | - Book cover rendering<br>- Title/author display<br>- Genre badge<br>- Progress bar<br>- Click to open book<br>- Delete button<br>- AuthenticatedImage integration<br>- Skeleton loading state |
| `BookGrid.tsx` | None | ❌ MISSING | P1 | - Grid layout<br>- Responsive columns<br>- Empty state<br>- Loading state with skeletons<br>- BookCard rendering |
| `LibraryHeader.tsx` | None | ❌ MISSING | P1 | - Title display<br>- Upload button<br>- Search bar<br>- Filter controls |
| `LibraryStats.tsx` | None | ❌ MISSING | P2 | - Total books count<br>- Reading time<br>- Books completed<br>- Current streak |
| `LibrarySearch.tsx` | None | ❌ MISSING | P1 | - Search input<br>- Debounced search<br>- Clear button<br>- Search icon |
| `LibraryPagination.tsx` | None | ❌ MISSING | P1 | - Page navigation<br>- Current page highlight<br>- Previous/next buttons<br>- Disabled states<br>- Page count display |
| `DeleteConfirmModal.tsx` | None | ❌ MISSING | P0 | - Confirmation dialog<br>- Destructive action styling<br>- Delete confirmation<br>- Cancel action<br>- Book title display |

---

## 6. Admin Components (src/components/Admin/)

| Component | Test File | Status | Priority | Use Cases to Cover |
|-----------|-----------|--------|----------|-------------------|
| `AdminHeader.tsx` | None | ❌ MISSING | P2 | - Title display<br>- Navigation breadcrumbs<br>- User info |
| `AdminStats.tsx` | None | ❌ MISSING | P2 | - System statistics<br>- User count<br>- Book count<br>- Active sessions |
| `AdminTabNavigation.tsx` | None | ❌ MISSING | P2 | - Tab switching<br>- Active tab highlight<br>- Tab content rendering |
| `AdminMultiNLPSettings.tsx` | None | ❌ MISSING | P3 | - NLP settings (deprecated) |
| `AdminParsingSettings.tsx` | None | ❌ MISSING | P2 | - Parsing configuration<br>- Feature flags<br>- Settings save |

---

## 7. Additional Components

| Component | Test File | Status | Priority | Use Cases to Cover |
|-----------|-----------|--------|----------|-------------------|
| `Auth/AuthGuard.tsx` | None | ❌ MISSING | P0 | - Authenticated user access<br>- Redirect to login<br>- Loading state<br>- Children rendering |
| `Images/ImageGallery.tsx` | None | ❌ MISSING | P1 | - Image grid rendering<br>- Image modal trigger<br>- Loading states<br>- Empty state |
| `Images/ImageModal.tsx` | None | ❌ MISSING | P1 | - Full-size image display<br>- Close button<br>- Download button<br>- Navigation (prev/next) |
| `Settings/ReaderSettings.tsx` | None | ❌ MISSING | P1 | - Settings form<br>- Default values<br>- Save settings<br>- Reset to defaults |
| `Books/` (if exists) | None | ❌ MISSING | P2 | - Book-related components |
| `ErrorBoundary.tsx` | ✅ EXISTS | ✅ PARTIAL | P0 | **Current Coverage:**<br>- Error catching<br><br>**Missing:**<br>- Error display UI<br>- Reset functionality<br>- Error logging |

---

## Priority Classification

### P0 - Critical (Must Have) - 15 components
**High user interaction, core functionality**

1. `Button` - Most used UI component
2. `Input` - Form interactions
3. `Select` - Form dropdowns
4. `Modal` - Critical dialogs
5. `Dialog` - Confirmation flows
6. `BottomNav` - Mobile navigation
7. `MobileDrawer` - Mobile menu
8. `Header` - App navigation
9. `Sidebar` - Desktop navigation
10. `EpubReader` - Core reading experience
11. `ReaderToolbar` - Reader controls
12. `TocSidebar` - Chapter navigation
13. `ReaderSettingsPanel` - Reading preferences
14. `BookCard` - Library interaction
15. `DeleteConfirmModal` - Data safety
16. `AuthGuard` - Security

### P1 - High Priority (Should Have) - 22 components
**Important functionality, affects user experience**

- Form controls: `Checkbox`, `Radio`
- Layout: `Card`, `NotificationContainer`, `OfflineBanner`, `ThemeSwitcher`
- Navigation: `Layout`
- Reader: `ImageGenerationStatus`, `ProgressSaveIndicator`, `PositionConflictDialog`, `ReaderNavigationControls`, `ReaderHeader`, `ReaderContent`, `BookReader`
- Library: `BookGrid`, `LibraryHeader`, `LibrarySearch`, `LibraryPagination`
- Other: `ImageGallery`, `ImageModal`, `ReaderSettings`

### P2 - Medium Priority (Nice to Have) - 14 components
**Supporting functionality, less critical**

- UI: `Skeleton`, `ErrorMessage`, `LoadingSpinner`, `ParsingOverlay`, `AuthenticatedImage`
- Radix wrappers: `dropdown-menu`, `popover`, `progress`, `slider`, `tooltip`
- Reader: `BookInfo`, `ExtractionIndicator`, `SelectionMenu`, `ProgressIndicator`, `ReaderControls`
- Admin: `AdminHeader`, `AdminStats`, `AdminTabNavigation`, `AdminParsingSettings`
- Library: `LibraryStats`

### P3 - Low Priority (Could Have) - 3 components
**Legacy or rarely used**

- UI: `separator`
- Admin: `AdminMultiNLPSettings` (deprecated)

---

## Accessibility Testing Gaps

### Critical A11y Tests Needed

1. **Keyboard Navigation**
   - Button (Enter, Space)
   - Modal (Tab trap, ESC)
   - Dialog (Tab trap, ESC)
   - Navigation (Arrow keys, Tab)
   - Reader (Shortcuts)

2. **Screen Reader Support**
   - ARIA labels on all interactive components
   - ARIA roles (dialog, radiogroup, alert)
   - ARIA states (aria-invalid, aria-checked, aria-expanded)
   - Live regions for notifications
   - Form field associations (label → input)

3. **Focus Management**
   - Focus trap in Modal/Dialog/Drawer
   - Focus restoration on close
   - Visible focus indicators
   - Tab order

4. **Color Contrast**
   - All text meets WCAG AA (4.5:1)
   - Interactive elements meet WCAG AA (3:1)
   - Error states are not color-only

5. **Touch Targets**
   - Minimum 44x44px (Apple HIG)
   - Mobile-friendly spacing

---

## Recommended Test Implementation Order

### Phase 1: Critical Components (Week 1-2)
1. `Button` - Foundation for all interactions
2. `Modal` + `Dialog` - Critical user flows
3. `AuthGuard` - Security
4. `BottomNav` + `MobileDrawer` - Mobile navigation
5. `Header` + `Sidebar` - Desktop navigation

### Phase 2: Core Functionality (Week 3-4)
6. `Input` + `Select` + `Checkbox` + `Radio` - Forms
7. `EpubReader` - Reading experience (complex, needs mocking)
8. `ReaderToolbar` + `TocSidebar` + `ReaderSettingsPanel` - Reader UI
9. `BookCard` + `DeleteConfirmModal` - Library management

### Phase 3: Supporting Features (Week 5-6)
10. `NotificationContainer` - User feedback
11. `Card` + `Skeleton` - Layout components
12. Reader supporting components (ImageGenerationStatus, ProgressSaveIndicator, etc.)
13. Library components (BookGrid, LibraryHeader, etc.)

### Phase 4: Polish (Week 7)
14. Accessibility tests for all P0/P1 components
15. Integration tests for user flows
16. Edge cases and error scenarios

---

## Test Tools & Setup Required

### Testing Framework
- **Vitest** - Already configured
- **@testing-library/react** - Component testing
- **@testing-library/user-event** - User interactions
- **@testing-library/jest-dom** - DOM matchers

### Additional Tools Needed
1. **@testing-library/react-hooks** - For custom hooks
2. **msw** (Mock Service Worker) - API mocking
3. **@vitest/coverage-v8** - Coverage reporting
4. **axe-core/react** - Accessibility testing
5. **@faker-js/faker** - Test data generation

### Mocking Requirements
1. **epub.js** - Mock the entire library for EpubReader tests
2. **react-router-dom** - Mock navigation
3. **framer-motion** - Mock animations (optional, can use actual)
4. **localStorage** - Mock browser APIs
5. **IndexedDB** - Mock for offline features
6. **Zustand stores** - Mock state management

---

## Coverage Goals

### Minimum Coverage Targets
- **Overall Coverage:** 80%
- **P0 Components:** 90%+
- **P1 Components:** 80%+
- **P2 Components:** 60%+
- **Critical Paths:** 95%+

### Test Types Distribution
- **Unit Tests:** 60% (individual components)
- **Integration Tests:** 30% (component interactions)
- **Accessibility Tests:** 10% (a11y validation)

---

## Sample Test Structure

```typescript
// Example: Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Button } from './button';

expect.extend(toHaveNoViolations);

describe('Button', () => {
  describe('Variants', () => {
    it('renders primary variant by default', () => {
      render(<Button>Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toHaveClass('bg-[var(--color-accent-600)]');
    });

    it('renders all variants correctly', () => {
      const variants = ['primary', 'secondary', 'ghost', 'destructive', 'outline', 'link'];
      // Test each variant...
    });
  });

  describe('Sizes', () => {
    it('renders medium size by default', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button')).toHaveClass('h-11');
    });

    it('renders all sizes correctly', () => {
      // Test sm, md, lg, icon...
    });
  });

  describe('Loading State', () => {
    it('shows spinner when loading', () => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
    });

    it('disables button when loading', () => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('Interactions', () => {
    it('calls onClick when clicked', async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      await userEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('responds to keyboard (Enter)', async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole('button');
      button.focus();
      await userEvent.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<Button>Accessible Button</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports aria-label', () => {
      render(<Button aria-label="Close dialog">×</Button>);
      expect(screen.getByRole('button', { name: /close dialog/i })).toBeInTheDocument();
    });
  });
});
```

---

## Recommendations

### Immediate Actions
1. **Start with P0 components** - Focus on critical user paths
2. **Set up test infrastructure** - Install missing tools (msw, axe-core, etc.)
3. **Create test utilities** - Render helpers, mock factories, custom matchers
4. **Document test patterns** - Standardize testing approach across team

### Long-term Strategy
1. **Enforce test coverage** - Add pre-commit hooks for minimum coverage
2. **CI/CD integration** - Run tests on every PR
3. **Visual regression testing** - Consider Chromatic or Percy for visual tests
4. **E2E tests** - Add Playwright tests for critical user journeys
5. **Performance testing** - Test component render performance

### Test-Driven Development
- For NEW components: Write tests FIRST
- For EXISTING components: Follow recommended implementation order
- Aim for RED → GREEN → REFACTOR cycle

---

## Conclusion

The frontend codebase has **minimal test coverage** (1.9%) with only 1 out of 54 components having tests. This represents a **critical quality risk** for:

- **User Experience:** Untested interactive components can break without detection
- **Refactoring Safety:** Difficult to refactor without regression tests
- **Accessibility:** No validation of a11y requirements
- **Maintenance:** Hard to verify bug fixes

**Estimated Effort:**
- **Phase 1 (P0):** 40-60 hours (2-3 weeks)
- **Phase 2 (Core):** 60-80 hours (3-4 weeks)
- **Phase 3 (Supporting):** 40-50 hours (2-3 weeks)
- **Phase 4 (Polish):** 20-30 hours (1 week)
- **Total:** 160-220 hours (8-11 weeks for 1 engineer)

**Priority Recommendation:** Begin with Phase 1 (P0 components) immediately to cover critical user paths, then iterate through phases based on team capacity and release schedule.
