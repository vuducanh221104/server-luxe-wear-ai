/**
 * @file storage.service.test.ts
 * @description Unit tests for StorageService
 */

import { StorageService } from "../../../src/services/storage.service";

// Mock dependencies
jest.mock("../../../src/config/supabase", () => ({
  supabaseAdmin: {
    storage: {
      from: jest.fn(),
    },
  },
}));

jest.mock("../../../src/config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

import { supabaseAdmin } from "../../../src/config/supabase";
import { MAX_AVATAR_SIZE } from "../../../src/types/upload";

describe("StorageService", () => {
  let storageService: StorageService;

  beforeEach(() => {
    storageService = new StorageService();
    jest.clearAllMocks();
  });

  describe("validateAvatarFile", () => {
    it("should return valid for supported image types", () => {
      const file = {
        mimetype: "image/jpeg",
        size: 1024 * 100, // 100KB
        originalname: "avatar.jpg",
        buffer: Buffer.from("test"),
      } as Express.Multer.File;

      const result = storageService.validateAvatarFile(file);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return invalid for unsupported file type", () => {
      const file = {
        mimetype: "application/pdf",
        size: 1024 * 100,
        originalname: "document.pdf",
        buffer: Buffer.from("test"),
      } as Express.Multer.File;

      const result = storageService.validateAvatarFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Unsupported file type");
    });

    it("should return invalid for file too large", () => {
      const file = {
        mimetype: "image/jpeg",
        size: MAX_AVATAR_SIZE + 1, // Exceed max size
        originalname: "large.jpg",
        buffer: Buffer.from("test"),
      } as Express.Multer.File;

      const result = storageService.validateAvatarFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("File too large");
    });

    it("should return invalid when no file provided", () => {
      const result = storageService.validateAvatarFile(null as unknown as Express.Multer.File);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("No file provided");
    });

    it("should return invalid for empty filename", () => {
      const file = {
        mimetype: "image/jpeg",
        size: 1024,
        originalname: "",
        buffer: Buffer.from("test"),
      } as Express.Multer.File;

      const result = storageService.validateAvatarFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid file name");
    });

    it("should return invalid for whitespace-only filename", () => {
      const file = {
        mimetype: "image/jpeg",
        size: 1024,
        originalname: "   ",
        buffer: Buffer.from("test"),
      } as Express.Multer.File;

      const result = storageService.validateAvatarFile(file);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid file name");
    });
  });

  describe("uploadAvatar", () => {
    it("should upload avatar successfully", async () => {
      const file = {
        mimetype: "image/jpeg",
        size: 1024 * 100,
        originalname: "avatar.jpg",
        buffer: Buffer.from("test"),
      } as Express.Multer.File;

      const mockStorageFrom = {
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: "https://storage.example.com/user-uploads/avatars/avatar.jpg" },
        }),
      };

      (supabaseAdmin.storage.from as jest.Mock).mockReturnValue(mockStorageFrom);

      const result = await storageService.uploadAvatar(file, "user-1");

      expect(result).toBe("https://storage.example.com/user-uploads/avatars/avatar.jpg");
      expect(mockStorageFrom.upload).toHaveBeenCalled();
    });

    it("should throw error for unsupported file type", async () => {
      const file = {
        mimetype: "application/pdf",
        size: 1024,
        originalname: "doc.pdf",
        buffer: Buffer.from("test"),
      } as Express.Multer.File;

      await expect(storageService.uploadAvatar(file, "user-1")).rejects.toThrow(
        "Unsupported file type"
      );
    });

    it("should throw error for file too large", async () => {
      const file = {
        mimetype: "image/jpeg",
        size: MAX_AVATAR_SIZE + 1,
        originalname: "large.jpg",
        buffer: Buffer.from("test"),
      } as Express.Multer.File;

      await expect(storageService.uploadAvatar(file, "user-1")).rejects.toThrow("File too large");
    });

    it("should throw error when upload fails", async () => {
      const file = {
        mimetype: "image/jpeg",
        size: 1024,
        originalname: "avatar.jpg",
        buffer: Buffer.from("test"),
      } as Express.Multer.File;

      const mockStorageFrom = {
        upload: jest.fn().mockResolvedValue({ error: { message: "Upload failed" } }),
      };

      (supabaseAdmin.storage.from as jest.Mock).mockReturnValue(mockStorageFrom);

      await expect(storageService.uploadAvatar(file, "user-1")).rejects.toThrow(
        "Upload failed: Upload failed"
      );
    });

    it("should throw error when public URL not available", async () => {
      const file = {
        mimetype: "image/jpeg",
        size: 1024,
        originalname: "avatar.jpg",
        buffer: Buffer.from("test"),
      } as Express.Multer.File;

      const mockStorageFrom = {
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: "" } }),
      };

      (supabaseAdmin.storage.from as jest.Mock).mockReturnValue(mockStorageFrom);

      await expect(storageService.uploadAvatar(file, "user-1")).rejects.toThrow(
        "Failed to get public URL"
      );
    });
  });

  describe("deleteAvatar", () => {
    it("should delete avatar successfully", async () => {
      const mockStorageFrom = {
        remove: jest.fn().mockResolvedValue({ error: null }),
      };

      (supabaseAdmin.storage.from as jest.Mock).mockReturnValue(mockStorageFrom);

      await storageService.deleteAvatar(
        "https://storage.example.com/user-uploads/avatars/avatar.jpg",
        "user-1"
      );

      expect(mockStorageFrom.remove).toHaveBeenCalledWith(["avatars/avatar.jpg"]);
    });

    it("should throw error for invalid avatar URL", async () => {
      await expect(
        storageService.deleteAvatar("https://storage.example.com/other-bucket/file.jpg", "user-1")
      ).rejects.toThrow("Invalid avatar URL - bucket not found");
    });

    it("should throw error when deletion fails", async () => {
      const mockStorageFrom = {
        remove: jest.fn().mockResolvedValue({ error: { message: "Delete failed" } }),
      };

      (supabaseAdmin.storage.from as jest.Mock).mockReturnValue(mockStorageFrom);

      await expect(
        storageService.deleteAvatar(
          "https://storage.example.com/user-uploads/avatars/avatar.jpg",
          "user-1"
        )
      ).rejects.toThrow("Deletion failed: Delete failed");
    });
  });

  describe("uploadKnowledgeFile", () => {
    it("should upload knowledge file successfully", async () => {
      const file = {
        mimetype: "application/pdf",
        size: 1024 * 1024, // 1MB
        originalname: "document.pdf",
        buffer: Buffer.from("test"),
      } as Express.Multer.File;

      const mockStorageFrom = {
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: "https://storage.example.com/user-uploads/knowledge/file.pdf" },
        }),
      };

      (supabaseAdmin.storage.from as jest.Mock).mockReturnValue(mockStorageFrom);

      const result = await storageService.uploadKnowledgeFile(file, "user-1", "tenant-1");

      expect(result).toContain("https://storage.example.com");
      expect(mockStorageFrom.upload).toHaveBeenCalled();
    });

    it("should sanitize filename with special characters", async () => {
      const file = {
        mimetype: "application/pdf",
        size: 1024,
        originalname: "my [document] (test).pdf",
        buffer: Buffer.from("test"),
      } as Express.Multer.File;

      const mockStorageFrom = {
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: "https://storage.example.com/user-uploads/knowledge/file.pdf" },
        }),
      };

      (supabaseAdmin.storage.from as jest.Mock).mockReturnValue(mockStorageFrom);

      await storageService.uploadKnowledgeFile(file, "user-1", "tenant-1");

      // Check that upload was called with sanitized filename
      const uploadCall = mockStorageFrom.upload.mock.calls[0];
      expect(uploadCall[0]).not.toContain("[");
      expect(uploadCall[0]).not.toContain("]");
    });

    it("should throw error when upload fails", async () => {
      const file = {
        mimetype: "application/pdf",
        size: 1024,
        originalname: "document.pdf",
        buffer: Buffer.from("test"),
      } as Express.Multer.File;

      const mockStorageFrom = {
        upload: jest.fn().mockResolvedValue({ error: { message: "Upload failed" } }),
      };

      (supabaseAdmin.storage.from as jest.Mock).mockReturnValue(mockStorageFrom);

      await expect(storageService.uploadKnowledgeFile(file, "user-1", "tenant-1")).rejects.toThrow(
        "Upload failed: Upload failed"
      );
    });
  });
});
