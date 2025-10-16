/**
 * @file public.router.ts
 * @description Public routes for external agent access
 * API key based authentication for external websites
 */

import { Router } from "express";
import * as publicController from "../controllers/public.controller";
import { apiKeyMiddleware } from "../middlewares/apiKey.middleware";
import { rateLimiterMiddleware } from "../middlewares/rateLimiter.middleware";
import {
  publicAgentChatValidator,
  publicAgentDetailsValidator,
} from "../validators/public.validator";

const router = Router();

/**
 * GET /api/public/health
 * Health check endpoint
 * @access Public (no auth required)
 */
router.get("/health", publicController.publicHealthCheck);

/**
 * POST /api/public/agents/:agentId/chat
 * Chat with public agent using API key
 * @access Public (API key required)
 */
router.post(
  "/agents/:agentId/chat",
  rateLimiterMiddleware, // Rate limiting for external requests
  apiKeyMiddleware, // Validate API key and attach agent
  publicAgentChatValidator,
  publicController.chatWithPublicAgent
);

/**
 * GET /api/public/agents/:agentId
 * Get public agent information
 * @access Public (API key required)
 */
router.get(
  "/agents/:agentId",
  apiKeyMiddleware, // Validate API key and attach agent
  publicAgentDetailsValidator,
  publicController.getPublicAgentInfo
);

export default router;
