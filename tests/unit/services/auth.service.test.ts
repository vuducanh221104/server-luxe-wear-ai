/**
 * @file auth.service.test.ts
 * @description Unit tests for auth service
 */

// Track database results
let dbResults: { data: unknown; error: unknown } = { data: null, error: null };

// Mock bcryptjs
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed_password"),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock jsonwebtoken
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("mock_jwt_token"),
  verify: jest.fn().mockReturnValue({ userId: "user-123" }),
}));

// Mock token service
const mockValidateToken = jest.fn();
const mockRevokeAllUserTokens = jest.fn();
const mockGetUserActiveTokens = jest.fn();
const mockCreateToken = jest.fn();

jest.mock("../../../src/services/token.service", () => ({
  tokenService: {
    validateToken: (...args: unknown[]) => mockValidateToken(...args),
    revokeAllUserTokens: (...args: unknown[]) => mockRevokeAllUserTokens(...args),
    getUserActiveTokens: (...args: unknown[]) => mockGetUserActiveTokens(...args),
    createToken: (...args: unknown[]) => mockCreateToken(...args),
  },
}));

// Mock tenant service
const mockCreateDefaultTenant = jest.fn();

jest.mock("../../../src/services/tenant.service", () => ({
  tenantService: {
    createDefaultTenant: (...args: unknown[]) => mockCreateDefaultTenant(...args),
  },
}));

jest.mock("../../../src/config/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn().mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(() => Promise.resolve(dbResults)),
    })),
  },
}));

jest.mock("../../../src/config/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

// Import after mocks
import { AuthService } from "../../../src/services/auth.service";
import bcrypt from "bcryptjs";

describe("AuthService", () => {
  let authService: AuthService;

  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    password_hash: "hashed_password",
    role: "member",
    is_active: true,
    email_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variable
    process.env.JWT_SECRET = "test-secret";
    authService = new AuthService();

    // Reset db results
    dbResults = { data: null, error: null };

    // Default mock implementations
    mockGetUserActiveTokens.mockResolvedValue([]);
    mockCreateToken.mockResolvedValue({ id: "token-123", token_value: "mock_refresh_token" });
    mockCreateDefaultTenant.mockResolvedValue({ id: "tenant-123" });
  });

  describe("register", () => {
    it("should throw error if user already exists", async () => {
      dbResults = { data: mockUser, error: null };

      await expect(
        authService.register({
          email: "test@example.com",
          password: "password123",
        })
      ).rejects.toThrow("User with this email already exists");
    });
  });

  describe("login", () => {
    it("should throw error for invalid email", async () => {
      dbResults = { data: null, error: { code: "PGRST116" } };

      await expect(
        authService.login({
          email: "invalid@example.com",
          password: "password123",
        })
      ).rejects.toThrow("Invalid email or password");
    });

    it("should throw error for invalid password", async () => {
      dbResults = { data: mockUser, error: null };
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        authService.login({
          email: "test@example.com",
          password: "wrongpassword",
        })
      ).rejects.toThrow("Invalid email or password");
    });

    it("should throw error for deactivated account", async () => {
      dbResults = { data: { ...mockUser, is_active: false }, error: null };

      await expect(
        authService.login({
          email: "test@example.com",
          password: "password123",
        })
      ).rejects.toThrow("Account is deactivated");
    });
  });

  describe("verifyToken", () => {
    it("should verify valid token and return user", async () => {
      dbResults = { data: mockUser, error: null };

      const result = await authService.verifyToken("valid_token");

      expect(result).toEqual(mockUser);
    });

    it("should throw error for invalid token", async () => {
      const jwt = require("jsonwebtoken");
      jwt.verify.mockImplementationOnce(() => {
        throw new Error("Invalid token");
      });

      await expect(authService.verifyToken("invalid_token")).rejects.toThrow("Invalid token");
    });

    it("should throw error if user not found", async () => {
      dbResults = { data: null, error: { code: "PGRST116" } };

      await expect(authService.verifyToken("valid_token")).rejects.toThrow("Invalid token");
    });

    it("should throw error if user is deactivated", async () => {
      dbResults = { data: { ...mockUser, is_active: false }, error: null };

      await expect(authService.verifyToken("valid_token")).rejects.toThrow("Invalid token");
    });
  });

  describe("refreshToken", () => {
    it("should throw error for invalid refresh token", async () => {
      mockValidateToken.mockResolvedValueOnce(null);

      await expect(authService.refreshToken("invalid_refresh_token")).rejects.toThrow(
        "Invalid refresh token"
      );
    });

    it("should throw error if user not found", async () => {
      mockValidateToken.mockResolvedValueOnce({
        id: "token-123",
        user_id: "user-123",
      });
      dbResults = { data: null, error: { code: "PGRST116" } };

      await expect(authService.refreshToken("valid_refresh_token")).rejects.toThrow(
        "Invalid refresh token"
      );
    });

    it("should throw error if user is deactivated", async () => {
      mockValidateToken.mockResolvedValueOnce({
        id: "token-123",
        user_id: "user-123",
      });
      dbResults = { data: { ...mockUser, is_active: false }, error: null };

      await expect(authService.refreshToken("valid_refresh_token")).rejects.toThrow(
        "Invalid refresh token"
      );
    });
  });

  describe("logout", () => {
    it("should logout user successfully", async () => {
      mockRevokeAllUserTokens.mockResolvedValueOnce(2);

      const result = await authService.logout("user-123");

      expect(result.message).toBe("Logged out successfully");
      expect(mockRevokeAllUserTokens).toHaveBeenCalledWith("user-123");
    });

    it("should handle logout errors", async () => {
      mockRevokeAllUserTokens.mockRejectedValueOnce(new Error("Database error"));

      await expect(authService.logout("user-123")).rejects.toThrow();
    });
  });
});
