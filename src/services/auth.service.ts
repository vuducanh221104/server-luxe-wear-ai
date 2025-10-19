/**
 * @file auth.service.ts
 * @description Authentication service using Supabase Auth
 * Wrapper for Supabase Auth with business logic
 */

import { supabase, supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";
import { User } from "@supabase/supabase-js";
import { RegisterData, LoginCredentials, AuthResponse } from "../types";
import { UserTenantMembership } from "../types/tenant";
import { tenantService } from "./tenant.service";

/**
 * Register a new user
 * @param data - Registration data
 * @returns Auth response with user and tokens
 */
export const register = async (data: RegisterData): Promise<AuthResponse> => {
  const { email, password, name, role } = data;

  logger.info("Attempting user registration", { email, role });

  try {
    // Register user with Supabase Auth
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split("@")[0], // Use email prefix as default name
          role: role || "authenticated",
        },
      },
    });

    if (error) {
      logger.error("User registration failed", { email, error: error.message });
      throw new Error(error.message);
    }

    if (!authData.user) {
      logger.error("Registration returned no user", { email });
      throw new Error("Registration failed - no user data returned");
    }

    // If role is admin, update user role in auth.users table
    if (role === "admin") {
      try {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          authData.user.id,
          {
            user_metadata: {
              ...authData.user.user_metadata,
              name: name || email.split("@")[0],
            },
          }
        );

        if (updateError) {
          logger.error("Failed to set admin role", {
            userId: authData.user.id,
            error: updateError.message,
          });
          // Don't throw error here, user is still registered successfully
        } else {
          logger.info("Admin role set successfully", {
            userId: authData.user.id,
            email: authData.user.email,
          });
        }
      } catch (updateError) {
        logger.error("Failed to update user role", {
          userId: authData.user.id,
          error: updateError instanceof Error ? updateError.message : "Unknown error",
        });
      }
    }

    // User registered successfully - no email confirmation needed
    logger.info("User registered successfully", {
      userId: authData.user.id,
      email: authData.user.email,
      role,
    });

    return {
      user: authData.user,
      session: authData.session,
      accessToken: authData.session?.access_token ?? "",
      refreshToken: authData.session?.refresh_token ?? "",
    };
  } catch (error) {
    logger.error("Failed to register user", {
      email,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
};

/**
 * Login user with email and password
 * @param credentials - Login credentials
 * @returns Auth response with user and tokens
 */
export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const { email, password } = credentials;

  logger.info("Attempting user login", { email });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.error("User login failed", { email, error: error.message });
      throw new Error(error.message);
    }

    if (!data.user || !data.session) {
      logger.error("Login returned no user or session", { email });
      throw new Error("Login failed - no user data returned");
    }

    // Optional: Update last login timestamp
    try {
      await updateLastLogin(data.user.id);
    } catch (error) {
      logger.warn("Failed to update last login", {
        userId: data.user.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Don't fail login for metadata update failure
    }

    let userTenants: UserTenantMembership[] = [];
    try {
      userTenants = await tenantService.getUserTenants(data.user.id);
      if (userTenants.length === 0) {
        const tenant = await tenantService.createTenant(
          {
            name: `${data.user.user_metadata?.name || email.split("@")[0]}'s Workspace`,
            plan: "free",
            status: "active",
          },
          data.user.id
        );

        logger.info("Default tenant created for user on first login", {
          userId: data.user.id,
          tenantId: tenant.id,
          tenantName: tenant.name,
        });

        // Get updated user tenants after creating default tenant
        userTenants = await tenantService.getUserTenants(data.user.id);
      }
    } catch (tenantError) {
      logger.error("Failed to create default tenant on login", {
        userId: data.user.id,
        error: tenantError instanceof Error ? tenantError.message : "Unknown error",
      });
      // Continue with empty tenants array
    }

    logger.info("User logged in successfully", {
      userId: data.user.id,
      email: data.user.email,
    });

    // Debug: Log token details
    logger.debug("Login tokens generated", {
      hasAccessToken: !!data.session.access_token,
      accessTokenLength: data.session.access_token?.length || 0,
      hasRefreshToken: !!data.session.refresh_token,
      refreshTokenLength: data.session.refresh_token?.length || 0,
      tokenType: data.session.token_type,
      expiresAt: data.session.expires_at,
    });

    return {
      user: data.user,
      session: data.session,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      userTenants: userTenants,
    };
  } catch (error) {
    logger.error("Failed to login user", {
      email,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
};

/**
 * Logout user
 * @param accessToken - User's access token
 */
export const logout = async (): Promise<void> => {
  logger.info("Attempting user logout");

  const { error } = await supabase.auth.signOut();

  if (error) {
    logger.error("User logout failed", { error: error.message });
    throw new Error(error.message);
  }

  logger.info("User logged out successfully");
};

/**
 * Refresh access token using refresh token
 * @param refreshToken - User's refresh token
 * @returns New session with fresh tokens
 */
export const refreshToken = async (refreshToken: string): Promise<AuthResponse> => {
  logger.info("Attempting token refresh");

  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      logger.error("Token refresh failed", { error: error.message });
      throw new Error(error.message);
    }

    if (!data.user || !data.session) {
      logger.error("Token refresh returned no user or session");
      throw new Error("Token refresh failed - no session data returned");
    }

    logger.info("Token refreshed successfully", { userId: data.user.id });

    return {
      user: data.user,
      session: data.session,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  } catch (error) {
    logger.error("Failed to refresh token", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
};

/**
 * Request password reset email
 * @param email - User's email
 */
export const forgotPassword = async (email: string): Promise<void> => {
  logger.info("Password reset requested", { email });

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL || "http://localhost:3001"}/api/auth/callback-fragment`,
    });

    if (error) {
      logger.error("Password reset request failed", { email, error: error.message });
      throw new Error(error.message);
    }

    logger.info("Password reset email sent", { email });
  } catch (error) {
    logger.error("Failed to forgot password", {
      email,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
};

/**
 * Reset password with token
 * @param token - Reset token from email
 * @param newPassword - New password
 */
export const resetPassword = async (newPassword: string): Promise<void> => {
  logger.info("Attempting password reset");

  // Update password (token is already verified by Supabase in session)
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    logger.error("Password reset failed", { error: error.message });
    throw new Error(error.message);
  }

  logger.info("Password reset successfully");
};

/**
 * Verify JWT token
 * @param token - JWT access token
 * @returns User object if valid
 */
export const verifyToken = async (token: string): Promise<User> => {
  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      logger.error("Token verification failed", { error: error.message });
      throw new Error("Invalid or expired token");
    }

    if (!data.user) {
      throw new Error("No user found for token");
    }

    return data.user;
  } catch (error) {
    logger.error("Failed to verify token", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
};

/**
 * Get user by ID (admin operation)
 * @param userId - User ID
 * @returns User object
 */
export const getUserById = async (userId: string): Promise<User> => {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error) {
    logger.error("Get user by ID failed", { userId, error: error.message });
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error("User not found");
  }

  return data.user;
};

/**
 * Update last login timestamp
 * @param userId - User ID
 */
const updateLastLogin = async (userId: string): Promise<void> => {
  try {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        last_login: new Date().toISOString(),
      },
    });
  } catch (error) {
    // Don't throw error for metadata update failure
    logger.warn("Failed to update last login", { userId, error });
  }
};
