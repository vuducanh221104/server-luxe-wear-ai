/**
 * @file webhook.service.test.ts
 * @description Unit tests for WebhookService
 */

import { WebhookService } from "../../../src/services/webhook.service";

// Mock dependencies
jest.mock("../../../src/config/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

jest.mock("../../../src/config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

import { supabaseAdmin } from "../../../src/config/supabase";

describe("WebhookService", () => {
  let webhookService: WebhookService;
  let dbResults: { data: unknown; error: unknown; count?: number };

  beforeEach(() => {
    webhookService = new WebhookService();
    dbResults = { data: null, error: null };

    // Reset mocks
    jest.clearAllMocks();

    // Setup chain mock
    const chainMock = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn(() => Promise.resolve(dbResults)),
      then: jest.fn((cb) => cb(dbResults)),
    };

    (supabaseAdmin.from as jest.Mock).mockReturnValue(chainMock);
  });

  describe("createWebhook", () => {
    it("should create webhook successfully", async () => {
      const mockWebhook = {
        id: "webhook-1",
        agent_id: "agent-1",
        tenant_id: "tenant-1",
        url: "https://example.com/webhook",
        event_type: "conversation.created",
      };

      dbResults = { data: mockWebhook, error: null };

      const result = await webhookService.createWebhook({
        agent_id: "agent-1",
        tenant_id: "tenant-1",
        url: "https://example.com/webhook",
        event_type: "conversation.created",
      });

      expect(result).toEqual(mockWebhook);
    });

    it("should throw error when create fails", async () => {
      dbResults = { data: null, error: { message: "DB error" } };

      await expect(
        webhookService.createWebhook({
          agent_id: "agent-1",
          tenant_id: "tenant-1",
          url: "https://example.com/webhook",
          event_type: "conversation.created",
        })
      ).rejects.toThrow("Failed to create webhook: DB error");
    });
  });

  describe("getWebhookById", () => {
    it("should return webhook when found", async () => {
      const mockWebhook = {
        id: "webhook-1",
        agent_id: "agent-1",
        url: "https://example.com/webhook",
      };

      dbResults = { data: mockWebhook, error: null };

      const result = await webhookService.getWebhookById("webhook-1");

      expect(result).toEqual(mockWebhook);
    });

    it("should return null when not found", async () => {
      dbResults = { data: null, error: { code: "PGRST116", message: "Not found" } };

      const result = await webhookService.getWebhookById("invalid-id");

      expect(result).toBeNull();
    });

    it("should throw error for other database errors", async () => {
      dbResults = { data: null, error: { code: "OTHER", message: "DB error" } };

      await expect(webhookService.getWebhookById("webhook-1")).rejects.toThrow(
        "Failed to get webhook: DB error"
      );
    });

    it("should filter by tenant ID when provided", async () => {
      const mockWebhook = { id: "webhook-1", tenant_id: "tenant-1" };
      dbResults = { data: mockWebhook, error: null };

      const result = await webhookService.getWebhookById("webhook-1", "tenant-1");

      expect(result).toEqual(mockWebhook);
    });
  });

  describe("getWebhooksByAgentId", () => {
    it("should return webhooks for agent", async () => {
      const mockWebhooks = [
        { id: "webhook-1", agent_id: "agent-1" },
        { id: "webhook-2", agent_id: "agent-1" },
      ];

      const chainMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn(() => Promise.resolve({ data: mockWebhooks, error: null, count: 2 })),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue(chainMock);

      const result = await webhookService.getWebhooksByAgentId("agent-1");

      expect(result.webhooks).toEqual(mockWebhooks);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it("should support pagination options", async () => {
      const chainMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue(chainMock);

      const result = await webhookService.getWebhooksByAgentId("agent-1", {
        page: 2,
        limit: 5,
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
    });

    it("should throw error when query fails", async () => {
      const chainMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn(() => Promise.resolve({ data: null, error: { message: "DB error" } })),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue(chainMock);

      await expect(webhookService.getWebhooksByAgentId("agent-1")).rejects.toThrow(
        "Failed to get webhooks: DB error"
      );
    });
  });

  describe("updateWebhook", () => {
    it("should update webhook successfully", async () => {
      const mockWebhook = {
        id: "webhook-1",
        url: "https://example.com/updated",
      };

      dbResults = { data: mockWebhook, error: null };

      const result = await webhookService.updateWebhook("webhook-1", {
        url: "https://example.com/updated",
      });

      expect(result).toEqual(mockWebhook);
    });

    it("should throw error when webhook not found", async () => {
      dbResults = { data: null, error: { code: "PGRST116", message: "Not found" } };

      await expect(
        webhookService.updateWebhook("invalid-id", { url: "https://example.com" })
      ).rejects.toThrow("Webhook not found");
    });

    it("should throw error when update fails", async () => {
      dbResults = { data: null, error: { code: "OTHER", message: "DB error" } };

      await expect(
        webhookService.updateWebhook("webhook-1", { url: "https://example.com" })
      ).rejects.toThrow("Failed to update webhook: DB error");
    });
  });

  describe("deleteWebhook", () => {
    it("should delete webhook successfully", async () => {
      const chainMock = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn(() => Promise.resolve({ error: null })),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue(chainMock);

      await expect(webhookService.deleteWebhook("webhook-1")).resolves.toBeUndefined();
    });

    it("should throw error when delete fails", async () => {
      const chainMock = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn(() => Promise.resolve({ error: { message: "DB error" } })),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue(chainMock);

      await expect(webhookService.deleteWebhook("webhook-1")).rejects.toThrow(
        "Failed to delete webhook: DB error"
      );
    });
  });

  describe("isWebhookOwner", () => {
    it("should return true when user owns webhook", async () => {
      const mockData = {
        agent_id: "agent-1",
        agents: [{ owner_id: "user-1" }],
      };

      dbResults = { data: mockData, error: null };

      const result = await webhookService.isWebhookOwner("webhook-1", "user-1");

      expect(result).toBe(true);
    });

    it("should return false when user does not own webhook", async () => {
      const mockData = {
        agent_id: "agent-1",
        agents: [{ owner_id: "other-user" }],
      };

      dbResults = { data: mockData, error: null };

      const result = await webhookService.isWebhookOwner("webhook-1", "user-1");

      expect(result).toBe(false);
    });

    it("should return false when webhook not found", async () => {
      dbResults = { data: null, error: { message: "Not found" } };

      const result = await webhookService.isWebhookOwner("invalid-id", "user-1");

      expect(result).toBe(false);
    });

    it("should return false when agents data is null", async () => {
      const mockData = {
        agent_id: "agent-1",
        agents: null,
      };

      dbResults = { data: mockData, error: null };

      const result = await webhookService.isWebhookOwner("webhook-1", "user-1");

      expect(result).toBe(false);
    });
  });

  describe("getWebhookStats", () => {
    it("should return webhook statistics", async () => {
      const now = new Date();
      const mockWebhooks = [
        {
          event_type: "conversation.created",
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
        {
          event_type: "conversation.created",
          created_at: new Date(now.getTime() - 86400000 * 2).toISOString(),
          updated_at: null,
        },
        {
          event_type: "message.sent",
          created_at: now.toISOString(),
          updated_at: null,
        },
      ];

      const chainMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn(() => Promise.resolve({ data: mockWebhooks, error: null })),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue(chainMock);

      const result = await webhookService.getWebhookStats("agent-1");

      expect(result.total).toBe(3);
      expect(result.byEventType?.["conversation.created"]).toBe(2);
      expect(result.byEventType?.["message.sent"]).toBe(1);
    });

    it("should throw error when query fails", async () => {
      const chainMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn(() => Promise.resolve({ data: null, error: { message: "DB error" } })),
      };

      (supabaseAdmin.from as jest.Mock).mockReturnValue(chainMock);

      await expect(webhookService.getWebhookStats("agent-1")).rejects.toThrow(
        "Failed to get webhook stats: DB error"
      );
    });
  });
});
