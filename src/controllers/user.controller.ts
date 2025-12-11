/**
 * @file user.controller.ts
 * @description User controller for profile management using custom users table
 * Handles HTTP requests for user-related operations
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { userService } from "../services/user.service";
import { storageService } from "../services/storage.service";
import { authService } from "../services/auth.service";
import { successResponse, errorResponse } from "../utils/response";
import { handleAsyncOperationStrict } from "../utils/errorHandler";
import logger from "../config/logger";

/**
 * User Controller Class
 * Object-based controller for user operations using custom users table
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
            name: user.name,
            phone: user.phone,
            website: user.website,
            avatar_url: user.avatar_url,
            role: user.role,
            preferences: user.preferences,
            is_active: user.is_active,
            email_verified: user.email_verified,
            last_login: user.last_login,
            created_at: user.created_at,
            updated_at: user.updated_at,
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

        const { name, phone, website, preferences } = req.body;
        const updateData: {
          name?: string;
          phone?: string;
          website?: string;
          avatar_url?: string;
          preferences?: Record<string, unknown>;
        } = {
          name,
          phone,
          website,
          preferences,
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
            const avatar_url = await storageService.uploadAvatar(req.file, req.user.id);
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
            return errorResponse(res, "Failed to upload avatar. Please try again.", 500);
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
            name: updatedUser.name,
            phone: updatedUser.phone,
            website: updatedUser.website,
            avatar_url: updatedUser.avatar_url,
            role: updatedUser.role,
            preferences: updatedUser.preferences,
            is_active: updatedUser.is_active,
            email_verified: updatedUser.email_verified,
            updated_at: updatedUser.updated_at,
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

        const updatedUser = await userService.updateUser(req.user.id, { email });

        return successResponse(
          res,
          {
            id: updatedUser.id,
            email: updatedUser.email,
            updated_at: updatedUser.updated_at,
          },
          "Email updated successfully"
        );
      },
      "update user email",
      {
        context: {
          userId: req.user?.id,
        },
      }
    );
  }

  /**
   * Delete current user avatar
   * DELETE /api/users/avatar
   */
  async deleteAvatar(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        try {
          // Delete avatar from storage
          if (req.user.avatar_url) {
            await storageService.deleteAvatar(req.user.avatar_url, req.user.id);
          }

          // Update user profile to remove avatar_url
          const updatedUser = await userService.updateUserProfile(req.user.id, {
            avatar_url: undefined,
          });

          return successResponse(
            res,
            {
              id: updatedUser.id,
              avatar_url: updatedUser.avatar_url,
            },
            "Avatar deleted successfully"
          );
        } catch (error) {
          logger.error("Avatar deletion failed", {
            userId: req.user.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          return errorResponse(res, "Failed to delete avatar", 500);
        }
      },
      "delete user avatar",
      {
        context: {
          userId: req.user?.id,
        },
      }
    );
  }

  /**
   * Get user statistics
   * GET /api/users/stats
   */
  async getUserStats(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        const stats = await userService.getUserStats(req.user.id);

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
   * Get user tenant memberships
   * GET /api/users/memberships
   */
  async getUserMemberships(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        const memberships = await userService.getUserMemberships(req.user.id);

        return successResponse(
          res,
          {
            memberships: memberships.map((membership) => ({
              id: membership.id,
              tenant_id: membership.tenant_id,
              role: membership.role,
              status: membership.status,
              joined_at: membership.joined_at,
            })),
          },
          "User memberships retrieved successfully"
        );
      },
      "get user memberships",
      {
        context: {
          userId: req.user?.id,
        },
      }
    );
  }

  /**
   * List all users (admin only)
   * GET /api/users
   */
  async listUsers(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        // Check if user has admin privileges
        if (!["admin", "owner", "super_admin"].includes(req.user.role)) {
          return errorResponse(res, "Admin access required", 403);
        }

        const page = parseInt(req.query.page as string) || 1;
        const perPage = parseInt(req.query.perPage as string) || 10;
        const search = req.query.search as string;

        // Extract filters
        const role = req.query.role as string;
        const is_active_param = req.query.is_active;
        let is_active: boolean | undefined = undefined;
        if (is_active_param === 'true') is_active = true;
        if (is_active_param === 'false') is_active = false;

        // Extract sort
        const sortField = req.query.sortField as string;
        const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc';

        const result = await userService.listUsers(
          page,
          perPage,
          search,
          { role, is_active },
          sortField ? { field: sortField, order: sortOrder } : undefined
        );

        return successResponse(res, result, "Users retrieved successfully");
      },
      "list users",
      {
        context: {
          adminUserId: req.user?.id,
          page: req.query.page,
          perPage: req.query.perPage,
          search: req.query.search,
          filters: { role: req.query.role, is_active: req.query.is_active },
          sort: { field: req.query.sortField, order: req.query.sortOrder }
        },
      }
    );
  }

  /**
   * Get user by ID (admin only)
   * GET /api/users/:userId
   */
  async getUserById(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        // Check if user has admin privileges
        if (!["admin", "owner", "super_admin"].includes(req.user.role)) {
          return errorResponse(res, "Admin access required", 403);
        }

        const { userId: id } = req.params;

        const user = await userService.getUserProfile(id);

        return successResponse(
          res,
          {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            website: user.website,
            avatar_url: user.avatar_url,
            role: user.role,
            preferences: user.preferences,
            is_active: user.is_active,
            email_verified: user.email_verified,
            last_login: user.last_login,
            created_at: user.created_at,
            updated_at: user.updated_at,
          },
          "User retrieved successfully"
        );
      },
      "get user by id",
      {
        context: {
          adminUserId: req.user?.id,
          targetUserId: req.params.id,
        },
      }
    );
  }

  /**
   * Update user by ID (admin only)
   * PUT /api/users/:userId
   */
  async updateUserById(req: Request, res: Response): Promise<Response> {
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

        // Check if user has admin privileges
        if (!["admin", "owner", "super_admin"].includes(req.user.role)) {
          return errorResponse(res, "Admin access required", 403);
        }

        const { userId: id } = req.params;
        const { name, phone, website, role, is_active, email_verified, preferences } = req.body;

        const updateData: {
          name?: string;
          phone?: string;
          website?: string;
          role?: "member" | "admin" | "owner" | "super_admin";
          is_active?: boolean;
          email_verified?: boolean;
          preferences?: Record<string, unknown>;
        } = {};

        // Only include fields that are provided and allowed
        if (name !== undefined) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;
        if (website !== undefined) updateData.website = website;
        if (role !== undefined) updateData.role = role;
        if (is_active !== undefined) updateData.is_active = is_active;
        if (email_verified !== undefined) updateData.email_verified = email_verified;
        if (preferences !== undefined) updateData.preferences = preferences;

        const updatedUser = await userService.updateUser(id, updateData);

        return successResponse(
          res,
          {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            is_active: updatedUser.is_active,
            email_verified: updatedUser.email_verified,
            updated_at: updatedUser.updated_at,
          },
          "User updated successfully"
        );
      },
      "update user by id",
      {
        context: {
          adminUserId: req.user?.id,
          targetUserId: req.params.id,
          updateFields: Object.keys(req.body || {}),
        },
      }
    );
  }

  /**
   * Update user password by ID (admin only)
   * PUT /api/users/:userId/password
   */
  async adminUpdatePassword(req: Request, res: Response): Promise<Response> {
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

        // Check if user has admin privileges
        if (!["admin", "owner", "super_admin"].includes(req.user.role)) {
          return errorResponse(res, "Admin access required", 403);
        }

        const { userId: id } = req.params;
        const { newPassword } = req.body;

        // Reset password using auth service
        await authService.resetPassword(id, newPassword);

        return successResponse(
          res,
          { message: "User password updated successfully" },
          "User password updated successfully"
        );
      },
      "admin update user password",
      {
        context: {
          adminUserId: req.user?.id,
          targetUserId: req.params.userId,
        },
      }
    );
  }

  /**
   * Delete user by ID (admin only)
   * DELETE /api/users/:userId
   */
  async deleteUserById(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        // Check if user has admin privileges
        if (!["admin", "owner", "super_admin"].includes(req.user.role)) {
          return errorResponse(res, "Admin access required", 403);
        }

        const { userId: id } = req.params;

        // Prevent admin from deleting themselves
        if (id === req.user.id) {
          return errorResponse(res, "Cannot delete your own account", 400);
        }

        const result = await userService.deleteUser(id);

        return successResponse(res, result, "User deleted successfully");
      },
      "delete user by id",
      {
        context: {
          adminUserId: req.user?.id,
          targetUserId: req.params.id,
        },
      }
    );
  }

  /**
   * Bulk delete users (admin only)
   * DELETE /api/users/bulk
   */
  async bulkDeleteUsers(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!["admin", "owner", "super_admin"].includes(req.user.role)) {
          return errorResponse(res, "Admin access required", 403);
        }

        const { userIds } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
          return errorResponse(res, "userIds array is required", 400);
        }

        // Prevent self-deletion
        if (userIds.includes(req.user.id)) {
          return errorResponse(res, "Cannot delete your own account in bulk action", 400);
        }

        const result = await userService.deleteUsers(userIds);

        return successResponse(res, result, "Users deleted successfully");
      },
      "bulk delete users",
      {
        context: {
          adminUserId: req.user?.id,
          count: req.body.userIds?.length,
        },
      }
    );
  }

  /**
   * Bulk update users (admin only)
   * PUT /api/users/bulk
   */
  async bulkUpdateUsers(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!["admin", "owner", "super_admin"].includes(req.user.role)) {
          return errorResponse(res, "Admin access required", 403);
        }

        const { userIds, data } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
          return errorResponse(res, "userIds array is required", 400);
        }

        if (!data || (data.is_active === undefined && !data.role)) {
          return errorResponse(res, "Update data (is_active or role) is required", 400);
        }

        const result = await userService.updateUsers(userIds, data);

        return successResponse(res, result, "Users updated successfully");
      },
      "bulk update users",
      {
        context: {
          adminUserId: req.user?.id,
          count: req.body.userIds?.length,
          data: req.body.data,
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
  deleteAvatar,
  getUserStats,
  getUserMemberships,
  listUsers,
  getUserById,
  updateUserById,
  adminUpdatePassword,
  deleteUserById,
  bulkDeleteUsers,
  bulkUpdateUsers,
} = userController;

export default userController;
