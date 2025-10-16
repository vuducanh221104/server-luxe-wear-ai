/**
 * @file avatar.middleware.ts
 * @description Multer middleware specifically for avatar uploads
 */

import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { SUPPORTED_IMAGE_TYPES, MAX_AVATAR_SIZE } from "../services/storage.service";
import logger from "../config/logger";

// Type for authenticated request
interface AuthenticatedRequest extends Omit<Request, "user"> {
  user?: { id: string };
}

/**
 * Configure multer storage for avatars (memory storage)
 */
const storage = multer.memoryStorage();

/**
 * File filter function to validate avatar file types
 */
const fileFilter = (
  req: AuthenticatedRequest,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const supportedTypes = Object.values(SUPPORTED_IMAGE_TYPES);

  logger.info("Avatar upload attempt", {
    fileName: file.originalname,
    mimeType: file.mimetype,
    userId: req.user?.id,
  });

  // Check if file type is supported
  if (supportedTypes.includes(file.mimetype as any)) {
    cb(null, true);
  } else {
    logger.warn("Unsupported avatar file type", {
      fileName: file.originalname,
      mimeType: file.mimetype,
      supportedTypes,
      userId: req.user?.id,
    });

    cb(
      new Error(
        `Unsupported file type: ${file.mimetype}. Supported types: ${supportedTypes.join(", ")}`
      )
    );
  }
};

/**
 * Multer configuration for avatar uploads
 */
const uploadConfig = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_AVATAR_SIZE, // 5MB limit
    files: 1, // Only allow 1 file at a time
  },
});

/**
 * Single avatar upload middleware that accepts common field names and normalizes to req.file
 */
const ACCEPTED_FILE_FIELDS = ["avatar", "file", "image", "avatar_file"] as const;

const uploadAny = uploadConfig.any();

export const uploadAvatar = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  uploadAny(req as any, res, (err: any) => {
    if (err) return next(err);

    const files = (req as any).files as Express.Multer.File[] | undefined;
    if (Array.isArray(files) && files.length > 0) {
      const picked =
        files.find((f) => ACCEPTED_FILE_FIELDS.includes(f.fieldname as any)) || files[0];
      // Normalize to req.file for downstream handlers
      (req as any).file = picked;
    }

    next();
  });
};

/**
 * Error handler for avatar upload errors
 */
export const handleAvatarUploadError = (
  error: multer.MulterError | Error,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  if (error instanceof multer.MulterError) {
    logger.error("Avatar upload error", {
      error: error.message,
      code: error.code,
      userId: req.user?.id,
    });

    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          success: false,
          message: `File too large. Maximum size is ${MAX_AVATAR_SIZE / 1024 / 1024}MB`,
          error: "FILE_TOO_LARGE",
        });

      case "LIMIT_FILE_COUNT":
        return res.status(400).json({
          success: false,
          message: "Only one avatar file allowed",
          error: "TOO_MANY_FILES",
        });

      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message: "Unexpected file field. Use 'avatar' field name",
          error: "UNEXPECTED_FILE",
        });

      default:
        return res.status(400).json({
          success: false,
          message: "Avatar upload error",
          error: error.code,
        });
    }
  }

  // Handle custom file filter errors
  if (error.message.includes("Unsupported file type")) {
    logger.error("Avatar file type validation error", {
      error: error.message,
      userId: req.user?.id,
    });

    return res.status(400).json({
      success: false,
      message: error.message,
      error: "UNSUPPORTED_FILE_TYPE",
    });
  }

  // Pass other errors to global error handler
  next(error);
};

/**
 * Middleware to validate avatar file exists
 */
export const validateAvatarExists = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  if (!req.file) {
    logger.warn("No avatar file provided", {
      userId: req.user?.id,
      body: req.body,
    });

    return res.status(400).json({
      success: false,
      message: "No avatar file provided. Please upload an image file.",
      error: "NO_FILE_PROVIDED",
    });
  }

  next();
};
