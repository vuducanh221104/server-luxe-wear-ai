/**
 * @file agent.router.ts
 * @description AI agent routes with Supabase integration
 */

import { Router } from "express";
import * as agentController from "../controllers/agent.controller";
import {
  createAgentValidator,
  updateAgentValidator,
  agentIdValidator,
  paginationValidator,
  searchValidator,
  chatValidator,
  togglePublicValidator,
  getUserAgentsValidator,
} from "../validators/agent.validator";
import { authMiddleware } from "../middlewares/auth.middleware";
import { adminMiddleware } from "../middlewares/auth.middleware";
import { strictRateLimiter } from "../middlewares/rateLimiter.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";

const router = Router();

// ===========================
// Admin Routes (System Administration)
// Note: MUST come BEFORE dynamic routes (/:agentId) to prevent route conflicts
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
 * GET /api/agents/admin/users/:userId/agents
 * Get specific user's agents
 * @access Admin
 */
router.get(
  "/admin/users/:userId/agents",
  authMiddleware,
  adminMiddleware,
  getUserAgentsValidator,
  agentController.getUserAgents
);

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

// ===========================
// User Routes (Agent Owners)
// ===========================

/**
 * POST /api/agents
 * Create a new agent
 * @access User (Agent Owner) + Tenant Context
 */
router.post(
  "/",
  authMiddleware,
  tenantMiddleware,
  strictRateLimiter,
  createAgentValidator,
  agentController.createAgent
);

/**
 * GET /api/agents
 * List user's agents with pagination
 * @access User (Agent Owner) + Tenant Context
 */
router.get("/", authMiddleware, tenantMiddleware, paginationValidator, agentController.listAgents);

/**
 * GET /api/agents/search
 * Search agents by name or description
 * @access User (Agent Owner) + Tenant Context
 */
router.get(
  "/search",
  authMiddleware,
  tenantMiddleware,
  searchValidator,
  agentController.searchAgents
);

/**
 * GET /api/agents/:agentId
 * Get agent by ID
 * @access User (Agent Owner) + Tenant Context
 */
router.get(
  "/:agentId",
  authMiddleware,
  tenantMiddleware,
  agentIdValidator,
  agentController.getAgent
);

/**
 * PUT /api/agents/:agentId
 * Update agent
 * @access User (Agent Owner) + Tenant Context
 */
router.put(
  "/:agentId",
  authMiddleware,
  tenantMiddleware,
  strictRateLimiter,
  [...agentIdValidator, ...updateAgentValidator],
  agentController.updateAgent
);

/**
 * DELETE /api/agents/:agentId
 * Delete agent
 * @access User (Agent Owner) + Tenant Context
 */
router.delete(
  "/:agentId",
  authMiddleware,
  tenantMiddleware,
  strictRateLimiter,
  agentIdValidator,
  agentController.deleteAgent
);

/**
 * GET /api/agents/:agentId/stats
 * Get agent statistics
 * @access User (Agent Owner) + Tenant Context
 */
router.get(
  "/:agentId/stats",
  authMiddleware,
  tenantMiddleware,
  agentIdValidator,
  agentController.getAgentStats
);

/**
 * POST /api/agents/:agentId/chat
 * Chat with agent
 * @access User (Agent Owner) + Tenant Context
 */
router.post(
  "/:agentId/chat",
  authMiddleware,
  tenantMiddleware,
  strictRateLimiter,
  [...agentIdValidator, ...chatValidator],
  agentController.chatWithAgent
);

/**
 * POST /api/agents/:agentId/regenerate-key
 * Regenerate agent API key
 * @access User (Agent Owner) + Tenant Context
 */
router.post(
  "/:agentId/regenerate-key",
  authMiddleware,
  tenantMiddleware,
  strictRateLimiter,
  agentIdValidator,
  agentController.regenerateAgentApiKey
);

/**
 * PATCH /api/agents/:agentId/public
 * Toggle agent public status
 * @access User (Agent Owner) + Tenant Context
 */
router.patch(
  "/:agentId/public",
  authMiddleware,
  tenantMiddleware,
  strictRateLimiter,
  [...agentIdValidator, ...togglePublicValidator],
  agentController.toggleAgentPublic
);

export default router;
