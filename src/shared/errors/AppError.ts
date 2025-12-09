/**
 * @file shared/errors/AppError.ts
 * @description Custom error classes for better error handling and consistency
 * Following the Error Hierarchy pattern for clean error management
 */

import { HTTP_STATUS } from "../constants";

/**
 * Base Application Error
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: string = "INTERNAL_ERROR",
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly for instanceof to work correctly
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Convert error to JSON response format
   */
  toJSON(): Record<string, unknown> {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Validation Error - 400 Bad Request
 * Use for request validation failures
 */
export class ValidationError extends AppError {
  constructor(message: string = "Validation failed", details?: Record<string, unknown>) {
    super(message, HTTP_STATUS.BAD_REQUEST, "VALIDATION_ERROR", true, details);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Authentication Error - 401 Unauthorized
 * Use when user is not authenticated
 */
export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, HTTP_STATUS.UNAUTHORIZED, "AUTHENTICATION_ERROR", true);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Authorization Error - 403 Forbidden
 * Use when user doesn't have permission
 */
export class AuthorizationError extends AppError {
  constructor(message: string = "Access denied") {
    super(message, HTTP_STATUS.FORBIDDEN, "AUTHORIZATION_ERROR", true);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Not Found Error - 404
 * Use when resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, HTTP_STATUS.NOT_FOUND, "NOT_FOUND_ERROR", true);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Conflict Error - 409
 * Use for duplicate resources or state conflicts
 */
export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(message, HTTP_STATUS.CONFLICT, "CONFLICT_ERROR", true);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Rate Limit Error - 429
 * Use when rate limit is exceeded
 */
export class RateLimitError extends AppError {
  constructor(message: string = "Too many requests, please try again later") {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, "RATE_LIMIT_ERROR", true);
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * External Service Error - 503
 * Use for third-party service failures
 */
export class ExternalServiceError extends AppError {
  constructor(serviceName: string, originalError?: Error) {
    super(
      `External service error: ${serviceName}`,
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      "EXTERNAL_SERVICE_ERROR",
      true,
      originalError ? { originalMessage: originalError.message } : undefined
    );
    Object.setPrototypeOf(this, ExternalServiceError.prototype);
  }
}

/**
 * Database Error - 500
 * Use for database operation failures
 */
export class DatabaseError extends AppError {
  constructor(operation: string, originalError?: Error) {
    super(
      `Database error during ${operation}`,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "DATABASE_ERROR",
      true,
      originalError ? { originalMessage: originalError.message } : undefined
    );
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Convert unknown error to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR, "UNKNOWN_ERROR");
  }

  return new AppError(
    "An unexpected error occurred",
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    "UNKNOWN_ERROR"
  );
}
