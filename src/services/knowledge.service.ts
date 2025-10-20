/**
 * @file knowledge.service.ts
 * @description Service layer for knowledge management and database operations
 * Handles knowledge base operations with multi-tenancy support
 */

import { supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";
import {
  Knowledge,
  KnowledgeInsert,
  KnowledgeUpdate,
  KnowledgeListOptions,
  KnowledgeListResponse,
} from "../types";

/**
 * Knowledge service class for database operations
 */
export class KnowledgeService {
  /**
   * Create a new knowledge entry with vector storage
   */
  async createKnowledge(data: KnowledgeInsert): Promise<Knowledge> {
    try {
      logger.info("Creating knowledge entry", {
        title: data.title,
        agentId: data.agent_id,
        tenantId: data.tenant_id,
      });

      // 1. Store in Supabase database
      const { data: knowledge, error } = await supabaseAdmin
        .from("knowledge")
        .insert(data)
        .select()
        .single();

      if (error) {
        logger.error("Failed to create knowledge entry", {
          error: error.message,
          data,
        });
        throw new Error(`Failed to create knowledge entry: ${error.message}`);
      }

      // Note: Content is stored in Pinecone only via file upload
      // This method only creates metadata entries without content
      // Use processFileUpload() to create knowledge with actual content

      logger.info("Knowledge entry created successfully", {
        knowledgeId: knowledge.id,
        title: knowledge.title,
        tenantId: knowledge.tenant_id,
      });

      return knowledge;
    } catch (error) {
      logger.error("Create knowledge service error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Get knowledge entry by ID
   */
  async getKnowledgeById(id: string, tenantId?: string): Promise<Knowledge | null> {
    try {
      let query = supabaseAdmin.from("knowledge").select("*").eq("id", id);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data: knowledge, error } = await query.single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new Error(`Failed to get knowledge entry: ${error.message}`);
      }

      return knowledge;
    } catch (error) {
      logger.error("Get knowledge by ID service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        knowledgeId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get user's knowledge entries with pagination
   */
  async getUserKnowledge(
    tenantId: string,
    options: KnowledgeListOptions = {}
  ): Promise<KnowledgeListResponse> {
    try {
      const { page = 1, limit = 10, agentId } = options;
      const offset = (page - 1) * limit;

      // Build query
      let query = supabaseAdmin
        .from("knowledge")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId);

      // Filter by agent if specified
      if (agentId) {
        query = query.eq("agent_id", agentId);
      } else {
        // Show knowledge not tied to specific agents for this tenant
        query = query.is("agent_id", null);
      }

      const {
        data: knowledge,
        error,
        count,
      } = await query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get user knowledge: ${error.message}`);
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        knowledge: knowledge || [],
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      logger.error("Get user knowledge service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        tenantId,
        options,
      });
      throw error;
    }
  }

  /**
   * Update knowledge entry
   */
  async updateKnowledge(id: string, data: KnowledgeUpdate, tenantId: string): Promise<Knowledge> {
    try {
      // Check if knowledge exists
      const existingKnowledge = await this.getKnowledgeById(id, tenantId);
      if (!existingKnowledge) {
        throw new Error("Knowledge entry not found");
      }

      // Update in database
      const { data: knowledge, error } = await supabaseAdmin
        .from("knowledge")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update knowledge entry: ${error.message}`);
      }

      // Note: Content is stored in Pinecone only, not in database
      // To update content, delete and re-upload the file

      logger.info("Knowledge updated successfully", {
        knowledgeId: id,
        tenantId,
      });

      return knowledge;
    } catch (error) {
      logger.error("Update knowledge service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        knowledgeId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Delete knowledge entry
   */
  async deleteKnowledge(id: string, tenantId: string): Promise<void> {
    try {
      // Check if knowledge exists
      const existingKnowledge = await this.getKnowledgeById(id, tenantId);
      if (!existingKnowledge) {
        throw new Error("Knowledge entry not found");
      }

      // Delete from database
      const { error } = await supabaseAdmin
        .from("knowledge")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);

      if (error) {
        throw new Error(`Failed to delete knowledge entry: ${error.message}`);
      }

      // Delete from vector database
      try {
        const { deleteKnowledge: deleteKnowledgeVector } = await import("./vectorizer.service");
        await deleteKnowledgeVector(id);
      } catch (vectorError) {
        logger.warn("Vector deletion failed", {
          knowledgeId: id,
          error: vectorError instanceof Error ? vectorError.message : "Unknown error",
        });
      }

      logger.info("Knowledge deleted successfully", {
        knowledgeId: id,
        title: existingKnowledge.title,
        tenantId,
      });
    } catch (error) {
      logger.error("Delete knowledge service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        knowledgeId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Search knowledge base using vector similarity
   */
  async searchKnowledge(
    query: string,
    userId: string,
    tenantId: string,
    topK: number = 5
  ): Promise<
    Array<{
      id: string;
      score: number;
      title: string;
      content: string;
      metadata: Record<string, unknown>;
      agentId: string | null;
      createdAt: string | null;
      updatedAt: string | null;
    }>
  > {
    try {
      // Search using vector similarity
      const { searchKnowledge: searchKnowledgeVector } = await import("./vectorizer.service");
      const searchResults = await searchKnowledgeVector(query, userId, tenantId, topK);

      // Get full knowledge entries from database
      const knowledgeIds = searchResults.map((result) => result.id);

      let knowledgeEntries: Knowledge[] = [];
      if (knowledgeIds.length > 0) {
        const { data, error } = await supabaseAdmin
          .from("knowledge")
          .select("*")
          .in("id", knowledgeIds)
          .eq("tenant_id", tenantId);

        if (error) {
          throw new Error(`Failed to get knowledge entries: ${error.message}`);
        }

        knowledgeEntries = data || [];
      }

      // Combine search results with database entries
      const results = searchResults.map((result) => {
        const dbEntry = knowledgeEntries.find((entry) => entry.id === result.id);
        return {
          id: result.id,
          score: result.score,
          title: (dbEntry?.title || result.metadata?.title || "Untitled") as string,
          content: result.metadata?.content || "", // Content is stored in Pinecone metadata
          metadata: dbEntry?.metadata || result.metadata || {},
          agentId: (dbEntry?.agent_id || result.metadata?.agentId) as string | null,
          createdAt: dbEntry?.created_at || null,
          updatedAt: dbEntry?.updated_at || null,
        };
      });

      logger.info("Knowledge search completed", {
        userId,
        tenantId,
        resultsFound: results.length,
        topScore: results[0]?.score || 0,
      });

      return results;
    } catch (error) {
      logger.error("Search knowledge service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        query,
        userId,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get all knowledge entries (Admin only)
   */
  async getAllKnowledge(options: KnowledgeListOptions = {}): Promise<KnowledgeListResponse> {
    try {
      const { page = 1, limit = 10 } = options;
      const offset = (page - 1) * limit;

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
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get all knowledge: ${error.message}`);
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        knowledge: knowledge || [],
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      logger.error("Get all knowledge service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        options,
      });
      throw error;
    }
  }

  /**
   * Get knowledge statistics (Admin only)
   */
  async getKnowledgeStats(): Promise<{
    totalKnowledge: number;
    knowledgeWithAgents: number;
    standaloneKnowledge: number;
    recentKnowledge: number;
    // avgContentLength removed: content is in Pinecone, not DB
  }> {
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

      // Note: Content is stored in Pinecone only, not in database
      // Average content length cannot be calculated from database

      return {
        totalKnowledge: totalKnowledge || 0,
        knowledgeWithAgents: knowledgeWithAgents || 0,
        standaloneKnowledge: (totalKnowledge || 0) - (knowledgeWithAgents || 0),
        recentKnowledge: recentKnowledge || 0,
        // avgContentLength removed: content is in Pinecone, not DB
      };
    } catch (error) {
      logger.error("Get knowledge stats service error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Force delete knowledge entry (Admin only)
   */
  async forceDeleteKnowledge(id: string): Promise<void> {
    try {
      // Get knowledge info before deletion (for logging)
      const { data: knowledge } = await supabaseAdmin
        .from("knowledge")
        .select("id, title, agent_id")
        .eq("id", id)
        .single();

      if (!knowledge) {
        throw new Error("Knowledge entry not found");
      }

      // Force delete (bypass ownership check)
      const { error } = await supabaseAdmin.from("knowledge").delete().eq("id", id);

      if (error) {
        throw new Error(`Failed to force delete knowledge: ${error.message}`);
      }

      // Delete from vector database
      try {
        const { deleteKnowledge: deleteKnowledgeVector } = await import("./vectorizer.service");
        await deleteKnowledgeVector(id);
      } catch (vectorError) {
        logger.warn("Force delete: Vector deletion failed", {
          knowledgeId: id,
          error: vectorError instanceof Error ? vectorError.message : "Unknown error",
        });
      }

      logger.warn("Knowledge force deleted", {
        knowledgeId: id,
        title: knowledge.title,
        agentId: knowledge.agent_id,
      });
    } catch (error) {
      logger.error("Force delete knowledge service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        knowledgeId: id,
      });
      throw error;
    }
  }

  /**
   * Process single file upload and convert to knowledge entries
   */
  async processFileUpload(params: {
    file: Express.Multer.File;
    agentId?: string;
    title?: string;
    chunkSize?: number;
    overlap?: number;
    userId: string;
    tenantId: string;
  }): Promise<{
    file: {
      originalName: string;
      size: number;
      type: string;
      url: string; // Public URL in Supabase Storage
    };
    extracted: {
      contentLength: number;
      wordCount: number;
      pageCount: number;
    };
    knowledge: {
      chunksCreated: number;
      entries: Array<{
        id: string;
        title: string;
        contentPreview: string;
        agentId: string | null;
        createdAt: string;
      }>;
    };
  }> {
    try {
      const { file, agentId, title, chunkSize = 1000, overlap = 100, userId, tenantId } = params;

      // Import file processing utilities
      const { extractTextFromFile, chunkText, validateFile } = await import(
        "../utils/fileProcessor"
      );
      const { v4: uuidv4 } = await import("uuid");

      // Validate file
      const validation = validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.error || "Invalid file");
      }

      logger.info("File upload started", {
        fileName: file.originalname,
        fileSize: file.size,
        userId,
        agentId,
      });

      // 1. Upload file to Supabase Storage first
      const { storageService } = await import("./storage.service");
      const fileUrl = await storageService.uploadKnowledgeFile(file, userId, tenantId);

      logger.info("File uploaded to storage", {
        fileName: file.originalname,
        fileUrl,
        userId,
      });

      // 2. Extract text from file
      const extractedText = await extractTextFromFile(file);

      // Use provided title or file name
      const knowledgeTitle = title || extractedText.metadata.fileName.replace(/\.[^/.]+$/, "");

      // Chunk text if it's large
      const chunks = chunkText(extractedText.content, chunkSize, overlap);

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
          tenant_id: tenantId,
          // Store file metadata in database
          file_url: fileUrl,
          file_type: file.mimetype,
          file_size: file.size,
          file_name: file.originalname,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        knowledgeEntries.push(knowledgeEntry);

        vectorEntries.push({
          id: chunkId,
          content: chunks[i],
          metadata: {
            userId,
            title: chunkTitle,
            agentId: agentId || null,
            tenantId,
            // Include file info in Pinecone metadata
            fileUrl,
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
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
        // Rollback: Delete uploaded file from storage
        try {
          await storageService.deleteKnowledgeFile(fileUrl, userId);
        } catch (deleteError) {
          logger.error("Failed to delete file after database error", {
            fileUrl,
            error: deleteError instanceof Error ? deleteError.message : "Unknown",
          });
        }

        logger.error("File upload database error", {
          error: error.message,
          fileName: file.originalname,
          userId,
        });
        throw new Error(error.message);
      }

      // Store in vector database
      try {
        const { batchStoreKnowledge } = await import("./vectorizer.service");
        await batchStoreKnowledge(vectorEntries);
      } catch (vectorError) {
        // Rollback: Remove from database
        const ids = knowledgeEntries.map((entry) => entry.id);
        await supabaseAdmin.from("knowledge").delete().in("id", ids);

        // Rollback: Delete uploaded file from storage
        try {
          await storageService.deleteKnowledgeFile(fileUrl, userId);
        } catch (deleteError) {
          logger.error("Failed to delete file after vector error", {
            fileUrl,
            error: deleteError instanceof Error ? deleteError.message : "Unknown",
          });
        }

        logger.error("File upload vector storage failed, rolled back database entries", {
          fileName: file.originalname,
          chunksCount: chunks.length,
          error: vectorError instanceof Error ? vectorError.message : "Unknown error",
          userId,
        });
        throw new Error("Failed to store file content in vector database");
      }

      logger.info("File upload completed successfully", {
        fileName: file.originalname,
        chunksCreated: chunks.length,
        totalContentLength: extractedText.content.length,
        userId,
        agentId,
      });

      return {
        file: {
          originalName: file.originalname,
          size: file.size,
          type: file.mimetype,
          url: fileUrl, // File URL in storage
        },
        extracted: {
          contentLength: extractedText.content.length,
          wordCount: extractedText.metadata.wordCount,
          pageCount: extractedText.metadata.pageCount || 0,
        },
        knowledge: {
          chunksCreated: chunks.length,
          entries:
            createdEntries?.map((entry) => ({
              id: entry.id,
              title: entry.title,
              contentPreview: entry.content.substring(0, 100) + "...",
              agentId: entry.agent_id,
              fileUrl: entry.file_url, // Include file URL
              createdAt: entry.created_at,
            })) || [],
        },
      };
    } catch (error) {
      logger.error("Process file upload service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        fileName: params.file?.originalname,
        userId: params.userId,
      });
      throw error;
    }
  }

  /**
   * Process multiple files upload and convert to knowledge entries
   */
  async processMultipleFilesUpload(params: {
    files: Express.Multer.File[];
    agentId?: string;
    chunkSize?: number;
    overlap?: number;
    userId: string;
    tenantId: string;
  }): Promise<{
    filesProcessed: number;
    totalChunksCreated: number;
    files: Array<{
      fileName: string;
      chunksCreated: number;
      contentLength: number;
      wordCount: number;
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
  }> {
    try {
      const { files, agentId, chunkSize = 1000, overlap = 100, userId, tenantId } = params;

      // Import file processing utilities
      const { extractTextFromFile, chunkText, validateFile } = await import(
        "../utils/fileProcessor"
      );
      const { v4: uuidv4 } = await import("uuid");

      if (files.length > 5) {
        throw new Error("Maximum 5 files allowed per batch");
      }

      logger.info("Batch file upload started", {
        fileCount: files.length,
        fileNames: files.map((f) => f.originalname),
        userId,
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
            userId,
          });
          continue;
        }

        try {
          // Extract text from file
          const extractedText = await extractTextFromFile(file);
          const knowledgeTitle = extractedText.metadata.fileName.replace(/\.[^/.]+$/, "");

          // Chunk text if it's large
          const chunks = chunkText(extractedText.content, chunkSize, overlap);

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
              tenant_id: tenantId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            allKnowledgeEntries.push(knowledgeEntry);

            allVectorEntries.push({
              id: chunkId,
              content: chunks[i],
              metadata: {
                userId,
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
            userId,
          });
          // Continue with other files
        }
      }

      if (allKnowledgeEntries.length === 0) {
        throw new Error("No files could be processed successfully");
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
          userId,
        });
        throw new Error(error.message);
      }

      // Store in vector database
      try {
        const { batchStoreKnowledge } = await import("./vectorizer.service");
        await batchStoreKnowledge(allVectorEntries);
      } catch (vectorError) {
        // If vector storage fails, remove from database
        const ids = allKnowledgeEntries.map((entry) => entry.id);
        await supabaseAdmin.from("knowledge").delete().in("id", ids);

        logger.error("Batch file upload vector storage failed, rolled back database entries", {
          fileCount: files.length,
          chunksCount: allKnowledgeEntries.length,
          error: vectorError instanceof Error ? vectorError.message : "Unknown error",
          userId,
        });
        throw new Error("Failed to store file contents in vector database");
      }

      logger.info("Batch file upload completed successfully", {
        fileCount: files.length,
        totalChunksCreated: allKnowledgeEntries.length,
        processedFiles: processedFiles.length,
        userId,
        agentId,
      });

      return {
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
      };
    } catch (error) {
      logger.error("Process multiple files upload service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        fileCount: params.files?.length,
        userId: params.userId,
      });
      throw error;
    }
  }
}

// Create and export service instance
export const knowledgeService = new KnowledgeService();
export default knowledgeService;
