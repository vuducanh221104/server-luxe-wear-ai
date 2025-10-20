/**
 * @file user.router.ts
 * @description User management routes with Supabase Auth
 */

import { Router } from "express";
import * as userController from "../controllers/user.controller";
import {
  updateProfileValidator,
  updateEmailValidator,
  updatePasswordValidator,
  userIdValidator,
  paginationValidator,
  banUserValidator,
} from "../validators/user.validator";
import { authMiddleware } from "../middlewares/auth.middleware";
import { authRateLimiter } from "../middlewares/rateLimiter.middleware";
import {
  uploadAvatar as uploadAvatarMiddleware,
  handleAvatarUploadError,
  validateAvatarExists,
} from "../middlewares/avatar.middleware";

const router = Router();

// ===========================
// User Profile Routes
// ===========================

/**
 * GET /api/users/profile
 * Get current user profile
 * @access Private
 */
router.get("/profile", authMiddleware, userController.getProfile);

/**
 * PUT /api/users/profile
 * Update current user profile
 * @access Private
 */
router.put(
  "/profile",
  authMiddleware,
  authRateLimiter,
  uploadAvatarMiddleware, // Add file upload middleware
  handleAvatarUploadError, // Add error handling
  updateProfileValidator,
  userController.updateProfile
);

/**
 * PUT /api/users/email
 * Update current user email
 * @access Private
 */
router.put(
  "/email",
  authMiddleware,
  authRateLimiter,
  updateEmailValidator,
  userController.updateEmail
);

/**
 * GET /api/users/stats
 * Get current user statistics
 * @access Private
 */
router.get("/stats", authMiddleware, userController.getUserStats);

/**
 * POST /api/users/avatar
 * Upload user avatar
 * @access Private
 */
router.post(
  "/avatar",
  authMiddleware,
  authRateLimiter,
  uploadAvatarMiddleware,
  handleAvatarUploadError,
  validateAvatarExists,
  userController.updateProfile
);

/**
 * DELETE /api/users/avatar
 * Delete user avatar
 * @access Private
 */
router.delete("/avatar", authMiddleware, userController.deleteAvatar);

// ===========================
// Admin Routes
// ===========================

/**
 * GET /api/users
 * List all users with pagination (Admin only)
 * @access Admin
 */
router.get("/", authMiddleware, paginationValidator, userController.listUsers);

/**
 * GET /api/users/:userId
 * Get user by ID (Admin only)
 * @access Admin
 */
router.get("/:userId", authMiddleware, userIdValidator, userController.getUserById);

/**
 * PUT /api/users/:userId/password
 * Update user password (Admin only)
 * @access Admin
 */
router.put(
  "/:userId/password",
  authMiddleware,
  authRateLimiter,
  [...userIdValidator, ...updatePasswordValidator],
  userController.updateProfile
);

/**
 * PUT /api/users/:userId/ban
 * Ban/Unban user (Admin only)
 * @access Admin
 */
router.put(
  "/:userId/ban",
  authMiddleware,
  authRateLimiter,
  banUserValidator,
  userController.updateUserById
);

/**
 * DELETE /api/users/:userId
 * Delete user (Admin only)
 * @access Admin
 */
router.delete(
  "/:userId",
  authMiddleware,
  authRateLimiter,
  userIdValidator,
  userController.deleteUserById
);

export default router;
