/**
 * @file webhook.controller.ts
 * @description Controller for webhook management endpoints
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { webhookService } from "../services/webhook.service";
import { webhookApi } from "../integrations/webhook.api";
import { successResponse, errorResponse } from "../utils/response";
import { handleAsyncOperationStrict } from "../utils/errorHandler";
import logger from "../config/logger";
import {
  verifyWebhookSignature,
  getSignatureHeaderName,
  getTimestampHeaderName,
} from "../utils/webhookSignature";
import type { WebhookProvider, WebhookUpdate, WebhookSignatureConfig } from "../types/webhook";

/**
 * Webhook Controller Class
 * Object-based controller for webhook operations
 */
export class WebhookController {
  /**
   * Create a new webhook
   * @access User + Tenant Context
   */
  async createWebhook(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const userId = req.user?.id;
        if (!userId) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        const { agent_id, event_type, url, headers } = req.body;

        const webhook = await webhookService.createWebhook({
          agent_id,
          event_type,
          url,
          headers: headers || null,
          tenant_id: req.tenant.id,
        });

        logger.info("Webhook created via API", {
          webhookId: webhook.id,
          userId,
          tenantId: req.tenant.id,
          agentId: agent_id,
        });

        return successResponse(res, webhook, "Webhook created successfully", 201);
      },
      "create webhook",
      {
        context: {
          userId: req.user?.id,
          agentId: req.body?.agent_id,
          eventType: req.body?.event_type,
        },
      }
    );
  }

  /**
   * Get webhook by ID
   */
  async getWebhook(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { id } = req.params;
        const userId = req.user?.id;

        if (!userId) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        // Check ownership
        const isOwner = await webhookService.isWebhookOwner(id, userId, req.tenant!.id);
        if (!isOwner) {
          return errorResponse(res, "Webhook not found or access denied", 404);
        }

        const webhook = await webhookService.getWebhookById(id, req.tenant!.id);
        if (!webhook) {
          return errorResponse(res, "Webhook not found", 404);
        }

        return successResponse(res, webhook, "Webhook retrieved successfully");
      },
      "get webhook",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.tenant?.id,
          webhookId: req.params.id,
        },
      }
    );
  }

  /**
   * Get webhooks for an agent
   */
  async getAgentWebhooks(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
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

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        // TODO: Add agent ownership check here

        const result = await webhookService.getWebhooksByAgentId(
          agentId,
          {
            page: Number(page),
            limit: Number(limit),
            eventType: event_type as string,
          },
          req.tenant!.id
        );

        return successResponse(res, result, "Webhooks retrieved successfully");
      },
      "get agent webhooks",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.tenant?.id,
          agentId: req.params.agentId,
          page: req.query.page,
          limit: req.query.limit,
          eventType: req.query.event_type,
        },
      }
    );
  }

  /**
   * Update webhook
   */
  async updateWebhook(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { id } = req.params;
        const userId = req.user?.id;

        if (!userId) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        // Check ownership
        const isOwner = await webhookService.isWebhookOwner(id, userId, req.tenant!.id);
        if (!isOwner) {
          return errorResponse(res, "Webhook not found or access denied", 404);
        }

        const { event_type, url, headers } = req.body;
        const updateData: Partial<WebhookUpdate> = {};

        if (event_type !== undefined) updateData.event_type = event_type;
        if (url !== undefined) updateData.url = url;
        if (headers !== undefined) updateData.headers = headers;

        const webhook = await webhookService.updateWebhook(id, updateData, req.tenant!.id);

        logger.info("Webhook updated via API", {
          webhookId: id,
          userId,
          tenantId: req.tenant.id,
          updates: Object.keys(updateData),
        });

        return successResponse(res, webhook, "Webhook updated successfully");
      },
      "update webhook",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.tenant?.id,
          webhookId: req.params.id,
          updateFields: Object.keys(req.body || {}),
        },
      }
    );
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { id } = req.params;
        const userId = req.user?.id;

        if (!userId) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        // Check ownership
        const isOwner = await webhookService.isWebhookOwner(id, userId, req.tenant!.id);
        if (!isOwner) {
          return errorResponse(res, "Webhook not found or access denied", 404);
        }

        await webhookService.deleteWebhook(id, req.tenant!.id);

        logger.info("Webhook deleted via API", {
          webhookId: id,
          userId,
          tenantId: req.tenant.id,
        });

        return successResponse(res, null, "Webhook deleted successfully");
      },
      "delete webhook",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.tenant?.id,
          webhookId: req.params.id,
        },
      }
    );
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
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
          tenantId: req.tenant?.id,
        });

        // Verify signature if secret is configured
        const webhookSecret = process.env[`WEBHOOK_SECRET_${provider.toUpperCase()}`];
        if (webhookSecret) {
          const signatureHeaderName = getSignatureHeaderName(provider);
          const signature =
            headers[signatureHeaderName] || headers[signatureHeaderName.toLowerCase()];

          if (!signature) {
            logger.warn("Missing webhook signature", { provider });
            return errorResponse(res, "Missing webhook signature", 401);
          }

          const timestampHeaderName = getTimestampHeaderName(provider);
          const timestamp = timestampHeaderName
            ? headers[timestampHeaderName] || headers[timestampHeaderName.toLowerCase()]
            : undefined;

          const config: WebhookSignatureConfig = {
            provider,
            secret: webhookSecret,
          };

          const verificationResult = verifyWebhookSignature(payload, signature, config, timestamp);

          if (!verificationResult.valid) {
            logger.warn("Webhook signature verification failed", {
              provider,
              error: verificationResult.error,
            });
            return errorResponse(res, verificationResult.error || "Invalid signature", 401);
          }

          logger.info("Webhook signature verified", {
            provider,
            timestamp: verificationResult.timestamp,
          });
        }

        // Process webhook using integration layer
        const result = await webhookApi.processWebhook(provider, payload, headers);

        if (result.success) {
          logger.info("Webhook processed successfully", {
            eventId: result.eventId,
            provider: result.provider,
            eventType: result.type,
            processingTime: result.processingTime,
            tenantId: req.tenant?.id,
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
            tenantId: req.tenant?.id,
          });

          return errorResponse(res, result.error || "Failed to process webhook", 400);
        }
      },
      "process webhook",
      {
        context: {
          provider: req.params.provider,
          payloadSize: JSON.stringify(req.body).length,
        },
      }
    );
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const { agentId } = req.params;
        const userId = req.user?.id;

        if (!userId) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        // TODO: Add agent ownership check here

        const stats = await webhookService.getWebhookStats(agentId, req.tenant!.id);

        return successResponse(res, stats, "Webhook statistics retrieved successfully");
      },
      "get webhook stats",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.tenant?.id,
          agentId: req.params.agentId,
        },
      }
    );
  }

  /**
   * Search webhooks
   */
  async searchWebhooks(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const { q: query } = req.query;
        const { page = 1, limit = 10 } = req.query;
        const userId = req.user?.id;

        if (!userId) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        if (!query || typeof query !== "string") {
          return errorResponse(res, "Search query is required", 400);
        }

        const result = await webhookService.searchWebhooks(
          query,
          userId,
          {
            page: Number(page),
            limit: Number(limit),
          },
          req.tenant!.id
        );

        return successResponse(res, result, "Webhooks search completed");
      },
      "search webhooks",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.tenant?.id,
          query: req.query.q,
          page: req.query.page,
          limit: req.query.limit,
        },
      }
    );
  }

  /**
   * Verify webhook signature
   * POST /api/webhooks/verify-signature
   */
  async verifySignature(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { provider, payload, signature, secret } = req.body;

        if (!provider || !payload || !signature || !secret) {
          return errorResponse(
            res,
            "Missing required fields: provider, payload, signature, secret",
            400
          );
        }

        const config: WebhookSignatureConfig = {
          provider: provider as WebhookProvider,
          secret,
        };

        const result = verifyWebhookSignature(payload, signature, config);

        if (result.valid) {
          return successResponse(
            res,
            {
              valid: true,
              timestamp: result.timestamp,
              provider,
            },
            "Signature verified successfully"
          );
        } else {
          return errorResponse(res, result.error || "Signature verification failed", 401);
        }
      },
      "verify webhook signature",
      {
        context: {
          provider: req.body?.provider,
        },
      }
    );
  }

  /**
   * Test webhook
   */
  async testWebhook(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
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

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        // Check ownership
        const isOwner = await webhookService.isWebhookOwner(id, userId, req.tenant!.id);
        if (!isOwner) {
          return errorResponse(res, "Webhook not found or access denied", 404);
        }

        const webhook = await webhookService.getWebhookById(id, req.tenant!.id);
        if (!webhook) {
          return errorResponse(res, "Webhook not found", 404);
        }

        // TODO: Implement webhook testing logic
        // This would involve making an HTTP request to the webhook URL
        // with test data and returning the results

        logger.info("Webhook test requested", {
          webhookId: id,
          userId,
          tenantId: req.tenant.id,
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
      },
      "test webhook",
      {
        context: {
          userId: req.user?.id,
          webhookId: req.params.id,
          hasTestData: !!req.body?.test_data,
        },
      }
    );
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
  verifySignature,
  testWebhook,
} = webhookController;

export default webhookController;
