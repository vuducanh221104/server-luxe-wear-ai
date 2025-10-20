/**
 * @file user.service.ts
 * @description User service using custom users table
 * Handles user profile management and admin operations
 */

import { supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";
import {
  User,
  UpdateUserProfileData,
  UserStats,
  UserListResponse,
  UserWithMemberships,
  CreateUserData,
  UpdateUserData,
  UserTenantMembership,
  CreateMembershipData,
  UpdateMembershipData,
} from "../types/user";
import { handleAsyncOperationStrict } from "../utils/errorHandler";

/**
 * User Service Class
 * Class-based service for user operations using custom users table
 */
export class UserService {
  /**
   * Get user profile by ID
   * @param userId - User ID
   * @returns User profile
   */
  async getUserProfile(userId: string): Promise<User> {
    return handleAsyncOperationStrict(
      async () => {
        logger.info("Getting user profile", { userId });

        const { data, error } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

        if (error) {
          throw new Error(error.message);
        }

        if (!data) {
          throw new Error("User not found");
        }

        logger.info("User profile retrieved successfully", { userId });
        return data;
      },
      "get user profile",
      {
        context: { userId },
      }
    );
  }

  /**
   * Get user profile with tenant memberships
   * @param userId - User ID
   * @returns User profile with memberships
   */
  async getUserWithMemberships(userId: string): Promise<UserWithMemberships> {
    return handleAsyncOperationStrict(
      async () => {
        logger.info("Getting user with memberships", { userId });

        const { data: user, error: userError } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();

        if (userError) {
          throw new Error(userError.message);
        }

        if (!user) {
          throw new Error("User not found");
        }

        const { data: memberships, error: membershipsError } = await supabaseAdmin
          .from("user_tenant_memberships")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "active");

        if (membershipsError) {
          logger.warn("Failed to get memberships", { userId, error: membershipsError.message });
        }

        logger.info("User with memberships retrieved successfully", { userId });
        return {
          ...user,
          memberships: memberships || [],
        };
      },
      "get user with memberships",
      {
        context: { userId },
      }
    );
  }

  /**
   * Update user profile
   * @param userId - User ID
   * @param data - Profile update data
   * @returns Updated user profile
   */
  async updateUserProfile(userId: string, data: UpdateUserProfileData): Promise<User> {
    return handleAsyncOperationStrict(
      async () => {
        logger.info("Updating user profile", { userId, fields: Object.keys(data) });

        const { data: updatedUser, error } = await supabaseAdmin
          .from("users")
          .update(data)
          .eq("id", userId)
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }

        if (!updatedUser) {
          throw new Error("User not found");
        }

        logger.info("User profile updated successfully", { userId });
        return updatedUser;
      },
      "update user profile",
      {
        context: { userId, fields: Object.keys(data) },
      }
    );
  }

  /**
   * Create new user (admin only)
   * @param data - User creation data
   * @returns Created user
   */
  async createUser(data: CreateUserData): Promise<User> {
    return handleAsyncOperationStrict(
      async () => {
        logger.info("Creating new user", { email: data.email });

        // Check if user already exists
        const existingUser = await this.getUserByEmail(data.email);
        if (existingUser) {
          throw new Error("User with this email already exists");
        }

        const { data: newUser, error } = await supabaseAdmin
          .from("users")
          .insert(data)
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }

        if (!newUser) {
          throw new Error("Failed to create user");
        }

        logger.info("User created successfully", { userId: newUser.id, email: newUser.email });
        return newUser;
      },
      "create user",
      {
        context: { email: data.email },
      }
    );
  }

  /**
   * Update user (admin only)
   * @param userId - User ID
   * @param data - Update data
   * @returns Updated user
   */
  async updateUser(userId: string, data: UpdateUserData): Promise<User> {
    return handleAsyncOperationStrict(
      async () => {
        logger.info("Updating user", { userId, fields: Object.keys(data) });

        const { data: updatedUser, error } = await supabaseAdmin
          .from("users")
          .update(data)
          .eq("id", userId)
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }

        if (!updatedUser) {
          throw new Error("User not found");
        }

        logger.info("User updated successfully", { userId });
        return updatedUser;
      },
      "update user",
      {
        context: { userId, fields: Object.keys(data) },
      }
    );
  }

  /**
   * Delete user (admin only)
   * @param userId - User ID
   * @returns Success message
   */
  async deleteUser(userId: string): Promise<{ message: string }> {
    return handleAsyncOperationStrict(
      async () => {
        logger.info("Deleting user", { userId });

        const { error } = await supabaseAdmin.from("users").delete().eq("id", userId);

        if (error) {
          throw new Error(error.message);
        }

        logger.info("User deleted successfully", { userId });
        return { message: "User deleted successfully" };
      },
      "delete user",
      {
        context: { userId },
      }
    );
  }

  /**
   * List users with pagination (admin only)
   * @param page - Page number
   * @param perPage - Items per page
   * @param search - Search term
   * @returns User list response
   */
  async listUsers(
    page: number = 1,
    perPage: number = 10,
    search?: string
  ): Promise<UserListResponse> {
    return handleAsyncOperationStrict(
      async () => {
        logger.info("Listing users", { page, perPage, search });

        let query = supabaseAdmin.from("users").select("*", { count: "exact" });

        // Add search filter
        if (search) {
          query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
        }

        // Add pagination
        const from = (page - 1) * perPage;
        const to = from + perPage - 1;

        const {
          data: users,
          error,
          count,
        } = await query.order("created_at", { ascending: false }).range(from, to);

        if (error) {
          throw new Error(error.message);
        }

        const total = count || 0;
        const totalPages = Math.ceil(total / perPage);

        logger.info("Users listed successfully", {
          total,
          page,
          perPage,
          totalPages,
        });

        return {
          users: users || [],
          total,
          page,
          perPage,
          totalPages,
        };
      },
      "list users",
      {
        context: { page, perPage, search },
      }
    );
  }

  /**
   * Get user statistics
   * @param userId - User ID
   * @returns User statistics
   */
  async getUserStats(userId: string): Promise<UserStats> {
    return handleAsyncOperationStrict(
      async () => {
        logger.info("Getting user stats", { userId });

        // Get user data
        const user = await this.getUserProfile(userId);

        // Get agents count
        const { count: agentsCount } = await supabaseAdmin
          .from("agents")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", userId);

        // Get total queries count
        const { count: totalQueries } = await supabaseAdmin
          .from("analytics")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        // Get tenants count
        const { count: tenantsCount } = await supabaseAdmin
          .from("user_tenant_memberships")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "active");

        logger.info("User stats retrieved successfully", { userId });

        return {
          agentsCount: agentsCount || 0,
          totalQueries: totalQueries || 0,
          tenantsCount: tenantsCount || 0,
          lastLoginAt: user.last_login,
          createdAt: user.created_at,
        };
      },
      "get user stats",
      {
        context: { userId },
      }
    );
  }

  /**
   * Get user by email
   * @param email - User email
   * @returns User data
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return handleAsyncOperationStrict(
      async () => {
        const { data, error } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("email", email)
          .single();

        if (error) {
          return null;
        }

        return data as User;
      },
      "get user by email",
      {
        context: { email },
      }
    );
  }

  /**
   * Add user to tenant
   * @param data - Membership creation data
   * @returns Created membership
   */
  async addUserToTenant(data: CreateMembershipData): Promise<UserTenantMembership> {
    return handleAsyncOperationStrict(
      async () => {
        logger.info("Adding user to tenant", {
          userId: data.user_id,
          tenantId: data.tenant_id,
        });

        // Check if membership already exists
        const { data: existing } = await supabaseAdmin
          .from("user_tenant_memberships")
          .select("*")
          .eq("user_id", data.user_id)
          .eq("tenant_id", data.tenant_id)
          .single();

        if (existing) {
          throw new Error("User is already a member of this tenant");
        }

        const { data: membership, error } = await supabaseAdmin
          .from("user_tenant_memberships")
          .insert(data)
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }

        if (!membership) {
          throw new Error("Failed to create membership");
        }

        logger.info("User added to tenant successfully", {
          userId: data.user_id,
          tenantId: data.tenant_id,
        });
        return membership;
      },
      "add user to tenant",
      {
        context: { userId: data.user_id, tenantId: data.tenant_id },
      }
    );
  }

  /**
   * Update user tenant membership
   * @param membershipId - Membership ID
   * @param data - Update data
   * @returns Updated membership
   */
  async updateMembership(
    membershipId: string,
    data: UpdateMembershipData
  ): Promise<UserTenantMembership> {
    return handleAsyncOperationStrict(
      async () => {
        logger.info("Updating membership", { membershipId, fields: Object.keys(data) });

        const { data: membership, error } = await supabaseAdmin
          .from("user_tenant_memberships")
          .update(data)
          .eq("id", membershipId)
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }

        if (!membership) {
          throw new Error("Membership not found");
        }

        logger.info("Membership updated successfully", { membershipId });
        return membership;
      },
      "update membership",
      {
        context: { membershipId, fields: Object.keys(data) },
      }
    );
  }

  /**
   * Remove user from tenant
   * @param membershipId - Membership ID
   * @returns Success message
   */
  async removeUserFromTenant(membershipId: string): Promise<{ message: string }> {
    return handleAsyncOperationStrict(
      async () => {
        logger.info("Removing user from tenant", { membershipId });

        const { error } = await supabaseAdmin
          .from("user_tenant_memberships")
          .delete()
          .eq("id", membershipId);

        if (error) {
          throw new Error(error.message);
        }

        logger.info("User removed from tenant successfully", { membershipId });
        return { message: "User removed from tenant successfully" };
      },
      "remove user from tenant",
      {
        context: { membershipId },
      }
    );
  }

  /**
   * Get user tenant memberships
   * @param userId - User ID
   * @returns User memberships
   */
  async getUserMemberships(userId: string): Promise<UserTenantMembership[]> {
    return handleAsyncOperationStrict(
      async () => {
        logger.info("Getting user memberships", { userId });

        const { data: memberships, error } = await supabaseAdmin
          .from("user_tenant_memberships")
          .select(
            `
            *,
            tenants (
              id,
              name,
              plan,
              status
            )
          `
          )
          .eq("user_id", userId)
          .order("joined_at", { ascending: false });

        if (error) {
          throw new Error(error.message);
        }

        logger.info("User memberships retrieved successfully", { userId });
        return memberships || [];
      },
      "get user memberships",
      {
        context: { userId },
      }
    );
  }
}

// Create and export service instance
export const userService = new UserService();
export default userService;
