/**
 * @file token.service.test.ts
 * @description Unit tests for TokenService
 */

import { TokenService } from "../../../src/services/token.service";

// Mock dependencies
jest.mock("../../../src/config/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

jest.mock("../../../src/config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

import { supabaseAdmin } from "../../../src/config/supabase";

describe("TokenService", () => {
  let tokenService: TokenService;
  let dbResults: { data: unknown; error: unknown; count?: number };

  beforeEach(() => {
    tokenService = new TokenService();
    dbResults = { data: null, error: null };

    // Reset mocks
    jest.clearAllMocks();

    // Setup chain mock
    const chainMock = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(() => Promise.resolve(dbResults)),
      then: jest.fn((cb) => cb(dbResults)),
    };

    (supabaseAdmin.from as jest.Mock).mockReturnValue(chainMock);
  });

  describe("createToken", () => {
    it("should throw error for access token type", async () => {
      await expect(
        tokenService.createToken({
          userId: "user-1",
          tokenType: "access",
        })
      ).rejects.toThrow("Access tokens should be created via AuthService");
    });

    it("should throw error for unknown token type", async () => {
      await expect(
        tokenService.createToken({
          userId: "user-1",
          tokenType: "unknown" as "access" | "refresh" | "password_reset" | "email_verification",
        })
      ).rejects.toThrow("Unknown token type: unknown");
    });

    it("should create refresh token successfully", async () => {
      const mockToken = {
        id: "token-1",
        user_id: "user-1",
        token_type: "refresh",
        token_value: "abc123",
        expires_at: new Date().toISOString(),
      };

      dbResults = { data: mockToken, error: null };

      const result = await tokenService.createToken({
        userId: "user-1",
        tokenType: "refresh",
        expiresInDays: 7,
      });

      expect(result).toEqual(mockToken);
    });

    it("should create password_reset token successfully", async () => {
      const mockToken = {
        id: "token-2",
        user_id: "user-1",
        token_type: "password_reset",
        token_value: "abc123def456",
        expires_at: new Date().toISOString(),
      };

      dbResults = { data: mockToken, error: null };

      const result = await tokenService.createToken({
        userId: "user-1",
        tokenType: "password_reset",
        expiresInDays: 1,
      });

      expect(result).toEqual(mockToken);
    });

    it("should throw error when database insert fails", async () => {
      dbResults = { data: null, error: { message: "DB error" } };

      await expect(
        tokenService.createToken({
          userId: "user-1",
          tokenType: "refresh",
        })
      ).rejects.toThrow("Failed to create token");
    });
  });

  describe("validateToken", () => {
    it("should return token when valid", async () => {
      const mockToken = {
        id: "token-1",
        user_id: "user-1",
        token_type: "refresh",
        token_value: "validtoken",
        is_revoked: false,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      };

      dbResults = { data: mockToken, error: null };

      const result = await tokenService.validateToken("validtoken", "refresh");

      expect(result).toEqual(mockToken);
    });

    it("should return null when token invalid", async () => {
      dbResults = { data: null, error: { message: "Not found" } };

      const result = await tokenService.validateToken("invalidtoken", "refresh");

      expect(result).toBeNull();
    });
  });

  describe("revokeToken", () => {
    it("should revoke token successfully", async () => {
      dbResults = { data: null, error: null };

      const result = await tokenService.revokeToken("sometoken", "refresh");

      expect(result).toBe(true);
    });

    it("should return false when revoke fails", async () => {
      dbResults = { data: null, error: { message: "DB error" } };

      const result = await tokenService.revokeToken("sometoken", "refresh");

      expect(result).toBe(false);
    });
  });

  describe("revokeAllUserTokens", () => {
    it("should revoke all user tokens", async () => {
      dbResults = { data: null, error: null, count: 5 };

      const result = await tokenService.revokeAllUserTokens("user-1");

      expect(result).toBe(5);
    });

    it("should revoke only specific token type", async () => {
      dbResults = { data: null, error: null, count: 2 };

      const result = await tokenService.revokeAllUserTokens("user-1", "refresh");

      expect(result).toBe(2);
    });

    it("should return 0 on error", async () => {
      dbResults = { data: null, error: { message: "DB error" }, count: 0 };

      const result = await tokenService.revokeAllUserTokens("user-1");

      expect(result).toBe(0);
    });
  });

  describe("getTokenById", () => {
    it("should return token when found", async () => {
      const mockToken = {
        id: "token-1",
        user_id: "user-1",
        token_type: "refresh",
      };

      dbResults = { data: mockToken, error: null };

      const result = await tokenService.getTokenById("token-1");

      expect(result).toEqual(mockToken);
    });

    it("should return null when not found", async () => {
      dbResults = { data: null, error: { message: "Not found" } };

      const result = await tokenService.getTokenById("invalid-id");

      expect(result).toBeNull();
    });
  });

  describe("revokeTokenById", () => {
    it("should revoke token by ID successfully", async () => {
      dbResults = { data: null, error: null };

      const result = await tokenService.revokeTokenById("token-1");

      expect(result).toBe(true);
    });

    it("should return false on error", async () => {
      dbResults = { data: null, error: { message: "DB error" } };

      const result = await tokenService.revokeTokenById("token-1");

      expect(result).toBe(false);
    });
  });

  describe("getUserActiveTokens", () => {
    it("should return active tokens", async () => {
      const mockTokens = [
        { id: "token-1", user_id: "user-1", token_type: "refresh" },
        { id: "token-2", user_id: "user-1", token_type: "refresh" },
      ];

      // For list operations, we need different chain
      const chainMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        order: jest.fn(() => Promise.resolve({ data: mockTokens, error: null })),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue(chainMock);

      const result = await tokenService.getUserActiveTokens("user-1");

      expect(result).toEqual(mockTokens);
    });

    it("should return empty array on error", async () => {
      const chainMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        order: jest.fn(() => Promise.resolve({ data: null, error: { message: "Error" } })),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue(chainMock);

      const result = await tokenService.getUserActiveTokens("user-1");

      expect(result).toEqual([]);
    });
  });

  describe("getTokenStats", () => {
    it("should return token statistics", async () => {
      const now = new Date();
      const mockStats = [
        {
          token_type: "refresh",
          is_revoked: false,
          expires_at: new Date(now.getTime() + 86400000).toISOString(),
        },
        {
          token_type: "refresh",
          is_revoked: true,
          expires_at: new Date(now.getTime() + 86400000).toISOString(),
        },
        {
          token_type: "password_reset",
          is_revoked: false,
          expires_at: new Date(now.getTime() - 86400000).toISOString(),
        },
      ];

      const chainMock = {
        select: jest.fn(() => Promise.resolve({ data: mockStats, error: null })),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue(chainMock);

      const result = await tokenService.getTokenStats();

      expect(result.totalTokens).toBe(3);
      expect(result.revokedTokens).toBe(1);
      expect(result.tokensByType["refresh"]).toBe(2);
      expect(result.tokensByType["password_reset"]).toBe(1);
    });

    it("should return empty stats on error", async () => {
      const chainMock = {
        select: jest.fn(() => Promise.resolve({ data: null, error: { message: "Error" } })),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue(chainMock);

      const result = await tokenService.getTokenStats();

      expect(result).toEqual({
        totalTokens: 0,
        activeTokens: 0,
        expiredTokens: 0,
        revokedTokens: 0,
        tokensByType: {},
      });
    });
  });
});
