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
import { handleAsyncOperationStrict } from "../utils/errorHandler";
import { knowledgeService } from "../services/knowledge.service";
import { streamingKnowledgeService } from "../services/streamingKnowledge.service";
import { AdminKnowledgeEntry } from "../types/knowledge";
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
   * @access User + Tenant Context
   */
  async createKnowledge(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        const { title, metadata, agentId } = req.body; // agentId is optional
        const knowledgeId = uuidv4();

        // Prepare data for service
        const knowledgeData = {
          id: knowledgeId,
          title,
          metadata: {
            ...metadata,
            userId: req.user.id,
          },
          agent_id: agentId || null, // Optional - can be null for standalone knowledge
          tenant_id: req.tenant.id,
          user_id: req.user.id, // Required - knowledge belongs to user
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Use service to create knowledge (includes vector storage)
        const knowledge = await knowledgeService.createKnowledge(knowledgeData);

        return successResponse(
          res,
          {
            id: knowledge.id,
            title: knowledge.title,
            metadata: knowledge.metadata,
            agentId: knowledge.agent_id,
            createdAt: knowledge.created_at,
            updatedAt: knowledge.updated_at,
            fileUrl: knowledge.file_url,
            fileType: knowledge.file_type,
            fileSize: knowledge.file_size,
            fileName: knowledge.file_name,
          },
          "Knowledge entry created successfully",
          201
        );
      },
      "create knowledge",
      {
        context: {
          userId: req.user?.id,
          title: req.body?.title,
          agentId: req.body?.agentId,
          contentLength: req.body?.content?.length,
        },
      }
    );
  }

  /**
   * Get user's knowledge entries with pagination
   * GET /api/knowledge
   * @access User + Tenant Context
   */
  async getUserKnowledge(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        const page = parseInt(req.query.page as string) || 1;
        const perPage = Math.min(parseInt(req.query.perPage as string) || 10, 50);
        const agentId = req.query.agentId as string;

        // Use service to get user knowledge
        const result = await knowledgeService.getUserKnowledge(req.user.id, req.tenant.id, {
          page,
          limit: perPage,
          agentId,
        });

        return successResponse(
          res,
          {
            knowledge: result.knowledge.map((entry) => ({
              id: entry.id,
              title: entry.title,
              // content removed: Text is stored in Pinecone only
              metadata: entry.metadata,
              agentId: entry.agent_id,
              createdAt: entry.created_at,
              updatedAt: entry.updated_at,
              // File metadata
              fileUrl: entry.file_url,
              fileType: entry.file_type,
              fileSize: entry.file_size,
              fileName: entry.file_name,
            })),
            pagination: result.pagination,
          },
          "Knowledge entries retrieved successfully"
        );
      },
      "get user knowledge",
      {
        context: {
          userId: req.user?.id,
          page: req.query.page,
          perPage: req.query.perPage,
          agentId: req.query.agentId,
        },
      }
    );
  }

  /**
   * Get knowledge entry by ID
   * GET /api/knowledge/:id
   * @access User + Tenant Context
   */
  async getKnowledgeById(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        const { id } = req.params;

        // Use service to get knowledge by ID
        const knowledge = await knowledgeService.getKnowledgeById(id, req.user.id, req.tenant.id);

        if (!knowledge) {
          return errorResponse(res, "Knowledge entry not found", 404);
        }

        return successResponse(
          res,
          {
            id: knowledge.id,
            title: knowledge.title,
            metadata: knowledge.metadata,
            agentId: knowledge.agent_id,
            createdAt: knowledge.created_at,
            updatedAt: knowledge.updated_at,
            fileUrl: knowledge.file_url,
            fileType: knowledge.file_type,
            fileSize: knowledge.file_size,
            fileName: knowledge.file_name,
          },
          "Knowledge entry retrieved successfully"
        );
      },
      "get knowledge by ID",
      {
        context: {
          userId: req.user?.id,
          knowledgeId: req.params.id,
        },
      }
    );
  }

  /**
   * Delete knowledge entry
   * DELETE /api/knowledge/:id
   * @access User + Tenant Context
   */
  async deleteKnowledge(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        const { id } = req.params;

        // Use service to delete knowledge
        await knowledgeService.deleteKnowledge(id, req.user.id, req.tenant.id);

        return successResponse(res, null, "Knowledge entry deleted successfully");
      },
      "delete knowledge",
      {
        context: {
          userId: req.user?.id,
          knowledgeId: req.params.id,
        },
      }
    );
  }

  /**
   * Update knowledge entry
   * PUT /api/knowledge/:id
   * @access User + Tenant Context
   */
  async updateKnowledge(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        const { id } = req.params;
        const { title, metadata } = req.body;

        // Use service to update knowledge
        const knowledge = await knowledgeService.updateKnowledge(
          id,
          { title, metadata },
          req.user.id,
          req.tenant.id
        );

        return successResponse(
          res,
          {
            id: knowledge.id,
            title: knowledge.title,
            // content removed: Text is stored in Pinecone only
            metadata: knowledge.metadata,
            agentId: knowledge.agent_id,
            createdAt: knowledge.created_at,
            updatedAt: knowledge.updated_at,
            // File metadata
            fileUrl: knowledge.file_url,
            fileType: knowledge.file_type,
            fileSize: knowledge.file_size,
            fileName: knowledge.file_name,
          },
          "Knowledge entry updated successfully"
        );
      },
      "update knowledge",
      {
        context: {
          userId: req.user?.id,
          knowledgeId: req.params.id,
          updateFields: Object.keys(req.body || {}),
        },
      }
    );
  }

  /**
   * Search knowledge base by metadata (title, filename)
   * GET /api/knowledge/search
   * @access User + Tenant Context
   */
  async searchKnowledgeBase(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        // Get params from query string
        const query = req.query.query as string;
        const limit = parseInt((req.query.limit as string) || "20");
        const agentId = req.query.agentId as string | undefined;

        // Search knowledge metadata in Supabase
        const results = await knowledgeService.searchKnowledge(
          query,
          req.user.id,
          req.tenant.id,
          limit,
          agentId
        );

        return successResponse(
          res,
          {
            query,
            results,
            totalFound: results.length,
            searchType: "metadata", // Clarify this is metadata search, not semantic
          },
          "Knowledge search completed successfully"
        );
      },
      "search knowledge base",
      {
        context: {
          userId: req.user?.id,
          queryLength: (req.query?.query as string)?.length,
          limit: req.query?.limit,
          agentId: req.query?.agentId,
        },
      }
    );
  }

  /**
   * Upload file(s) and convert to knowledge using streaming
   * POST /api/knowledge/upload
   * @access User + Tenant Context
   * @description Handles large file uploads with streaming and progress tracking
   */
  async uploadFiles(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        // Check if streaming upload session exists
        if (!req.uploadSession) {
          return errorResponse(res, "No upload session found", 400);
        }

        const session = req.uploadSession;

        // Check if upload completed successfully
        if (!session.completed) {
          return errorResponse(res, "Upload not completed", 400);
        }

        if (session.error) {
          return errorResponse(res, `Upload error: ${session.error}`, 400);
        }

        // Get uploaded files
        const uploadedFiles = Array.from(session.files.values());

        if (uploadedFiles.length === 0) {
          return errorResponse(res, "No files provided", 400);
        }

        // Limit maximum files
        const MAX_FILES = 20;
        if (uploadedFiles.length > MAX_FILES) {
          return errorResponse(res, `Maximum ${MAX_FILES} files allowed per upload`, 400);
        }

        const { agentId, title, chunkSize = 5000, overlap = 200 } = req.body;

        // Process files using streaming service
        const result = await streamingKnowledgeService.processStreamingUpload({
          files: uploadedFiles,
          userId: req.user.id,
          tenantId: req.tenant.id,
          agentId: agentId || null,
          title,
          chunkSize: parseInt(chunkSize.toString()) || 5000,
          overlap: parseInt(overlap.toString()) || 200,
        });

        if (!result.success) {
          return errorResponse(res, "File processing failed", 500, result.errors);
        }

        return successResponse(
          res,
          {
            sessionId: result.sessionId,
            filesProcessed: result.filesProcessed,
            totalChunks: result.totalChunks,
            totalKnowledgeEntries: result.totalKnowledgeEntries,
            files: result.files,
            knowledge: result.knowledge,
            errors: result.errors,
          },
          "Files uploaded and processed successfully",
          201
        );
      },
      "upload files",
      {
        context: {
          userId: req.user?.id,
          fileCount: req.uploadSession?.files.size || 0,
          agentId: req.body?.agentId,
          chunkSize: req.body?.chunkSize,
        },
      }
    );
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
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const page = parseInt(req.query.page as string) || 1;
        const perPage = Math.min(parseInt(req.query.perPage as string) || 10, 100);

        // Use service to get all knowledge
        const result = await knowledgeService.getAllKnowledge({
          page,
          limit: perPage,
        });

        return successResponse(
          res,
          {
            knowledge: result.knowledge.map((entry: AdminKnowledgeEntry) => ({
              id: entry.id,
              title: entry.title,
              // content removed: Text is stored in Pinecone only
              metadata: entry.metadata,
              agent: entry.agent,
              createdAt: entry.created_at,
              updatedAt: entry.updated_at,
              // Include file metadata if available
              fileUrl: entry.file_url,
              fileType: entry.file_type,
              fileSize: entry.file_size,
              fileName: entry.file_name,
            })),
            pagination: result.pagination,
          },
          "All knowledge entries retrieved successfully"
        );
      },
      "get all knowledge (admin)",
      {
        context: {
          adminId: req.user?.id,
          page: req.query.page,
          perPage: req.query.perPage,
        },
      }
    );
  }

  /**
   * Get system-wide knowledge statistics (Admin only)
   * GET /api/knowledge/admin/stats
   * @access Admin
   */
  async getKnowledgeStats(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Use service to get knowledge stats
        const stats = await knowledgeService.getKnowledgeStats();

        return successResponse(res, stats, "Knowledge statistics retrieved successfully");
      },
      "get knowledge stats (admin)",
      {
        context: {
          adminId: req.user?.id,
        },
      }
    );
  }

  /**
   * Force delete any knowledge entry (Admin only)
   * DELETE /api/knowledge/admin/:id
   * @access Admin
   */
  async forceDeleteKnowledge(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { id } = req.params;

        // Use service to force delete knowledge
        await knowledgeService.forceDeleteKnowledge(id);

        return successResponse(res, null, "Knowledge entry deleted successfully");
      },
      "force delete knowledge (admin)",
      {
        context: {
          adminId: req.user?.id,
          knowledgeId: req.params.id,
        },
      }
    );
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
  searchKnowledgeBase,
  uploadFiles,
  getAllKnowledge,
  getKnowledgeStats,
  forceDeleteKnowledge,
} = knowledgeController;

export default knowledgeController;
