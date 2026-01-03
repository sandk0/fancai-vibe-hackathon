import { useState } from 'react';
import ErrorBoundary from './ErrorBoundary';

/**
 * Демонстрационный компонент для визуального тестирования ErrorBoundary
 *
 * Используйте этот компонент для проверки работы ErrorBoundary в dev mode
 *
 * @example
 * // Добавьте в HomePage для тестирования:
 * import { ErrorBoundaryDemo } from '@/components/ErrorBoundaryDemo';
 * // ...
 * <ErrorBoundaryDemo />
 */

// Компонент который бросает ошибку при shouldThrow=true
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Демонстрационная ошибка для тестирования ErrorBoundary');
  }
  return (
    <div className="p-4 bg-green-100 border border-green-400 rounded-lg">
      <p className="text-green-800 font-semibold">✅ Компонент работает без ошибок</p>
    </div>
  );
};

export const ErrorBoundaryDemo = () => {
  const [shouldThrowApp, setShouldThrowApp] = useState(false);
  const [shouldThrowPage, setShouldThrowPage] = useState(false);
  const [shouldThrowComponent, setShouldThrowComponent] = useState(false);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="bg-card rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">ErrorBoundary Demo</h2>
        <p className="text-muted-foreground mb-6">
          Нажмите на кнопки чтобы вызвать ошибки на разных уровнях ErrorBoundary
        </p>

        {/* App Level ErrorBoundary Demo */}
        <div className="mb-6 p-4 border border-border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">1. App-Level ErrorBoundary</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Перехватывает ошибки на уровне всего приложения (main.tsx)
          </p>
          <button
            onClick={() => setShouldThrowApp(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            💥 Вызвать App-Level ошибку
          </button>
          <div className="mt-3">
            <ErrorBoundary level="app">
              <ThrowError shouldThrow={shouldThrowApp} />
            </ErrorBoundary>
          </div>
        </div>

        {/* Page Level ErrorBoundary Demo */}
        <div className="mb-6 p-4 border border-border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">2. Page-Level ErrorBoundary</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Перехватывает ошибки на уровне страницы (BookReaderPage)
          </p>
          <button
            onClick={() => setShouldThrowPage(true)}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            ⚠️ Вызвать Page-Level ошибку
          </button>
          <div className="mt-3">
            <ErrorBoundary level="page">
              <ThrowError shouldThrow={shouldThrowPage} />
            </ErrorBoundary>
          </div>
        </div>

        {/* Component Level ErrorBoundary Demo */}
        <div className="mb-6 p-4 border border-border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">3. Component-Level ErrorBoundary</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Перехватывает ошибки отдельного компонента (локальная защита)
          </p>
          <button
            onClick={() => setShouldThrowComponent(true)}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            🔸 Вызвать Component-Level ошибку
          </button>
          <div className="mt-3">
            <ErrorBoundary level="component">
              <ThrowError shouldThrow={shouldThrowComponent} />
            </ErrorBoundary>
          </div>
        </div>

        {/* Custom Fallback Demo */}
        <div className="mb-6 p-4 border border-border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">4. Custom Fallback UI</h3>
          <p className="text-sm text-muted-foreground mb-3">
            ErrorBoundary с кастомным fallback компонентом
          </p>
          <div className="mt-3">
            <ErrorBoundary
              fallback={
                <div className="p-4 bg-purple-100 dark:bg-purple-900 border border-purple-400 rounded-lg">
                  <p className="text-purple-800 dark:text-purple-200 font-semibold">
                    🎨 Кастомный Fallback UI
                  </p>
                  <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">
                    Вы можете создать любой fallback UI для вашего компонента
                  </p>
                </div>
              }
            >
              <ThrowError shouldThrow={true} />
            </ErrorBoundary>
          </div>
        </div>

        {/* Reset Button */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            onClick={() => {
              setShouldThrowApp(false);
              setShouldThrowPage(false);
              setShouldThrowComponent(false);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔄 Сбросить все ошибки
          </button>
        </div>

        {/* Info */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">ℹ️ Информация</h4>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• В dev mode показываются детали ошибки (stacktrace)</li>
            <li>• В production детали скрыты для безопасности</li>
            <li>• Каждый уровень boundary показывает свой UI</li>
            <li>• Кнопка "Попробовать снова" сбрасывает error state</li>
            <li>• App-level boundary перезагружает всю страницу</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ErrorBoundaryDemo;
