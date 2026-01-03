# Test Priority Roadmap - Quick Reference

## Current State
- **Test Coverage:** 1.9% (1/54 components)
- **Risk Level:** 🔴 CRITICAL
- **Immediate Action Required:** YES

---

## Top 10 Priority Components (Start Here)

### Week 1: Foundation Components (P0)
1. **Button** (`src/components/UI/button.tsx`)
   - **Why:** Most used component, foundation for all interactions
   - **Tests:** Variants, sizes, loading state, keyboard navigation, a11y
   - **Estimated Time:** 4-6 hours

2. **Modal** (`src/components/UI/Modal.tsx`)
   - **Why:** Critical for dialogs, focus management, accessibility
   - **Tests:** Open/close, focus trap, ESC key, backdrop click, portal
   - **Estimated Time:** 6-8 hours

3. **Dialog** (`src/components/UI/Dialog.tsx`)
   - **Why:** Confirmation flows, destructive actions
   - **Tests:** Variants, callbacks, loading state, icons
   - **Estimated Time:** 4-5 hours

4. **AuthGuard** (`src/components/Auth/AuthGuard.tsx`)
   - **Why:** Security-critical, controls access
   - **Tests:** Authentication checks, redirects, loading
   - **Estimated Time:** 2-3 hours

### Week 2: Navigation (P0)
5. **BottomNav** (`src/components/Navigation/BottomNav.tsx`)
   - **Why:** Primary mobile navigation
   - **Tests:** Route highlighting, touch targets, navigation
   - **Estimated Time:** 3-4 hours

6. **MobileDrawer** (`src/components/Navigation/MobileDrawer.tsx`)
   - **Why:** Mobile menu with complex interactions
   - **Tests:** Open/close, focus trap, scroll lock, logout
   - **Estimated Time:** 6-8 hours

7. **Header** (`src/components/Layout/Header.tsx`)
   - **Why:** Main navigation, user menu
   - **Tests:** Menu interactions, theme switcher, upload
   - **Estimated Time:** 4-5 hours

8. **Sidebar** (`src/components/Layout/Sidebar.tsx`)
   - **Why:** Desktop navigation, state persistence
   - **Tests:** Collapsed state, localStorage, route highlighting
   - **Estimated Time:** 4-5 hours

### Week 3-4: Forms & Reader (P0)
9. **Input** (`src/components/UI/Input.tsx`)
   - **Why:** Form foundation, complex variants
   - **Tests:** Variants, sizes, icons, errors, ARIA
   - **Estimated Time:** 5-6 hours

10. **Select** (`src/components/UI/Select.tsx`)
    - **Why:** Form controls, accessibility
    - **Tests:** Options, variants, keyboard navigation
    - **Estimated Time:** 4-5 hours

---

## Quick Win: Component Groups

### Group A: Form Controls (12 hours)
- Button, Input, Select
- **Impact:** Enables form testing across app
- **Blockers:** None

### Group B: Navigation (18 hours)
- BottomNav, MobileDrawer, Header, Sidebar
- **Impact:** Core app navigation
- **Blockers:** AuthGuard tests

### Group C: Dialogs (15 hours)
- Modal, Dialog, DeleteConfirmModal
- **Impact:** User confirmation flows
- **Blockers:** Button tests

---

## Test Infrastructure Setup (Before Starting)

### Install Dependencies
```bash
npm install -D @testing-library/react-hooks msw @faker-js/faker axe-core jest-axe
```

### Create Test Utilities
1. **`src/test-utils/render.tsx`** - Custom render with providers
2. **`src/test-utils/mocks.ts`** - Mock factories for stores, API
3. **`src/test-utils/matchers.ts`** - Custom matchers
4. **`src/test-utils/setup.ts`** - Global test setup

### Configure MSW (API Mocking)
```typescript
// src/test-utils/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

---

## Test Template (Copy-Paste Ready)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ComponentName } from './ComponentName';

expect.extend(toHaveNoViolations);

describe('ComponentName', () => {
  // Setup
  const defaultProps = {
    // Define default props
  };

  const renderComponent = (props = {}) => {
    return render(<ComponentName {...defaultProps} {...props} />);
  };

  // Tests
  describe('Rendering', () => {
    it('renders without crashing', () => {
      renderComponent();
      expect(screen.getByRole('...')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('handles click events', async () => {
      const onClick = vi.fn();
      renderComponent({ onClick });

      await userEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderComponent();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
```

---

## Coverage Checkpoints

### Week 1 Target: 15%
- ✅ Button
- ✅ Modal
- ✅ Dialog
- ✅ AuthGuard

### Week 2 Target: 30%
- ✅ Previous +
- ✅ BottomNav
- ✅ MobileDrawer
- ✅ Header
- ✅ Sidebar

