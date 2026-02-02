/**
 * API Error Handling Utilities
 *
 * Provides centralized error types, classification, and retry logic
 * for all API calls in the app.
 */

// Error types for classification
export enum ApiErrorType {
  NETWORK = 'NETWORK',           // No internet connection
  TIMEOUT = 'TIMEOUT',           // Request timed out
  AUTH = 'AUTH',                 // Authentication failed
  VALIDATION = 'VALIDATION',     // Invalid request data
  NOT_FOUND = 'NOT_FOUND',       // Resource not found
  CONFLICT = 'CONFLICT',         // Resource conflict (e.g., duplicate)
  RATE_LIMIT = 'RATE_LIMIT',     // Too many requests
  SERVER = 'SERVER',             // Server error (5xx)
  UNKNOWN = 'UNKNOWN',           // Unknown error
}

export interface ApiError {
  type: ApiErrorType;
  message: string;
  code?: string;
  statusCode?: number;
  retryable: boolean;
  originalError?: Error;
}

/**
 * Classify an error into a specific ApiErrorType.
 */
export function classifyError(error: unknown): ApiError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes('network') ||
      message.includes('failed to fetch') ||
      message.includes('net::err') ||
      message.includes('no internet')
    ) {
      return {
        type: ApiErrorType.NETWORK,
        message: 'No internet connection. Please check your network and try again.',
        retryable: true,
        originalError: error,
      };
    }

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return {
        type: ApiErrorType.TIMEOUT,
        message: 'Request timed out. Please try again.',
        retryable: true,
        originalError: error,
      };
    }

    // Auth errors
    if (
      message.includes('unauthorized') ||
      message.includes('unauthenticated') ||
      message.includes('invalid token') ||
      message.includes('jwt')
    ) {
      return {
        type: ApiErrorType.AUTH,
        message: 'Your session has expired. Please sign in again.',
        retryable: false,
        originalError: error,
      };
    }
  }

  // Handle HTTP status codes if available
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    const status = err.status || err.statusCode;

    if (typeof status === 'number') {
      if (status === 401) {
        return {
          type: ApiErrorType.AUTH,
          message: 'Your session has expired. Please sign in again.',
          statusCode: status,
          retryable: false,
        };
      }
      if (status === 403) {
        return {
          type: ApiErrorType.AUTH,
          message: "You don't have permission to perform this action.",
          statusCode: status,
          retryable: false,
        };
      }
      if (status === 404) {
        return {
          type: ApiErrorType.NOT_FOUND,
          message: 'The requested resource was not found.',
          statusCode: status,
          retryable: false,
        };
      }
      if (status === 409) {
        return {
          type: ApiErrorType.CONFLICT,
          message: 'This action conflicts with existing data.',
          statusCode: status,
          retryable: false,
        };
      }
      if (status === 422) {
        return {
          type: ApiErrorType.VALIDATION,
          message: 'The provided data is invalid. Please check and try again.',
          statusCode: status,
          retryable: false,
        };
      }
      if (status === 429) {
        return {
          type: ApiErrorType.RATE_LIMIT,
          message: 'Too many requests. Please wait a moment and try again.',
          statusCode: status,
          retryable: true,
        };
      }
      if (status >= 500) {
        return {
          type: ApiErrorType.SERVER,
          message: 'Server error. Please try again later.',
          statusCode: status,
          retryable: true,
        };
      }
    }
  }

  return {
    type: ApiErrorType.UNKNOWN,
    message: 'An unexpected error occurred. Please try again.',
    retryable: true,
    originalError: error instanceof Error ? error : undefined,
  };
}

/**
 * Get a user-friendly error message for display.
 */
export function getErrorMessage(error: unknown): string {
  const classified = classifyError(error);
  return classified.message;
}

/**
 * Check if an error is retryable.
 */
export function isRetryable(error: unknown): boolean {
  const classified = classifyError(error);
  return classified.retryable;
}

/**
 * Calculate delay for exponential backoff retry.
 * @param attempt - The current attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @param maxDelay - Maximum delay in milliseconds (default: 30000)
 */
export function getRetryDelay(
  attempt: number,
  baseDelay = 1000,
  maxDelay = 30000
): number {
  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Retry configuration options.
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
};

/**
 * Execute an async function with automatic retry logic.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxAttempts, baseDelay, maxDelay, shouldRetry } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const shouldAttemptRetry = shouldRetry
        ? shouldRetry(error, attempt)
        : isRetryable(error);

      if (!shouldAttemptRetry || attempt >= maxAttempts - 1) {
        throw error;
      }

      const delay = getRetryDelay(attempt, baseDelay, maxDelay);

      if (__DEV__) {
        console.log(`Retry attempt ${attempt + 1}/${maxAttempts} after ${delay}ms`);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Create a timeout wrapper for promises.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage = 'Request timed out'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Default timeout for API requests (10 seconds).
 */
export const DEFAULT_TIMEOUT = 10000;
