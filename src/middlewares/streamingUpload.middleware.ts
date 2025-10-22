/**
 * @file streaming-upload.middleware.ts
 * @description File upload middleware for both streaming (busboy) and avatar (multer)
 * Includes: Streaming knowledge file uploads + Avatar image uploads
 */

import busboy from "busboy";
import multer from "multer";
import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import logger from "../config/logger";
import { SUPPORTED_IMAGE_TYPES, MAX_AVATAR_SIZE } from "../services/storage.service";

// Define supported file types locally
const SUPPORTED_FILE_TYPES = {
  PDF: "application/pdf",
  DOC: "application/msword",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  TXT: "text/plain",
  MD: "text/markdown",
} as const;

// Maximum file size (1GB)
const MAX_FILE_SIZE = 1 * 1024 * 1024 * 1024;

// Type for authenticated request
interface AuthenticatedRequest extends Omit<Request, "user"> {
  user?: { id: string };
}

// Interface for streaming file data
export interface StreamingFile {
  id: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  fieldname: string;
  encoding: string;
}

// Interface for upload progress
export interface UploadProgress {
  fileId: string;
  fileName: string;
  bytesReceived: number;
  totalBytes: number;
  percentage: number;
  status: "uploading" | "processing" | "completed" | "error";
  error?: string;
}

// Interface for upload session
export interface UploadSession {
  sessionId: string;
  userId: string;
  files: Map<string, StreamingFile>;
  progress: Map<string, UploadProgress>;
  completed: boolean;
  error?: string;
}

// Store active upload sessions
const uploadSessions = new Map<string, UploadSession>();

/**
 * Streaming upload middleware
 * Handles multipart/form-data with progress tracking
 */
