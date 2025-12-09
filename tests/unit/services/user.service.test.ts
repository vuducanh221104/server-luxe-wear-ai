/**
 * @file user.service.test.ts
 * @description Unit tests for user service
 */

// Track database results
let dbResults: { data: unknown; error: unknown; count?: number } = { data: null, error: null };

jest.mock("../../../src/config/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn().mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
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
import { UserService } from "../../../src/services/user.service";

describe("UserService", () => {
  let userService: UserService;

  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    password_hash: "hashed_password",
    role: "member",
    is_active: true,
    email_verified: false,
    avatar_url: null,
    phone: null,
    website: null,
    preferences: {},
    last_login: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    userService = new UserService();
    dbResults = { data: null, error: null };
  });

  describe("getUserProfile", () => {
    it("should return user profile when found", async () => {
      dbResults = { data: mockUser, error: null };

      const result = await userService.getUserProfile("user-123");

      expect(result).toEqual(mockUser);
    });

    it("should throw error when user not found", async () => {
      dbResults = { data: null, error: { message: "User not found" } };

      await expect(userService.getUserProfile("invalid-id")).rejects.toThrow();
    });

    it("should throw error when database fails", async () => {
      dbResults = { data: null, error: { message: "Database error" } };

      await expect(userService.getUserProfile("user-123")).rejects.toThrow();
    });
  });

  describe("updateUserProfile", () => {
    it("should update user profile successfully", async () => {
      const updatedUser = { ...mockUser, name: "Updated Name" };
      dbResults = { data: updatedUser, error: null };

      const result = await userService.updateUserProfile("user-123", { name: "Updated Name" });

      expect(result.name).toBe("Updated Name");
    });

    it("should throw error when user not found", async () => {
      dbResults = { data: null, error: null };

      await expect(userService.updateUserProfile("invalid-id", { name: "Test" })).rejects.toThrow();
    });

    it("should throw error when update fails", async () => {
      dbResults = { data: null, error: { message: "Update failed" } };

      await expect(userService.updateUserProfile("user-123", { name: "Test" })).rejects.toThrow();
    });
  });

  describe("updateUser", () => {
    it("should update user successfully (admin)", async () => {
      const updatedUser = { ...mockUser, role: "admin" };
      dbResults = { data: updatedUser, error: null };

      const result = await userService.updateUser("user-123", { role: "admin" });

      expect(result.role).toBe("admin");
    });

    it("should throw error when user not found", async () => {
      dbResults = { data: null, error: null };

      await expect(userService.updateUser("invalid-id", { role: "admin" })).rejects.toThrow();
    });
  });

  describe("deleteUser", () => {
    it("should delete user successfully", async () => {
      dbResults = { data: null, error: null };

      const result = await userService.deleteUser("user-123");

      expect(result.message).toBe("User deleted successfully");
    });
  });

  describe("listUsers", () => {
    it("should return empty list when no users", async () => {
      dbResults = { data: [], error: null, count: 0 };

      const result = await userService.listUsers(1, 10);

      expect(result.users).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(10);
    });
  });

  describe("getUserByEmail", () => {
    it("should return user when found by email", async () => {
      dbResults = { data: mockUser, error: null };

      const result = await userService.getUserByEmail("test@example.com");

      expect(result).toEqual(mockUser);
    });

    it("should return null when user not found", async () => {
      dbResults = { data: null, error: { code: "PGRST116" } };

      const result = await userService.getUserByEmail("invalid@example.com");

      expect(result).toBeNull();
    });
  });
});
