/**
 * @file knowledge.router.ts
 * @description Knowledge base routes with user and admin access
 * Handles knowledge entry management with proper authentication and validation
 */

import { Router } from "express";
import * as knowledgeController from "../controllers/knowledge.controller";
import {
  createKnowledgeEndpointValidator,
  updateKnowledgeEndpointValidator,
  getKnowledgeByIdValidator,
  deleteKnowledgeValidator,
  searchKnowledgeEndpointValidator,
  uploadFileEndpointValidator,
  knowledgeListValidator,
  paginationValidator,
  knowledgeIdValidator,
} from "../validators/knowledge.validator";
import { authMiddleware } from "../middlewares/auth.middleware";
import { adminMiddleware } from "../middlewares/auth.middleware";
import { strictRateLimiter, rateLimiterMiddleware } from "../middlewares/rateLimiter.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import {
  streamingUploadMiddleware,
  getUploadProgress,
} from "../middlewares/streamingUpload.middleware";

const router = Router();

// ===========================
// User Routes (Knowledge Owners)
// ===========================

/**
 * POST /api/knowledge
 * Create a new knowledge entry
 * @access User + Tenant Context
 */
router.post(
  "/",
  authMiddleware,
  tenantMiddleware,
  strictRateLimiter,
  createKnowledgeEndpointValidator,
  knowledgeController.createKnowledge
);

/**
 * GET /api/knowledge
 * Get user's knowledge entries with pagination
 * @access User + Tenant Context
 */
router.get(
  "/",
  authMiddleware,
  tenantMiddleware,
  knowledgeListValidator,
  knowledgeController.getUserKnowledge
);

/**
 * GET /api/knowledge/search
 * Search knowledge base by METADATA (title, filename)
 *
 * Query params:
 * - query: Search term (required, 1-500 chars)
 * - limit: Max results (optional, default 20, max 100)
 * - agentId: Filter by agent (optional, UUID)
 *
 * Searches: title (document name), file_name (original filename)
 * This is for DOCUMENT MANAGEMENT, NOT content search.
 *
 * For SEMANTIC/CONTENT SEARCH (AI-powered RAG), use Agent Chat instead:
 *   POST /api/agents/:agentId/chat
 *
 * Agent Chat automatically searches knowledge CONTENT via Pinecone vector database
 * and generates contextual AI responses using RAG (Retrieval Augmented Generation).
 *
 * @access User + Tenant Context
 */
router.get(
  "/search",
  authMiddleware,
  tenantMiddleware,
  rateLimiterMiddleware,
  searchKnowledgeEndpointValidator,
  knowledgeController.searchKnowledgeBase
);

/**
 * GET /api/knowledge/:id
 * Get knowledge entry by ID
 * @access User + Tenant Context
 */
router.get(
  "/:id",
  authMiddleware,
  tenantMiddleware,
  getKnowledgeByIdValidator,
  knowledgeController.getKnowledgeById
);

/**
 * PUT /api/knowledge/:id
 * Update knowledge entry
 * @access User + Tenant Context
 */
router.put(
  "/:id",
  authMiddleware,
  tenantMiddleware,
  strictRateLimiter,
  updateKnowledgeEndpointValidator,
  knowledgeController.updateKnowledge
);

/**
 * DELETE /api/knowledge/:id
 * Delete knowledge entry
 * @access User + Tenant Context
 */
router.delete(
  "/:id",
  authMiddleware,
  tenantMiddleware,
  strictRateLimiter,
  deleteKnowledgeValidator,
  knowledgeController.deleteKnowledge
);

/**
 * POST /api/knowledge/upload
 * Upload file(s) and convert to knowledge using streaming
 * @access User + Tenant Context
 * @description Handles large file uploads with streaming and progress tracking
 */
router.post(
  "/upload",
  authMiddleware,
  tenantMiddleware,
  strictRateLimiter,
  streamingUploadMiddleware,
  uploadFileEndpointValidator,
  knowledgeController.uploadFiles
);

/**
 * GET /api/knowledge/upload/progress/:sessionId
 * Get upload progress for a session
 * @access User + Tenant Context
 */
router.get("/upload/progress/:sessionId", authMiddleware, tenantMiddleware, (req, res) => {
  const { sessionId } = req.params;
  const progress = getUploadProgress(sessionId);

  if (!progress) {
    return res.status(404).json({
      success: false,
      message: "Upload session not found",
      error: "SESSION_NOT_FOUND",
    });
  }

  return res.json({
    success: true,
    sessionId,
    progress,
  });
});

// ===========================
// Admin Routes (System Administration)
// ===========================

/**
 * GET /api/knowledge/admin/all
 * Get all knowledge entries in system with pagination
 * @access Admin
 */
router.get(
  "/admin/all",
  authMiddleware,
  adminMiddleware,
  paginationValidator,
  knowledgeController.getAllKnowledge
);

/**
 * GET /api/knowledge/admin/stats
 * Get system-wide knowledge statistics
 * @access Admin
 */
router.get("/admin/stats", authMiddleware, adminMiddleware, knowledgeController.getKnowledgeStats);

/**
 * DELETE /api/knowledge/admin/:id
 * Force delete any knowledge entry (bypass ownership check)
 * @access Admin
 */
router.delete(
  "/admin/:id",
  authMiddleware,
  adminMiddleware,
  strictRateLimiter,
  knowledgeIdValidator,
  knowledgeController.forceDeleteKnowledge
);

export default router;
