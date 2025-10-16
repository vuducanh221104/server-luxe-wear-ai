/**
 * @file storage.service.ts
 * @description Supabase Storage service for file uploads
 * Handles avatar uploads and other file operations
 */

import { supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";

/**
 * Supported image types for avatar upload
 */
export const SUPPORTED_IMAGE_TYPES = {
  JPEG: "image/jpeg",
  JPG: "image/jpg",
  PNG: "image/png",
  WEBP: "image/webp",
  GIF: "image/gif",
} as const;

/**
 * Maximum file size for avatars (5MB)
 */
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Upload avatar to Supabase Storage
 * @param file - Multer file object
 * @param userId - User ID
 * @returns Public URL of uploaded avatar
 */
export const uploadAvatar = async (file: Express.Multer.File, userId: string): Promise<string> => {
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
    const filePath = `${userId}/${fileName}`;

    logger.info("Uploading avatar to Supabase Storage", {
      userId,
      fileName,
      fileSize: file.size,
      mimeType: file.mimetype,
      filePath,
    });

    // Upload file to Supabase Storage using admin client to bypass RLS
    const { error } = await supabaseAdmin.storage.from("avatars").upload(filePath, file.buffer, {
      contentType: file.mimetype,
      cacheControl: "3600",
      upsert: false, // Don't overwrite existing files
    });

    if (error) {
      logger.error("Avatar upload failed", {
        userId,
        error: error.message,
        errorName: error.name,
        fileName,
        filePath,
      });
      throw new Error(`Failed to upload avatar: ${error.message}`);
    }

    // Get public URL using admin client
    const { data: urlData } = supabaseAdmin.storage.from("avatars").getPublicUrl(filePath);

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
    logger.error("Avatar upload service error", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
};

/**
 * Delete avatar from Supabase Storage
 * @param avatarUrl - Public URL of the avatar
 * @param userId - User ID
 */
export const deleteAvatar = async (avatarUrl: string, userId: string): Promise<void> => {
  try {
    // Extract the internal path within the bucket from the public URL
    // Public URL format: https://<project>.supabase.co/storage/v1/object/public/avatars/<internal-path>
    const url = new URL(avatarUrl);
    const marker = "/storage/v1/object/public/avatars/";
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex === -1) {
      throw new Error("Invalid avatar URL format");
    }
    const filePath = url.pathname.substring(markerIndex + marker.length);

    logger.info("Deleting avatar from Supabase Storage", {
      userId,
      filePath,
    });

    const { error } = await supabaseAdmin.storage.from("avatars").remove([filePath]);

    if (error) {
      logger.error("Avatar deletion failed", {
        userId,
        error: error.message,
        filePath,
      });
      throw new Error(`Failed to delete avatar: ${error.message}`);
    }

    logger.info("Avatar deleted successfully", {
      userId,
      filePath,
    });
  } catch (error) {
    logger.error("Avatar deletion service error", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
};

/**
 * Validate avatar file
 * @param file - Multer file object
 * @returns Validation result
 */
export const validateAvatarFile = (
  file: Express.Multer.File
): { isValid: boolean; error?: string } => {
  if (!file) {
    return { isValid: false, error: "No file provided" };
  }

  // Check file type
  const supportedTypes = Object.values(SUPPORTED_IMAGE_TYPES);
  if (!supportedTypes.includes(file.mimetype as (typeof supportedTypes)[number])) {
    return {
      isValid: false,
      error: `Unsupported file type: ${file.mimetype}. Supported types: ${supportedTypes.join(", ")}`,
    };
  }

  // Check file size
  if (file.size > MAX_AVATAR_SIZE) {
    return {
      isValid: false,
      error: `File too large. Maximum size is ${MAX_AVATAR_SIZE / 1024 / 1024}MB`,
    };
  }

  return { isValid: true };
};

/**
 * Test Supabase Storage connection and bucket access
 * @returns Test result
 */
export const testStorageConnection = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    logger.info("Testing Supabase Storage connection...");

    // Test if avatars bucket exists and is accessible using admin client
    const { data, error } = await supabaseAdmin.storage.from("avatars").list("", {
      limit: 1,
    });

    if (error) {
      logger.error("Storage connection test failed", {
        error: error.message,
        errorName: error.name,
      });
      return {
        success: false,
        error: `Storage test failed: ${error.message}`,
      };
    }

    logger.info("Storage connection test successful", {
      bucketExists: true,
      itemCount: data?.length || 0,
    });

    return { success: true };
  } catch (error) {
    logger.error("Storage connection test error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
