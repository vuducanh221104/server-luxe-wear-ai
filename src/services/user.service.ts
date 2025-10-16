/**
 * @file user.service.ts
 * @description User service using Supabase Auth
 * Handles user profile management and admin operations
 */

import { supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";
import { User } from "@supabase/supabase-js";
import { UpdateUserProfileData, UserStats, UserListResponse } from "../types";

/**
 * Get user profile by ID
 * @param userId - User ID
 * @returns User profile
 */
export const getUserProfile = async (userId: string): Promise<User> => {
  logger.info("Getting user profile", { userId });

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error) {
    logger.error("Get user profile failed", { userId, error: error.message });
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("User not found");
  }

  logger.info("User profile retrieved successfully", { userId });
  return data.user;
};

/**
 * Update user profile
 * @param userId - User ID
 * @param profileData - Profile data to update
 * @returns Updated user profile
 */
export const updateUserProfile = async (
  userId: string,
  profileData: UpdateUserProfileData
): Promise<User> => {
  logger.info("Updating user profile", { userId, profileData });

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: profileData,
  });

  if (error) {
    logger.error("Update user profile failed", { userId, error: error.message });
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Failed to update user profile");
  }

  logger.info("User profile updated successfully", { userId });
  return data.user;
};

/**
 * Update user email
 * @param userId - User ID
 * @param newEmail - New email address
 * @returns Updated user
 */
export const updateUserEmail = async (userId: string, newEmail: string): Promise<User> => {
  logger.info("Updating user email", { userId, newEmail });

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    email: newEmail,
    email_confirm: true, // Skip email confirmation for admin updates
  });

  if (error) {
    logger.error("Update user email failed", { userId, error: error.message });
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Failed to update user email");
  }

  logger.info("User email updated successfully", { userId, newEmail });
  return data.user;
};

/**
 * Update user password (admin operation)
 * @param userId - User ID
 * @param newPassword - New password
 * @returns Updated user
 */
export const updateUserPassword = async (userId: string, newPassword: string): Promise<User> => {
  logger.info("Updating user password", { userId });

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    logger.error("Update user password failed", { userId, error: error.message });
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Failed to update user password");
  }

  logger.info("User password updated successfully", { userId });
  return data.user;
};

/**
 * List all users (admin operation)
 * @param page - Page number (1-based)
 * @param perPage - Items per page
 * @returns List of users with pagination
 */
export const listUsers = async (
  page: number = 1,
  perPage: number = 10
): Promise<UserListResponse> => {
  logger.info("Listing users", { page, perPage });

  const { data, error } = await supabaseAdmin.auth.admin.listUsers({
    page,
    perPage,
  });

  if (error) {
    logger.error("List users failed", { error: error.message });
    throw new Error(error.message);
  }

  const totalPages = Math.ceil((data.total || 0) / perPage);

  logger.info("Users listed successfully", {
    total: data.total,
    page,
    perPage,
    totalPages,
  });

  return {
    users: data.users,
    total: data.total || 0,
    page,
    perPage,
    totalPages,
  };
};

/**
 * Delete user (admin operation)
 * @param userId - User ID to delete
 */
export const deleteUser = async (userId: string): Promise<void> => {
  logger.info("Deleting user", { userId });

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (error) {
    logger.error("Delete user failed", { userId, error: error.message });
    throw new Error(error.message);
  }

  logger.info("User deleted successfully", { userId });
};

/**
 * Ban/Unban user (admin operation)
 * @param userId - User ID
 * @param banned - Ban status
 * @returns Updated user
 */
export const banUser = async (userId: string, banned: boolean = true): Promise<User> => {
  logger.info("Updating user ban status", { userId, banned });

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: banned ? "876000h" : "none", // ~100 years or none
  });

  if (error) {
    logger.error("Update user ban status failed", { userId, error: error.message });
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("Failed to update user ban status");
  }

  logger.info("User ban status updated successfully", { userId, banned });
  return data.user;
};

/**
 * Get user's agents count
 * @param userId - User ID
 * @returns Number of agents owned by user
 */
export const getUserAgentsCount = async (userId: string): Promise<number> => {
  logger.info("Getting user agents count", { userId });

  const { count, error } = await supabaseAdmin
    .from("agents")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", userId);

  if (error) {
    logger.error("Get user agents count failed", { userId, error: error.message });
    throw new Error(error.message);
  }

  logger.info("User agents count retrieved", { userId, count });
  return count || 0;
};

/**
 * Get user statistics
 * @param userId - User ID
 * @returns User statistics
 */
export const getUserStats = async (userId: string): Promise<UserStats> => {
  logger.info("Getting user statistics", { userId });

  try {
    // Get user profile
    const user = await getUserProfile(userId);

    // Get agents count
    const agentsCount = await getUserAgentsCount(userId);

    // Get total queries count from analytics
    const { data: userAgents } = await supabaseAdmin
      .from("agents")
      .select("id")
      .eq("owner_id", userId);

    const agentIds = userAgents?.map((agent) => agent.id) || [];

    const { count: totalQueries, error: analyticsError } = await supabaseAdmin
      .from("analytics")
      .select("*", { count: "exact", head: true })
      .in("agent_id", agentIds);

    if (analyticsError) {
      logger.warn("Failed to get analytics count", { userId, error: analyticsError.message });
    }

    const stats = {
      agentsCount,
      totalQueries: totalQueries || 0,
      lastLoginAt: user.user_metadata?.last_login || null,
      createdAt: user.created_at,
    };

    logger.info("User statistics retrieved", { userId, stats });
    return stats;
  } catch (error) {
    logger.error("Get user statistics failed", { userId, error });
    throw error;
  }
};
