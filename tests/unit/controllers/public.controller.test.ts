/**
 * @file public.controller.test.ts
 * @description Unit tests for PublicController
 */

import { Request, Response } from "express";
import { PublicController } from "../../../src/controllers/public.controller";
import { validationResult } from "express-validator";

// Mock dependencies
jest.mock("express-validator", () => ({
  validationResult: jest.fn(),
}));

jest.mock("../../../src/config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("../../../src/config/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

jest.mock("../../../src/services/rag.service", () => ({
  chatWithRAGStream: jest.fn(),
}));

jest.mock("../../../src/integrations/gemini.api", () => ({
  geminiApi: {
    generateContent: jest.fn(),
  },
}));

describe("PublicController", () => {
  let publicController: PublicController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  const mockAgent = {
    id: "agent-1",
    name: "Test Agent",
    description: "A test agent",
    owner_id: "user-1",
    tenant_id: "tenant-1",
    config: {
      model: "gemini-pro",
      temperature: 0.7,
      maxTokens: 1024,
      systemPrompt: "You are a helpful assistant",
    },
    is_public: true,
    api_key: "test-api-key",
    allowed_origins: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    publicController = new PublicController();
    jest.clearAllMocks();

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };

    mockReq = {
      agent: mockAgent,
      body: {},
      params: {},
      query: {},
      get: jest.fn().mockReturnValue("http://localhost"),
      ip: "127.0.0.1",
    };

    (validationResult as unknown as jest.Mock).mockReturnValue({
      isEmpty: () => true,
      array: () => [],
    });
  });

  describe("getPublicAgentInfo", () => {
    it("should return public agent info successfully", async () => {
      await publicController.getPublicAgentInfo(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Agent information retrieved successfully",
        })
      );
    });

    it("should return 404 when agent not found", async () => {
      mockReq.agent = undefined;

      await publicController.getPublicAgentInfo(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("should expose only safe config properties", async () => {
      await publicController.getPublicAgentInfo(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            config: expect.objectContaining({
              model: "gemini-pro",
              temperature: 0.7,
              maxTokens: 1024,
            }),
          }),
        })
      );

      // Should NOT expose systemPrompt
      const jsonCall = (mockRes.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.data.config.systemPrompt).toBeUndefined();
    });
  });

  describe("publicHealthCheck", () => {
    it("should return health status", async () => {
      await publicController.publicHealthCheck(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Public API is healthy",
          data: expect.objectContaining({
            status: "ok",
            timestamp: expect.any(String),
            version: "1.0.0",
          }),
        })
      );
    });
  });

  describe("chatWithPublicAgent", () => {
    it("should return 400 when validation fails", async () => {
      (validationResult as unknown as jest.Mock).mockReturnValue({
        isEmpty: () => false,
        array: () => [{ msg: "Message is required" }],
      });

      await publicController.chatWithPublicAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should return 404 when agent not found", async () => {
      mockReq.agent = undefined;

      await publicController.chatWithPublicAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it("should set correct headers for streaming", async () => {
      mockReq.body = { message: "Hello" };
      const { supabaseAdmin } = require("../../../src/config/supabase");

      // Mock no knowledge base
      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ count: 0 }),
          }),
        }),
      });

      const { geminiApi } = require("../../../src/integrations/gemini.api");
      geminiApi.generateContent.mockImplementation(async function* () {
        yield "Response";
      });

      await publicController.chatWithPublicAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "text/plain; charset=utf-8");
    });

    it("should stream response without RAG when no knowledge base", async () => {
      mockReq.body = { message: "Hello" };
      const { supabaseAdmin } = require("../../../src/config/supabase");

      // Mock no knowledge base
      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ count: 0 }),
          }),
        }),
      });

      const { geminiApi } = require("../../../src/integrations/gemini.api");
      geminiApi.generateContent.mockImplementation(async function* () {
        yield "Hello ";
        yield "World";
      });

      await publicController.chatWithPublicAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.write).toHaveBeenCalledWith("Hello ");
      expect(mockRes.write).toHaveBeenCalledWith("World");
      expect(mockRes.end).toHaveBeenCalled();
    });

    it("should use RAG when knowledge base exists", async () => {
      mockReq.body = { message: "Hello" };
      const { supabaseAdmin } = require("../../../src/config/supabase");

      // Mock knowledge base exists
      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ count: 5 }),
          }),
        }),
      });

      const { chatWithRAGStream } = require("../../../src/services/rag.service");
      chatWithRAGStream.mockImplementation(async function* () {
        yield "RAG Response";
      });

      await publicController.chatWithPublicAgent(mockReq as Request, mockRes as Response);

      expect(chatWithRAGStream).toHaveBeenCalled();
      expect(mockRes.write).toHaveBeenCalledWith("RAG Response");
    });

    it("should include context in message when provided", async () => {
      mockReq.body = { message: "Hello", context: "Previous conversation" };
      const { supabaseAdmin } = require("../../../src/config/supabase");

      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ count: 0 }),
          }),
        }),
      });

      const { geminiApi } = require("../../../src/integrations/gemini.api");
      geminiApi.generateContent.mockImplementation(async function* () {
        yield "Response";
      });

      await publicController.chatWithPublicAgent(mockReq as Request, mockRes as Response);

      expect(geminiApi.generateContent).toHaveBeenCalledWith(
        expect.stringContaining("Previous conversation"),
        expect.any(Object)
      );
    });

    it("should handle streaming errors", async () => {
      mockReq.body = { message: "Hello" };
      const { supabaseAdmin } = require("../../../src/config/supabase");

      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ count: 0 }),
          }),
        }),
      });

      const { geminiApi } = require("../../../src/integrations/gemini.api");
      geminiApi.generateContent.mockImplementation(async function* () {
        throw new Error("Streaming error");
      });

      await publicController.chatWithPublicAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.end).toHaveBeenCalledWith("Error generating streaming AI response");
    });
  });
});
