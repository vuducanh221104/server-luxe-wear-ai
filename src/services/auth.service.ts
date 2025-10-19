/**
 * @file auth.service.ts
 * @description Authentication service using Supabase Auth
 * Wrapper for Supabase Auth with business logic
 */

import { supabase, supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";
import { User } from "@supabase/supabase-js";
import { RegisterData, LoginCredentials, AuthResponse } from "../types";
import { tenantService } from "./tenant.service";

/**
 * Register a new user
 * @param data - Registration data
 * @returns Auth response with user and tokens
 */
export const register = async (data: RegisterData): Promise<AuthResponse> => {
  const { email, password, name } = data;

  logger.info("Attempting user registration", { email });

  // Register user with Supabase Auth
  const { data: authData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name || email.split("@")[0], // Use email prefix as default name
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

  // Check if email confirmation is required
  if (!authData.session) {
    logger.info("Email confirmation required", {
      email,
      userId: authData.user.id,
      emailConfirmedAt: authData.user.email_confirmed_at,
    });

    // Return user data without session - frontend should handle email confirmation
    return {
      user: authData.user,
      session: null,
      accessToken: "", // Empty until email is confirmed
      refreshToken: "", // Empty until email is confirmed
    };
  }

  // Note: Tenant creation moved to login flow
  // This ensures tenant is only created when user actually logs in

  logger.info("User registered successfully", {
    userId: authData.user.id,
    email: authData.user.email,
  });

  return {
    user: authData.user,
    session: authData.session,
    accessToken: authData.session.access_token,
    refreshToken: authData.session.refresh_token,
  };
};

/**
 * Login user with email and password
 * @param credentials - Login credentials
 * @returns Auth response with user and tokens
 */
export const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const { email, password } = credentials;

  logger.info("Attempting user login", { email });

  // Sign in with Supabase Auth
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
  await updateLastLogin(data.user.id);

  // Auto create default tenant for user if they don't have any tenants
  try {
    const userTenants = await tenantService.getUserTenants(data.user.id);
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
    }
  } catch (tenantError) {
    logger.error("Failed to create default tenant on login", {
      userId: data.user.id,
      error: tenantError instanceof Error ? tenantError.message : "Unknown error",
    });
    // Don't fail login if tenant creation fails
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
  };
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
};

/**
 * Request password reset email
 * @param email - User's email
 */
export const forgotPassword = async (email: string): Promise<void> => {
  logger.info("Password reset requested", { email });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.FRONTEND_URL || "http://localhost:3001"}/api/auth/callback-fragment`,
  });

  if (error) {
    logger.error("Password reset request failed", { email, error: error.message });
    throw new Error(error.message);
  }

  logger.info("Password reset email sent", { email });
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
  const { data, error } = await supabase.auth.getUser(token);

  if (error) {
    logger.error("Token verification failed", { error: error.message });
    throw new Error("Invalid or expired token");
  }

  if (!data.user) {
    throw new Error("No user found for token");
  }

  return data.user;
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
