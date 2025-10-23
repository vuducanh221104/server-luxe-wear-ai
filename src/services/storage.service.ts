/**
 * @file storage.service.ts
 * @description Supabase Storage service for file uploads
 * Handles avatar uploads and other file operations
 */

import { supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";
import { SUPPORTED_IMAGE_TYPES, MAX_AVATAR_SIZE } from "../types/upload";

/**
 * Storage Service Class
 * Class-based service for storage operations
 */
export class StorageService {
  /**
   * Upload avatar to Supabase Storage
   * @param file - Multer file object
   * @param userId - User ID
   * @returns Public URL of uploaded avatar
   */
  async uploadAvatar(file: Express.Multer.File, userId: string): Promise<string> {
    try {
      // Validate file type
      const supportedTypes = Object.values(SUPPORTED_IMAGE_TYPES);
      if (!supportedTypes.includes(file.mimetype as (typeof supportedTypes)[number])) {
        throw new Error(
          `Unsupported file type: ${file.mimetype}. Supported types: ${supportedTypes.join(", ")}`
        );
      }

      // Validate file size
      if (file.size > MAX_AVATAR_SIZE) {
        throw new Error(`File too large. Maximum size is ${MAX_AVATAR_SIZE / 1024 / 1024}MB`);
      }

      // Generate unique filename
      const fileExtension = file.originalname.split(".").pop() || "jpg";
      const fileName = `avatar-${userId}-${Date.now()}.${fileExtension}`;
      // Path INSIDE the bucket (do NOT prefix with bucket name)
      const filePath = `avatars/${fileName}`;

      logger.info("Uploading avatar", { userId, fileName, fileSize: file.size });

      // Upload to Supabase Storage
      const { error } = await supabaseAdmin.storage
        .from("user-uploads")
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: "3600",
          upsert: false, // Don't overwrite existing files
        });

      if (error) {
        logger.error("Avatar upload failed", { error: error.message, userId, fileName });
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage.from("user-uploads").getPublicUrl(filePath);

      if (!urlData.publicUrl) {
        throw new Error("Failed to get public URL for uploaded avatar");
      }

      logger.info("Avatar uploaded successfully", {
        userId,
        fileName,
        publicUrl: urlData.publicUrl,
      });

      return urlData.publicUrl;
    } catch (error) {
      logger.error("Avatar upload error", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
        fileName: file.originalname,
        fileSize: file.size,
      });
      throw error;
    }
  }

  /**
   * Delete avatar from Supabase Storage
   * @param avatarUrl - Avatar URL to delete
   * @param userId - User ID
   */
  async deleteAvatar(avatarUrl: string, userId: string): Promise<void> {
    try {
      // Extract file path from URL
      const url = new URL(avatarUrl);
      const pathParts = url.pathname.split("/");
      const bucketIndex = pathParts.findIndex((part) => part === "user-uploads");

      if (bucketIndex === -1) {
        throw new Error("Invalid avatar URL - bucket not found");
      }

      // Reconstruct file path (everything after the bucket name)
      const filePath = pathParts.slice(bucketIndex + 1).join("/");

      logger.info("Deleting avatar", { userId, filePath });

      // Delete from Supabase Storage
      const { error } = await supabaseAdmin.storage.from("user-uploads").remove([filePath]);

      if (error) {
        logger.error("Avatar deletion failed", { error: error.message, userId, filePath });
        throw new Error(`Deletion failed: ${error.message}`);
      }

      logger.info("Avatar deleted successfully", { userId, filePath });
    } catch (error) {
      logger.error("Avatar deletion error", {
        userId,
        avatarUrl,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Validate avatar file
   * @param file - Multer file object
   * @returns Validation result
   */
  validateAvatarFile(file: Express.Multer.File): { valid: boolean; error?: string } {
    try {
      // Check if file exists
      if (!file) {
        return { valid: false, error: "No file provided" };
      }

      // Validate file type
      const supportedTypes = Object.values(SUPPORTED_IMAGE_TYPES);
      if (!supportedTypes.includes(file.mimetype as (typeof supportedTypes)[number])) {
        return {
          valid: false,
          error: `Unsupported file type: ${file.mimetype}. Supported types: ${supportedTypes.join(", ")}`,
        };
      }

      // Validate file size
      if (file.size > MAX_AVATAR_SIZE) {
        return {
          valid: false,
          error: `File too large. Maximum size is ${MAX_AVATAR_SIZE / 1024 / 1024}MB`,
        };
      }

      // Validate file name
      if (!file.originalname || file.originalname.trim() === "") {
        return { valid: false, error: "Invalid file name" };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Unknown validation error",
      };
    }
  }

  /**
   * Upload knowledge file (PDF, DOCX, image, video) to Supabase Storage
   * @param file - Multer file object
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns Public URL of uploaded file
   */
  async uploadKnowledgeFile(
    file: Express.Multer.File,
    userId: string,
    tenantId: string
  ): Promise<string> {
    try {
      // Sanitize filename to remove special characters
      const sanitizedFileName = file.originalname
        .replace(/[\[\]{}()<>"'|\\]/g, "") // Remove special chars
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/-+/g, "-") // Remove duplicate hyphens
        .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `${userId}-${timestamp}-${sanitizedFileName}`;
      // Path: knowledge/{tenantId}/{userId}/{filename}
      const filePath = `knowledge/${tenantId}/${userId}/${fileName}`;

      logger.info("Uploading knowledge file", {
        userId,
        tenantId,
        fileName: file.originalname,
        fileSize: file.size,
        fileType: file.mimetype,
      });

      // Upload to Supabase Storage
      const { error } = await supabaseAdmin.storage
        .from("user-uploads")
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        logger.error("Knowledge file upload failed", {
          error: error.message,
          userId,
          fileName: file.originalname,
        });
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = supabaseAdmin.storage.from("user-uploads").getPublicUrl(filePath);

      if (!urlData.publicUrl) {
        throw new Error("Failed to get public URL for uploaded file");
      }

      logger.info("Knowledge file uploaded successfully", {
        userId,
        tenantId,
        fileName: file.originalname,
        publicUrl: urlData.publicUrl,
      });

      return urlData.publicUrl;
    } catch (error) {
      logger.error("Knowledge file upload error", {
        userId,
        tenantId,
        error: error instanceof Error ? error.message : "Unknown error",
        fileName: file.originalname,
        fileSize: file.size,
      });
      throw error;
    }
  }

  /**
   * Delete knowledge file from Supabase Storage
   * @param fileUrl - File URL to delete
   * @param userId - User ID
   */
  async deleteKnowledgeFile(fileUrl: string, userId: string): Promise<void> {
    try {
      // Extract file path from URL
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split("/");
      const bucketIndex = pathParts.findIndex((part) => part === "user-uploads");

      if (bucketIndex === -1) {
        throw new Error("Invalid file URL - bucket not found");
      }

      // Reconstruct file path
      const filePath = pathParts.slice(bucketIndex + 1).join("/");

      logger.info("Deleting knowledge file", { userId, filePath });

      // Delete from Supabase Storage
      const { error } = await supabaseAdmin.storage.from("user-uploads").remove([filePath]);

      if (error) {
        logger.error("Knowledge file deletion failed", { error: error.message, userId, filePath });
        throw new Error(`Deletion failed: ${error.message}`);
      }

      logger.info("Knowledge file deleted successfully", { userId, filePath });
    } catch (error) {
      logger.error("Knowledge file deletion error", {
        userId,
        fileUrl,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Test storage connection
   * @returns Connection test result
   */
  async testStorageConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info("Testing storage connection");

      // Try to list buckets
      const { data, error } = await supabaseAdmin.storage.listBuckets();

      if (error) {
        logger.error("Storage connection test failed", { error: error.message });
        return { success: false, error: error.message };
      }

      logger.info("Storage connection test successful", { bucketCount: data?.length || 0 });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Storage connection test error", { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }
}

// Create and export service instance
export const storageService = new StorageService();
export default storageService;
