/**
 * @file user.controller.ts
 * @description User controller for profile management
 * Handles HTTP requests for user-related operations
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import * as userService from "../services/user.service";
import {
  uploadAvatar as uploadAvatarToStorage,
  deleteAvatar as deleteAvatarFromStorage,
} from "../services/storage.service";
import { successResponse, errorResponse } from "../utils/response";
import { handleAsyncOperationStrict } from "../utils/errorHandler";
import logger from "../config/logger";

/**
 * User Controller Class
 * Object-based controller for user operations
 */
export class UserController {
  /**
   * Get current user profile
   * GET /api/users/profile
   */
  async getProfile(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        const user = await userService.getUserProfile(req.user.id);

        return successResponse(
          res,
          {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name,
            phone: user.user_metadata?.phone,
            website: user.user_metadata?.website,
            avatar_url: user.user_metadata?.avatar_url,
            provider: user.app_metadata?.provider,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
          },
          "Profile retrieved successfully"
        );
      },
      "get user profile",
      {
        context: {
          userId: req.user?.id,
        },
      }
    );
  }

  /**
   * Update current user profile
   * PUT /api/users/profile
   */
  async updateProfile(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        const { name, phone, website } = req.body;
        const updateData: { name?: string; phone?: string; website?: string; avatar_url?: string } =
          {
            name,
            phone,
            website,
          };

        // If avatar file is uploaded, upload to Supabase Storage
        if (req.file) {
          logger.info("Avatar file detected in profile update", {
            userId: req.user.id,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
          });

          try {
            const avatar_url = await uploadAvatarToStorage(req.file, req.user.id);
            updateData.avatar_url = avatar_url;
            logger.info("Avatar uploaded during profile update", {
              userId: req.user.id,
              avatarUrl: avatar_url,
            });
          } catch (error) {
            logger.error("Avatar upload failed during profile update", {
              userId: req.user.id,
              error: error instanceof Error ? error.message : "Unknown error",
            });
            return errorResponse(
              res,
              "Profile updated but avatar upload failed: " +
                (error instanceof Error ? error.message : "Unknown error"),
              400
            );
          }
        } else {
          logger.info("No avatar file in profile update request", {
            userId: req.user.id,
            body: req.body,
          });
          // Don't update avatar_url if no file is uploaded
        }

        const updatedUser = await userService.updateUserProfile(req.user.id, updateData);

        return successResponse(
          res,
          {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.user_metadata?.name,
            phone: updatedUser.user_metadata?.phone,
            website: updatedUser.user_metadata?.website,
            avatar_url: updatedUser.user_metadata?.avatar_url,
            updatedAt: updatedUser.updated_at,
          },
          "Profile updated successfully"
        );
      },
      "update user profile",
      {
        context: {
          userId: req.user?.id,
          updateFields: Object.keys(req.body || {}),
          hasAvatarFile: !!req.file,
        },
      }
    );
  }

  /**
   * Update current user email
   * PUT /api/users/email
   */
  async updateEmail(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        const { email } = req.body;

        const updatedUser = await userService.updateUserEmail(req.user.id, email);

        return successResponse(
          res,
          {
            id: updatedUser.id,
            email: updatedUser.email,
            updatedAt: updatedUser.updated_at,
          },
          "Email updated successfully"
        );
      },
      "update user email",
      {
        context: {
          userId: req.user?.id,
          newEmail: req.body?.email,
        },
      }
    );
  }

  /**
   * Get user statistics
   * GET /api/users/stats
   */
  async getStats(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        const stats = await userService.getUserStats(req.user.id, req.tenant?.id);

        return successResponse(res, stats, "User statistics retrieved successfully");
      },
      "get user stats",
      {
        context: {
          userId: req.user?.id,
        },
      }
    );
  }

  /**
   * Upload user avatar
   * POST /api/users/avatar
   */
  async uploadAvatar(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.file) {
          return errorResponse(res, "No avatar file provided", 400);
        }

        // Upload avatar to Supabase Storage
        const avatarUrl = await uploadAvatarToStorage(req.file, req.user.id);

        // Update user profile with new avatar URL
        const updatedUser = await userService.updateUserProfile(req.user.id, {
          avatar_url: avatarUrl,
        });

        return successResponse(
          res,
          {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.user_metadata?.name,
            avatar_url: updatedUser.user_metadata?.avatar_url,
            updatedAt: updatedUser.updated_at,
          },
          "Avatar uploaded successfully"
        );
      },
      "upload user avatar",
      {
        context: {
          userId: req.user?.id,
          fileName: req.file?.originalname,
          fileSize: req.file?.size,
        },
      }
    );
  }

  /**
   * Delete user avatar
   * DELETE /api/users/avatar
   */
  async deleteAvatar(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        // Get current user to check if they have an avatar
        const user = await userService.getUserProfile(req.user.id);
        const currentAvatarUrl = user.user_metadata?.avatar_url;

        if (!currentAvatarUrl) {
          return errorResponse(res, "No avatar to delete", 400);
        }

        // Delete avatar from Supabase Storage
        await deleteAvatarFromStorage(currentAvatarUrl, req.user.id);

        // Update user profile to remove avatar URL
        const updatedUser = await userService.updateUserProfile(req.user.id, {
          avatar_url: "",
        });

        return successResponse(
          res,
          {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.user_metadata?.name,
            avatar_url: updatedUser.user_metadata?.avatar_url,
            updatedAt: updatedUser.updated_at,
          },
          "Avatar deleted successfully"
        );
      },
      "delete user avatar",
      {
        context: {
          userId: req.user?.id,
        },
      }
    );
  }

  // ===========================
  // Admin Operations
  // ===========================

  /**
   * List all users (Admin only)
   * GET /api/users
   */
  async listUsers(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const page = parseInt(req.query.page as string) || 1;
        const perPage = parseInt(req.query.perPage as string) || 10;

        const result = await userService.listUsers(page, perPage);

        return successResponse(
          res,
          {
            users: result.users.map((user) => ({
              id: user.id,
              email: user.email,
              name: user.user_metadata?.name,
              provider: user.app_metadata?.provider,
              createdAt: user.created_at,
              updatedAt: user.updated_at,
              lastSignInAt: user.last_sign_in_at,
            })),
            pagination: {
              page: result.page,
              perPage: result.perPage,
              total: result.total,
              totalPages: result.totalPages,
            },
          },
          "Users retrieved successfully"
        );
      },
      "list users (admin)",
      {
        context: {
          adminId: req.user?.id,
          page: req.query.page,
          perPage: req.query.perPage,
        },
      }
    );
  }

  /**
   * Get user by ID (Admin only)
   * GET /api/users/:userId
   */
  async getUserById(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { userId } = req.params;

        const user = await userService.getUserProfile(userId);

        return successResponse(
          res,
          {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name,
            phone: user.user_metadata?.phone,
            website: user.user_metadata?.website,
            avatar_url: user.user_metadata?.avatar_url,
            provider: user.app_metadata?.provider,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
            lastSignInAt: user.last_sign_in_at,
          },
          "User retrieved successfully"
        );
      },
      "get user by ID (admin)",
      {
        context: {
          adminId: req.user?.id,
          targetUserId: req.params.userId,
        },
      }
    );
  }

  /**
   * Update user password (Admin only)
   * PUT /api/users/:userId/password
   */
  async updateUserPassword(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { userId } = req.params;
        const { password } = req.body;

        await userService.updateUserPassword(userId, password);

        return successResponse(res, null, "User password updated successfully");
      },
      "update user password (admin)",
      {
        context: {
          adminId: req.user?.id,
          targetUserId: req.params.userId,
        },
      }
    );
  }

  /**
   * Ban/Unban user (Admin only)
   * PUT /api/users/:userId/ban
   */
  async banUser(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { userId } = req.params;
        const { banned } = req.body;

        const updatedUser = await userService.banUser(userId, banned);

        return successResponse(
          res,
          {
            id: updatedUser.id,
            email: updatedUser.email,
            banned: banned,
            updatedAt: updatedUser.updated_at,
          },
          `User ${banned ? "banned" : "unbanned"} successfully`
        );
      },
      "ban/unban user (admin)",
      {
        context: {
          adminId: req.user?.id,
          targetUserId: req.params.userId,
          banned: req.body?.banned,
        },
      }
    );
  }

  /**
   * Delete user (Admin only)
   * DELETE /api/users/:userId
   */
  async deleteUser(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { userId } = req.params;

        await userService.deleteUser(userId);

        return successResponse(res, null, "User deleted successfully");
      },
      "delete user (admin)",
      {
        context: {
          adminId: req.user?.id,
          targetUserId: req.params.userId,
        },
      }
    );
  }
}

// Create and export controller instance
export const userController = new UserController();

// Export individual methods for backward compatibility
export const {
  getProfile,
  updateProfile,
  updateEmail,
  getStats,
  uploadAvatar,
  deleteAvatar,
  listUsers,
  getUserById,
  updateUserPassword,
  banUser,
  deleteUser,
} = userController;

export default userController;
