/**
 * Error handling utilities for TypeScript strict mode
 */

/**
 * Extract error message from unknown error type
 * @param error - Unknown error object
 * @param defaultMessage - Default message if error has no message
 * @returns Error message string
 */
export function getErrorMessage(error: unknown, defaultMessage = 'An error occurred'): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    // Check for Axios-style error response
    if ('response' in error) {
      const axiosError = error as { response?: { data?: { detail?: string; message?: string } } };
      return axiosError.response?.data?.detail || axiosError.response?.data?.message || defaultMessage;
    }

    // Check for message property
    if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
      return (error as { message: string }).message;
    }
  }

  return defaultMessage;
}

/**
 * Check if value is an Error instance
 * @param error - Value to check
 * @returns True if value is Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard for Axios-style errors
 */
export interface AxiosStyleError {
  response?: {
    data?: {
      detail?: string;
      message?: string;
      error?: string;
    };
    status?: number;
  };
  message?: string;
}

/**
 * Check if error is Axios-style error
 * @param error - Unknown error
 * @returns True if error has Axios response structure
 */
export function isAxiosStyleError(error: unknown): error is AxiosStyleError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  );
}
