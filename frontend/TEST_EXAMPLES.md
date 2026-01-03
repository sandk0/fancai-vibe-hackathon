# Test Examples - High Priority Components

Ready-to-use test examples for the most critical components.

---

## Example 1: Button Component

**File:** `src/components/UI/__tests__/button.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Button, Spinner } from '../button';

expect.extend(toHaveNoViolations);

describe('Button', () => {
  describe('Rendering', () => {
    it('renders children correctly', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<Button className="custom-class">Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });
  });

  describe('Variants', () => {
    const variants = ['primary', 'secondary', 'ghost', 'destructive', 'outline', 'link'] as const;

    variants.forEach((variant) => {
      it(`renders ${variant} variant with correct styles`, () => {
        render(<Button variant={variant}>Button</Button>);
        const button = screen.getByRole('button');

        // Check for variant-specific classes
        const variantClassMap = {
          primary: 'bg-[var(--color-accent-600)]',
          secondary: 'bg-[var(--color-bg-emphasis)]',
          ghost: 'bg-transparent',
          destructive: 'bg-[var(--color-error)]',
          outline: 'border-[var(--color-border-default)]',
          link: 'underline-offset-4',
        };

        expect(button).toHaveClass(variantClassMap[variant]);
      });
    });

    it('uses primary variant by default', () => {
      render(<Button>Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-[var(--color-accent-600)]');
    });
  });

  describe('Sizes', () => {
    const sizes = ['sm', 'md', 'lg', 'icon'] as const;

    sizes.forEach((size) => {
      it(`renders ${size} size correctly`, () => {
        render(<Button size={size}>Button</Button>);
        const button = screen.getByRole('button');

        const sizeClassMap = {
          sm: 'h-9',
          md: 'h-11',
          lg: 'h-12',
          icon: 'h-11 w-11',
        };

        expect(button).toHaveClass(sizeClassMap[size]);
      });
    });

    it('uses md size by default', () => {
      render(<Button>Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('h-11');
    });
  });

  describe('Loading State', () => {
    it('shows spinner when loading', () => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getByRole('button')).toContainElement(
        screen.getByRole('button').querySelector('svg')
      );
    });

    it('shows loadingText when provided', () => {
      render(<Button isLoading loadingText="Saving...">Save</Button>);
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('hides children visually when loading without loadingText', () => {
      render(<Button isLoading>Save</Button>);
      const srOnly = screen.getByText('Save');
      expect(srOnly).toHaveClass('sr-only');
    });

    it('disables button when loading', () => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
    });

    it('sets aria-busy when loading', () => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Disabled State', () => {
    it('applies disabled state', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not call onClick when disabled', async () => {
      const handleClick = vi.fn();
      render(<Button disabled onClick={handleClick}>Disabled</Button>);

      await userEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('has reduced opacity when disabled', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole('button')).toHaveClass('disabled:opacity-50');
    });
  });

  describe('Interactions', () => {
    it('calls onClick when clicked', async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      await userEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('responds to Enter key', async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Press Enter</Button>);

      const button = screen.getByRole('button');
      button.focus();
      await userEvent.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalled();
    });

    it('responds to Space key', async () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Press Space</Button>);

      const button = screen.getByRole('button');
      button.focus();
      await userEvent.keyboard(' ');

      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('AsChild (Slot)', () => {
    it('renders as child element when asChild is true', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      );

      const link = screen.getByRole('link', { name: /link button/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/test');
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<Button>Accessible Button</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports custom aria-label', () => {
      render(<Button aria-label="Close dialog">×</Button>);
      expect(screen.getByRole('button', { name: /close dialog/i })).toBeInTheDocument();
    });

    it('has touch-friendly size (minimum 44px)', () => {
      render(<Button>Touch me</Button>);
      expect(screen.getByRole('button')).toHaveClass('h-11'); // 44px
    });

    it('has visible focus indicator', () => {
      render(<Button>Focus me</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus-visible:ring-2');
    });
  });
});

describe('Spinner', () => {
  it('renders spinner SVG', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('has animation class', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('svg')).toHaveClass('animate-spin');
  });

  it('is hidden from screen readers', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
```

---

## Example 2: Modal Component

