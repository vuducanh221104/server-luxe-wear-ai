/**
 * @file auth.middleware.ts
 * @description Authentication and authorization middleware
 * Includes: JWT auth, admin role check, and API key auth
 */

import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { errorResponse } from "../utils/response";
import logger from "../config/logger";
import { User } from "../types/user";
import { supabaseAdmin } from "../config/supabase";
import { isValidApiKeyFormat } from "../utils/apiKey";
import { Tables } from "../types/database";

/**
 * Extend Express Request to include user and agent
 */
declare module "express-serve-static-core" {
  interface Request {
    user?: User;
    agent?: Tables<"agents">;
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

// ============================================================================
// ADMIN AUTHORIZATION
// ============================================================================

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
    const userRole = req.user.role;

    if (userRole !== "admin" && userRole !== "owner" && userRole !== "super_admin") {
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

    const userRole = req.user.role;

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

// ============================================================================
// API KEY AUTHENTICATION
// ============================================================================

/**
 * API key authentication middleware
 * Validates API key and attaches agent to request object
 * Used for public agent access from external websites
 */
export const apiKeyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    // Extract API key from headers
    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
      return errorResponse(res, "API key is required. Include 'X-API-Key' header.", 401);
    }

    // Validate API key format
    if (!isValidApiKeyFormat(apiKey)) {
      return errorResponse(res, "Invalid API key format", 401);
    }

    // Find agent by API key
    const { data: agent, error } = await supabaseAdmin
      .from("agents")
      .select("*")
      .eq("api_key", apiKey)
      .eq("is_public", true) // Only public agents can be accessed via API key
      .single();

    if (error || !agent) {
      logger.warn("Invalid API key attempt", {
        apiKey: apiKey.substring(0, 8) + "...", // Log partial key for security
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      return errorResponse(res, "Invalid API key or agent not found", 401);
    }

    // Check allowed origins if configured
    if (agent.allowed_origins && agent.allowed_origins.length > 0) {
      const origin = req.get("Origin") || req.get("Referer");

      if (!origin) {
        return errorResponse(res, "Origin header is required for this agent", 403);
      }

      const isAllowedOrigin = agent.allowed_origins.some((allowedOrigin: string) => {
        // Support wildcard matching
        if (allowedOrigin === "*") return true;
        if (allowedOrigin.includes("*")) {
          const regex = new RegExp(allowedOrigin.replace(/\*/g, ".*"));
          return regex.test(origin);
        }
        return origin.includes(allowedOrigin);
      });

      if (!isAllowedOrigin) {
        logger.warn("Origin not allowed for agent", {
          agentId: agent.id,
          origin,
          allowedOrigins: agent.allowed_origins,
        });
        return errorResponse(res, "Origin not allowed for this agent", 403);
      }
    }

    // Attach agent to request object
    req.agent = agent;

    logger.info("API key authentication successful", {
      agentId: agent.id,
      agentName: agent.name,
      origin: req.get("Origin"),
    });

    // Continue to next middleware
    next();
  } catch (error) {
    logger.error("API key middleware error", {
      error: error instanceof Error ? error.message : "Unknown error",
      path: req.path,
    });

    return errorResponse(res, "Authentication failed", 500);
  }
};

/**
 * Optional API key middleware
 * Attaches agent to request if API key is valid, but doesn't block request if no key
 * Useful for endpoints that can work with or without agent context
 */
export const optionalApiKeyMiddleware = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers["x-api-key"] as string;

    if (apiKey && isValidApiKeyFormat(apiKey)) {
      try {
        const { data: agent } = await supabaseAdmin
          .from("agents")
          .select("*")
          .eq("api_key", apiKey)
          .eq("is_public", true)
          .single();

        if (agent) {
          req.agent = agent;
          logger.debug("Optional API key authentication successful", {
            agentId: agent.id,
          });
        }
      } catch (error) {
        // API key is invalid, but we don't block the request
        logger.debug("Optional API key failed, continuing without agent", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    next();
  } catch (error) {
    // Even if there's an error, we continue without agent
    logger.debug("Optional API key middleware error, continuing", { error });
    next();
  }
};
