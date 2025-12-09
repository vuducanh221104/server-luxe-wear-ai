/**
 * @file auth.controller.test.ts
 * @description Unit tests for auth controller
 */

// Mock dependencies FIRST before any imports
const mockRegister = jest.fn();
const mockLogin = jest.fn();
const mockLogout = jest.fn();
const mockRefreshToken = jest.fn();
const mockGetUserByEmail = jest.fn();
const mockVerifyToken = jest.fn();

jest.mock("../../../src/services/auth.service", () => ({
  authService: {
    register: mockRegister,
    login: mockLogin,
    logout: mockLogout,
    refreshToken: mockRefreshToken,
    getUserByEmail: mockGetUserByEmail,
    verifyToken: mockVerifyToken,
  },
}));

jest.mock("../../../src/services/user.service", () => ({
  userService: {
    getUserMemberships: jest.fn().mockResolvedValue([]),
    getUserWithMemberships: jest.fn().mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: "Test User",
      memberships: [],
    }),
  },
}));

jest.mock("../../../src/services/token.service", () => ({
  tokenService: {
    createToken: jest.fn(),
    validateToken: jest.fn(),
    revokeToken: jest.fn(),
  },
}));

jest.mock("express-validator", () => ({
  validationResult: jest.fn().mockReturnValue({
    isEmpty: () => true,
    array: () => [],
  }),
}));

jest.mock("../../../src/config/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

// Now import after mocks
import { Request, Response } from "express";
import { AuthController } from "../../../src/controllers/auth.controller";
import { User, UserRole } from "../../../src/types/user";

// Helper function to create mock user
const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  email: "test@example.com",
  password_hash: "hashed",
  name: "Test User",
  avatar_url: null,
  phone: null,
  website: null,
  role: "member" as UserRole,
  preferences: {},
  is_active: true,
  email_verified: true,
  last_login: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe("AuthController", () => {
  let controller: AuthController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AuthController();

    mockJson = jest.fn().mockReturnThis();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockRes = {
      status: mockStatus,
      json: mockJson,
    };
    mockReq = {
      body: {},
      ip: "127.0.0.1",
      get: jest.fn(),
    };
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      const userData = {
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      };
      mockReq.body = userData;

      mockRegister.mockResolvedValue({
        user: {
          id: "user-1",
          email: userData.email,
          name: userData.name,
          role: "user",
          is_active: true,
          email_verified: false,
        },
        token: "jwt-token",
        refreshToken: "refresh-token",
        message: "Registration successful",
      });

      await controller.register(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Registration successful",
        })
      );
    });

    it("should return error when user already exists", async () => {
      mockReq.body = {
        email: "existing@example.com",
        password: "password123",
        name: "Test",
      };

      mockRegister.mockRejectedValue(new Error("User with this email already exists"));

      await controller.register(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(409);
    });

    it("should validate required fields", async () => {
      mockReq.body = { email: "" };

      // Mock validation to fail
      require("express-validator").validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: "Email is required" }],
      });

      await controller.register(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
    });
  });

  describe("login", () => {
    beforeEach(() => {
      // Reset validation mock to pass validation
      require("express-validator").validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });
    });

    it("should login user successfully", async () => {
      mockReq.body = {
        email: "test@example.com",
        password: "password123",
      };

      mockLogin.mockResolvedValue({
        user: {
          id: "user-1",
          email: "test@example.com",
          name: "Test User",
        },
        token: "jwt-token",
        refreshToken: "refresh-token",
        message: "Login successful",
      });

      await controller.login(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it("should return error for invalid credentials", async () => {
      mockReq.body = {
        email: "test@example.com",
        password: "wrongpassword",
      };

      mockLogin.mockRejectedValue(new Error("Invalid credentials"));

      await controller.login(mockReq as Request, mockRes as Response);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });
  });

  describe("logout", () => {
    it("should logout user successfully", async () => {
      mockReq.user = createMockUser();
      mockLogout.mockResolvedValue({ message: "Logged out successfully" });

      await controller.logout(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it("should return error when user not authenticated", async () => {
      mockReq.user = undefined;

      await controller.logout(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
    });
  });

  describe("refreshToken", () => {
    beforeEach(() => {
      // Reset validation mock to pass validation
      require("express-validator").validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => [],
      });
    });

    it("should refresh token successfully", async () => {
      mockReq.body = { refreshToken: "valid-refresh-token" };
      mockRefreshToken.mockResolvedValue({
        token: "new-jwt-token",
      });

      await controller.refreshToken(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it("should return error for invalid refresh token", async () => {
      mockReq.body = { refreshToken: "invalid-token" };
      mockRefreshToken.mockRejectedValue(new Error("Invalid refresh token"));

      await controller.refreshToken(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    it("should return error when refresh token not provided", async () => {
      mockReq.body = {};

      await controller.refreshToken(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
    });
  });

  describe("getCurrentUser", () => {
    it("should return current user profile", async () => {
      mockReq.user = createMockUser();

      await controller.getCurrentUser(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
    });

    it("should return error when not authenticated", async () => {
      mockReq.user = undefined;

      await controller.getCurrentUser(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
    });
  });
});