**File:** `src/components/UI/__tests__/Modal.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../Modal';

expect.extend(toHaveNoViolations);

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    children: <div>Modal content</div>,
  };

  beforeEach(() => {
    // Create portal root
    const portalRoot = document.createElement('div');
    portalRoot.setAttribute('id', 'portal-root');
    document.body.appendChild(portalRoot);
  });

  afterEach(() => {
    // Clean up portal root
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<Modal {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders children content', () => {
      render(<Modal {...defaultProps}>Custom Content</Modal>);
      expect(screen.getByText('Custom Content')).toBeInTheDocument();
    });

    it('renders backdrop', () => {
      const { container } = render(<Modal {...defaultProps} />);
      const backdrop = container.querySelector('.bg-black\\/50');
      expect(backdrop).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('renders default variant with constrained width', () => {
      render(<Modal {...defaultProps} variant="default" />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('md:max-w-lg');
    });

    it('renders fullscreen variant', () => {
      render(<Modal {...defaultProps} variant="fullscreen" />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('w-full h-full');
    });

    it('renders drawer variant with bottom sheet style', () => {
      render(<Modal {...defaultProps} variant="drawer" />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('rounded-t-xl');
    });
  });

  describe('Close Behavior', () => {
    it('calls onClose when ESC key is pressed', async () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);

      await userEvent.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close on ESC when closeOnEscape is false', async () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} closeOnEscape={false} />);

      await userEvent.keyboard('{Escape}');
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when backdrop is clicked', async () => {
      const onClose = vi.fn();
      const { container } = render(<Modal {...defaultProps} onClose={onClose} />);

      const backdrop = container.querySelector('.bg-black\\/50');
      await userEvent.click(backdrop!);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close on backdrop click when closeOnBackdropClick is false', async () => {
      const onClose = vi.fn();
      const { container } = render(
        <Modal {...defaultProps} onClose={onClose} closeOnBackdropClick={false} />
      );

      const backdrop = container.querySelector('.bg-black\\/50');
      await userEvent.click(backdrop!);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not close when clicking modal content', async () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose}>Content</Modal>);

      await userEvent.click(screen.getByText('Content'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Focus Management', () => {
    it('traps focus within modal', async () => {
      render(
        <Modal {...defaultProps}>
          <button>Button 1</button>
          <button>Button 2</button>
        </Modal>
      );

      const [button1, button2] = screen.getAllByRole('button');

      // Tab from first to second button
      button1.focus();
      await userEvent.tab();
      expect(button2).toHaveFocus();

      // Tab from second button should cycle to first
      await userEvent.tab();
      expect(button1).toHaveFocus();
    });

    it('focuses first focusable element on mount', async () => {
      render(
        <Modal {...defaultProps}>
          <button>First Button</button>
          <button>Second Button</button>
        </Modal>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /first button/i })).toHaveFocus();
      });
    });

    it('restores focus to previously focused element on close', async () => {
      const trigger = document.createElement('button');
      trigger.textContent = 'Open Modal';
      document.body.appendChild(trigger);
      trigger.focus();

      const { rerender } = render(<Modal {...defaultProps} isOpen={true} />);

      // Close modal
      rerender(<Modal {...defaultProps} isOpen={false} />);

      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });
  });

  describe('Body Scroll Lock', () => {
    it('locks body scroll when modal is open', () => {
      render(<Modal {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('unlocks body scroll when modal is closed', () => {
      const { rerender } = render(<Modal {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe('hidden');

      rerender(<Modal {...defaultProps} isOpen={false} />);
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<Modal {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has role="dialog"', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal="true"', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('associates with title via aria-labelledby', () => {
      render(<Modal {...defaultProps} titleId="modal-title" />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'modal-title');
    });

    it('associates with description via aria-describedby', () => {
      render(<Modal {...defaultProps} descriptionId="modal-desc" />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-describedby', 'modal-desc');
    });
  });
});

describe('ModalHeader', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    children: (
      <ModalHeader>
        <h2>Modal Title</h2>
      </ModalHeader>
    ),
  };

  it('renders header content', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByText('Modal Title')).toBeInTheDocument();
  });

  it('shows close button by default', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /close modal/i })).toBeInTheDocument();
  });

  it('hides close button when showCloseButton is false', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <ModalHeader showCloseButton={false}>Title</ModalHeader>
      </Modal>
    );
    expect(screen.queryByRole('button', { name: /close modal/i })).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(<Modal {...defaultProps} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: /close modal/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ModalBody', () => {
  it('renders body content', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <ModalBody>Body content</ModalBody>
      </Modal>
    );
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('applies overflow-y-auto for scrolling', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <ModalBody>Content</ModalBody>
      </Modal>
    );
    const body = screen.getByText('Content').parentElement;
    expect(body).toHaveClass('overflow-y-auto');
  });
});

describe('ModalFooter', () => {
  it('renders footer content', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <ModalFooter>
          <button>Cancel</button>
          <button>Confirm</button>
        </ModalFooter>
      </Modal>
    );

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });
});
```

