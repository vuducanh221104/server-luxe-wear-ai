/**
 * @file upload.middleware.ts
 * @description Multer middleware for handling file uploads
 * Configures file upload settings, validation, and storage
 */

import multer from "multer";
import { Request, Response, NextFunction } from "express";
// import path from "path"; // Unused import
import { SUPPORTED_FILE_TYPES, MAX_FILE_SIZE } from "../utils/fileProcessor";
import logger from "../config/logger";

// Type for authenticated request
interface AuthenticatedRequest extends Omit<Request, "user"> {
  user?: { id: string };
}

/**
 * Configure multer storage (memory storage for processing)
 */
const storage = multer.memoryStorage();

/**
 * File filter function to validate file types
 */
const fileFilter = (
  req: AuthenticatedRequest,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const supportedTypes = Object.values(SUPPORTED_FILE_TYPES);

  logger.info("File upload attempt", {
    fileName: file.originalname,
    mimeType: file.mimetype,
    fieldName: file.fieldname,
    userId: req.user?.id,
  });

  // Check if file type is supported
  if (supportedTypes.includes(file.mimetype as (typeof supportedTypes)[number])) {
    cb(null, true);
  } else {
    logger.warn("Unsupported file type upload attempt", {
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
 * Multer configuration
 */
const uploadConfig = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE, // 10MB limit
    files: 1, // Only allow 1 file at a time
  },
});

/**
 * Single file upload middleware
 * Use this for uploading single knowledge files
 */
export const uploadSingleFile = uploadConfig.single("file");

/**
 * Multiple files upload middleware (up to 5 files)
 * Use this for batch file uploads
 */
export const uploadMultipleFiles = uploadConfig.array("files", 5);

/**
 * Error handler for multer errors
 */
export const handleUploadError = (
  error: multer.MulterError | Error,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  if (error instanceof multer.MulterError) {
    logger.error("Multer upload error", {
      error: error.message,
      code: error.code,
      field: error.field,
      userId: req.user?.id,
    });

    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        return res.status(400).json({
          success: false,
          message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          error: "FILE_TOO_LARGE",
        });

      case "LIMIT_FILE_COUNT":
        return res.status(400).json({
          success: false,
          message: "Too many files. Maximum 5 files allowed",
          error: "TOO_MANY_FILES",
        });

      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message: "Unexpected file field",
          error: "UNEXPECTED_FILE",
        });

      default:
        return res.status(400).json({
          success: false,
          message: "File upload error",
          error: error.code,
        });
    }
  }

  // Handle custom file filter errors
  if (error.message.includes("Unsupported file type")) {
    logger.error("File type validation error", {
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
 * Middleware to validate uploaded file exists
 */
export const validateFileExists = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  if (!req.file && !req.files) {
    logger.warn("No file provided in upload request", {
      userId: req.user?.id,
      body: req.body,
    });

    return res.status(400).json({
      success: false,
      message: "No file provided. Please upload a file.",
      error: "NO_FILE_PROVIDED",
    });
  }

  next();
};

/**
 * Middleware to log successful file upload
 */
export const logFileUpload = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  if (req.file) {
    logger.info("File uploaded successfully", {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      userId: req.user?.id,
    });
  }

  if (req.files && Array.isArray(req.files)) {
    logger.info("Multiple files uploaded successfully", {
      fileCount: req.files.length,
      files: req.files.map((f) => ({
        fileName: f.originalname,
        fileSize: f.size,
        mimeType: f.mimetype,
      })),
      userId: req.user?.id,
    });
  }

  next();
};
