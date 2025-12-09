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

jest.mock("../../../src/services/agent.service", () => ({
  agentService: {
    hasKnowledge: jest.fn(),
    logChatAnalytics: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../../src/services/rag.service", () => ({
  streamChatWithRAG: jest.fn(),
}));

jest.mock("../../../src/integrations/gemini.api", () => ({
  geminiApi: {
    streamGenerateContent: jest.fn(),
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
      headersSent: false,
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

    it("should set correct headers for SSE streaming", async () => {
      mockReq.body = { message: "Hello" };
      const { agentService } = require("../../../src/services/agent.service");
      agentService.hasKnowledge.mockResolvedValue(false);

      const { geminiApi } = require("../../../src/integrations/gemini.api");
      geminiApi.streamGenerateContent.mockImplementation(async function* () {
        yield "Response";
      });

      await publicController.chatWithPublicAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
      expect(mockRes.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
      expect(mockRes.setHeader).toHaveBeenCalledWith("Connection", "keep-alive");
    });

    it("should stream response in SSE format without RAG", async () => {
      mockReq.body = { message: "Hello" };
      const { agentService } = require("../../../src/services/agent.service");
      agentService.hasKnowledge.mockResolvedValue(false);

      const { geminiApi } = require("../../../src/integrations/gemini.api");
      geminiApi.streamGenerateContent.mockImplementation(async function* () {
        yield "Hello ";
        yield "World";
      });

      await publicController.chatWithPublicAgent(mockReq as Request, mockRes as Response);

      // SSE format: data: {JSON}\n\n
      expect(mockRes.write).toHaveBeenCalledWith('data: {"chunk":"Hello "}\n\n');
      expect(mockRes.write).toHaveBeenCalledWith('data: {"chunk":"World"}\n\n');
      expect(mockRes.write).toHaveBeenCalledWith('data: {"done":true}\n\n');
      expect(mockRes.end).toHaveBeenCalled();
    });

    it("should use RAG when knowledge base exists", async () => {
      mockReq.body = { message: "Hello" };
      const { agentService } = require("../../../src/services/agent.service");
      agentService.hasKnowledge.mockResolvedValue(true);

      const { streamChatWithRAG } = require("../../../src/services/rag.service");
      streamChatWithRAG.mockImplementation(async function* () {
        yield "RAG Response";
      });

      await publicController.chatWithPublicAgent(mockReq as Request, mockRes as Response);

      expect(streamChatWithRAG).toHaveBeenCalled();
      expect(mockRes.write).toHaveBeenCalledWith('data: {"chunk":"RAG Response"}\n\n');
    });

    it("should include context in message when provided", async () => {
      mockReq.body = { message: "Hello", context: "Previous conversation" };
      const { agentService } = require("../../../src/services/agent.service");
      agentService.hasKnowledge.mockResolvedValue(false);

      const { geminiApi } = require("../../../src/integrations/gemini.api");
      geminiApi.streamGenerateContent.mockImplementation(async function* () {
        yield "Response";
      });

      await publicController.chatWithPublicAgent(mockReq as Request, mockRes as Response);

      expect(geminiApi.streamGenerateContent).toHaveBeenCalledWith(
        expect.stringContaining("Previous conversation"),
        expect.any(Object)
      );
    });

    it("should handle streaming errors before headers sent", async () => {
      mockReq.body = { message: "Hello" };
      const { agentService } = require("../../../src/services/agent.service");
      agentService.hasKnowledge.mockRejectedValue(new Error("Service error"));

      await publicController.chatWithPublicAgent(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it("should send error event when streaming fails after headers sent", async () => {
      mockReq.body = { message: "Hello" };
      const { agentService } = require("../../../src/services/agent.service");
      agentService.hasKnowledge.mockResolvedValue(false);

      // Mock headersSent as true after setHeader is called
      let headersSent = false;
      mockRes.setHeader = jest.fn().mockImplementation(() => {
        headersSent = true;
      });
      Object.defineProperty(mockRes, "headersSent", {
        get: () => headersSent,
      });

      const { geminiApi } = require("../../../src/integrations/gemini.api");
      geminiApi.streamGenerateContent.mockImplementation(async function* () {
        yield "First chunk";
        throw new Error("Streaming error");
      });

      await publicController.chatWithPublicAgent(mockReq as Request, mockRes as Response);

      // Should have written first chunk then error
      expect(mockRes.write).toHaveBeenCalledWith('data: {"chunk":"First chunk"}\n\n');
      expect(mockRes.write).toHaveBeenCalledWith('data: {"error":"Stream failed"}\n\n');
      expect(mockRes.end).toHaveBeenCalled();
    });

    it("should log analytics asynchronously after completion", async () => {
      mockReq.body = { message: "Hello" };
      const { agentService } = require("../../../src/services/agent.service");
      agentService.hasKnowledge.mockResolvedValue(false);

      const { geminiApi } = require("../../../src/integrations/gemini.api");
      geminiApi.streamGenerateContent.mockImplementation(async function* () {
        yield "Response";
      });

      await publicController.chatWithPublicAgent(mockReq as Request, mockRes as Response);

      expect(agentService.logChatAnalytics).toHaveBeenCalledWith(
        "agent-1",
        "user-1",
        "tenant-1",
        "Hello",
        "Response"
      );
    });
  });
});
