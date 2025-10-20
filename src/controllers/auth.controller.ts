/**
 * @file auth.controller.ts
 * @description Authentication controller using custom users table
 * Handles HTTP requests for authentication endpoints
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { authService } from "../services/auth.service";
import { userService } from "../services/user.service";
import { successResponse, errorResponse } from "../utils/response";
import { handleAsyncOperationStrict } from "../utils/errorHandler";

/**
 * Auth Controller Class
 * Object-based controller for authentication operations using custom users
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

        const { email, password, name } = req.body;

        // Call service layer
        const result = await authService.register({ email, password, name });

        // Registration successful - return user info and tokens
        return successResponse(
          res,
          {
            user: {
              id: result.user.id,
              email: result.user.email,
              name: result.user.name,
              role: result.user.role,
              is_active: result.user.is_active,
              email_verified: result.user.email_verified,
            },
            token: result.token,
            refreshToken: result.refreshToken,
            message: result.message,
          },
          "Registration successful",
          201
        );
      },
      "register user",
      {
        context: {
          email: req.body?.email,
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

        // Get user memberships for tenant context
        const memberships = await userService.getUserMemberships(result.user.id);

        // Login successful - return user info and tokens
        return successResponse(
          res,
          {
            user: {
              id: result.user.id,
              email: result.user.email,
              name: result.user.name,
              role: result.user.role,
              is_active: result.user.is_active,
              email_verified: result.user.email_verified,
              last_login: result.user.last_login,
            },
            token: result.token,
            refreshToken: result.refreshToken,
            message: result.message,
            tenants: memberships.map((membership) => ({
              id: membership.tenant_id,
              role: membership.role,
              status: membership.status,
              joined_at: membership.joined_at,
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
  async logout(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        if (!req.user?.id) {
          return errorResponse(res, "User not authenticated", 401);
        }

        // Call service layer
        const result = await authService.logout(req.user.id);

        return successResponse(res, result, "Logout successful");
      },
      "logout user",
      {
        context: {
          userId: req.user?.id,
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  async refreshToken(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { refreshToken } = req.body;

        if (!refreshToken) {
          return errorResponse(res, "Refresh token is required", 400);
        }

        // Call service layer
        const result = await authService.refreshToken(refreshToken);

        return successResponse(
          res,
          {
            token: result.token,
            message: "Token refreshed successfully",
          },
          "Token refreshed successfully"
        );
      },
      "refresh token",
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
        if (!req.user?.id) {
          return errorResponse(res, "User not authenticated", 401);
        }

        // Get user with memberships
        const userWithMemberships = await userService.getUserWithMemberships(req.user.id);

        return successResponse(
          res,
          {
            user: {
              id: userWithMemberships.id,
              email: userWithMemberships.email,
              name: userWithMemberships.name,
              avatar_url: userWithMemberships.avatar_url,
              phone: userWithMemberships.phone,
              website: userWithMemberships.website,
              role: userWithMemberships.role,
              preferences: userWithMemberships.preferences,
              is_active: userWithMemberships.is_active,
              email_verified: userWithMemberships.email_verified,
              last_login: userWithMemberships.last_login,
              created_at: userWithMemberships.created_at,
              updated_at: userWithMemberships.updated_at,
            },
            memberships: userWithMemberships.memberships.map((membership) => ({
              id: membership.id,
              tenant_id: membership.tenant_id,
              role: membership.role,
              status: membership.status,
              joined_at: membership.joined_at,
            })),
          },
          "User profile retrieved successfully"
        );
      },
      "get current user",
      {
        context: {
          userId: req.user?.id,
        },
      }
    );
  }

  /**
   * Change user password
   * POST /api/auth/change-password
   */
  async changePassword(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user?.id) {
          return errorResponse(res, "User not authenticated", 401);
        }

        const { currentPassword, newPassword } = req.body;

        // Call service layer
        const result = await authService.changePassword(req.user.id, currentPassword, newPassword);

        return successResponse(res, result, "Password changed successfully");
      },
      "change password",
      {
        context: {
          userId: req.user?.id,
        },
      }
    );
  }

  /**
   * Reset user password (admin only)
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

        if (!req.user?.id) {
          return errorResponse(res, "User not authenticated", 401);
        }

        // Check if user has admin privileges
        if (!["admin", "owner", "super_admin"].includes(req.user.role)) {
          return errorResponse(res, "Admin access required", 403);
        }

        const { userId, newPassword } = req.body;

        // Call service layer
        const result = await authService.resetPassword(userId, newPassword);

        return successResponse(res, result, "Password reset successfully");
      },
      "reset password",
      {
        context: {
          adminUserId: req.user?.id,
          targetUserId: req.body?.userId,
        },
      }
    );
  }

  /**
   * Verify email address
   * POST /api/auth/verify-email
   */
  async verifyEmail(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { token } = req.body;
        const result = await authService.refreshToken(token);

        // In a real implementation, you would verify the email token
        // For now, we'll just return a success message
        return successResponse(res, { token: result.token }, "Token refreshed successfully");
      },
      "verify email",
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

        // In a real implementation, you would send a password reset email
        // For now, we'll just return a success message
        return successResponse(
          res,
          { message: "Password reset email sent (not implemented yet)" },
          "Password reset requested"
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
   * Verify token endpoint
   * @param req - Express request
   * @param res - Express response
   * @returns Response with user data
   */
  async verifyToken(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const { token } = req.body;

        if (!token) {
          return errorResponse(res, "Token is required", 400);
        }

        const user = await authService.verifyToken(token);

        return successResponse(
          res,
          {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              is_active: user.is_active,
              email_verified: user.email_verified,
            },
          },
          "Token verified successfully"
        );
      },
      "verify token",
      {
        context: {
          ip: req.ip,
          userAgent: req.get("User-Agent"),
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
  refreshToken,
  getCurrentUser,
  changePassword,
  resetPassword,
  verifyEmail,
  forgotPassword,
  verifyToken,
} = authController;

export default authController;
