/**
 * @file auth.router.ts
 * @description Authentication routes with Supabase Auth
 */

import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import * as oauthController from "../controllers/oauth.controller";
import passport from "../config/passport";
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
  checkEmailValidator,
  revokeSessionValidator,
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

/**
 * GET /api/auth/sessions
 * Get user's active sessions
 * @access Private
 */
router.get("/sessions", authMiddleware, authController.getUserSessions);

/**
 * POST /api/auth/logout-all
 * Logout from all devices
 * @access Private
 */
router.post("/logout-all", authMiddleware, authController.logoutAll);

/**
 * DELETE /api/auth/sessions/:sessionId
 * Revoke a specific session
 * @access Private
 */
router.delete(
  "/sessions/:sessionId",
  authMiddleware,
  revokeSessionValidator,
  authController.revokeSession
);

/**
 * POST /api/auth/check-email
 * Check if email is already registered
 * @access Public
 */
router.post("/check-email", authRateLimiter, checkEmailValidator, authController.checkEmailExists);

// ===========================
// OAuth Routes
// ===========================

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 * @access Public
 */
router.get("/google", passport.authenticate("google", { session: false }));

/**
 * GET /api/auth/google/callback
 * Google OAuth callback
 * @access Public (called by Google)
 */
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/api/auth/oauth/failure",
  }),
  oauthController.googleCallback
);

/**
 * GET /api/auth/github
 * Initiate GitHub OAuth flow
 * @access Public
 */
router.get("/github", passport.authenticate("github", { session: false }));

/**
 * GET /api/auth/github/callback
 * GitHub OAuth callback
 * @access Public (called by GitHub)
 */
router.get(
  "/github/callback",
  passport.authenticate("github", {
    session: false,
    failureRedirect: "/api/auth/oauth/failure",
  }),
  oauthController.githubCallback
);

/**
 * GET /api/auth/oauth/failure
 * OAuth failure handler
 * @access Public
 */
router.get("/oauth/failure", oauthController.oauthFailure);

/**
 * GET /api/auth/oauth/providers
 * Get available OAuth providers
 * @access Public
 */
router.get("/oauth/providers", oauthController.getProviders);

export default router;
