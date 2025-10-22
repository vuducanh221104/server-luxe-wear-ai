/**
 * @file oauth.controller.ts
 * @description OAuth authentication controller
 * Handles OAuth callbacks and token generation for social logins
 */

import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { successResponse, errorResponse } from "../utils/response";
import { handleAsyncOperationStrict } from "../utils/errorHandler";
import logger from "../config/logger";
import { User } from "../types/user";

/**
 * OAuth Controller Class
 * Object-based controller for OAuth operations
 */
export class OAuthController {
  /**
   * Google OAuth callback handler
   * GET /api/auth/google/callback
   * @access Public (called by Google)
   */
  async googleCallback(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        logger.error("Google OAuth callback: No user in request");
        res.redirect(
          `${process.env.FRONTEND_URL || "http://localhost:3000"}/login?error=auth_failed`
        );
        return;
      }

      const user = req.user as User;

      // Generate JWT tokens for the user
      const { token, refreshToken } = await authService.generateTokens(user.id);

      logger.info("Google OAuth successful", {
        userId: user.id,
        email: user.email,
      });

      // Redirect to frontend with tokens
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/auth/callback?token=${token}&refreshToken=${refreshToken}`);
    } catch (error) {
      logger.error("Google OAuth callback error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/login?error=server_error`);
    }
  }

  /**
   * GitHub OAuth callback handler
   * GET /api/auth/github/callback
   * @access Public (called by GitHub)
   */
  async githubCallback(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        logger.error("GitHub OAuth callback: No user in request");
        res.redirect(
          `${process.env.FRONTEND_URL || "http://localhost:3000"}/login?error=auth_failed`
        );
        return;
      }

      const user = req.user as User;

      // Generate JWT tokens for the user
      const { token, refreshToken } = await authService.generateTokens(user.id);

      logger.info("GitHub OAuth successful", {
        userId: user.id,
        email: user.email,
      });

      // Redirect to frontend with tokens
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/auth/callback?token=${token}&refreshToken=${refreshToken}`);
    } catch (error) {
      logger.error("GitHub OAuth callback error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/login?error=server_error`);
    }
  }

  /**
   * OAuth failure handler
   * GET /api/auth/oauth/failure
   * @access Public
   */
  async oauthFailure(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        logger.warn("OAuth authentication failed", {
          query: req.query,
          ip: req.ip,
        });

        return errorResponse(res, "OAuth authentication failed", 401);
      },
      "oauth failure",
      {
        context: {
          ip: req.ip,
          query: req.query,
        },
      }
    );
  }

  /**
   * Get available OAuth providers
   * GET /api/auth/oauth/providers
   * @access Public
   */
  async getProviders(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const providers = [];

        // Check which OAuth providers are configured
        if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
          providers.push({
            name: "google",
            displayName: "Google",
            authUrl: "/api/auth/google",
          });
        }

        if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
          providers.push({
            name: "github",
            displayName: "GitHub",
            authUrl: "/api/auth/github",
          });
        }

        return successResponse(
          res,
          {
            providers,
            count: providers.length,
          },
          "OAuth providers retrieved successfully"
        );
      },
      "get oauth providers",
      {
        context: {
          ip: req.ip,
        },
      }
    );
  }
}

// Create and export controller instance
export const oauthController = new OAuthController();

// Export individual methods for backward compatibility
export const { googleCallback, githubCallback, oauthFailure, getProviders } = oauthController;

export default oauthController;
