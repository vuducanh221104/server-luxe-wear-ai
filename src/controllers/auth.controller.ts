/**
 * @file auth.controller.ts
 * @description Authentication controller using custom users table
 * Handles HTTP requests for authentication endpoints
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { authService } from "../services/auth.service";
import { tokenService } from "../services/token.service";
import { userService } from "../services/user.service";
import { successResponse, errorResponse } from "../utils/response";
import { handleControllerOperation } from "../utils/errorHandler";

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
    return handleControllerOperation(
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
      res,
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
    return handleControllerOperation(
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
      res,
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
    return handleControllerOperation(
      async () => {
        if (!req.user?.id) {
          return errorResponse(res, "User not authenticated", 401);
        }

        // Call service layer
        const result = await authService.logout(req.user.id);

        return successResponse(res, result, "Logout successful");
      },
      "logout user",
      res,
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
    return handleControllerOperation(
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
      res,
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
    return handleControllerOperation(
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
      res,
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
    return handleControllerOperation(
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
      res,
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
    return handleControllerOperation(
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
      res,
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
    return handleControllerOperation(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { token } = req.body;

        // Validate email verification token
        const tokenRecord = await tokenService.validateToken(token, "email_verification");
        if (!tokenRecord) {
          return errorResponse(res, "Invalid or expired verification token", 400);
        }

        // Mark user's email as verified
        const user = await authService.getUserById(tokenRecord.user_id);
        if (!user) {
          return errorResponse(res, "User not found", 404);
        }

        if (!user.email_verified) {
          await authService.updateUser(user.id, { email_verified: true });
        }

        // Revoke used token
        await tokenService.revokeToken(token, "email_verification");

        return successResponse(
          res,
          { message: "Email verified successfully" },
          "Email verified successfully"
        );
      },
      "verify email",
      res,
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
    return handleControllerOperation(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { email } = req.body as { email: string };

        // Find user
        const user = await authService.getUserByEmail(email);
        if (!user) {
          // Do not reveal that email doesn't exist
          return successResponse(
            res,
            { message: "If an account exists, a reset email has been sent" },
            "Password reset requested"
          );
        }

        // Create password reset token
        const resetToken = await tokenService.createToken({
          userId: user.id,
          tokenType: "password_reset",
          expiresInDays: 1,
          metadata: { reason: "forgot_password" },
        });

        // TODO: send email with reset link containing resetToken.token_value

        // For now, respond generically and include token in non-production for testing
        const responsePayload: Record<string, unknown> = {
          message: "If an account exists, a reset email has been sent",
        };
        if (process.env.NODE_ENV !== "production") {
          responsePayload.token = resetToken.token_value;
        }

        return successResponse(res, responsePayload, "Password reset requested");
      },
      "forgot password",
      res,
      {
        context: {
          email: req.body?.email,
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Send email verification token
   * POST /api/auth/request-verify-email
   */
  async sendTokenVerifyEmail(req: Request, res: Response): Promise<Response> {
    return handleControllerOperation(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { email } = req.body as { email: string };

        const user = await authService.getUserByEmail(email);
        if (!user) {
          // Không tiết lộ email tồn tại hay không
          return successResponse(
            res,
            { message: "Nếu tài khoản tồn tại, email xác thực đã được gửi" },
            "Verification email requested"
          );
        }

        if (user.email_verified) {
          return successResponse(
            res,
            { message: "Email đã được xác thực trước đó" },
            "Email already verified"
          );
        }

        const verifyToken = await tokenService.createToken({
          userId: user.id,
          tokenType: "email_verification",
          expiresInDays: 1,
          metadata: { reason: "verify_email" },
        });

        // TODO: Gửi email kèm link chứa verifyToken.token_value

        const payload: Record<string, unknown> = {
          message: "Nếu tài khoản tồn tại, email xác thực đã được gửi",
        };
        if (process.env.NODE_ENV !== "production") {
          payload.token = verifyToken.token_value;
        }

        return successResponse(res, payload, "Verification email requested");
      },
      "request verify email",
      res,
      {
        context: {
          email: req.body?.email,
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Reset password using reset token (public)
   * POST /api/auth/reset-password-with-token
   */
  async resetPasswordWithToken(req: Request, res: Response): Promise<Response> {
    return handleControllerOperation(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { token, newPassword } = req.body as { token: string; newPassword: string };

        // Validate password reset token
        const tokenRecord = await tokenService.validateToken(token, "password_reset");
        if (!tokenRecord) {
          return errorResponse(res, "Invalid or expired reset token", 400);
        }

        // Reset password
        await authService.resetPassword(tokenRecord.user_id, newPassword);

        // Revoke used token
        await tokenService.revokeToken(token, "password_reset");

        return successResponse(
          res,
          { message: "Password has been reset successfully" },
          "Password has been reset successfully"
        );
      },
      "reset password with token",
      res,
      {
        context: {
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
    return handleControllerOperation(
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
      res,
      {
        context: {
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        },
      }
    );
  }

  /**
   * Get user's active sessions
   * GET /api/auth/sessions
   * @access Private
   */
  async getUserSessions(req: Request, res: Response): Promise<Response> {
    return handleControllerOperation(
      async () => {
        if (!req.user?.id) {
          return errorResponse(res, "User not authenticated", 401);
        }

        const sessions = await authService.getUserSessions(req.user.id);

        return successResponse(
          res,
          {
            sessions,
            count: sessions.length,
          },
          "User sessions retrieved successfully"
        );
      },
      "get user sessions",
      res,
      {
        context: {
          userId: req.user?.id,
        },
      }
    );
  }

  /**
   * Logout from all devices
   * POST /api/auth/logout-all
   * @access Private
   */
  async logoutAll(req: Request, res: Response): Promise<Response> {
    return handleControllerOperation(
      async () => {
        if (!req.user?.id) {
          return errorResponse(res, "User not authenticated", 401);
        }

        await authService.logoutAll(req.user.id);

        return successResponse(
          res,
          { message: "Logged out from all devices successfully" },
          "Logout from all devices successful"
        );
      },
      "logout all devices",
      res,
      {
        context: {
          userId: req.user?.id,
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Revoke a specific session
   * DELETE /api/auth/sessions/:sessionId
   * @access Private
   */
  async revokeSession(req: Request, res: Response): Promise<Response> {
    return handleControllerOperation(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user?.id) {
          return errorResponse(res, "User not authenticated", 401);
        }

        const { sessionId } = req.params;

        await authService.revokeSession(sessionId, req.user.id);

        return successResponse(res, null, "Session revoked successfully");
      },
      "revoke session",
      res,
      {
        context: {
          userId: req.user?.id,
          sessionId: req.params.sessionId,
        },
      }
    );
  }

  /**
   * Check if email is already registered
   * POST /api/auth/check-email
   * @access Public
   */
  async checkEmailExists(req: Request, res: Response): Promise<Response> {
    return handleControllerOperation(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { email } = req.body as { email: string };

        const user = await authService.getUserByEmail(email);
        const exists = !!user;

        return successResponse(
          res,
          {
            exists,
            available: !exists,
          },
          "Email check completed"
        );
      },
      "check email exists",
      res,
      {
        context: {
          email: req.body?.email,
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
  sendTokenVerifyEmail,
  resetPasswordWithToken,
  getUserSessions,
  logoutAll,
  revokeSession,
  checkEmailExists,
} = authController;

export default authController;
