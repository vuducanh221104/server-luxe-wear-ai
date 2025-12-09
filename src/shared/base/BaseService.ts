/**
 * @file shared/base/BaseService.ts
 * @description Base service class with common patterns
 * Implements Repository Pattern foundation for all services
 */

import logger from "../../config/logger";
import { AppError, DatabaseError } from "../errors";

/**
 * Service operation result wrapper
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Base Service Class
 * Provides common functionality for all services
 */
export abstract class BaseService {
  protected readonly serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  /**
   * Log info with service context
   */
  protected logInfo(message: string, meta?: Record<string, unknown>): void {
    logger.info(message, { service: this.serviceName, ...meta });
  }

  /**
   * Log warning with service context
   */
  protected logWarn(message: string, meta?: Record<string, unknown>): void {
    logger.warn(message, { service: this.serviceName, ...meta });
  }

  /**
   * Log error with service context
   */
  protected logError(
    message: string,
    error?: Error | unknown,
    meta?: Record<string, unknown>
  ): void {
    logger.error(message, {
      service: this.serviceName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...meta,
    });
  }

  /**
   * Wrap async operation with error handling
   */
  protected async executeOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Record<string, unknown>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await operation();

      this.logInfo(`${operationName} completed`, {
        executionTime: Date.now() - startTime,
        ...context,
      });

      return result;
    } catch (error) {
      this.logError(`${operationName} failed`, error, {
        executionTime: Date.now() - startTime,
        ...context,
      });

      // Re-throw AppError as-is
      if (error instanceof AppError) {
        throw error;
      }

      // Wrap other errors
      throw new DatabaseError(operationName, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Create success result wrapper
   */
  protected success<T>(data: T): ServiceResult<T> {
    return { success: true, data };
  }

  /**
   * Create error result wrapper
   */
  protected failure<T>(error: string, code?: string): ServiceResult<T> {
    return { success: false, error, code };
  }

  /**
   * Build pagination metadata
   */
  protected buildPagination(
    total: number,
    page: number,
    limit: number
  ): PaginatedResult<never>["pagination"] {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * Normalize pagination options with defaults
   */
  protected normalizePagination(options: PaginationOptions): Required<PaginationOptions> {
    return {
      page: Math.max(1, options.page || 1),
      limit: Math.min(100, Math.max(1, options.limit || 10)),
      sortBy: options.sortBy || "created_at",
      sortOrder: options.sortOrder || "desc",
    };
  }
}
