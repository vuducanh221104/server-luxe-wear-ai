/**
 * @file webhook.controller.ts
 * @description Controller for webhook management endpoints
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { webhookService } from "../services/webhook.service";
import { webhookApi } from "../integrations/webhook.api";
import { successResponse, errorResponse } from "../utils/response";
import logger from "../config/logger";
import type { WebhookProvider, WebhookUpdate } from "../types/webhook";

/**
 * Webhook Controller Class
 * Object-based controller for webhook operations
 */
export class WebhookController {
  /**
   * Create a new webhook
   */
  async createWebhook(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      const userId = req.user?.id;
      if (!userId) {
        return errorResponse(res, "User not authenticated", 401);
      }

      const { agent_id, event_type, url, headers } = req.body;

      // Create webhook in database
      const webhook = await webhookService.createWebhook({
        agent_id,
        event_type,
        url,
        headers: headers || null,
      });

      logger.info("Webhook created via API", {
        webhookId: webhook.id,
        userId,
        agentId: agent_id,
      });

      return successResponse(res, webhook, "Webhook created successfully", 201);
    } catch (error) {
      logger.error("Create webhook controller error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.id,
      });

      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return errorResponse(res, "Agent not found", 404);
        }
        if (error.message.includes("permission")) {
          return errorResponse(res, "Permission denied", 403);
        }
      }

      return errorResponse(res, "Failed to create webhook", 500);
    }
  }

  /**
   * Get webhook by ID
   */
  async getWebhook(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return errorResponse(res, "User not authenticated", 401);
      }

      // Check ownership
      const isOwner = await webhookService.isWebhookOwner(id, userId);
      if (!isOwner) {
        return errorResponse(res, "Webhook not found or access denied", 404);
      }

      const webhook = await webhookService.getWebhookById(id);
      if (!webhook) {
        return errorResponse(res, "Webhook not found", 404);
      }

      return successResponse(res, webhook, "Webhook retrieved successfully");
    } catch (error) {
      logger.error("Get webhook controller error", {
        error: error instanceof Error ? error.message : "Unknown error",
        webhookId: req.params.id,
        userId: req.user?.id,
      });

      return errorResponse(res, "Failed to get webhook", 500);
    }
  }

  /**
   * Get webhooks for an agent
   */
  async getAgentWebhooks(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      const { agentId } = req.params;
      const userId = req.user?.id;
      const { page = 1, limit = 10, event_type } = req.query;

      if (!userId) {
        return errorResponse(res, "User not authenticated", 401);
      }

      // TODO: Add agent ownership check here

      const result = await webhookService.getWebhooksByAgentId(agentId, {
        page: Number(page),
        limit: Number(limit),
        eventType: event_type as string,
      });

      return successResponse(res, result, "Webhooks retrieved successfully");
    } catch (error) {
      logger.error("Get agent webhooks controller error", {
        error: error instanceof Error ? error.message : "Unknown error",
        agentId: req.params.agentId,
        userId: req.user?.id,
      });

      return errorResponse(res, "Failed to get webhooks", 500);
    }
  }

  /**
   * Update webhook
   */
  async updateWebhook(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return errorResponse(res, "User not authenticated", 401);
      }

      // Check ownership
      const isOwner = await webhookService.isWebhookOwner(id, userId);
      if (!isOwner) {
        return errorResponse(res, "Webhook not found or access denied", 404);
      }

      const { event_type, url, headers } = req.body;
      const updateData: Partial<WebhookUpdate> = {};

      if (event_type !== undefined) updateData.event_type = event_type;
      if (url !== undefined) updateData.url = url;
      if (headers !== undefined) updateData.headers = headers;

      const webhook = await webhookService.updateWebhook(id, updateData);

      logger.info("Webhook updated via API", {
        webhookId: id,
        userId,
        updates: Object.keys(updateData),
      });

      return successResponse(res, webhook, "Webhook updated successfully");
    } catch (error) {
      logger.error("Update webhook controller error", {
        error: error instanceof Error ? error.message : "Unknown error",
        webhookId: req.params.id,
        userId: req.user?.id,
      });

      if (error instanceof Error && error.message.includes("not found")) {
        return errorResponse(res, "Webhook not found", 404);
      }

      return errorResponse(res, "Failed to update webhook", 500);
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return errorResponse(res, "User not authenticated", 401);
      }

      // Check ownership
      const isOwner = await webhookService.isWebhookOwner(id, userId);
      if (!isOwner) {
        return errorResponse(res, "Webhook not found or access denied", 404);
      }

      await webhookService.deleteWebhook(id);

      logger.info("Webhook deleted via API", {
        webhookId: id,
        userId,
      });

      return successResponse(res, null, "Webhook deleted successfully");
    } catch (error) {
      logger.error("Delete webhook controller error", {
        error: error instanceof Error ? error.message : "Unknown error",
        webhookId: req.params.id,
        userId: req.user?.id,
      });

      return errorResponse(res, "Failed to delete webhook", 500);
    }
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      const { provider } = req.params as { provider: WebhookProvider };
      const payload = JSON.stringify(req.body);
      const headers = req.headers as Record<string, string>;

      logger.info("Processing incoming webhook", {
        provider,
        payloadSize: payload.length,
        userAgent: headers["user-agent"],
        contentType: headers["content-type"],
      });

      // Process webhook using integration layer
      const result = await webhookApi.processWebhook(provider, payload, headers);

      if (result.success) {
        logger.info("Webhook processed successfully", {
          eventId: result.eventId,
          provider: result.provider,
          eventType: result.type,
          processingTime: result.processingTime,
        });

        return successResponse(
          res,
          {
            eventId: result.eventId,
            eventType: result.type,
            processingTime: result.processingTime,
          },
          "Webhook processed successfully"
        );
      } else {
        logger.warn("Webhook processing failed", {
          eventId: result.eventId,
          provider: result.provider,
          error: result.error,
          processingTime: result.processingTime,
        });

        return errorResponse(res, result.error || "Failed to process webhook", 400);
      }
    } catch (error) {
      logger.error("Process webhook controller error", {
        error: error instanceof Error ? error.message : "Unknown error",
        provider: req.params.provider,
      });

      return errorResponse(res, "Failed to process webhook", 500);
    }
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(req: Request, res: Response): Promise<Response> {
    try {
      const { agentId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return errorResponse(res, "User not authenticated", 401);
      }

      // TODO: Add agent ownership check here

      const stats = await webhookService.getWebhookStats(agentId);

      return successResponse(res, stats, "Webhook statistics retrieved successfully");
    } catch (error) {
      logger.error("Get webhook stats controller error", {
        error: error instanceof Error ? error.message : "Unknown error",
        agentId: req.params.agentId,
        userId: req.user?.id,
      });

      return errorResponse(res, "Failed to get webhook statistics", 500);
    }
  }

  /**
   * Search webhooks
   */
  async searchWebhooks(req: Request, res: Response): Promise<Response> {
    try {
      const { q: query } = req.query;
      const { page = 1, limit = 10 } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return errorResponse(res, "User not authenticated", 401);
      }

      if (!query || typeof query !== "string") {
        return errorResponse(res, "Search query is required", 400);
      }

      const result = await webhookService.searchWebhooks(query, userId, {
        page: Number(page),
        limit: Number(limit),
      });

      return successResponse(res, result, "Webhooks search completed");
    } catch (error) {
      logger.error("Search webhooks controller error", {
        error: error instanceof Error ? error.message : "Unknown error",
        query: req.query.q,
        userId: req.user?.id,
      });

      return errorResponse(res, "Failed to search webhooks", 500);
    }
  }

  /**
   * Test webhook
   */
  async testWebhook(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      const { id } = req.params;
      const userId = req.user?.id;
      const { test_data } = req.body;

      if (!userId) {
        return errorResponse(res, "User not authenticated", 401);
      }

      // Check ownership
      const isOwner = await webhookService.isWebhookOwner(id, userId);
      if (!isOwner) {
        return errorResponse(res, "Webhook not found or access denied", 404);
      }

      const webhook = await webhookService.getWebhookById(id);
      if (!webhook) {
        return errorResponse(res, "Webhook not found", 404);
      }

      // TODO: Implement webhook testing logic
      // This would involve making an HTTP request to the webhook URL
      // with test data and returning the results

      logger.info("Webhook test requested", {
        webhookId: id,
        userId,
        hasTestData: !!test_data,
      });

      return successResponse(
        res,
        {
          webhook_id: id,
          test_status: "pending",
          message: "Webhook test functionality coming soon",
        },
        "Webhook test initiated"
      );
    } catch (error) {
      logger.error("Test webhook controller error", {
        error: error instanceof Error ? error.message : "Unknown error",
        webhookId: req.params.id,
        userId: req.user?.id,
      });

      return errorResponse(res, "Failed to test webhook", 500);
    }
  }
}

// Create and export controller instance
export const webhookController = new WebhookController();

// Export individual methods for backward compatibility
export const {
  createWebhook,
  getWebhook,
  getAgentWebhooks,
  updateWebhook,
  deleteWebhook,
  processWebhook,
  getWebhookStats,
  searchWebhooks,
  testWebhook,
} = webhookController;

export default webhookController;
