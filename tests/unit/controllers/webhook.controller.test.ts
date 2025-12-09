/**
 * @file webhook.controller.test.ts
 * @description Unit tests for WebhookController
 */

import { Request, Response } from "express";
import { WebhookController } from "../../../src/controllers/webhook.controller";
import { webhookService } from "../../../src/services/webhook.service";
import { validationResult } from "express-validator";

// Mock dependencies
jest.mock("../../../src/services/webhook.service", () => ({
  webhookService: {
    createWebhook: jest.fn(),
    getWebhookById: jest.fn(),
    getWebhooksByAgentId: jest.fn(),
    updateWebhook: jest.fn(),
    deleteWebhook: jest.fn(),
    isWebhookOwner: jest.fn(),
  },
}));

jest.mock("../../../src/integrations/webhook.api", () => ({
  webhookApi: {
    sendWebhook: jest.fn(),
  },
}));

jest.mock("express-validator", () => ({
  validationResult: jest.fn(),
}));

jest.mock("../../../src/config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("../../../src/utils/webhookSignature", () => ({
  verifyWebhookSignature: jest.fn(),
  getSignatureHeaderName: jest.fn(),
  getTimestampHeaderName: jest.fn(),
}));

describe("WebhookController", () => {
  let webhookController: WebhookController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    role: "member" as const,
    password_hash: "hashed_password",
    avatar_url: null,
    phone: null,
    website: null,
    preferences: {},
    last_login: null,
    is_active: true,
    email_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockTenant = {
    id: "tenant-1",
    name: "Test Tenant",
    plan: "free" as const,
    status: "active" as const,
    role: "member" as const,
  };

  const mockWebhook = {
    id: "webhook-1",
    agent_id: "agent-1",
    event_type: "chat.completed",
    url: "https://example.com/webhook",
    headers: null,
    tenant_id: "tenant-1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    webhookController = new WebhookController();
    jest.clearAllMocks();

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockReq = {
      user: mockUser,
      tenant: mockTenant,
      body: {},
      params: {},
      query: {},
      headers: {},
    };

    (validationResult as unknown as jest.Mock).mockReturnValue({
      isEmpty: () => true,
      array: () => [],
    });
  });

  describe("createWebhook", () => {
    it("should create webhook successfully", async () => {
      mockReq.body = {
        agent_id: "agent-1",
        event_type: "chat.completed",
        url: "https://example.com/webhook",
      };
      (webhookService.createWebhook as jest.Mock).mockResolvedValue(mockWebhook);

      await webhookController.createWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Webhook created successfully",
        })
      );
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;

      await webhookController.createWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when tenant context missing", async () => {
      mockReq.tenant = undefined;

      await webhookController.createWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 when validation fails", async () => {
      (validationResult as unknown as jest.Mock).mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: "URL is required" }],
      });

      await webhookController.createWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe("getWebhook", () => {
    it("should return webhook successfully", async () => {
      mockReq.params = { id: "webhook-1" };
      (webhookService.isWebhookOwner as jest.Mock).mockResolvedValue(true);
      (webhookService.getWebhookById as jest.Mock).mockResolvedValue(mockWebhook);

      await webhookController.getWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Webhook retrieved successfully",
        })
      );
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { id: "webhook-1" };

      await webhookController.getWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when tenant context missing", async () => {
      mockReq.tenant = undefined;
      mockReq.params = { id: "webhook-1" };

      await webhookController.getWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 when webhook not found or access denied", async () => {
      mockReq.params = { id: "webhook-1" };
      (webhookService.isWebhookOwner as jest.Mock).mockResolvedValue(false);

      await webhookController.getWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe("getAgentWebhooks", () => {
    it("should return agent webhooks successfully", async () => {
      mockReq.params = { agentId: "agent-1" };
      mockReq.query = { page: "1", limit: "10" };
      const mockResult = {
        webhooks: [mockWebhook],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      (webhookService.getWebhooksByAgentId as jest.Mock).mockResolvedValue(mockResult);

      await webhookController.getAgentWebhooks(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { agentId: "agent-1" };

      await webhookController.getAgentWebhooks(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when tenant context missing", async () => {
      mockReq.tenant = undefined;
      mockReq.params = { agentId: "agent-1" };

      await webhookController.getAgentWebhooks(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe("updateWebhook", () => {
    it("should update webhook successfully", async () => {
      mockReq.params = { id: "webhook-1" };
      mockReq.body = { url: "https://example.com/new-webhook" };
      (webhookService.isWebhookOwner as jest.Mock).mockResolvedValue(true);
      (webhookService.updateWebhook as jest.Mock).mockResolvedValue({
        ...mockWebhook,
        url: "https://example.com/new-webhook",
      });

      await webhookController.updateWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Webhook updated successfully",
        })
      );
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { id: "webhook-1" };

      await webhookController.updateWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when tenant context missing", async () => {
      mockReq.tenant = undefined;
      mockReq.params = { id: "webhook-1" };

      await webhookController.updateWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 when webhook not found or access denied", async () => {
      mockReq.params = { id: "webhook-1" };
      (webhookService.isWebhookOwner as jest.Mock).mockResolvedValue(false);

      await webhookController.updateWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe("deleteWebhook", () => {
    it("should delete webhook successfully", async () => {
      mockReq.params = { id: "webhook-1" };
      (webhookService.isWebhookOwner as jest.Mock).mockResolvedValue(true);
      (webhookService.deleteWebhook as jest.Mock).mockResolvedValue(undefined);

      await webhookController.deleteWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Webhook deleted successfully",
        })
      );
    });

    it("should return 401 when user not authenticated", async () => {
      mockReq.user = undefined;
      mockReq.params = { id: "webhook-1" };

      await webhookController.deleteWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("should return 400 when tenant context missing", async () => {
      mockReq.tenant = undefined;
      mockReq.params = { id: "webhook-1" };

      await webhookController.deleteWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 when webhook not found or access denied", async () => {
      mockReq.params = { id: "webhook-1" };
      (webhookService.isWebhookOwner as jest.Mock).mockResolvedValue(false);

      await webhookController.deleteWebhook(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});
