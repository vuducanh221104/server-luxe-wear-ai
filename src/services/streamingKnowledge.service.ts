/**
 * @file streaming-knowledge.service.ts
 * @description Streaming knowledge service for handling large file uploads
 * Processes files in chunks and stores them with background vectorization
 */

import { v4 as uuidv4 } from "uuid";
import { supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";
import { StreamingFile } from "../types/upload";
import { processMultipleStreamingFiles } from "../utils/streamingFileProcessor";
import { batchStoreKnowledge } from "./vector.service";
import { storageService } from "./storage.service";

// Interface for streaming upload parameters
export interface StreamingUploadParams {
  files: StreamingFile[];
  userId: string;
  tenantId: string;
  agentId?: string | null;
  title?: string;
  chunkSize?: number;
  overlap?: number;
}

// Interface for streaming upload result
export interface StreamingUploadResult {
  success: boolean;
  partialSuccess?: boolean;
  sessionId: string;
  filesProcessed: number;
  filesFailed: number;
  totalChunks: number;
  totalKnowledgeEntries: number;
  vectorizationStatus: "completed" | "failed" | "partial";
  vectorizationError?: string | null;
  files: Array<{
    fileName: string;
    status: "success" | "error";
    chunks: number;
    error?: string;
  }>;
  knowledge: {
    entries: Array<{
      id: string;
      title: string;
      contentPreview: string;
      agentId: string | null;
      createdAt: string;
    }>;
  };
  errors: string[];
}

/**
 * Streaming Knowledge Service
 * Handles large file uploads with chunked processing and background vectorization
 */
export class StreamingKnowledgeService {
  /**
   * Process streaming file upload with background processing
   */
  async processStreamingUpload(params: StreamingUploadParams): Promise<StreamingUploadResult> {
    const { files, userId, tenantId, agentId, title, chunkSize = 5000, overlap = 200 } = params;

    const sessionId = uuidv4();

    logger.info("Starting streaming upload processing", {
      sessionId,
      fileCount: files.length,
      userId,
      tenantId,
      agentId,
      chunkSize,
      overlap,
    });

    try {
      // Validate agent if provided
      let validatedAgentId = agentId;
      if (agentId) {
        const { data: agent, error: agentError } = await supabaseAdmin
          .from("agents")
          .select("id")
          .eq("id", agentId)
          .eq("tenant_id", tenantId)
          .single();

        if (agentError || !agent) {
          logger.warn("Agent not found, setting agent_id to null", {
            agentId,
            tenantId,
            sessionId,
          });
          validatedAgentId = null;
        }
      }

      // Process files in parallel
      const processingResults = await processMultipleStreamingFiles(
        files,
        userId,
        validatedAgentId || null,
        chunkSize,
        overlap
      );

      // Separate successful and failed files
      const successfulFiles = processingResults.filter((r) => r.status === "completed");
      const failedFiles = processingResults.filter((r) => r.status === "error");

      // Upload files to storage and collect all entries
      const allKnowledgeEntries: Record<string, unknown>[] = [];
      const allVectorEntries: Array<{
        id: string;
        content: string;
        metadata?: Record<string, unknown>;
      }> = [];

      // Process successful files
      for (const fileResult of successfulFiles) {
        const file = files.find((f) => f.id === fileResult.fileId);
        if (!file) continue;

        try {
          // Upload file to storage
          const fileUrl = await storageService.uploadKnowledgeFile(
            {
              buffer: file.buffer,
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
            } as Express.Multer.File,
            userId,
            tenantId
          );

          // Create knowledge entries for each chunk
          for (let i = 0; i < fileResult.entries.length; i++) {
            const entry = fileResult.entries[i];
            const chunkTitle =
              fileResult.entries.length > 1
                ? `${file.originalname.replace(/\.[^/.]+$/, "")} (Part ${i + 1})`
                : title || file.originalname.replace(/\.[^/.]+$/, "");

            const knowledgeEntry = {
              id: entry.id,
              title: chunkTitle,
              metadata: {
                fileName: file.originalname,
                fileType: file.mimetype,
                fileSize: file.size,
                chunkIndex: i,
                totalChunks: fileResult.entries.length,
                isFromFile: true,
                sessionId,
              },
              agent_id: validatedAgentId,
              tenant_id: tenantId,
              user_id: userId,
              file_url: fileUrl,
              file_type: file.mimetype,
              file_size: file.size,
              file_name: file.originalname,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            allKnowledgeEntries.push(knowledgeEntry);

            allVectorEntries.push({
              id: entry.id,
              content: entry.content,
              metadata: {
                userId,
                title: chunkTitle,
                agentId: validatedAgentId || "",
                tenantId,
                fileUrl,
                fileName: file.originalname,
                fileType: file.mimetype,
                fileSize: file.size,
                chunkIndex: i,
                totalChunks: fileResult.entries.length,
                isFromFile: true,
                sessionId,
              },
            });
          }
        } catch (error) {
          logger.error("Failed to upload file to storage", {
            sessionId,
            fileName: file.originalname,
            error: error instanceof Error ? error.message : "Unknown error",
          });

          // Mark file as failed
          failedFiles.push({
            fileId: file.id,
            fileName: file.originalname,
            status: "error",
            chunks: 0,
            totalSize: file.size,
            processedSize: 0,
            error: error instanceof Error ? error.message : "Storage upload failed",
            entries: [],
          });
        }
      }

      // Store knowledge entries in database
      let createdEntries: Array<Record<string, unknown>> = [];
      if (allKnowledgeEntries.length > 0) {
        const { data, error } = await supabaseAdmin
          .from("knowledge")
          .insert(allKnowledgeEntries)
          .select();

        if (error) {
          logger.error("Failed to insert knowledge entries", {
            sessionId,
            error: error.message,
            entryCount: allKnowledgeEntries.length,
          });
          throw new Error(`Database error: ${error.message}`);
        }

        createdEntries = data || [];
      }

      // Store vectors synchronously to ensure data consistency
      let vectorizationSuccess = true;
      let vectorizationError: string | null = null;

      if (allVectorEntries.length > 0) {
        try {
          await batchStoreKnowledge(allVectorEntries);
          logger.info("Vectors stored successfully", {
            sessionId,
            count: allVectorEntries.length,
          });
        } catch (error) {
          vectorizationSuccess = false;
          vectorizationError = error instanceof Error ? error.message : "Unknown error";
          logger.error("Vector storage failed", {
            sessionId,
            error: vectorizationError,
            vectorCount: allVectorEntries.length,
          });
        }
      }

      const totalChunks = successfulFiles.reduce((sum, r) => sum + r.chunks, 0);
      const errors = failedFiles.map((f) => `${f.fileName}: ${f.error}`);

      logger.info("Streaming upload processing completed", {
        sessionId,
        totalFiles: files.length,
        successfulFiles: successfulFiles.length,
        failedFiles: failedFiles.length,
        totalChunks,
        totalKnowledgeEntries: allKnowledgeEntries.length,
      });

      const hasPartialSuccess = successfulFiles.length > 0 && failedFiles.length > 0;
      const overallSuccess = failedFiles.length === 0 && vectorizationSuccess;

      return {
        success: overallSuccess,
        partialSuccess: hasPartialSuccess,
        sessionId,
        filesProcessed: successfulFiles.length,
        filesFailed: failedFiles.length,
        totalChunks,
        totalKnowledgeEntries: allKnowledgeEntries.length,
        vectorizationStatus: vectorizationSuccess ? "completed" : "failed",
        vectorizationError,
        files: processingResults.map((r) => ({
          fileName: r.fileName,
          status: r.status === "completed" ? "success" : "error",
          chunks: r.chunks,
          error: r.error,
        })),
        knowledge: {
          entries: createdEntries.map((entry) => ({
            id: entry.id as string,
            title: entry.title as string,
            contentPreview: "Content stored in vector database",
            agentId: (entry.agent_id as string | null) || null,
            createdAt: entry.created_at as string,
          })),
        },
        errors,
      };
    } catch (error) {
      logger.error("Streaming upload processing failed", {
        sessionId,
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
        fileCount: files.length,
      });

      return {
        success: false,
        partialSuccess: false,
        sessionId,
        filesProcessed: 0,
        filesFailed: files.length,
        totalChunks: 0,
        totalKnowledgeEntries: 0,
        vectorizationStatus: "failed",
        vectorizationError: error instanceof Error ? error.message : "Unknown error",
        files: [],
        knowledge: { entries: [] },
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }
}

// Create and export service instance
export const streamingKnowledgeService = new StreamingKnowledgeService();
