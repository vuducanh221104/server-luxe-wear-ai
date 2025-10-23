/**
 * @file streamingUpload.middleware.ts
 * @description Streaming file upload middleware using busboy
 * Handles large file uploads with progress tracking for knowledge base documents
 */

import busboy from "busboy";
import { Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import logger from "../config/logger";
import {
  SUPPORTED_FILE_TYPES,
  MAX_FILE_SIZE,
  StreamingFile,
  UploadProgress,
  UploadSession,
  AuthenticatedRequest,
} from "../types/upload";

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
    createdAt: Date.now(),
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
    // Attach files to request (using type assertion for custom file format)
    Object.assign(req, { files });
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
    if (session.completed && now - session.createdAt > maxAge) {
      uploadSessions.delete(sessionId);
      logger.debug("Cleaned up upload session", { sessionId });
    }
  }
};

// Clean up sessions every 10 minutes
setInterval(cleanupUploadSessions, 10 * 60 * 1000);
