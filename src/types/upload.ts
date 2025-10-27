/**
 * @file upload.ts
 * @description Type definitions for file upload functionality
 * Includes streaming uploads and avatar uploads
 */

import { Request } from "express";

// Supported file types for knowledge uploads
export const SUPPORTED_FILE_TYPES = {
  PDF: "application/pdf",
  DOC: "application/msword",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  TXT: "text/plain",
  MD: "text/markdown",
} as const;

// Type for supported file MIME types
export type SupportedFileType = (typeof SUPPORTED_FILE_TYPES)[keyof typeof SUPPORTED_FILE_TYPES];

// Maximum file size (1GB)
export const MAX_FILE_SIZE = 1 * 1024 * 1024 * 1024;

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

// Type for supported image MIME types
export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[keyof typeof SUPPORTED_IMAGE_TYPES];

/**
 * Maximum file size for avatars (5MB)
 */
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

/**
 * Interface for streaming file data
 * Used when uploading knowledge files with busboy
 */
export interface StreamingFile {
  id: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  fieldname: string;
  encoding: string;
}

/**
 * Interface for upload progress tracking
 * Tracks the status and progress of individual file uploads
 */
export interface UploadProgress {
  fileId: string;
  fileName: string;
  bytesReceived: number;
  totalBytes: number;
  percentage: number;
  status: "uploading" | "processing" | "completed" | "error";
  error?: string;
}

/**
 * Interface for upload session
 * Manages multiple file uploads in a single session
 */
export interface UploadSession {
  sessionId: string;
  userId: string;
  files: Map<string, StreamingFile>;
  progress: Map<string, UploadProgress>;
  completed: boolean;
  createdAt: number;
  error?: string;
}

/**
 * Type for authenticated request with user info
 * Used across upload middlewares
 */
export interface AuthenticatedRequest extends Omit<Request, "user"> {
  user?: { id: string };
  uploadSession?: UploadSession;
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

/**
 * Interface for streaming processing result
 * Tracks the result of processing a streaming file
 */
export interface StreamingProcessingResult {
  fileId: string;
  fileName: string;
  status: "processing" | "completed" | "error";
  chunks: number;
  totalSize: number;
  processedSize: number;
  error?: string;
  entries: Array<{
    id: string;
    content: string;
    metadata: Record<string, unknown>;
  }>;
}

/**
 * Interface for chunk processing
 * Handles processing of file chunks during streaming upload
 */
export interface ChunkProcessor {
  processChunk(chunk: Buffer, metadata: ChunkMetadata): Promise<string>;
  finalize(): Promise<string>;
}

/**
 * Interface for chunk metadata
 * Contains metadata about a file chunk being processed
 */
export interface ChunkMetadata {
  fileId: string;
  fileName: string;
  mimeType: string;
  chunkIndex: number;
  totalChunks: number;
  offset: number;
  size: number;
}

// Module augmentation for Express Request
declare module "express-serve-static-core" {
  interface Request {
    uploadSession?: UploadSession;
    file?: Express.Multer.File;
  }
}
