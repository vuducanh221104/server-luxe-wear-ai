/**
 * @file admin.middleware.ts
 * @description Admin authorization middleware
 * Checks if user has admin privileges for system operations
 */

import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/response";
import logger from "../config/logger";

/**
 * Admin authorization middleware
 * Requires user to be authenticated and have admin role
 * Should be used after authMiddleware
 */
export const adminMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    // Check if user is authenticated (should be set by authMiddleware)
    if (!req.user) {
      return errorResponse(res, "Authentication required", 401);
    }

    // Check if user has admin role
    // Note: This assumes user metadata contains role information
    const userMetadata = req.user.user_metadata || {};
    const userRole = userMetadata.role || req.user.role;

    if (userRole !== "admin" && userRole !== "super_admin") {
      logger.warn("Unauthorized admin access attempt", {
        userId: req.user.id,
        email: req.user.email,
        role: userRole,
        path: req.path,
        method: req.method,
      });

      return errorResponse(res, "Admin privileges required", 403);
    }

    logger.info("Admin access granted", {
      userId: req.user.id,
      email: req.user.email,
      role: userRole,
      path: req.path,
      method: req.method,
    });

    // User has admin privileges, continue
    next();
  } catch (error) {
    logger.error("Admin middleware error", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: req.user?.id,
      path: req.path,
    });

    return errorResponse(res, "Authorization failed", 500);
  }
};

/**
 * Super admin middleware (for highest level operations)
 * Requires user to have super_admin role
 */
export const superAdminMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    if (!req.user) {
      return errorResponse(res, "Authentication required", 401);
    }

    const userMetadata = req.user.user_metadata || {};
    const userRole = userMetadata.role || req.user.role;

    if (userRole !== "super_admin") {
      logger.warn("Unauthorized super admin access attempt", {
        userId: req.user.id,
        email: req.user.email,
        role: userRole,
        path: req.path,
      });

      return errorResponse(res, "Super admin privileges required", 403);
    }

    next();
  } catch (error) {
    logger.error("Super admin middleware error", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId: req.user?.id,
    });

    return errorResponse(res, "Authorization failed", 500);
  }
};
