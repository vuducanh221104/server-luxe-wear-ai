/**
 * @file auth.service.ts
 * @description Authentication service using custom users table
 * Handles user authentication, registration, and JWT token management
 */

import { supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, UserAuthData, UpdateUserData } from "../types/user";
import { AuthResponse, UserSession } from "../types/auth";
import { tokenService } from "./token.service";
import { tenantService } from "./tenant.service";

/**
 * Auth Service Class
 * Class-based service for authentication operations using custom users table
 */
export class AuthService {
  private readonly JWT_SECRET: string =
    process.env.JWT_SECRET ||
    "luxe-wear-ai-super-secret-key-2024-very-long-and-secure-jwt-secret-key-for-production-use-only";
  private readonly JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || "7d";

  /**
   * Register a new user
   * @param data - Registration data
   * @returns Auth response with user and tokens
   */
  async register(data: UserAuthData): Promise<AuthResponse> {
    const { email, password, name } = data;

    logger.info("Attempting user registration", { email });

    try {
      // Check if user already exists
      const existingUser = await this.getUserByEmail(email);
      if (existingUser) {
        throw new Error("User with this email already exists");
      }

      // Hash password
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // Create user in custom users table
      const { data: userData, error } = await supabaseAdmin
        .from("users")
        .insert({
          email,
          password_hash,
          name: name || email.split("@")[0],
          role: "member",
          is_active: true,
          email_verified: false,
        })
        .select()
        .single();

      if (error) {
        logger.error("User registration failed", { email, error: error.message });
        throw new Error(error.message);
      }

      if (!userData) {
        throw new Error("Registration failed - no user data returned");
      }

      // Create default tenant for the new user
      try {
        await tenantService.createDefaultTenant(userData.id, userData.email);
        logger.info("Default tenant created for new user", {
          userId: userData.id,
          email: userData.email,
        });
      } catch (tenantError) {
        logger.warn("Failed to create default tenant, but user registration succeeded", {
          userId: userData.id,
          email: userData.email,
          error: tenantError instanceof Error ? tenantError.message : "Unknown error",
        });
        // Don't fail registration if tenant creation fails
      }

      // Generate tokens
      const token = await this.generateToken(userData.id);
      const refreshToken = await this.generateRefreshToken(userData.id);

      logger.info("User registered successfully", {
        userId: userData.id,
        email: userData.email,
      });

      return {
        user: userData,
        token,
        refreshToken,
        message: "User registered successfully",
      };
    } catch (error) {
      logger.error("Registration error", {
        email,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Login user
   * @param credentials - Login credentials
   * @returns Auth response with user and tokens
   */
  async login(credentials: UserAuthData): Promise<AuthResponse> {
    const { email, password } = credentials;

    logger.info("Attempting user login", { email });

    try {
      // Get user by email
      const user = await this.getUserByEmail(email);
      if (!user) {
        throw new Error("Invalid email or password");
      }

      // Check if user is active
      if (!user.is_active) {
        throw new Error("Account is deactivated");
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        throw new Error("Invalid email or password");
      }

      // Update last login
      await this.updateLastLogin(user.id);

      // Generate access token
      const token = await this.generateToken(user.id);

      // Reuse existing active refresh token if available, otherwise create a new one
      const activeRefreshTokens = await tokenService.getUserActiveTokens(user.id, "refresh");
      const refreshToken =
        activeRefreshTokens && activeRefreshTokens.length > 0
          ? activeRefreshTokens[0].token_value
          : await this.generateRefreshToken(user.id);

      logger.info("User logged in successfully", {
        userId: user.id,
        email: user.email,
      });

      return {
        user,
        token,
        refreshToken,
        message: "Login successful",
      };
    } catch (error) {
      logger.error("Login error", {
        email,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Verify JWT token
   * @param token - JWT token
   * @returns User data if token is valid
   */
  async verifyToken(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as { userId: string };

      const user = await this.getUserById(decoded.userId);
      if (!user) {
        throw new Error("User not found");
      }

      if (!user.is_active) {
        throw new Error("Account is deactivated");
      }

      return user;
    } catch (error) {
      logger.error("Token verification failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error("Invalid token");
    }
  }

  /**
   * Refresh access token
   * @param refreshToken - Refresh token
   * @returns New access token
   */
  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    try {
      // Validate refresh token using token service
      const tokenRecord = await tokenService.validateToken(refreshToken, "refresh");
      if (!tokenRecord) {
        throw new Error("Invalid refresh token");
      }

      // Get user data
      const user = await this.getUserById(tokenRecord.user_id);
      if (!user) {
        throw new Error("User not found");
      }

      // Check if user is active
      if (!user.is_active) {
        throw new Error("Account is deactivated");
      }

      // Generate new access token
      const token = await this.generateToken(user.id);

      logger.info("Token refreshed successfully", {
        userId: user.id,
        email: user.email,
        tokenId: tokenRecord.id,
      });

      return { token };
    } catch (error) {
      logger.error("Token refresh failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error("Invalid refresh token");
    }
  }

  /**
   * Logout user (revoke all tokens)
   * @param userId - User ID
   * @returns Success message
   */
  async logout(userId: string): Promise<{ message: string }> {
    try {
      // Revoke all user tokens
      const revokedCount = await tokenService.revokeAllUserTokens(userId);

      logger.info("User logged out successfully", {
        userId,
        revokedTokens: revokedCount,
      });

      return { message: "Logged out successfully" };
    } catch (error) {
      logger.error("Logout failed", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Revoke specific refresh token
   * @param refreshToken - Refresh token to revoke
   * @returns Success message
   */
  async revokeRefreshToken(refreshToken: string): Promise<{ message: string }> {
    try {
      const success = await tokenService.revokeToken(refreshToken, "refresh");

      if (!success) {
        throw new Error("Failed to revoke refresh token");
      }

      logger.info("Refresh token revoked successfully");
      return { message: "Refresh token revoked successfully" };
    } catch (error) {
      logger.error("Failed to revoke refresh token", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Get user's active sessions
   * @param userId - User ID
   * @returns Active tokens
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    try {
      const activeTokens = await tokenService.getUserActiveTokens(userId, "refresh");

      return activeTokens.map((token) => ({
        id: token.id,
        createdAt: token.created_at,
        expiresAt: token.expires_at,
        metadata: token.metadata,
      }));
    } catch (error) {
      logger.error("Failed to get user sessions", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param id - User ID
   * @returns User data
   */
  async getUserById(id: string): Promise<User | null> {
    try {
      const { data, error } = await supabaseAdmin.from("users").select("*").eq("id", id).single();

      if (error) {
        logger.error("Get user by ID error", { id, error: error.message });
        return null;
      }

      return data;
    } catch (error) {
      logger.error("Get user by ID error", {
        id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Get user by email
   * @param email - User email
   * @returns User data
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      if (error) {
        logger.error("Get user by email error", { email, error: error.message });
        return null;
      }

      return data;
    } catch (error) {
      logger.error("Get user by email error", {
        email,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  }

  /**
   * Update user data
   * @param id - User ID
   * @param data - Update data
   * @returns Updated user
   */
  async updateUser(id: string, data: UpdateUserData): Promise<User> {
    try {
      const { data: userData, error } = await supabaseAdmin
        .from("users")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        logger.error("Update user error", { id, error: error.message });
        throw new Error(error.message);
      }

      if (!userData) {
        throw new Error("User not found");
      }

      logger.info("User updated successfully", { userId: id });
      return userData;
    } catch (error) {
      logger.error("Update user error", {
        id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Update last login timestamp
   * @param id - User ID
   */
  private async updateLastLogin(id: string): Promise<void> {
    try {
      await supabaseAdmin
        .from("users")
        .update({ last_login: new Date().toISOString() })
        .eq("id", id);
    } catch (error) {
      logger.error("Update last login error", {
        id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Generate JWT token
   * @param userId - User ID
   * @returns JWT token
   */
  private async generateToken(userId: string): Promise<string> {
    // Get user data for token payload
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error("User not found for token generation");
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      email_verified: user.email_verified,
      iat: Math.floor(Date.now() / 1000),
      iss: "luxe-wear-ai",
      aud: "luxe-wear-ai-users",
      sub: user.id,
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN,
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token (short random string like Supabase)
   * @param userId - User ID
   * @returns Refresh token
   */
  private async generateRefreshToken(userId: string): Promise<string> {
    // Create refresh token using token service
    const tokenRecord = await tokenService.createToken({
      userId,
      tokenType: "refresh",
      expiresInDays: 30,
      metadata: {
        generated_at: new Date().toISOString(),
        user_agent: "luxe-wear-ai",
      },
    });

    return tokenRecord.token_value;
  }

  /**
   * Change user password
   * @param userId - User ID
   * @param currentPassword - Current password
   * @param newPassword - New password
   * @returns Success message
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw new Error("Current password is incorrect");
      }

      // Hash new password
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await supabaseAdmin.from("users").update({ password_hash }).eq("id", userId);

      logger.info("Password changed successfully", { userId });
      return { message: "Password changed successfully" };
    } catch (error) {
      logger.error("Change password error", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Reset user password (admin only)
   * @param userId - User ID
   * @param newPassword - New password
   * @returns Success message
   */
  async resetPassword(userId: string, newPassword: string): Promise<{ message: string }> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Hash new password
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await supabaseAdmin.from("users").update({ password_hash }).eq("id", userId);

      logger.info("Password reset successfully", { userId });
      return { message: "Password reset successfully" };
    } catch (error) {
      logger.error("Reset password error", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}

// Create and export service instance
export const authService = new AuthService();
export default authService;
