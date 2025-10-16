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
  batchUploadEndpointValidator,
  uploadFileEndpointValidator,
  uploadMultipleFilesEndpointValidator,
  knowledgeListValidator,
  paginationValidator,
  knowledgeIdValidator,
} from "../validators/knowledge.validator";
import { authMiddleware } from "../middlewares/auth.middleware";
import { adminMiddleware } from "../middlewares/admin.middleware";
import { strictRateLimiter, rateLimiterMiddleware } from "../middlewares/rateLimiter.middleware";
import {
  uploadSingleFile,
  uploadMultipleFiles,
  handleUploadError,
  validateFileExists,
  logFileUpload,
} from "../middlewares/upload.middleware";

const router = Router();

// ===========================
// User Routes (Knowledge Owners)
// ===========================

/**
 * POST /api/knowledge
 * Create a new knowledge entry
 * @access User
 */
router.post(
  "/",
  authMiddleware,
  strictRateLimiter,
  createKnowledgeEndpointValidator,
  knowledgeController.createKnowledge
);

/**
 * GET /api/knowledge
 * Get user's knowledge entries with pagination
 * @access User
 */
router.get("/", authMiddleware, knowledgeListValidator, knowledgeController.getUserKnowledge);

/**
 * GET /api/knowledge/:id
 * Get knowledge entry by ID
 * @access User
 */
router.get("/:id", authMiddleware, getKnowledgeByIdValidator, knowledgeController.getKnowledgeById);

/**
 * PUT /api/knowledge/:id
 * Update knowledge entry
 * @access User
 */
router.put(
  "/:id",
  authMiddleware,
  strictRateLimiter,
  updateKnowledgeEndpointValidator,
  knowledgeController.updateKnowledge
);

/**
 * DELETE /api/knowledge/:id
 * Delete knowledge entry
 * @access User
 */
router.delete(
  "/:id",
  authMiddleware,
  strictRateLimiter,
  deleteKnowledgeValidator,
  knowledgeController.deleteKnowledge
);

/**
 * POST /api/knowledge/search
 * Search knowledge base using vector similarity
 * @access User
 */
router.post(
  "/search",
  authMiddleware,
  rateLimiterMiddleware,
  searchKnowledgeEndpointValidator,
  knowledgeController.searchKnowledgeBase
);

/**
 * POST /api/knowledge/batch
 * Batch upload knowledge entries
 * @access User
 */
router.post(
  "/batch",
  authMiddleware,
  strictRateLimiter,
  batchUploadEndpointValidator,
  knowledgeController.batchUploadKnowledge
);

/**
 * POST /api/knowledge/upload
 * Upload single file and convert to knowledge
 * @access User
 */
router.post(
  "/upload",
  authMiddleware,
  strictRateLimiter,
  uploadSingleFile,
  handleUploadError,
  validateFileExists,
  logFileUpload,
  uploadFileEndpointValidator,
  knowledgeController.uploadFile
);

/**
 * POST /api/knowledge/upload/batch
 * Upload multiple files and convert to knowledge
 * @access User
 */
router.post(
  "/upload/batch",
  authMiddleware,
  strictRateLimiter,
  uploadMultipleFiles,
  handleUploadError,
  validateFileExists,
  logFileUpload,
  uploadMultipleFilesEndpointValidator,
  knowledgeController.uploadMultipleFiles
);

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
