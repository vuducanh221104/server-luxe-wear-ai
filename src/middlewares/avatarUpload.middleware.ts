/**
 * @file avatarUpload.middleware.ts
 * @description Avatar upload middleware using multer
 * Handles single image file uploads for user avatars
 */

import multer from "multer";
import { Request, Response, NextFunction } from "express";
import logger from "../config/logger";
import { SUPPORTED_IMAGE_TYPES, MAX_AVATAR_SIZE, AuthenticatedRequest } from "../types/upload";

/**
 * Configure multer storage for avatars (memory storage)
 */
const avatarStorage = multer.memoryStorage();

/**
 * File filter function to validate avatar file types
 */
const avatarFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const supportedTypes = Object.values(SUPPORTED_IMAGE_TYPES);
  const authenticatedReq = req as AuthenticatedRequest;

  logger.info("Avatar upload attempt", {
    fileName: file.originalname,
    mimeType: file.mimetype,
    userId: authenticatedReq.user?.id,
  });

  // Check if file type is supported
  if (supportedTypes.includes(file.mimetype as (typeof supportedTypes)[number])) {
    cb(null, true);
  } else {
    logger.warn("Unsupported avatar file type", {
      fileName: file.originalname,
      mimeType: file.mimetype,
      supportedTypes,
      userId: authenticatedReq.user?.id,
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
  storage: avatarStorage,
  fileFilter: avatarFileFilter,
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

/**
 * Avatar upload middleware
 * Accepts multiple field names for flexibility and normalizes to req.file
 */
export const uploadAvatar = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  uploadAny(req as Request, res, (err?: unknown) => {
    if (err) return next(err);

    const files = (req as Request & { files?: Express.Multer.File[] }).files;
    if (Array.isArray(files) && files.length > 0) {
      const picked =
        files.find((f) =>
          ACCEPTED_FILE_FIELDS.includes(f.fieldname as (typeof ACCEPTED_FILE_FIELDS)[number])
        ) || files[0];
      // Normalize to req.file for downstream handlers
      (req as Request & { file?: Express.Multer.File }).file = picked;
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