export const streamingUploadMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "User not authenticated",
      error: "UNAUTHENTICATED",
    });
    return;
  }

  const sessionId = uuidv4();
  const userId = req.user.id;

  // Create upload session
  const session: UploadSession = {
    sessionId,
    userId,
    files: new Map(),
    progress: new Map(),
    completed: false,
  };

  uploadSessions.set(sessionId, session);

  // Set up busboy
  const bb = busboy({
    headers: req.headers,
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 20, // Max 20 files per upload
      fields: 10, // Max 10 form fields
      fieldSize: 1024 * 1024, // 1MB for form fields
    },
  });

  const files: StreamingFile[] = [];
  const fields: Record<string, string> = {};
  let fileCount = 0;
  let totalFiles = 0;

  // Handle file uploads
  bb.on("file", (fieldname, file, info) => {
    const { filename, encoding, mimeType } = info;

    logger.info("Streaming file upload started", {
      sessionId,
      userId,
      fileName: filename,
      mimeType,
      fieldname,
      encoding,
    });

    // Validate file type
    const supportedTypes = Object.values(SUPPORTED_FILE_TYPES);
    if (!supportedTypes.includes(mimeType as (typeof supportedTypes)[number])) {
      logger.warn("Unsupported file type in streaming upload", {
        sessionId,
        fileName: filename,
        mimeType,
        supportedTypes,
      });

      file.resume(); // Drain the stream
      session.error = `Unsupported file type: ${mimeType}`;
      return;
    }

    const fileId = uuidv4();
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    // Initialize progress tracking
    session.progress.set(fileId, {
      fileId,
      fileName: filename,
      bytesReceived: 0,
      totalBytes: 0,
      percentage: 0,
      status: "uploading",
    });

    // Handle file data chunks
    file.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      totalBytes += chunk.length;

      // Update progress
      const progress = session.progress.get(fileId);
      if (progress) {
        progress.bytesReceived = totalBytes;
        progress.percentage = Math.round((totalBytes / MAX_FILE_SIZE) * 100);
        session.progress.set(fileId, progress);
      }

      // Check file size limit
      if (totalBytes > MAX_FILE_SIZE) {
        logger.error("File size exceeded in streaming upload", {
          sessionId,
          fileName: filename,
          size: totalBytes,
          limit: MAX_FILE_SIZE,
        });

        file.resume();
        session.error = `File ${filename} exceeds maximum size limit`;
        return;
      }
    });

    // Handle file completion
    file.on("end", () => {
      const buffer = Buffer.concat(chunks);

      const streamingFile: StreamingFile = {
        id: fileId,
        originalname: filename,
        mimetype: mimeType,
        size: buffer.length,
        buffer,
        fieldname,
        encoding,
      };

      files.push(streamingFile);
      session.files.set(fileId, streamingFile);

      // Update progress to completed
      const progress = session.progress.get(fileId);
      if (progress) {
        progress.totalBytes = buffer.length;
        progress.percentage = 100;
        progress.status = "completed";
        session.progress.set(fileId, progress);
      }

      fileCount++;

      logger.info("Streaming file upload completed", {
        sessionId,
        userId,
        fileName: filename,
        size: buffer.length,
        fileCount,
        totalFiles,
      });
    });

    // Handle file errors
    file.on("error", (error: Error) => {
      logger.error("Streaming file upload error", {
        sessionId,
        userId,
        fileName: filename,
        error: error.message,
      });

      const progress = session.progress.get(fileId);
      if (progress) {
        progress.status = "error";
        progress.error = error.message;
        session.progress.set(fileId, progress);
      }

      session.error = `File upload error: ${error.message}`;
    });
  });

  // Handle form fields
  bb.on("field", (fieldname, value) => {
    fields[fieldname] = value;
    logger.debug("Form field received", {
      sessionId,
      fieldname,
      valueLength: value.length,
    });
  });

  // Handle upload completion
  bb.on("finish", () => {
    logger.info("Streaming upload session completed", {
      sessionId,
      userId,
      fileCount: files.length,
      fields: Object.keys(fields),
    });

    session.completed = true;

    // Attach data to request
    req.body = fields;
    (req as any).files = files; // Use any to bypass type checking for custom file format
    req.uploadSession = session;

    // Clean up session after 5 minutes
    setTimeout(
      () => {
        uploadSessions.delete(sessionId);
      },
      5 * 60 * 1000
    );

    next();
  });

  // Handle errors
  bb.on("error", (error: Error) => {
    logger.error("Busboy streaming upload error", {
      sessionId,
      userId,
      error: error.message,
    });

    session.error = error.message;
    session.completed = true;

    res.status(400).json({
      success: false,
      message: "Upload error",
      error: error.message,
      sessionId,
    });
  });

  // Pipe request to busboy
  req.pipe(bb);
};

/**
 * Get upload progress for a session
 */
export const getUploadProgress = (sessionId: string): UploadProgress[] | null => {
  const session = uploadSessions.get(sessionId);
  if (!session) {
    return null;
  }

  return Array.from(session.progress.values());
};

/**
 * Get upload session status
 */
export const getUploadSession = (sessionId: string): UploadSession | null => {
  return uploadSessions.get(sessionId) || null;
};

/**
 * Clean up completed upload sessions
 */
export const cleanupUploadSessions = (): void => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes

  for (const [sessionId, session] of uploadSessions.entries()) {
    if (session.completed && now - Date.now() > maxAge) {
      uploadSessions.delete(sessionId);
      logger.debug("Cleaned up upload session", { sessionId });
    }
  }
};

// Clean up sessions every 10 minutes
setInterval(cleanupUploadSessions, 10 * 60 * 1000);

// Extend Request interface
declare global {
  namespace Express {
    interface Request {
      uploadSession?: UploadSession;
    }
  }
}

// ============================================================================
// AVATAR UPLOAD (MULTER)
// ============================================================================

/**
 * Configure multer storage for avatars (memory storage)
 */
const avatarStorage = multer.memoryStorage();

/**
 * File filter function to validate avatar file types
 */
const avatarFileFilter = (
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
