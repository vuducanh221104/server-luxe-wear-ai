/**
 * @file shared/base/BaseController.ts
 * @description Base controller class with common patterns
 * Provides standardized request handling for all controllers
 */

import { Request, Response, NextFunction } from "express";
import { validationResult, ValidationError as ExpressValidationError } from "express-validator";
import { successResponse, errorResponse } from "../../utils/response";
import { ValidationError, AuthenticationError, isAppError } from "../errors";
import { HTTP_STATUS } from "../constants";
import logger from "../../config/logger";

/**
 * User info attached to authenticated requests
 */
interface RequestUser {
  id: string;
  email: string;
  role: string;
  tenantId?: string;
}

/**
 * Authenticated request with user info
 * Using Omit to avoid conflict with express-serve-static-core User type
 */
export interface AuthenticatedRequest extends Omit<Request, "user"> {
  user?: RequestUser;
}

/**
 * Controller method type
 */
export type ControllerMethod = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<Response | void>;

/**
 * Base Controller Class
 * Provides common functionality for all controllers
 */
export abstract class BaseController {
  protected readonly controllerName: string;

  constructor(controllerName: string) {
    this.controllerName = controllerName;
  }

  /**
   * Validate request and throw ValidationError if invalid
   */
  protected validateRequest(req: Request): void {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map((err: ExpressValidationError) => ({
        field: "path" in err ? err.path : "unknown",
        message: err.msg,
      }));

      throw new ValidationError("Validation failed", { errors: formattedErrors });
    }
  }

  /**
   * Get authenticated user or throw AuthenticationError
   */
  protected getAuthenticatedUser(
    req: AuthenticatedRequest
  ): NonNullable<AuthenticatedRequest["user"]> {
    if (!req.user?.id) {
      throw new AuthenticationError("User not authenticated");
    }
    return req.user as NonNullable<AuthenticatedRequest["user"]>;
  }

  /**
   * Get tenant ID from request or throw AuthenticationError
   */
  protected getTenantId(req: AuthenticatedRequest): string {
    const tenantId = req.headers["x-tenant-id"] as string;
    if (!tenantId) {
      throw new AuthenticationError("Tenant ID required");
    }
    return tenantId;
  }

  /**
   * Wrap controller method with error handling
   * Use this to wrap async controller methods
   */
  protected wrapAsync(handler: ControllerMethod): ControllerMethod {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      try {
        return await handler(req, res, next);
      } catch (error) {
        const executionTime = Date.now() - startTime;

        // Log error with context
        logger.error(`${this.controllerName} error`, {
          controller: this.controllerName,
          method: req.method,
          path: req.path,
          userId: req.user?.id,
          executionTime,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Handle AppError (our custom errors)
        if (isAppError(error)) {
          return errorResponse(
            res,
            error.message,
            error.statusCode,
            error.details ? [error.details] : undefined
          );
        }

        // Handle unknown errors
        const message = error instanceof Error ? error.message : "An unexpected error occurred";
        return errorResponse(res, message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
      }
    };
  }

  /**
   * Send success response with standard format
   */
  protected sendSuccess<T>(
    res: Response,
    data: T,
    message: string = "Success",
    statusCode: number = HTTP_STATUS.OK
  ): Response {
    return successResponse(res, data, message, statusCode);
  }

  /**
   * Send created response (201)
   */
  protected sendCreated<T>(
    res: Response,
    data: T,
    message: string = "Created successfully"
  ): Response {
    return successResponse(res, data, message, HTTP_STATUS.CREATED);
  }

  /**
   * Send no content response (204)
   */
  protected sendNoContent(res: Response): Response {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }

  /**
   * Send error response
   */
  protected sendError(
    res: Response,
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errors?: unknown[]
  ): Response {
    return errorResponse(res, message, statusCode, errors);
  }

  /**
   * Get pagination params from query
   */
  protected getPaginationParams(req: Request): { page: number; limit: number } {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
    return { page, limit };
  }
}
