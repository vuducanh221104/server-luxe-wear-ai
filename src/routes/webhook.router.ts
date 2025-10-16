/**
 * @file webhook.router.ts
 * @description Routes for webhook management endpoints
 */

import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { validationMiddleware } from "../middlewares/validation.middleware";
import {
  createWebhookValidator,
  updateWebhookValidator,
  webhookIdValidator,
  agentIdValidator,
  processWebhookValidator,
  listWebhooksValidator,
  testWebhookValidator,
} from "../validators/webhook.validator";
import {
  createWebhook,
  getWebhook,
  getAgentWebhooks,
  updateWebhook,
  deleteWebhook,
  processWebhook,
  getWebhookStats,
  searchWebhooks,
  testWebhook,
} from "../controllers/webhook.controller";

const router = Router();

/**
 * @route POST /api/webhooks
 * @description Create a new webhook
 * @access Private
 */
router.post("/", authMiddleware, createWebhookValidator, validationMiddleware, createWebhook);

/**
 * @route GET /api/webhooks/search
 * @description Search webhooks
 * @access Private
 */
router.get("/search", authMiddleware, listWebhooksValidator, validationMiddleware, searchWebhooks);

/**
 * @route GET /api/webhooks/:id
 * @description Get webhook by ID
 * @access Private
 */
router.get("/:id", authMiddleware, webhookIdValidator, validationMiddleware, getWebhook);

/**
 * @route PUT /api/webhooks/:id
 * @description Update webhook
 * @access Private
 */
router.put("/:id", authMiddleware, updateWebhookValidator, validationMiddleware, updateWebhook);

/**
 * @route DELETE /api/webhooks/:id
 * @description Delete webhook
 * @access Private
 */
router.delete("/:id", authMiddleware, webhookIdValidator, validationMiddleware, deleteWebhook);

/**
 * @route POST /api/webhooks/:id/test
 * @description Test webhook
 * @access Private
 */
router.post("/:id/test", authMiddleware, testWebhookValidator, validationMiddleware, testWebhook);

/**
 * @route GET /api/webhooks/agent/:agentId
 * @description Get webhooks for an agent
 * @access Private
 */
router.get(
  "/agent/:agentId",
  authMiddleware,
  agentIdValidator,
  listWebhooksValidator,
  validationMiddleware,
  getAgentWebhooks
);

/**
 * @route GET /api/webhooks/agent/:agentId/stats
 * @description Get webhook statistics for an agent
 * @access Private
 */
router.get(
  "/agent/:agentId/stats",
  authMiddleware,
  agentIdValidator,
  validationMiddleware,
  getWebhookStats
);

/**
 * @route POST /api/webhooks/process/:provider
 * @description Process incoming webhook from external provider
 * @access Public (no auth required for incoming webhooks)
 */
router.post("/process/:provider", processWebhookValidator, validationMiddleware, processWebhook);

export default router;
