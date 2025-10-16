/**
 * @file knowledge.controller.ts
 * @description Knowledge base controller for managing knowledge entries
 * Handles HTTP requests for knowledge-related operations
 *
 * Routes are organized as:
 * - User Routes: Users can manage their own knowledge entries
 * - Admin Routes: System administrators can manage all knowledge entries
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { successResponse, errorResponse } from "../utils/response";
import { supabaseAdmin } from "../config/supabase";
import {
  searchKnowledge,
  storeKnowledge,
  batchStoreKnowledge,
  deleteKnowledge as deleteKnowledgeVector,
} from "../utils/vectorizer";
import { extractTextFromFile, chunkText, validateFile } from "../utils/fileProcessor";
import logger from "../config/logger";
import { v4 as uuidv4 } from "uuid";

/**
 * Knowledge Controller Class
 * Object-based controller for knowledge operations
 */
export class KnowledgeController {
  // ===========================
  // User Routes (Knowledge Owners)
  // ===========================

  /**
   * Create a new knowledge entry
   * POST /api/knowledge
   * @access User
   */
  async createKnowledge(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      if (!req.user) {
        return errorResponse(res, "User not authenticated", 401);
      }

      const { title, content, metadata, agentId } = req.body;
      const knowledgeId = uuidv4();

      // Store in Supabase database
      const { data: knowledge, error } = await supabaseAdmin
        .from("knowledge")
        .insert({
          id: knowledgeId,
          title,
          content,
          metadata: metadata || {},
          agent_id: agentId || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        logger.error("Create knowledge database error", { error: error.message });
        throw new Error(error.message);
      }

      // Store in vector database (Pinecone)
      try {
        await storeKnowledge(knowledgeId, content, {
          userId: req.user.id,
          title,
          agentId: agentId || null,
          ...metadata,
        });
      } catch (vectorError) {
        // If vector storage fails, remove from database
        await supabaseAdmin.from("knowledge").delete().eq("id", knowledgeId);
        logger.error("Vector storage failed, rolled back database entry", {
          knowledgeId,
          error: vectorError instanceof Error ? vectorError.message : "Unknown error",
        });
        throw new Error("Failed to store knowledge in vector database");
      }

      logger.info("Knowledge created", {
        knowledgeId,
        userId: req.user.id,
        title,
        contentLength: content.length,
      });

      return successResponse(
        res,
        {
          id: knowledge.id,
          title: knowledge.title,
          content: knowledge.content,
          metadata: knowledge.metadata,
          agentId: knowledge.agent_id,
          createdAt: knowledge.created_at,
          updatedAt: knowledge.updated_at,
        },
        "Knowledge entry created successfully",
        201
      );
    } catch (error) {
      logger.error("Create knowledge error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.id,
      });
      return errorResponse(
        res,
        error instanceof Error ? error.message : "Failed to create knowledge entry",
        500
      );
    }
  }

  /**
   * Get user's knowledge entries with pagination
   * GET /api/knowledge
   * @access User
   */
  async getUserKnowledge(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      if (!req.user) {
        return errorResponse(res, "User not authenticated", 401);
      }

      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 10, 50);
      const agentId = req.query.agentId as string;
      const offset = (page - 1) * perPage;

      // Build query
      let query = supabaseAdmin.from("knowledge").select("*", { count: "exact" });

      // Filter by agent if specified
      if (agentId) {
        query = query.eq("agent_id", agentId);
      } else {
        // For now, we don't have user_id in knowledge table, so we'll need to filter by agent ownership
        // This is a simplified approach - in production you might want to add user_id to knowledge table
        query = query.is("agent_id", null); // Only show knowledge not tied to specific agents for now
      }

      const {
        data: knowledge,
        error,
        count,
      } = await query.order("created_at", { ascending: false }).range(offset, offset + perPage - 1);

      if (error) {
        logger.error("Get user knowledge error", { error: error.message });
        throw new Error(error.message);
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / perPage);

      return successResponse(
        res,
        {
          knowledge: knowledge.map((entry) => ({
            id: entry.id,
            title: entry.title,
            content: entry.content,
            metadata: entry.metadata,
            agentId: entry.agent_id,
            createdAt: entry.created_at,
            updatedAt: entry.updated_at,
          })),
          pagination: {
            page,
            perPage,
            total,
            totalPages,
          },
        },
        "Knowledge entries retrieved successfully"
      );
    } catch (error) {
      logger.error("Get user knowledge error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.id,
      });
      return errorResponse(
        res,
        error instanceof Error ? error.message : "Failed to retrieve knowledge entries",
        500
      );
    }
  }

  /**
   * Get knowledge entry by ID
   * GET /api/knowledge/:id
   * @access User
   */
  async getKnowledgeById(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      if (!req.user) {
        return errorResponse(res, "User not authenticated", 401);
      }

      const { id } = req.params;

      const { data: knowledge, error } = await supabaseAdmin
        .from("knowledge")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return errorResponse(res, "Knowledge entry not found", 404);
        }
        logger.error("Get knowledge by ID error", { error: error.message });
        throw new Error(error.message);
      }

      return successResponse(
        res,
        {
          id: knowledge.id,
          title: knowledge.title,
          content: knowledge.content,
          metadata: knowledge.metadata,
          agentId: knowledge.agent_id,
          createdAt: knowledge.created_at,
          updatedAt: knowledge.updated_at,
        },
        "Knowledge entry retrieved successfully"
      );
    } catch (error) {
      logger.error("Get knowledge by ID error", {
        error: error instanceof Error ? error.message : "Unknown error",
        knowledgeId: req.params.id,
        userId: req.user?.id,
      });
      return errorResponse(
        res,
        error instanceof Error ? error.message : "Failed to retrieve knowledge entry",
        500
      );
    }
  }

  /**
   * Delete knowledge entry
   * DELETE /api/knowledge/:id
   * @access User
   */
  async deleteKnowledge(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      if (!req.user) {
        return errorResponse(res, "User not authenticated", 401);
      }

      const { id } = req.params;

      // Check if knowledge exists
      const { data: existingKnowledge, error: fetchError } = await supabaseAdmin
        .from("knowledge")
        .select("id, title")
        .eq("id", id)
        .single();

      if (fetchError) {
        if (fetchError.code === "PGRST116") {
          return errorResponse(res, "Knowledge entry not found", 404);
        }
        throw new Error(fetchError.message);
      }

      // Delete from database
      const { error } = await supabaseAdmin.from("knowledge").delete().eq("id", id);

      if (error) {
        logger.error("Delete knowledge database error", { error: error.message });
        throw new Error(error.message);
      }

      // Delete from vector database
      try {
        await deleteKnowledgeVector(id);
      } catch (vectorError) {
        logger.warn("Vector deletion failed", {
          knowledgeId: id,
          error: vectorError instanceof Error ? vectorError.message : "Unknown error",
        });
      }

      logger.info("Knowledge deleted", {
        knowledgeId: id,
        title: existingKnowledge.title,
        userId: req.user.id,
      });

      return successResponse(res, null, "Knowledge entry deleted successfully");
    } catch (error) {
      logger.error("Delete knowledge error", {
        error: error instanceof Error ? error.message : "Unknown error",
        knowledgeId: req.params.id,
        userId: req.user?.id,
      });
      return errorResponse(
        res,
        error instanceof Error ? error.message : "Failed to delete knowledge entry",
        500
      );
    }
  }

  /**
   * Update knowledge entry
   * PUT /api/knowledge/:id
   * @access User
   */
  async updateKnowledge(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      if (!req.user) {
        return errorResponse(res, "User not authenticated", 401);
      }

      const { id } = req.params;
      const { title, content, metadata } = req.body;

      // Check if knowledge exists
      const { data: existingKnowledge, error: fetchError } = await supabaseAdmin
        .from("knowledge")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) {
        if (fetchError.code === "PGRST116") {
          return errorResponse(res, "Knowledge entry not found", 404);
        }
        throw new Error(fetchError.message);
      }

      // Update in database
      const { data: knowledge, error } = await supabaseAdmin
        .from("knowledge")
        .update({
          title: title || existingKnowledge.title,
          content: content || existingKnowledge.content,
          metadata: metadata || existingKnowledge.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        logger.error("Update knowledge database error", { error: error.message });
        throw new Error(error.message);
      }

      // Update in vector database if content changed
      if (content && content !== existingKnowledge.content) {
        try {
          await storeKnowledge(id, content, {
            userId: req.user.id,
            title: knowledge.title,
            agentId: knowledge.agent_id,
            ...knowledge.metadata,
          });
        } catch (vectorError) {
          logger.warn("Vector update failed", {
            knowledgeId: id,
            error: vectorError instanceof Error ? vectorError.message : "Unknown error",
          });
        }
      }

      logger.info("Knowledge updated", {
        knowledgeId: id,
        userId: req.user.id,
        contentChanged: !!content,
      });

      return successResponse(
        res,
        {
          id: knowledge.id,
          title: knowledge.title,
          content: knowledge.content,
          metadata: knowledge.metadata,
          agentId: knowledge.agent_id,
          createdAt: knowledge.created_at,
          updatedAt: knowledge.updated_at,
        },
        "Knowledge entry updated successfully"
      );
    } catch (error) {
      logger.error("Update knowledge error", {
        error: error instanceof Error ? error.message : "Unknown error",
        knowledgeId: req.params.id,
        userId: req.user?.id,
      });
      return errorResponse(
        res,
        error instanceof Error ? error.message : "Failed to update knowledge entry",
        500
      );
    }
  }

  /**
   * Batch upload knowledge entries
   * POST /api/knowledge/batch
   * @access User
   */
  async batchUploadKnowledge(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      if (!req.user) {
        return errorResponse(res, "User not authenticated", 401);
      }

      const { entries, agentId } = req.body;

      if (!Array.isArray(entries) || entries.length === 0) {
        return errorResponse(res, "Entries array is required and cannot be empty", 400);
      }

      if (entries.length > 100) {
        return errorResponse(res, "Maximum 100 entries allowed per batch", 400);
      }

      const knowledgeEntries = entries.map((entry) => ({
        id: uuidv4(),
        title: entry.title,
        content: entry.content,
        metadata: entry.metadata || {},
        agent_id: agentId || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      // Store in database
      const { data: createdEntries, error } = await supabaseAdmin
        .from("knowledge")
        .insert(knowledgeEntries)
        .select();

      if (error) {
        logger.error("Batch create knowledge database error", { error: error.message });
        throw new Error(error.message);
      }

      // Store in vector database
      try {
        const vectorEntries = knowledgeEntries.map((entry) => ({
          id: entry.id,
          content: entry.content,
          metadata: {
            userId: req.user!.id,
            title: entry.title,
            agentId: entry.agent_id,
            ...entry.metadata,
          },
        }));

        await batchStoreKnowledge(vectorEntries);
      } catch (vectorError) {
        // If vector storage fails, remove from database
        const ids = knowledgeEntries.map((entry) => entry.id);
        await supabaseAdmin.from("knowledge").delete().in("id", ids);

        logger.error("Batch vector storage failed, rolled back database entries", {
          count: entries.length,
          error: vectorError instanceof Error ? vectorError.message : "Unknown error",
        });
        throw new Error("Failed to store knowledge entries in vector database");
      }

      logger.info("Batch knowledge created", {
        userId: req.user.id,
        count: entries.length,
        agentId,
      });

      return successResponse(
        res,
        {
          created:
            createdEntries?.map((entry) => ({
              id: entry.id,
              title: entry.title,
              content: entry.content,
              metadata: entry.metadata,
              agentId: entry.agent_id,
              createdAt: entry.created_at,
            })) || [],
          count: createdEntries?.length || 0,
        },
        "Knowledge entries created successfully",
        201
      );
    } catch (error) {
      logger.error("Batch upload knowledge error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.id,
      });
      return errorResponse(
        res,
        error instanceof Error ? error.message : "Failed to batch upload knowledge entries",
        500
      );
    }
  }

  /**
   * Search knowledge base using vector similarity
   * POST /api/knowledge/search
   * @access User
   */
  async searchKnowledgeBase(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      if (!req.user) {
        return errorResponse(res, "User not authenticated", 401);
      }

      const { query, topK = 5, agentId } = req.body;

      logger.info("Knowledge search request", {
        userId: req.user.id,
        queryLength: query.length,
        topK,
        agentId,
      });

      // Search using vector similarity
      const searchResults = await searchKnowledge(query, req.user.id, topK);

      // Get full knowledge entries from database
      const knowledgeIds = searchResults.map((result) => result.id);

      let knowledgeEntries = [];
      if (knowledgeIds.length > 0) {
        const { data, error } = await supabaseAdmin
          .from("knowledge")
          .select("*")
          .in("id", knowledgeIds);

        if (error) {
          logger.error("Search knowledge database error", { error: error.message });
          throw new Error(error.message);
        }

        knowledgeEntries = data || [];
      }

      // Combine search results with database entries
      const results = searchResults.map((result) => {
        const dbEntry = knowledgeEntries.find((entry) => entry.id === result.id);
        return {
          id: result.id,
          score: result.score,
          title: dbEntry?.title || result.metadata?.title || "Untitled",
          content: dbEntry?.content || result.metadata?.content || "",
          metadata: dbEntry?.metadata || result.metadata || {},
          agentId: dbEntry?.agent_id || result.metadata?.agentId,
          createdAt: dbEntry?.created_at,
          updatedAt: dbEntry?.updated_at,
        };
      });

      // Filter by agent if specified
      const filteredResults = agentId
        ? results.filter((result) => result.agentId === agentId)
        : results;

      logger.info("Knowledge search completed", {
        userId: req.user.id,
        resultsFound: filteredResults.length,
        topScore: filteredResults[0]?.score || 0,
      });

      return successResponse(
        res,
        {
          query,
          results: filteredResults,
          totalFound: filteredResults.length,
        },
        "Knowledge search completed successfully"
      );
    } catch (error) {
      logger.error("Search knowledge error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.id,
      });
      return errorResponse(
        res,
        error instanceof Error ? error.message : "Failed to search knowledge base",
        500
      );
    }
  }

  /**
   * Upload single file and convert to knowledge
   * POST /api/knowledge/upload
   * @access User
   */
  async uploadFile(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      if (!req.user) {
        return errorResponse(res, "User not authenticated", 401);
      }

      if (!req.file) {
        return errorResponse(res, "No file provided", 400);
      }

      // Validate file
      const validation = validateFile(req.file);
      if (!validation.isValid) {
        return errorResponse(res, validation.error || "Invalid file", 400);
      }

      const { agentId, title, chunkSize = 1000, overlap = 100 } = req.body;

      logger.info("File upload started", {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        userId: req.user.id,
        agentId,
      });

      // Extract text from file
      const extractedText = await extractTextFromFile(req.file);

      // Use provided title or file name
      const knowledgeTitle = title || extractedText.metadata.fileName.replace(/\.[^/.]+$/, "");

      // Chunk text if it's large
      const chunks = chunkText(extractedText.content, parseInt(chunkSize), parseInt(overlap));

      const knowledgeEntries = [];
      const vectorEntries = [];

      // Create knowledge entries for each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = uuidv4();
        const chunkTitle = chunks.length > 1 ? `${knowledgeTitle} (Part ${i + 1})` : knowledgeTitle;

        const knowledgeEntry = {
          id: chunkId,
          title: chunkTitle,
          content: chunks[i],
          metadata: {
            ...extractedText.metadata,
            chunkIndex: i,
            totalChunks: chunks.length,
            isFromFile: true,
          },
          agent_id: agentId || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        knowledgeEntries.push(knowledgeEntry);

        vectorEntries.push({
          id: chunkId,
          content: chunks[i],
          metadata: {
            userId: req.user.id,
            title: chunkTitle,
            agentId: agentId || null,
            fileName: extractedText.metadata.fileName,
            fileType: extractedText.metadata.fileType,
            chunkIndex: i,
            totalChunks: chunks.length,
            isFromFile: true,
          },
        });
      }

      // Store in database
      const { data: createdEntries, error } = await supabaseAdmin
        .from("knowledge")
        .insert(knowledgeEntries)
        .select();

      if (error) {
        logger.error("File upload database error", {
          error: error.message,
          fileName: req.file.originalname,
          userId: req.user.id,
        });
        throw new Error(error.message);
      }

      // Store in vector database
      try {
        await batchStoreKnowledge(vectorEntries);
      } catch (vectorError) {
        // If vector storage fails, remove from database
        const ids = knowledgeEntries.map((entry) => entry.id);
        await supabaseAdmin.from("knowledge").delete().in("id", ids);

        logger.error("File upload vector storage failed, rolled back database entries", {
          fileName: req.file.originalname,
          chunksCount: chunks.length,
          error: vectorError instanceof Error ? vectorError.message : "Unknown error",
          userId: req.user.id,
        });
        throw new Error("Failed to store file content in vector database");
      }

      logger.info("File upload completed successfully", {
        fileName: req.file.originalname,
        chunksCreated: chunks.length,
        totalContentLength: extractedText.content.length,
        userId: req.user.id,
        agentId,
      });

      return successResponse(
        res,
        {
          file: {
            originalName: req.file.originalname,
            size: req.file.size,
            type: req.file.mimetype,
          },
          extracted: {
            contentLength: extractedText.content.length,
            wordCount: extractedText.metadata.wordCount,
            pageCount: extractedText.metadata.pageCount,
          },
          knowledge: {
            chunksCreated: chunks.length,
            entries:
              createdEntries?.map((entry) => ({
                id: entry.id,
                title: entry.title,
                contentPreview: entry.content.substring(0, 100) + "...",
                agentId: entry.agent_id,
                createdAt: entry.created_at,
              })) || [],
          },
        },
        "File uploaded and processed successfully",
        201
      );
    } catch (error) {
      logger.error("File upload error", {
        error: error instanceof Error ? error.message : "Unknown error",
        fileName: req.file?.originalname,
        userId: req.user?.id,
      });
      return errorResponse(
        res,
        error instanceof Error ? error.message : "Failed to upload and process file",
        500
      );
    }
  }

  /**
   * Upload multiple files and convert to knowledge
   * POST /api/knowledge/upload/batch
   * @access User
   */
  async uploadMultipleFiles(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      if (!req.user) {
        return errorResponse(res, "User not authenticated", 401);
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return errorResponse(res, "No files provided", 400);
      }

      const files = req.files as Express.Multer.File[];
      const { agentId, chunkSize = 1000, overlap = 100 } = req.body;

      if (files.length > 5) {
        return errorResponse(res, "Maximum 5 files allowed per batch", 400);
      }

      logger.info("Batch file upload started", {
        fileCount: files.length,
        fileNames: files.map((f) => f.originalname),
        userId: req.user.id,
        agentId,
      });

      const allKnowledgeEntries = [];
      const allVectorEntries = [];
      const processedFiles = [];

      // Process each file
      for (const file of files) {
        // Validate file
        const validation = validateFile(file);
        if (!validation.isValid) {
          logger.warn("Skipping invalid file", {
            fileName: file.originalname,
            error: validation.error,
            userId: req.user.id,
          });
          continue;
        }

        try {
          // Extract text from file
          const extractedText = await extractTextFromFile(file);
          const knowledgeTitle = extractedText.metadata.fileName.replace(/\.[^/.]+$/, "");

          // Chunk text if it's large
          const chunks = chunkText(extractedText.content, parseInt(chunkSize), parseInt(overlap));

          // Create knowledge entries for each chunk
          for (let i = 0; i < chunks.length; i++) {
            const chunkId = uuidv4();
            const chunkTitle =
              chunks.length > 1 ? `${knowledgeTitle} (Part ${i + 1})` : knowledgeTitle;

            const knowledgeEntry = {
              id: chunkId,
              title: chunkTitle,
              content: chunks[i],
              metadata: {
                ...extractedText.metadata,
                chunkIndex: i,
                totalChunks: chunks.length,
                isFromFile: true,
              },
              agent_id: agentId || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            allKnowledgeEntries.push(knowledgeEntry);

            allVectorEntries.push({
              id: chunkId,
              content: chunks[i],
              metadata: {
                userId: req.user.id,
                title: chunkTitle,
                agentId: agentId || null,
                fileName: extractedText.metadata.fileName,
                fileType: extractedText.metadata.fileType,
                chunkIndex: i,
                totalChunks: chunks.length,
                isFromFile: true,
              },
            });
          }

          processedFiles.push({
            fileName: file.originalname,
            chunksCreated: chunks.length,
            contentLength: extractedText.content.length,
            wordCount: extractedText.metadata.wordCount,
          });
        } catch (fileError) {
          logger.error("Failed to process file in batch", {
            fileName: file.originalname,
            error: fileError instanceof Error ? fileError.message : "Unknown error",
            userId: req.user.id,
          });
          // Continue with other files
        }
      }

      if (allKnowledgeEntries.length === 0) {
        return errorResponse(res, "No files could be processed successfully", 400);
      }

      // Store in database
      const { data: createdEntries, error } = await supabaseAdmin
        .from("knowledge")
        .insert(allKnowledgeEntries)
        .select();

      if (error) {
        logger.error("Batch file upload database error", {
          error: error.message,
          fileCount: files.length,
          userId: req.user.id,
        });
        throw new Error(error.message);
      }

      // Store in vector database
      try {
        await batchStoreKnowledge(allVectorEntries);
      } catch (vectorError) {
        // If vector storage fails, remove from database
        const ids = allKnowledgeEntries.map((entry) => entry.id);
        await supabaseAdmin.from("knowledge").delete().in("id", ids);

        logger.error("Batch file upload vector storage failed, rolled back database entries", {
          fileCount: files.length,
          chunksCount: allKnowledgeEntries.length,
          error: vectorError instanceof Error ? vectorError.message : "Unknown error",
          userId: req.user.id,
        });
        throw new Error("Failed to store file contents in vector database");
      }

      logger.info("Batch file upload completed successfully", {
        fileCount: files.length,
        totalChunksCreated: allKnowledgeEntries.length,
        processedFiles: processedFiles.length,
        userId: req.user.id,
        agentId,
      });

      return successResponse(
        res,
        {
          filesProcessed: processedFiles.length,
          totalChunksCreated: allKnowledgeEntries.length,
          files: processedFiles,
          knowledge: {
            entries:
              createdEntries?.map((entry) => ({
                id: entry.id,
                title: entry.title,
                contentPreview: entry.content.substring(0, 100) + "...",
                agentId: entry.agent_id,
                createdAt: entry.created_at,
              })) || [],
          },
        },
        "Files uploaded and processed successfully",
        201
      );
    } catch (error) {
      logger.error("Batch file upload error", {
        error: error instanceof Error ? error.message : "Unknown error",
        fileCount: req.files?.length,
        userId: req.user?.id,
      });
      return errorResponse(
        res,
        error instanceof Error ? error.message : "Failed to upload and process files",
        500
      );
    }
  }

  // ===========================
  // Admin Routes (System Administration)
  // ===========================

  /**
   * Get all knowledge entries in system (Admin only)
   * GET /api/knowledge/admin/all
   * @access Admin
   */
  async getAllKnowledge(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      const page = parseInt(req.query.page as string) || 1;
      const perPage = Math.min(parseInt(req.query.perPage as string) || 10, 100);
      const offset = (page - 1) * perPage;

      const {
        data: knowledge,
        error,
        count,
      } = await supabaseAdmin
        .from("knowledge")
        .select(
          `
        *,
        agent:agent_id (
          id,
          name,
          owner_id
        )
      `,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + perPage - 1);

      if (error) {
        logger.error("Admin get all knowledge error", { error: error.message });
        throw new Error(error.message);
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / perPage);

      logger.info("Admin: All knowledge retrieved", {
        adminId: req.user?.id,
        total,
        page,
        perPage,
      });

      return successResponse(
        res,
        {
          knowledge: knowledge.map((entry) => ({
            id: entry.id,
            title: entry.title,
            content: entry.content.substring(0, 200) + (entry.content.length > 200 ? "..." : ""),
            metadata: entry.metadata,
            agent: entry.agent,
            createdAt: entry.created_at,
            updatedAt: entry.updated_at,
          })),
          pagination: {
            page,
            perPage,
            total,
            totalPages,
          },
        },
        "All knowledge entries retrieved successfully"
      );
    } catch (error) {
      logger.error("Admin get all knowledge error", {
        error: error instanceof Error ? error.message : "Unknown error",
        adminId: req.user?.id,
      });
      return errorResponse(
        res,
        error instanceof Error ? error.message : "Failed to retrieve knowledge entries",
        500
      );
    }
  }

  /**
   * Get system-wide knowledge statistics (Admin only)
   * GET /api/knowledge/admin/stats
   * @access Admin
   */
  async getKnowledgeStats(req: Request, res: Response): Promise<Response> {
    try {
      // Get total knowledge count
      const { count: totalKnowledge } = await supabaseAdmin
        .from("knowledge")
        .select("*", { count: "exact", head: true });

      // Get knowledge with agents
      const { count: knowledgeWithAgents } = await supabaseAdmin
        .from("knowledge")
        .select("*", { count: "exact", head: true })
        .not("agent_id", "is", null);

      // Get knowledge created in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: recentKnowledge } = await supabaseAdmin
        .from("knowledge")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString());

      // Get average content length
      const { data: contentStats } = await supabaseAdmin.from("knowledge").select("content");

      const avgContentLength = contentStats?.length
        ? Math.round(
            contentStats.reduce((sum, entry) => sum + entry.content.length, 0) / contentStats.length
          )
        : 0;

      logger.info("Admin: Knowledge stats retrieved", {
        adminId: req.user?.id,
        totalKnowledge,
        knowledgeWithAgents,
      });

      return successResponse(
        res,
        {
          totalKnowledge: totalKnowledge || 0,
          knowledgeWithAgents: knowledgeWithAgents || 0,
          standaloneKnowledge: (totalKnowledge || 0) - (knowledgeWithAgents || 0),
          recentKnowledge: recentKnowledge || 0,
          avgContentLength,
        },
        "Knowledge statistics retrieved successfully"
      );
    } catch (error) {
      logger.error("Admin knowledge stats error", {
        error: error instanceof Error ? error.message : "Unknown error",
        adminId: req.user?.id,
      });
      return errorResponse(res, "Failed to get knowledge statistics", 500);
    }
  }

  /**
   * Force delete any knowledge entry (Admin only)
   * DELETE /api/knowledge/admin/:id
   * @access Admin
   */
  async forceDeleteKnowledge(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      const { id } = req.params;

      // Get knowledge info before deletion (for logging)
      const { data: knowledge } = await supabaseAdmin
        .from("knowledge")
        .select("id, title, agent_id")
        .eq("id", id)
        .single();

      if (!knowledge) {
        return errorResponse(res, "Knowledge entry not found", 404);
      }

      // Force delete (bypass ownership check)
      const { error } = await supabaseAdmin.from("knowledge").delete().eq("id", id);

      if (error) {
        logger.error("Admin force delete knowledge failed", {
          knowledgeId: id,
          error: error.message,
          adminId: req.user?.id,
        });
        throw new Error(error.message);
      }

      // Delete from vector database
      try {
        await deleteKnowledgeVector(id);
      } catch (vectorError) {
        logger.warn("Admin force delete: Vector deletion failed", {
          knowledgeId: id,
          error: vectorError instanceof Error ? vectorError.message : "Unknown error",
        });
      }

      logger.warn("Admin: Knowledge force deleted", {
        knowledgeId: id,
        title: knowledge.title,
        agentId: knowledge.agent_id,
        adminId: req.user?.id,
        adminEmail: req.user?.email,
      });

      return successResponse(res, null, "Knowledge entry deleted successfully");
    } catch (error) {
      logger.error("Admin force delete knowledge error", {
        knowledgeId: req.params.id,
        error: error instanceof Error ? error.message : "Unknown error",
        adminId: req.user?.id,
      });
      return errorResponse(
        res,
        error instanceof Error ? error.message : "Failed to delete knowledge entry",
        500
      );
    }
  }
}

// Create and export controller instance
export const knowledgeController = new KnowledgeController();

// Export individual methods for backward compatibility
export const {
  createKnowledge,
  getUserKnowledge,
  getKnowledgeById,
  deleteKnowledge,
  updateKnowledge,
  batchUploadKnowledge,
  searchKnowledgeBase,
  uploadFile,
  uploadMultipleFiles,
  getAllKnowledge,
  getKnowledgeStats,
  forceDeleteKnowledge,
} = knowledgeController;

export default knowledgeController;
