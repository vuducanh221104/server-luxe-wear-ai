/**
 * @file auth.controller.ts
 * @description Authentication controller
 * Handles HTTP requests for authentication endpoints
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import * as authService from "../services/auth.service";
import { tenantService } from "../services/tenant.service";
import { successResponse, errorResponse } from "../utils/response";
import { handleAsyncOperationStrict } from "../utils/errorHandler";
import { UserTenantMembership } from "../types/tenant";

/**
 * Auth Controller Class
 * Object-based controller for authentication operations
 */
export class AuthController {
  /**
   * Register a new user
   * POST /api/auth/register
   */
  async register(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { email, password, name, role } = req.body;

        // Call service layer
        const result = await authService.register({ email, password, name, role });

        // Registration successful - return user info and tokens
        return successResponse(
          res,
          {
            user: {
              id: result.user.id,
              email: result.user.email,
              name: result.user.user_metadata?.name,
              emailConfirmedAt: result.user.email_confirmed_at,
            },
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            message: "Registration successful",
          },
          "Registration successful",
          201
        );
      },
      "register user",
      {
        context: {
          email: req.body?.email,
          name: req.body?.name,
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  async login(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { email, password } = req.body;

        // Call service layer
        const result = await authService.login({ email, password });

        // Use tenants from service (already includes default tenant creation)
        const userTenants = result.userTenants || [];

        return successResponse(
          res,
          {
            user: {
              id: result.user.id,
              email: result.user.email,
              name: result.user.user_metadata?.name,
            },
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            tenants: userTenants
              .filter((membership: UserTenantMembership) => membership.tenant)
              .map((membership: UserTenantMembership) => ({
                id: membership.tenant.id,
                name: membership.tenant.name,
                plan: membership.tenant.plan,
                status: membership.tenant.status,
                role: membership.role,
                joinedAt: membership.joinedAt,
              })),
          },
          "Login successful"
        );
      },
      "login user",
      {
        context: {
          email: req.body?.email,
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Logout user
   * POST /api/auth/logout
   */
  async logout(_req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        await authService.logout();

        return successResponse(res, null, "Logout successful");
      },
      "logout user",
      {
        context: {
          ip: _req.ip,
        },
      }
    );
  }

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  async refreshAccessToken(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { refreshToken } = req.body;

        // Call service layer
        const result = await authService.refreshToken(refreshToken);

        // Get user's tenants
        const userTenants = await tenantService.getUserTenants(result.user.id);

        return successResponse(
          res,
          {
            user: {
              id: result.user.id,
              email: result.user.email,
              name: result.user.user_metadata?.name,
            },
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            tenants: userTenants
              .filter((membership: UserTenantMembership) => membership.tenant) // Filter out undefined tenants
              .map((membership: UserTenantMembership) => ({
                id: membership.tenant.id,
                name: membership.tenant.name,
                plan: membership.tenant.plan,
                status: membership.tenant.status,
                role: membership.role,
                joinedAt: membership.joinedAt,
              })),
            defaultTenant: userTenants[0]?.tenant
              ? {
                  id: userTenants[0].tenant.id,
                  name: userTenants[0].tenant.name,
                  plan: userTenants[0].tenant.plan,
                }
              : null,
          },
          "Token refreshed successfully"
        );
      },
      "refresh access token",
      {
        context: {
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Request password reset
   * POST /api/auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { email } = req.body;

        await authService.forgotPassword(email);

        // Always return success even if email doesn't exist (security best practice)
        return successResponse(
          res,
          null,
          "If the email exists, a password reset link has been sent"
        );
      },
      "forgot password",
      {
        context: {
          email: req.body?.email,
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Reset password with token
   * POST /api/auth/reset-password
   */
  async resetPassword(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { password } = req.body;

        await authService.resetPassword(password);

        return successResponse(res, null, "Password reset successful");
      },
      "reset password",
      {
        context: {
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  async getCurrentUser(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
          return errorResponse(res, "No token provided", 401);
        }

        const user = await authService.verifyToken(token);

        return successResponse(
          res,
          {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name,
            createdAt: user.created_at,
          },
          "User retrieved successfully"
        );
      },
      "get current user",
      {
        context: {
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Verify access token
   * POST /api/auth/verify-token
   */
  async verifyToken(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const { access_token } = req.body;

        if (!access_token) {
          return errorResponse(res, "Access token is required", 400);
        }

        const user = await authService.verifyToken(access_token);

        return successResponse(
          res,
          {
            user: {
              id: user.id,
              email: user.email,
              name: user.user_metadata?.name || user.email?.split("@")[0],
              email_confirmed_at: user.email_confirmed_at,
              created_at: user.created_at,
            },
            authenticated: true,
          },
          "Token verified successfully"
        );
      },
      "verify token",
      {
        context: {
          ip: req.ip,
        },
      }
    );
  }
}

// Create and export controller instance
export const authController = new AuthController();

// Export individual methods for backward compatibility
export const {
  register,
  login,
  logout,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  verifyToken,
} = authController;

export default authController;
