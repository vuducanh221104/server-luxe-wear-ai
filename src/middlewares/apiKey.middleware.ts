/**
 * @file apiKey.middleware.ts
 * @description API key authentication middleware for public agent access
 * Validates API keys for external website integration
 */

import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase";
import { errorResponse } from "../utils/response";
import { isValidApiKeyFormat } from "../utils/apiKey";
import logger from "../config/logger";
import { Tables } from "../types/database";

/**
 * Extend Express Request to include agent for API key auth
 */
declare module "express-serve-static-core" {
  interface Request {
    agent?: Tables<"agents">;
  }
}

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
