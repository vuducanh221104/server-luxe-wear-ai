/**
 * @file oauth.controller.test.ts
 * @description Unit tests for OAuthController
 */

import { Request, Response } from "express";
import { OAuthController } from "../../../src/controllers/oauth.controller";
import { authService } from "../../../src/services/auth.service";

// Mock dependencies
jest.mock("../../../src/services/auth.service", () => ({
  authService: {
    generateTokens: jest.fn(),
  },
}));

jest.mock("../../../src/config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe("OAuthController", () => {
  let oauthController: OAuthController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    role: "member" as const,
    password_hash: "hashed_password",
    avatar_url: null,
    phone: null,
    website: null,
    preferences: {},
    last_login: null,
    is_active: true,
    email_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const originalEnv = process.env;

  beforeEach(() => {
    oauthController = new OAuthController();
    jest.clearAllMocks();

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn(),
    };

    mockReq = {
      user: mockUser,
      query: {},
      ip: "127.0.0.1",
    };

    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("googleCallback", () => {
    it("should redirect with tokens on successful Google OAuth", async () => {
      (authService.generateTokens as jest.Mock).mockResolvedValue({
        token: "access-token",
        refreshToken: "refresh-token",
      });
      process.env.FRONTEND_URL = "http://localhost:3000";

      await oauthController.googleCallback(mockReq as Request, mockRes as Response);

      expect(authService.generateTokens).toHaveBeenCalledWith("user-1");
      expect(mockRes.redirect).toHaveBeenCalledWith(
        "http://localhost:3000/auth/callback?token=access-token&refreshToken=refresh-token"
      );
    });

    it("should redirect to login with error when user not in request", async () => {
      mockReq.user = undefined;
      process.env.FRONTEND_URL = "http://localhost:3000";

      await oauthController.googleCallback(mockReq as Request, mockRes as Response);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        "http://localhost:3000/login?error=auth_failed"
      );
    });

    it("should redirect to login on token generation error", async () => {
      (authService.generateTokens as jest.Mock).mockRejectedValue(new Error("Token error"));
      process.env.FRONTEND_URL = "http://localhost:3000";

      await oauthController.googleCallback(mockReq as Request, mockRes as Response);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        "http://localhost:3000/login?error=server_error"
      );
    });

    it("should use default frontend URL when env not set", async () => {
      delete process.env.FRONTEND_URL;
      (authService.generateTokens as jest.Mock).mockResolvedValue({
        token: "access-token",
        refreshToken: "refresh-token",
      });

      await oauthController.googleCallback(mockReq as Request, mockRes as Response);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        expect.stringContaining("http://localhost:3000")
      );
    });
  });

  describe("githubCallback", () => {
    it("should redirect with tokens on successful GitHub OAuth", async () => {
      (authService.generateTokens as jest.Mock).mockResolvedValue({
        token: "access-token",
        refreshToken: "refresh-token",
      });
      process.env.FRONTEND_URL = "http://localhost:3000";

      await oauthController.githubCallback(mockReq as Request, mockRes as Response);

      expect(authService.generateTokens).toHaveBeenCalledWith("user-1");
      expect(mockRes.redirect).toHaveBeenCalledWith(
        "http://localhost:3000/auth/callback?token=access-token&refreshToken=refresh-token"
      );
    });

    it("should redirect to login with error when user not in request", async () => {
      mockReq.user = undefined;
      process.env.FRONTEND_URL = "http://localhost:3000";

      await oauthController.githubCallback(mockReq as Request, mockRes as Response);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        "http://localhost:3000/login?error=auth_failed"
      );
    });

    it("should redirect to login on token generation error", async () => {
      (authService.generateTokens as jest.Mock).mockRejectedValue(new Error("Token error"));
      process.env.FRONTEND_URL = "http://localhost:3000";

      await oauthController.githubCallback(mockReq as Request, mockRes as Response);

      expect(mockRes.redirect).toHaveBeenCalledWith(
        "http://localhost:3000/login?error=server_error"
      );
    });
  });

  describe("oauthFailure", () => {
    it("should return 401 error response", async () => {
      mockReq.query = { error: "access_denied" };

      await oauthController.oauthFailure(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "OAuth authentication failed",
        })
      );
    });
  });

  describe("getProviders", () => {
    it("should return empty providers when none configured", async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_SECRET;

      await oauthController.getProviders(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: {
            providers: [],
            count: 0,
          },
        })
      );
    });

    it("should return Google provider when configured", async () => {
      process.env.GOOGLE_CLIENT_ID = "google-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_SECRET;

      await oauthController.getProviders(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            providers: [
              expect.objectContaining({
                name: "google",
                displayName: "Google",
              }),
            ],
            count: 1,
          }),
        })
      );
    });

    it("should return GitHub provider when configured", async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      process.env.GITHUB_CLIENT_ID = "github-client-id";
      process.env.GITHUB_CLIENT_SECRET = "github-client-secret";

      await oauthController.getProviders(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            providers: [
              expect.objectContaining({
                name: "github",
                displayName: "GitHub",
              }),
            ],
            count: 1,
          }),
        })
      );
    });

    it("should return both providers when both configured", async () => {
      process.env.GOOGLE_CLIENT_ID = "google-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
      process.env.GITHUB_CLIENT_ID = "github-client-id";
      process.env.GITHUB_CLIENT_SECRET = "github-client-secret";

      await oauthController.getProviders(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            count: 2,
          }),
        })
      );
    });
  });
});
