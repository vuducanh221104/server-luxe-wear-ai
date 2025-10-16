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
router.post("/refresh", refreshTokenValidator, authController.refreshAccessToken);

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
 * Reset password with token from email
 * @access Public
 */
router.post("/reset-password", resetPasswordValidator, authController.resetPassword);

/**
 * GET /api/auth/me
 * Get current authenticated user
 * @access Private
 */
router.get("/me", authMiddleware, authController.getCurrentUser);

/**
 * GET /api/auth/callback
 * Handle Supabase auth callback from URL fragment
 * @access Public
 */
router.get("/callback", authController.handleAuthCallback);

/**
 * GET /api/auth/callback-fragment
 * Handle Supabase auth callback from URL fragment (#)
 * @access Public
 */
router.get("/callback-fragment", authController.handleAuthCallbackFragment);

/**
 * POST /api/auth/verify-token
 * Verify access token
 * @access Public
 */
router.post("/verify-token", authController.verifyToken);

export default router;
