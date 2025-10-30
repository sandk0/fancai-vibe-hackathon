import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'app' | 'page' | 'component';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - компонент для отлова и обработки ошибок в React дереве
 *
 * Поддерживает:
 * - Graceful error handling без краша всего приложения
 * - Красивый UI для error state
 * - Кнопка "Попробовать снова" для reset state
 * - Логирование ошибок в консоль/сервис
 * - Error details (stacktrace) в dev mode
 * - Разные уровни границ (app, page, component)
 *
 * @example
 * // App level - ловит все ошибки приложения
 * <ErrorBoundary level="app">
 *   <App />
 * </ErrorBoundary>
 *
 * @example
 * // Component level - локальная защита критичной секции
 * <ErrorBoundary
 *   level="component"
 *   fallback={<p>Не удалось загрузить книгу</p>}
 * >
 *   <EpubReader />
 * </ErrorBoundary>
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Обновляет state при возникновении ошибки
   */
  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  /**
   * Вызывается после того как ошибка была поймана
   * Используется для логирования и отправки в сервисы мониторинга
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { level = 'app', onError } = this.props;

    // Логируем с информацией об уровне границы
    console.error(`[ErrorBoundary:${level}] Caught error:`, {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });

    this.setState({
      error,
      errorInfo
    });

    // Вызываем callback если передан
    if (onError) {
      onError(error, errorInfo);
    }

    // TODO: Интеграция с error tracking сервисами
    // if (import.meta.env.PROD) {
    //   // Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    //   // LogRocket.captureException(error);
    // }
  }

  /**
   * Сброс error state и попытка повторного рендера
   */
  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Reload page для app-level границы (более надежный reset)
    if (this.props.level === 'app') {
      window.location.reload();
    }
  };

  /**
   * Возврат на главную страницу (для app-level)
   */
  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, level = 'app' } = this.props;

    if (hasError) {
      // Кастомный fallback UI если передан
      if (fallback) {
        return fallback;
      }

      // Получаем тему из localStorage для правильного отображения
      const isDarkTheme = localStorage.getItem('theme') === 'dark';
      const bgColor = isDarkTheme ? '#1a1a1a' : '#ffffff';
      const textColor = isDarkTheme ? '#e5e5e5' : '#1a1a1a';
      const borderColor = isDarkTheme ? '#333' : '#e5e5e5';
      const cardBg = isDarkTheme ? '#2a2a2a' : '#f9f9f9';

      // Разные UI для разных уровней
      const isAppLevel = level === 'app';
      const isPageLevel = level === 'page';

      return (
        <div
          className="error-boundary-container"
          style={{
            backgroundColor: bgColor,
            color: textColor,
            minHeight: isAppLevel ? '100vh' : 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
          }}
        >
          <div
            className="error-boundary-content"
            style={{
              maxWidth: isAppLevel ? '600px' : '100%',
              width: '100%',
              textAlign: 'center',
            }}
          >
            {/* Error Icon */}
            <div
              style={{
                fontSize: isAppLevel ? '4rem' : '3rem',
                marginBottom: '1.5rem',
              }}
            >
              {isAppLevel ? '💥' : '⚠️'}
            </div>

            {/* Error Title */}
            <h1
              style={{
                fontSize: isAppLevel ? '2rem' : '1.5rem',
                fontWeight: 'bold',
                marginBottom: '1rem',
                color: textColor,
              }}
            >
              {isAppLevel && 'Упс! Что-то пошло не так'}
              {isPageLevel && 'Ошибка загрузки страницы'}
              {!isAppLevel && !isPageLevel && 'Ошибка компонента'}
            </h1>

            {/* Error Message */}
            <p
              style={{
                fontSize: '1rem',
                marginBottom: '2rem',
                color: isDarkTheme ? '#999' : '#666',
                lineHeight: '1.6',
              }}
            >
              {isAppLevel && 'Приносим извинения за неудобства. Пожалуйста, попробуйте обновить страницу или вернуться на главную.'}
              {isPageLevel && 'Не удалось загрузить содержимое страницы. Попробуйте обновить или вернуться назад.'}
              {!isAppLevel && !isPageLevel && 'Возникла ошибка при отображении этого компонента.'}
            </p>

            {/* Error Details (только в dev mode) */}
            {import.meta.env.DEV && error && (
              <details
                style={{
                  marginBottom: '2rem',
                  textAlign: 'left',
                  backgroundColor: cardBg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '8px',
                  padding: '1rem',
                  overflow: 'auto',
                }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    fontWeight: '600',
                    marginBottom: '0.5rem',
                    color: '#ef4444',
                  }}
                >
                  🔍 Детали ошибки (dev mode)
                </summary>

                <div style={{ marginTop: '1rem' }}>
                  <p style={{
                    fontWeight: '600',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                  }}>
                    Error:
                  </p>
                  <pre
                    style={{
                      backgroundColor: isDarkTheme ? '#1a1a1a' : '#fff',
                      padding: '0.75rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      overflow: 'auto',
                      border: `1px solid ${borderColor}`,
                      marginBottom: '1rem',
                    }}
                  >
                    {error.toString()}
                  </pre>

                  {errorInfo?.componentStack && (
                    <>
                      <p style={{
                        fontWeight: '600',
                        marginBottom: '0.5rem',
                        fontSize: '0.875rem',
                      }}>
                        Component Stack:
                      </p>
                      <pre
                        style={{
                          backgroundColor: isDarkTheme ? '#1a1a1a' : '#fff',
                          padding: '0.75rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          overflow: 'auto',
                          border: `1px solid ${borderColor}`,
                          maxHeight: '200px',
                        }}
                      >
                        {errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              </details>
            )}

            {/* Action Buttons */}
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={this.handleReset}
                style={{
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {isAppLevel ? '🔄 Перезагрузить страницу' : '🔄 Попробовать снова'}
              </button>

              {isAppLevel && (
                <button
                  onClick={this.handleGoHome}
                  style={{
                    backgroundColor: isDarkTheme ? '#374151' : '#f3f4f6',
                    color: textColor,
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    border: `1px solid ${borderColor}`,
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkTheme ? '#4b5563' : '#e5e7eb';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkTheme ? '#374151' : '#f3f4f6';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  🏠 На главную
                </button>
              )}
            </div>

            {/* Help Text */}
            {isAppLevel && (
              <p
                style={{
                  marginTop: '2rem',
                  fontSize: '0.875rem',
                  color: isDarkTheme ? '#666' : '#999',
                }}
              >
                Если проблема повторяется, пожалуйста, обратитесь в поддержку
              </p>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
