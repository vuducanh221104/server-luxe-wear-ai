/**
 * @file agent.router.ts
 * @description AI agent routes with Supabase integration
 */

import { Router } from "express";
import { param } from "express-validator";
import * as agentController from "../controllers/agent.controller";
import {
  createAgentValidator,
  updateAgentValidator,
  agentIdValidator,
  paginationValidator,
  searchValidator,
  chatValidator,
  togglePublicValidator,
} from "../validators/agent.validator";
import { authMiddleware } from "../middlewares/auth.middleware";
import { adminMiddleware } from "../middlewares/admin.middleware";
import { strictRateLimiter } from "../middlewares/rateLimiter.middleware";

const router = Router();

// ===========================
// User Routes (Agent Owners)
// ===========================

/**
 * POST /api/agents
 * Create a new agent
 * @access User (Agent Owner)
 */
router.post(
  "/",
  authMiddleware,
  strictRateLimiter,
  createAgentValidator,
  agentController.createAgent
);

/**
 * GET /api/agents
 * List user's agents with pagination
 * @access User (Agent Owner)
 */
router.get("/", authMiddleware, paginationValidator, agentController.listAgents);

/**
 * GET /api/agents/search
 * Search agents by name or description
 * @access User (Agent Owner)
 */
router.get("/search", authMiddleware, searchValidator, agentController.searchAgents);

/**
 * GET /api/agents/:agentId
 * Get agent by ID
 * @access User (Agent Owner)
 */
router.get("/:agentId", authMiddleware, agentIdValidator, agentController.getAgent);

/**
 * PUT /api/agents/:agentId
 * Update agent
 * @access User (Agent Owner)
 */
router.put(
  "/:agentId",
  authMiddleware,
  strictRateLimiter,
  [...agentIdValidator, ...updateAgentValidator],
  agentController.updateAgent
);

/**
 * DELETE /api/agents/:agentId
 * Delete agent
 * @access User (Agent Owner)
 */
router.delete(
  "/:agentId",
  authMiddleware,
  strictRateLimiter,
  agentIdValidator,
  agentController.deleteAgent
);

/**
 * GET /api/agents/:agentId/stats
 * Get agent statistics
 * @access User (Agent Owner)
 */
router.get("/:agentId/stats", authMiddleware, agentIdValidator, agentController.getAgentStats);

/**
 * POST /api/agents/:agentId/chat
 * Chat with agent
 * @access User (Agent Owner)
 */
router.post(
  "/:agentId/chat",
  authMiddleware,
  strictRateLimiter,
  [...agentIdValidator, ...chatValidator],
  agentController.chatWithAgent
);

/**
 * POST /api/agents/:agentId/regenerate-key
 * Regenerate agent API key
 * @access User (Agent Owner)
 */
router.post(
  "/:agentId/regenerate-key",
  authMiddleware,
  strictRateLimiter,
  agentIdValidator,
  agentController.regenerateAgentApiKey
);

/**
 * PATCH /api/agents/:agentId/public
 * Toggle agent public status
 * @access User (Agent Owner)
 */
router.patch(
  "/:agentId/public",
  authMiddleware,
  strictRateLimiter,
  [...agentIdValidator, ...togglePublicValidator],
  agentController.toggleAgentPublic
);

// ===========================
// Admin Routes (System Administration)
// ===========================

/**
 * GET /api/agents/admin/all
 * List all agents in system with pagination
 * @access Admin
 */
router.get(
  "/admin/all",
  authMiddleware,
  adminMiddleware,
  paginationValidator,
  agentController.listAllAgents
);

/**
 * GET /api/agents/admin/stats
 * Get system-wide agent statistics
 * @access Admin
 */
router.get("/admin/stats", authMiddleware, adminMiddleware, agentController.getSystemAgentStats);

/**
 * DELETE /api/agents/admin/:agentId
 * Force delete any agent (bypass ownership check)
 * @access Admin
 */
router.delete(
  "/admin/:agentId",
  authMiddleware,
  adminMiddleware,
  strictRateLimiter,
  agentIdValidator,
  agentController.forceDeleteAgent
);

/**
 * GET /api/agents/admin/users/:userId/agents
 * Get specific user's agents
 * @access Admin
 */
router.get(
  "/admin/users/:userId/agents",
  authMiddleware,
  adminMiddleware,
  [...paginationValidator, param("userId").isUUID().withMessage("User ID must be a valid UUID")],
  agentController.getUserAgents
);

export default router;
