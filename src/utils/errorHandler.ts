/**
 * @file errorHandler.ts
 * @description Generic error handling utilities
 * Provides reusable error handling patterns for async operations
 */

import logger from "../config/logger";

/**
 * Error handling options
 */
export interface ErrorHandlerOptions {
  /** Custom error message prefix */
  messagePrefix?: string;
  /** Whether to log the error */
  shouldLog?: boolean;
  /** Custom logger context */
  context?: Record<string, unknown>;
  /** Whether to re-throw the error */
  shouldThrow?: boolean;
}

/**
 * Generic error handler wrapper for async operations
 * @param operation - The async operation to execute
 * @param operationName - Name of the operation for logging
 * @param fallbackValue - Fallback value if operation fails (optional)
 * @param options - Error handling options
 * @returns Result of the operation or fallback value
 */
export async function handleAsyncOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  fallbackValue?: T,
  options: ErrorHandlerOptions = {}
): Promise<T> {
  const {
    messagePrefix = "Failed to",
    shouldLog = true,
    context = {},
    shouldThrow = true,
  } = options;

  try {
    return await operation();
  } catch (error) {
    const errorMessage = `${messagePrefix} ${operationName}`;
    const errorDetails = {
      error: error instanceof Error ? error.message : "Unknown error",
      operation: operationName,
      ...context,
    };

    if (shouldLog) {
      logger.error(errorMessage, errorDetails);
    }

    if (fallbackValue !== undefined) {
      return fallbackValue;
    }

    if (shouldThrow) {
      throw error; // Throw original error instead of creating new one
    }

    // If not throwing and no fallback, return undefined (for void operations)
    return undefined as T;
  }
}

/**
 * Error handler for operations that should always throw on failure
 * @param operation - The async operation to execute
 * @param operationName - Name of the operation for logging
 * @param options - Error handling options
 * @returns Result of the operation
 */
export async function handleAsyncOperationStrict<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: ErrorHandlerOptions = {}
): Promise<T> {
  return handleAsyncOperation(operation, operationName, undefined, {
    shouldThrow: true,
    ...options,
  });
}

/**
 * Error handler for operations that should return fallback value on failure
 * @param operation - The async operation to execute
 * @param operationName - Name of the operation for logging
 * @param fallbackValue - Fallback value if operation fails
 * @param options - Error handling options
 * @returns Result of the operation or fallback value
 */
export async function handleAsyncOperationWithFallback<T>(
  operation: () => Promise<T>,
  operationName: string,
  fallbackValue: T,
  options: ErrorHandlerOptions = {}
): Promise<T> {
  return handleAsyncOperation(operation, operationName, fallbackValue, {
    shouldThrow: false,
    ...options,
  });
}

/**
 * Error handler for void operations (no return value)
 * @param operation - The async operation to execute
 * @param operationName - Name of the operation for logging
 * @param options - Error handling options
 */
export async function handleVoidOperation(
  operation: () => Promise<void>,
  operationName: string,
  options: ErrorHandlerOptions = {}
): Promise<void> {
  await handleAsyncOperation(operation, operationName, undefined, {
    shouldThrow: true,
    ...options,
  });
}

/**
 * Retry wrapper with exponential backoff
 * @param operation - The async operation to execute
 * @param operationName - Name of the operation for logging
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in milliseconds
 * @param options - Error handling options
 * @returns Result of the operation
 */
export async function handleAsyncOperationWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  options: ErrorHandlerOptions = {}
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        // Last attempt failed
        const errorMessage = `${options.messagePrefix || "Failed to"} ${operationName} after ${maxRetries + 1} attempts`;

        if (options.shouldLog !== false) {
          logger.error(errorMessage, {
            error: lastError.message,
            operation: operationName,
            attempts: maxRetries + 1,
            ...options.context,
          });
        }

        if (options.shouldThrow !== false) {
          throw new Error(errorMessage);
        }

        return undefined as T;
      }

      // Wait before retry with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn(`Retrying ${operationName} in ${delay}ms`, {
        attempt: attempt + 1,
        maxRetries,
        error: lastError.message,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return undefined as T;
}

/**
 * Batch error handler for multiple operations
 * @param operations - Array of operations to execute
 * @param operationName - Name of the batch operation for logging
 * @param options - Error handling options
 * @returns Array of results (successful operations only)
 */
export async function handleBatchOperations<T>(
  operations: Array<() => Promise<T>>,
  operationName: string,
  options: ErrorHandlerOptions = {}
): Promise<T[]> {
  const results: T[] = [];
  const errors: Error[] = [];

  for (let i = 0; i < operations.length; i++) {
    try {
      const result = await operations[i]();
      results.push(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);

      logger.warn(`Operation ${i + 1} in ${operationName} failed`, {
        error: err.message,
        operationIndex: i,
        ...options.context,
      });
    }
  }

  if (errors.length > 0 && options.shouldLog !== false) {
    logger.error(`Batch ${operationName} completed with ${errors.length} failures`, {
      totalOperations: operations.length,
      successfulOperations: results.length,
      failedOperations: errors.length,
      ...options.context,
    });
  }

  return results;
}