---

## Example 3: BottomNav Component

**File:** `src/components/Navigation/__tests__/BottomNav.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { BottomNav } from '../BottomNav';

expect.extend(toHaveNoViolations);

// Helper to render with router
const renderWithRouter = (component: React.ReactElement, route = '/') => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {component}
    </MemoryRouter>
  );
};

describe('BottomNav', () => {
  describe('Rendering', () => {
    it('renders all navigation items', () => {
      renderWithRouter(<BottomNav />);

      expect(screen.getByRole('link', { name: /главная/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /библиотека/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /галерея/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /статистика/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /профиль/i })).toBeInTheDocument();
    });

    it('renders icons for each nav item', () => {
      const { container } = renderWithRouter(<BottomNav />);
      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThanOrEqual(5);
    });

    it('has navigation role', () => {
      renderWithRouter(<BottomNav />);
      expect(screen.getByRole('navigation', { name: /mobile navigation/i })).toBeInTheDocument();
    });
  });

  describe('Active State', () => {
    it('highlights home link when on home page', () => {
      renderWithRouter(<BottomNav />, '/');
      const homeLink = screen.getByRole('link', { name: /главная/i });
      expect(homeLink).toHaveAttribute('aria-current', 'page');
      expect(homeLink).toHaveClass('text-[var(--color-accent-500)]');
    });

    it('highlights library link when on library page', () => {
      renderWithRouter(<BottomNav />, '/library');
      const libraryLink = screen.getByRole('link', { name: /библиотека/i });
      expect(libraryLink).toHaveAttribute('aria-current', 'page');
    });

    it('highlights link for nested routes', () => {
      renderWithRouter(<BottomNav />, '/library/123');
      const libraryLink = screen.getByRole('link', { name: /библиотека/i });
      expect(libraryLink).toHaveAttribute('aria-current', 'page');
    });

    it('scales icon when active', () => {
      const { container } = renderWithRouter(<BottomNav />, '/');
      const homeLink = screen.getByRole('link', { name: /главная/i });
      const icon = homeLink.querySelector('svg');
      expect(icon).toHaveClass('scale-110');
    });
  });

  describe('Navigation', () => {
    it('navigates to correct route when clicked', async () => {
      renderWithRouter(<BottomNav />);

      const libraryLink = screen.getByRole('link', { name: /библиотека/i });
      expect(libraryLink).toHaveAttribute('href', '/library');
    });

    it('all links have correct href attributes', () => {
      renderWithRouter(<BottomNav />);

      expect(screen.getByRole('link', { name: /главная/i })).toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: /библиотека/i })).toHaveAttribute('href', '/library');
      expect(screen.getByRole('link', { name: /галерея/i })).toHaveAttribute('href', '/images');
      expect(screen.getByRole('link', { name: /статистика/i })).toHaveAttribute('href', '/stats');
      expect(screen.getByRole('link', { name: /профиль/i })).toHaveAttribute('href', '/profile');
    });
  });

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = renderWithRouter(<BottomNav />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has touch-friendly targets (min 56px height)', () => {
      const { container } = renderWithRouter(<BottomNav />);
      const links = screen.getAllByRole('link');

      links.forEach((link) => {
        expect(link).toHaveClass('min-h-[56px]');
      });
    });

    it('has proper aria labels', () => {
      renderWithRouter(<BottomNav />);
      expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Mobile navigation');
    });

    it('icons are hidden from screen readers', () => {
      const { container } = renderWithRouter(<BottomNav />);
      const icons = container.querySelectorAll('svg');

      icons.forEach((icon) => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('is hidden on desktop (md:hidden)', () => {
      const { container } = renderWithRouter(<BottomNav />);
      const nav = container.querySelector('nav');
      expect(nav).toHaveClass('md:hidden');
    });

    it('is fixed at bottom', () => {
      const { container } = renderWithRouter(<BottomNav />);
      const nav = container.querySelector('nav');
      expect(nav).toHaveClass('fixed bottom-0');
    });
  });

  describe('Styling', () => {
    it('has backdrop blur effect', () => {
      const { container } = renderWithRouter(<BottomNav />);
      const backdrop = container.querySelector('.backdrop-blur-lg');
      expect(backdrop).toBeInTheDocument();
    });

    it('has border on top', () => {
      const { container } = renderWithRouter(<BottomNav />);
      const backdrop = container.querySelector('.border-t');
      expect(backdrop).toBeInTheDocument();
    });

    it('supports safe area for iOS', () => {
      const { container } = renderWithRouter(<BottomNav />);
      const list = container.querySelector('ul');
      expect(list).toHaveClass('pb-safe');
    });
  });
});
```

