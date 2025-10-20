/**
 * @file auth.middleware.ts
 * @description Authentication middleware for protected routes
 * Verifies JWT tokens and attaches user to request
 */

import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { errorResponse } from "../utils/response";
import logger from "../config/logger";
import { User } from "../types/user";

/**
 * Extend Express Request to include user
 */
declare module "express-serve-static-core" {
  interface Request {
    user?: User;
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request object
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    logger.debug("Auth middleware - Headers:", {
      authorization: authHeader,
      path: req.path,
    });

    if (!authHeader) {
      return errorResponse(res, "No authorization header provided", 401);
    }

    // Check for Bearer token format
    if (!authHeader.startsWith("Bearer ")) {
      return errorResponse(res, "Invalid authorization header format. Use 'Bearer <token>'", 401);
    }

    // Extract token
    const token = authHeader.split(" ")[1];

    if (!token) {
      return errorResponse(res, "No token provided", 401);
    }

    // Verify token and get user
    const user = await authService.verifyToken(token);

    // Attach user to request object
    req.user = user;

    // Continue to next middleware
    next();
  } catch (error) {
    logger.error("Auth middleware error", {
      error: error instanceof Error ? error.message : "Unknown error",
      path: req.path,
    });

    return errorResponse(
      res,
      error instanceof Error ? error.message : "Authentication failed",
      401
    );
  }
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't block request if no token
 */
export const optionalAuthMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];

      if (token) {
        try {
          const user = await authService.verifyToken(token);
          req.user = user;
        } catch (error) {
          // Token is invalid, but we don't block the request
          logger.debug("Optional auth failed, continuing without user", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    next();
  } catch (error) {
    // Even if there's an error, we continue without user
    logger.debug("Optional auth middleware error, continuing", { error });
    next();
  }
};
