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

        const { title, content, metadata, agentId } = req.body;
        const knowledgeId = uuidv4();

        // Prepare data for service
        const knowledgeData = {
          id: knowledgeId,
          title,
          content,
          metadata: {
            ...metadata,
            userId: req.user.id,
          },
          agent_id: agentId || null,
          tenant_id: req.tenant.id,
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
            content: knowledge.content,
            metadata: knowledge.metadata,
            agentId: knowledge.agent_id,
            createdAt: knowledge.created_at,
            updatedAt: knowledge.updated_at,
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
        const result = await knowledgeService.getUserKnowledge(req.tenant.id, {
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
              content: entry.content,
              metadata: entry.metadata,
              agentId: entry.agent_id,
              createdAt: entry.created_at,
              updatedAt: entry.updated_at,
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
        const knowledge = await knowledgeService.getKnowledgeById(id, req.tenant.id);

        if (!knowledge) {
          return errorResponse(res, "Knowledge entry not found", 404);
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
        await knowledgeService.deleteKnowledge(id, req.tenant.id);

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
        const { title, content, metadata } = req.body;

        // Use service to update knowledge
        const knowledge = await knowledgeService.updateKnowledge(
          id,
          { title, content, metadata },
          req.tenant.id
        );

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
   * Search knowledge base using vector similarity
   * POST /api/knowledge/search
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

        const { query, topK = 5, agentId } = req.body;

        // Use service to search knowledge
        const results = await knowledgeService.searchKnowledge(
          query,
          req.user.id,
          req.tenant.id,
          topK
        );

        // Filter by agent if specified
        const filteredResults = agentId
          ? results.filter((result) => result.agentId === agentId)
          : results;

        return successResponse(
          res,
          {
            query,
            results: filteredResults,
            totalFound: filteredResults.length,
          },
          "Knowledge search completed successfully"
        );
      },
      "search knowledge base",
      {
        context: {
          userId: req.user?.id,
          queryLength: req.body?.query?.length,
          topK: req.body?.topK,
          agentId: req.body?.agentId,
        },
      }
    );
  }

  /**
   * Upload single file and convert to knowledge
   * POST /api/knowledge/upload
   * @access User
   */
  async uploadFile(req: Request, res: Response): Promise<Response> {
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

        if (!req.file) {
          return errorResponse(res, "No file provided", 400);
        }

        const { agentId, title, chunkSize = 1000, overlap = 100 } = req.body;

        // Use service to process file upload
        const result = await knowledgeService.processFileUpload({
          file: req.file,
          agentId,
          title,
          chunkSize: parseInt(chunkSize),
          overlap: parseInt(overlap),
          userId: req.user.id,
          tenantId: req.tenant.id,
        });

        return successResponse(res, result, "File uploaded and processed successfully", 201);
      },
      "upload file",
      {
        context: {
          userId: req.user?.id,
          fileName: req.file?.originalname,
          fileSize: req.file?.size,
          agentId: req.body?.agentId,
          chunkSize: req.body?.chunkSize,
        },
      }
    );
  }

  /**
   * Upload multiple files and convert to knowledge
   * POST /api/knowledge/upload/batch
   * @access User
   */
  async uploadMultipleFiles(req: Request, res: Response): Promise<Response> {
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

        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
          return errorResponse(res, "No files provided", 400);
        }

        const files = req.files as Express.Multer.File[];
        const { agentId, chunkSize = 1000, overlap = 100 } = req.body;

        if (files.length > 5) {
          return errorResponse(res, "Maximum 5 files allowed per batch", 400);
        }

        // Use service to process multiple files upload
        const result = await knowledgeService.processMultipleFilesUpload({
          files,
          agentId,
          chunkSize: parseInt(chunkSize),
          overlap: parseInt(overlap),
          userId: req.user.id,
          tenantId: req.tenant.id,
        });

        return successResponse(res, result, "Files uploaded and processed successfully", 201);
      },
      "upload multiple files",
      {
        context: {
          userId: req.user?.id,
          fileCount: (req.files as Express.Multer.File[])?.length,
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
              content: entry.content.substring(0, 200) + (entry.content.length > 200 ? "..." : ""),
              metadata: entry.metadata,
              agent: entry.agent,
              createdAt: entry.created_at,
              updatedAt: entry.updated_at,
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
  uploadFile,
  uploadMultipleFiles,
  getAllKnowledge,
  getKnowledgeStats,
  forceDeleteKnowledge,
} = knowledgeController;

export default knowledgeController;
