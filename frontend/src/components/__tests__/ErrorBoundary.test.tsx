import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ErrorBoundary from '../ErrorBoundary';

// Компонент который намеренно выбрасывает ошибку
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  // Сохраняем оригинальные методы
  const originalError = console.error;
  const originalLocation = window.location;

  beforeEach(() => {
    // Подавляем console.error для тестов (чтобы не загрязнять вывод)
    console.error = vi.fn();

    // Мокируем window.location для тестирования reload и navigation
    // @ts-expect-error - необходимо для мокирования readonly свойства в тестах
    delete window.location;
    // @ts-expect-error - необходимо для мокирования readonly свойства в тестах
    window.location = { ...originalLocation, reload: vi.fn(), href: '' };
  });

  afterEach(() => {
    // Восстанавливаем оригинальные методы
    console.error = originalError;
    window.location = originalLocation;
    vi.clearAllMocks();
  });

  describe('Error Catching', () => {
    it('catches errors and displays fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Проверяем что отображается error UI
      expect(screen.getByText(/что-то пошло не так/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /перезагрузить/i })).toBeInTheDocument();
    });

    it('renders children when there is no error', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
      expect(screen.queryByText(/что-то пошло не так/i)).not.toBeInTheDocument();
    });

    it('logs error to console', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Error Levels', () => {
    it('displays app-level error UI correctly', () => {
      render(
        <ErrorBoundary level="app">
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/что-то пошло не так/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /перезагрузить страницу/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /на главную/i })).toBeInTheDocument();
    });

    it('displays page-level error UI correctly', () => {
      render(
        <ErrorBoundary level="page">
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/ошибка загрузки страницы/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /попробовать снова/i })).toBeInTheDocument();
    });

    it('displays component-level error UI correctly', () => {
      render(
        <ErrorBoundary level="component">
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/ошибка компонента/i)).toBeInTheDocument();
    });
  });

  describe('Custom Fallback', () => {
    it('renders custom fallback when provided', () => {
      const customFallback = <div>Custom error message</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
      expect(screen.queryByText(/что-то пошло не так/i)).not.toBeInTheDocument();
    });
  });

  describe('Error Reset', () => {
    it('reloads page when reset button clicked on app-level boundary', () => {
      render(
        <ErrorBoundary level="app">
          <ThrowError />
        </ErrorBoundary>
      );

      const resetButton = screen.getByRole('button', { name: /перезагрузить/i });
      fireEvent.click(resetButton);

      expect(window.location.reload).toHaveBeenCalled();
    });

    it('resets state when reset button clicked on component-level boundary', () => {
      render(
        <ErrorBoundary level="component">
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/ошибка компонента/i)).toBeInTheDocument();

      const resetButton = screen.getByRole('button', { name: /попробовать снова/i });
      fireEvent.click(resetButton);

      // State должен быть сброшен, но компонент все еще бросает ошибку
      // так что снова показывается error UI
      expect(screen.getByText(/ошибка компонента/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('navigates to home when home button clicked', () => {
      render(
        <ErrorBoundary level="app">
          <ThrowError />
        </ErrorBoundary>
      );

      const homeButton = screen.getByRole('button', { name: /на главную/i });
      fireEvent.click(homeButton);

      expect(window.location.href).toBe('/');
    });
  });

  describe('Error Callback', () => {
    it('calls onError callback when error is caught', () => {
      const onError = vi.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });
  });

  describe('Dev Mode Features', () => {
    it('shows error details in dev mode', () => {
      // В dev mode детали ошибки должны быть в details элементе
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      if (import.meta.env.DEV) {
        const detailsElement = screen.getByText(/детали ошибки/i);
        expect(detailsElement).toBeInTheDocument();

        // Проверяем что текст ошибки присутствует
        expect(screen.getByText(/Test error message/i)).toBeInTheDocument();
      }
    });
  });

  describe('Theme Support', () => {
    it('respects dark theme from localStorage', () => {
      localStorage.setItem('theme', 'dark');

      const { container } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Проверяем что применяется темная тема (через inline styles)
      const errorContainer = container.querySelector('.error-boundary-container');
      expect(errorContainer).toHaveStyle({ backgroundColor: '#1a1a1a' });

      localStorage.removeItem('theme');
    });

    it('respects light theme from localStorage', () => {
      localStorage.setItem('theme', 'light');

      const { container } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const errorContainer = container.querySelector('.error-boundary-container');
      expect(errorContainer).toHaveStyle({ backgroundColor: '#ffffff' });

      localStorage.removeItem('theme');
    });
  });
});