### Week 4 Target: 50%
- ✅ Previous +
- ✅ Input, Select, Checkbox, Radio
- ✅ BookCard, DeleteConfirmModal
- ✅ NotificationContainer

### Week 8 Target: 80%
- ✅ All P0 and P1 components
- ✅ Integration tests for user flows
- ✅ Accessibility tests

---

## Accessibility Testing Checklist

For each component, verify:

- [ ] **Keyboard Navigation**
  - Tab navigation works
  - Enter/Space trigger actions
  - ESC closes modals/menus
  - Arrow keys for lists/options

- [ ] **Screen Reader Support**
  - All interactive elements have labels
  - ARIA roles are correct
  - ARIA states update dynamically
  - Live regions for notifications

- [ ] **Focus Management**
  - Focus trap in modals/dialogs
  - Focus restoration on close
  - Visible focus indicators
  - Logical tab order

- [ ] **Color & Contrast**
  - Text contrast ≥ 4.5:1 (WCAG AA)
  - Interactive elements ≥ 3:1
  - Don't rely on color alone

- [ ] **Touch Targets**
  - Minimum 44x44px (Apple HIG)
  - Adequate spacing between targets

---

## Common Testing Patterns

### 1. Testing Variants
```typescript
const variants = ['primary', 'secondary', 'ghost'];
variants.forEach(variant => {
  it(`renders ${variant} variant`, () => {
    render(<Button variant={variant}>Text</Button>);
    expect(screen.getByRole('button')).toHaveClass(`variant-${variant}`);
  });
});
```

### 2. Testing User Interactions
```typescript
it('handles form submission', async () => {
  const onSubmit = vi.fn();
  render(<Form onSubmit={onSubmit} />);

  await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
  await userEvent.click(screen.getByRole('button', { name: /submit/i }));

  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith({ email: 'test@example.com' });
  });
});
```

### 3. Testing Async States
```typescript
it('shows loading state', async () => {
  const promise = Promise.resolve();
  render(<AsyncComponent promise={promise} />);

  expect(screen.getByText('Loading...')).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
});
```

### 4. Testing Accessibility
```typescript
it('has proper ARIA attributes', () => {
  render(<Dialog isOpen={true} title="Delete" />);

  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(dialog).toHaveAttribute('aria-labelledby', expect.stringContaining('dialog-title'));
});
```

### 5. Testing Keyboard Navigation
```typescript
it('closes on ESC key', async () => {
  const onClose = vi.fn();
  render(<Modal isOpen={true} onClose={onClose} />);

  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalled();
});
```

---

## Red Flags (DO NOT Ship Without Tests)

### Critical User Paths
1. **Authentication Flow** - AuthGuard, Login, Logout
2. **Book Upload** - File upload, parsing, validation
3. **Reading Flow** - Open book, navigate chapters, save progress
4. **Delete Book** - Confirmation dialog, data deletion
5. **Settings Changes** - Reader settings, theme changes

### Security-Critical Components
1. **AuthGuard** - Access control
2. **DeleteConfirmModal** - Data safety
3. **LogoutButton** - Session management

### High-Complexity Components
1. **EpubReader** - epub.js integration, CFI tracking
2. **Modal/Dialog** - Focus management, accessibility
3. **MobileDrawer** - Focus trap, scroll lock

---

## Success Metrics

### Coverage Targets
- **Lines:** 80%+
- **Branches:** 75%+
- **Functions:** 85%+
- **Statements:** 80%+

### Quality Indicators
- [ ] All P0 components have tests
- [ ] All critical user paths tested
- [ ] No accessibility violations (axe)
- [ ] All forms validated
- [ ] All modals/dialogs tested for focus management

### CI/CD Integration
- [ ] Tests run on every PR
- [ ] Coverage reports generated
- [ ] Failing tests block merges
- [ ] Pre-commit hooks enforce test quality

---

## Resources

### Testing Library Docs
- [React Testing Library](https://testing-library.com/react)
- [User Event](https://testing-library.com/docs/user-event/intro)
- [jest-axe](https://github.com/nickcolley/jest-axe)

### Best Practices
- [Common Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Testing Playground](https://testing-playground.com/)
- [Accessibility Testing](https://www.a11yproject.com/)

### Tools
- [Vitest](https://vitest.dev/)
- [MSW](https://mswjs.io/)
- [Faker.js](https://fakerjs.dev/)

---

## Next Steps

1. **Review this roadmap** with the team
2. **Set up test infrastructure** (dependencies, utilities)
3. **Start with Week 1 components** (Button, Modal, Dialog, AuthGuard)
4. **Create PR with first tests** to establish patterns
5. **Iterate weekly** following the roadmap

**Questions?** Refer to `/Users/sandk/Documents/GitHub/fancai-vibe-hackathon/frontend/TEST_COVERAGE_AUDIT.md` for detailed component analysis.