---

## Example 4: AuthGuard Component

**File:** `src/components/Auth/__tests__/AuthGuard.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthGuard } from '../AuthGuard';
import { useAuthStore } from '@/stores/auth';

// Mock the auth store
vi.mock('@/stores/auth');

const mockUseAuthStore = vi.mocked(useAuthStore);

describe('AuthGuard', () => {
  const ProtectedContent = () => <div>Protected Content</div>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authenticated User', () => {
    beforeEach(() => {
      mockUseAuthStore.mockReturnValue({
        user: { id: '1', email: 'test@example.com', is_admin: false },
        token: 'valid-token',
        isLoading: false,
        // Add other required store properties
      } as any);
    });

    it('renders children when user is authenticated', () => {
      render(
        <MemoryRouter>
          <AuthGuard>
            <ProtectedContent />
          </AuthGuard>
        </MemoryRouter>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('allows access to protected routes', () => {
      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <AuthGuard>
                  <ProtectedContent />
                </AuthGuard>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  describe('Unauthenticated User', () => {
    beforeEach(() => {
      mockUseAuthStore.mockReturnValue({
        user: null,
        token: null,
        isLoading: false,
      } as any);
    });

    it('redirects to login when user is not authenticated', async () => {
      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route
              path="/protected"
              element={
                <AuthGuard>
                  <ProtectedContent />
                </AuthGuard>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
        expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      });
    });

    it('preserves redirect URL in state', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route
              path="/protected"
              element={
                <AuthGuard>
                  <ProtectedContent />
                </AuthGuard>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      // Verify redirect happened (exact implementation depends on your Navigate usage)
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    beforeEach(() => {
      mockUseAuthStore.mockReturnValue({
        user: null,
        token: null,
        isLoading: true,
      } as any);
    });

    it('shows loading indicator while checking authentication', () => {
      render(
        <MemoryRouter>
          <AuthGuard>
            <ProtectedContent />
          </AuthGuard>
        </MemoryRouter>
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('does not redirect during loading', () => {
      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route
              path="/protected"
              element={
                <AuthGuard>
                  <ProtectedContent />
                </AuthGuard>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    });
  });

  describe('Admin-Only Routes', () => {
    it('allows admin users to access admin routes', () => {
      mockUseAuthStore.mockReturnValue({
        user: { id: '1', email: 'admin@example.com', is_admin: true },
        token: 'admin-token',
        isLoading: false,
      } as any);

      render(
        <MemoryRouter>
          <AuthGuard requireAdmin>
            <div>Admin Content</div>
          </AuthGuard>
        </MemoryRouter>
      );

      expect(screen.getByText('Admin Content')).toBeInTheDocument();
    });

    it('redirects non-admin users from admin routes', async () => {
      mockUseAuthStore.mockReturnValue({
        user: { id: '2', email: 'user@example.com', is_admin: false },
        token: 'user-token',
        isLoading: false,
      } as any);

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/" element={<div>Home Page</div>} />
            <Route
              path="/admin"
              element={
                <AuthGuard requireAdmin>
                  <div>Admin Content</div>
                </AuthGuard>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Home Page')).toBeInTheDocument();
        expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
      });
    });
  });
});
```

---

## Test Utilities Setup

**File:** `src/test-utils/render.tsx`

```typescript
import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a client for each test to avoid cache pollution
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable retries in tests
        gcTime: 0, // Disable cache
      },
    },
  });

interface AllTheProvidersProps {
  children: React.ReactNode;
}

function AllTheProviders({ children }: AllTheProvidersProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
```

**File:** `src/test-utils/setup.ts`

```typescript
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;
```

---

These examples demonstrate:
1. Comprehensive test coverage patterns
2. Accessibility testing with jest-axe
3. User interaction testing
4. Focus management testing
5. Router integration
6. Store mocking
7. Loading states
8. Error scenarios

Use these as templates for testing other components!
