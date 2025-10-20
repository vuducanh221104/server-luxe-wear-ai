/**
 * @file auth.router.ts
 * @description Authentication routes with Supabase Auth
 */

import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  refreshTokenValidator,
  changePasswordValidator,
  verifyEmailValidator,
  requestVerifyEmailValidator,
  resetPasswordWithTokenValidator,
} from "../validators/auth.validator";
import { authMiddleware } from "../middlewares/auth.middleware";
import { authRateLimiter } from "../middlewares/rateLimiter.middleware";

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 * @access Public
 */
router.post("/register", authRateLimiter, registerValidator, authController.register);

/**
 * POST /api/auth/login
 * Login user with email and password
 * @access Public
 */
router.post("/login", authRateLimiter, loginValidator, authController.login);

/**
 * POST /api/auth/logout
 * Logout current user
 * @access Private
 */
router.post("/logout", authMiddleware, authController.logout);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 * @access Public
 */
router.post("/refresh", refreshTokenValidator, authController.refreshToken);

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 * @access Public
 */
router.post(
  "/forgot-password",
  authRateLimiter,
  forgotPasswordValidator,
  authController.forgotPassword
);

/**
 * POST /api/auth/reset-password
 * Reset password (admin only)
 * @access Private
 */
router.post(
  "/reset-password",
  authMiddleware,
  resetPasswordValidator,
  authController.resetPassword
);

/**
 * POST /api/auth/change-password
 * Change password for authenticated user
 * @access Private
 */
router.post(
  "/change-password",
  authMiddleware,
  changePasswordValidator,
  authController.changePassword
);

/**
 * POST /api/auth/verify-email
 * Verify email using verification token
 * @access Public
 */
router.post("/verify-email", verifyEmailValidator, authController.verifyEmail);

/**
 * POST /api/auth/request-verify-email
 * Request an email verification token to be sent
 * @access Public
 */
router.post(
  "/request-verify-email",
  requestVerifyEmailValidator,
  authController.sendTokenVerifyEmail
);

/**
 * POST /api/auth/reset-password-with-token
 * Reset password using password reset token
 * @access Public
 */
router.post(
  "/reset-password-with-token",
  resetPasswordWithTokenValidator,
  authController.resetPasswordWithToken
);

/**
 * GET /api/auth/me
 * Get current authenticated user
 * @access Private
 */
router.get("/me", authMiddleware, authController.getCurrentUser);

/**
 * POST /api/auth/verify-token
 * Verify access token
 * @access Public
 */
router.post("/verify-token", authController.verifyToken);

export default router;
