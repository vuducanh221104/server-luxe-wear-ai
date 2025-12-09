/**
 * @file user.controller.test.ts
 * @description Unit tests for UserController
 */

import { Request, Response } from "express";
import { UserController } from "../../../src/controllers/user.controller";
import { userService } from "../../../src/services/user.service";
import { storageService } from "../../../src/services/storage.service";
import { validationResult } from "express-validator";

// Mock dependencies
jest.mock("../../../src/services/user.service", () => ({
  userService: {
    getUserProfile: jest.fn(),
    updateUserProfile: jest.fn(),
    getUserById: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    listUsers: jest.fn(),
  },
}));

jest.mock("../../../src/services/storage.service", () => ({
  storageService: {
    uploadAvatar: jest.fn(),
    deleteAvatar: jest.fn(),
  },
}));

jest.mock("../../../src/services/auth.service", () => ({
  authService: {
    changePassword: jest.fn(),
  },
}));

jest.mock("express-validator", () => ({
  validationResult: jest.fn(),
}));

jest.mock("../../../src/config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe("UserController", () => {
  let userController: UserController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    role: "member" as const,
    password_hash: "hashed_password",
    avatar_url: "https://example.com/avatar.jpg",
    phone: "+1234567890",
    website: "https://example.com",
    preferences: { theme: "dark" },
    last_login: new Date().toISOString(),
    is_active: true,
    email_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    userController = new UserController();
    jest.clearAllMocks();

    // Setup default mock response
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Setup default mock request
    mockReq = {
      user: mockUser,
      body: {},
      params: {},
      query: {},
      ip: "127.0.0.1",
    };

    // Default validation passes
    (validationResult as unknown as jest.Mock).mockReturnValue({
      isEmpty: () => true,
      array: () => [],
    });
  });

  describe("getProfile", () => {
    it("should return user profile successfully", async () => {
      (userService.getUserProfile as jest.Mock).mockResolvedValue(mockUser);

      await userController.getProfile(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Profile retrieved successfully",
          data: expect.objectContaining({
            id: mockUser.id,
            email: mockUser.email,
            name: mockUser.name,
          }),
        })
      );
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;

      await userController.getProfile(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "User not authenticated",
        })
      );
    });
  });

  describe("updateProfile", () => {
    it("should update profile successfully without avatar", async () => {
      mockReq.body = { name: "Updated Name", phone: "+0987654321" };
      const updatedUser = { ...mockUser, name: "Updated Name" };
      (userService.updateUserProfile as jest.Mock).mockResolvedValue(updatedUser);

      await userController.updateProfile(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Profile updated successfully",
        })
      );
    });

    it("should update profile with avatar upload", async () => {
      mockReq.body = { name: "Updated Name" };
      mockReq.file = {
        buffer: Buffer.from("test"),
        originalname: "avatar.jpg",
        mimetype: "image/jpeg",
        size: 1024,
      } as Express.Multer.File;

      const newAvatarUrl = "https://storage.example.com/avatar-new.jpg";
      (storageService.uploadAvatar as jest.Mock).mockResolvedValue(newAvatarUrl);
      (userService.updateUserProfile as jest.Mock).mockResolvedValue({
        ...mockUser,
        avatar_url: newAvatarUrl,
      });

      await userController.updateProfile(mockReq as Request, mockRes as Response);

      expect(storageService.uploadAvatar).toHaveBeenCalledWith(mockReq.file, mockUser.id);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;

      await userController.updateProfile(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when validation fails", async () => {
      (validationResult as unknown as jest.Mock).mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: "Invalid phone format" }],
      });

      await userController.updateProfile(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should return 500 when avatar upload fails", async () => {
      mockReq.body = { name: "Updated Name" };
      mockReq.file = {
        buffer: Buffer.from("test"),
        originalname: "avatar.jpg",
        mimetype: "image/jpeg",
        size: 1024,
      } as Express.Multer.File;

      (storageService.uploadAvatar as jest.Mock).mockRejectedValue(new Error("Upload failed"));

      await userController.updateProfile(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe("deleteAvatar", () => {
    it("should delete avatar successfully", async () => {
      (userService.getUserProfile as jest.Mock).mockResolvedValue(mockUser);
      (storageService.deleteAvatar as jest.Mock).mockResolvedValue(undefined);
      (userService.updateUserProfile as jest.Mock).mockResolvedValue({
        ...mockUser,
        avatar_url: null,
      });

      await userController.deleteAvatar(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Avatar deleted successfully",
        })
      );
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;

      await userController.deleteAvatar(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe("getUserById (admin)", () => {
    it("should return 401 when not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { userId: "user-2" };

      await userController.getUserById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 403 when non-admin tries to access", async () => {
      mockReq.params = { userId: "user-2" };

      await userController.getUserById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe("listUsers (admin)", () => {
    it("should list users for admin", async () => {
      mockReq.user = { ...mockUser, role: "admin" as const };
      mockReq.query = { page: "1", limit: "10" };

      const mockListResponse = {
        users: [mockUser],
        total: 1,
        page: 1,
        perPage: 10,
        totalPages: 1,
      };
      (userService.listUsers as jest.Mock).mockResolvedValue(mockListResponse);

      await userController.listUsers(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("should return 403 for non-admin", async () => {
      await userController.listUsers(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it("should return 401 when not authenticated", async () => {
      mockReq.user = undefined;

      await userController.listUsers(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });
});
