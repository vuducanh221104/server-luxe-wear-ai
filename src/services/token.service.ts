/**
 * @file token.service.ts
 * @description Token management service for custom authentication
 * Handles token creation, validation, revocation, and cleanup
 */

import { supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";
import crypto from "crypto";
import { TokenRecord, CreateTokenData } from "../types/token";

export class TokenService {
  /**
   * Create a new token
   */
  async createToken(data: CreateTokenData): Promise<TokenRecord> {
    const { userId, tokenType, expiresInDays = 30, metadata = {} } = data;

    // Generate token based on type
    let tokenValue: string;
    switch (tokenType) {
      case "access":
        // Access tokens are JWT (handled by auth service)
        throw new Error("Access tokens should be created via AuthService");
      case "refresh":
        tokenValue = crypto.randomBytes(8).toString("hex").substring(0, 12);
        break;
      case "password_reset":
        tokenValue = crypto.randomBytes(16).toString("hex");
        break;
      case "email_verification":
        tokenValue = crypto.randomBytes(16).toString("hex");
        break;
      default:
        throw new Error(`Unknown token type: ${tokenType}`);
    }

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Store token in database
    const { data: tokenRecord, error } = await supabaseAdmin
      .from("user_tokens")
      .insert({
        user_id: userId,
        token_type: tokenType,
        token_value: tokenValue,
        expires_at: expiresAt.toISOString(),
        metadata,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create token", { error: error.message, userId, tokenType });
      throw new Error("Failed to create token");
    }

    logger.info("Token created successfully", {
      tokenId: tokenRecord.id,
      userId,
      tokenType,
      expiresAt: expiresAt.toISOString(),
    });

    return tokenRecord;
  }

  /**
   * Validate and get token
   */
  async validateToken(tokenValue: string, tokenType: string): Promise<TokenRecord | null> {
    const { data: token, error } = await supabaseAdmin
      .from("user_tokens")
      .select("*")
      .eq("token_value", tokenValue)
      .eq("token_type", tokenType)
      .eq("is_revoked", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error || !token) {
      logger.warn("Token validation failed", {
        tokenType,
        error: error?.message,
        tokenValue: tokenValue.substring(0, 8) + "...",
      });
      return null;
    }

    return token;
  }

  /**
   * Revoke a token
   */
  async revokeToken(tokenValue: string, tokenType: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from("user_tokens")
      .update({
        is_revoked: true,
        revoked_at: new Date().toISOString(),
      })
      .eq("token_value", tokenValue)
      .eq("token_type", tokenType);

    if (error) {
      logger.error("Failed to revoke token", { error: error.message, tokenType });
      return false;
    }

    logger.info("Token revoked successfully", { tokenType });
    return true;
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeAllUserTokens(userId: string, tokenType?: string): Promise<number> {
    let query = supabaseAdmin
      .from("user_tokens")
      .update({
        is_revoked: true,
        revoked_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("is_revoked", false);

    if (tokenType) {
      query = query.eq("token_type", tokenType);
    }

    const { count, error } = await query;

    if (error) {
      logger.error("Failed to revoke user tokens", { error: error.message, userId });
      return 0;
    }

    logger.info("User tokens revoked", { userId, tokenType, count });
    return count || 0;
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from("user_tokens")
      .delete()
      .lt("expires_at", new Date().toISOString());

    if (error) {
      logger.error("Failed to cleanup expired tokens", { error: error.message });
      return 0;
    }

    logger.info("Expired tokens cleaned up", { count });
    return count || 0;
  }

  /**
   * Get user's active tokens
   */
  async getUserActiveTokens(userId: string, tokenType?: string): Promise<TokenRecord[]> {
    let query = supabaseAdmin
      .from("user_tokens")
      .select("*")
      .eq("user_id", userId)
      .eq("is_revoked", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (tokenType) {
      query = query.eq("token_type", tokenType);
    }

    const { data: tokens, error } = await query;

    if (error) {
      logger.error("Failed to get user tokens", { error: error.message, userId });
      return [];
    }

    return tokens || [];
  }

  /**
   * Get token statistics
   */
  async getTokenStats(): Promise<{
    totalTokens: number;
    activeTokens: number;
    expiredTokens: number;
    revokedTokens: number;
    tokensByType: Record<string, number>;
  }> {
    const { data: stats, error } = await supabaseAdmin
      .from("user_tokens")
      .select("token_type, is_revoked, expires_at");

    if (error) {
      logger.error("Failed to get token stats", { error: error.message });
      return {
        totalTokens: 0,
        activeTokens: 0,
        expiredTokens: 0,
        revokedTokens: 0,
        tokensByType: {},
      };
    }

    const now = new Date();
    const result = {
      totalTokens: stats.length,
      activeTokens: 0,
      expiredTokens: 0,
      revokedTokens: 0,
      tokensByType: {} as Record<string, number>,
    };

    stats.forEach((token) => {
      // Count by type
      result.tokensByType[token.token_type] = (result.tokensByType[token.token_type] || 0) + 1;

      // Count by status
      if (token.is_revoked) {
        result.revokedTokens++;
      } else if (new Date(token.expires_at) < now) {
        result.expiredTokens++;
      } else {
        result.activeTokens++;
      }
    });

    return result;
  }
}

// Export singleton instance
export const tokenService = new TokenService();
export default tokenService;
